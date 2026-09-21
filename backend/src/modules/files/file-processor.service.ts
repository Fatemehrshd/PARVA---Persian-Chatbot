import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileAttachment } from './file-attachment.entity';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../admin/settings.service';
import { telemetry } from '../../shared/telemetry';
import * as xlsx from 'xlsx';

// Helper function to extract text from PDF buffer supporting both pdf-parse v2 (class) and v1 (function)
async function parsePdfBuffer(buffer: Buffer): Promise<{ text: string; numpages: number; info?: any }> {
  const pdfModule = require('pdf-parse');
  if (typeof pdfModule.PDFParse === 'function') {
    const parser = new pdfModule.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const numpages = result.total || (Array.isArray(result.pages) ? result.pages.length : 1);
      return {
        text: (result.text || '').trim(),
        numpages,
        info: {},
      };
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy().catch(() => {});
      }
    }
  } else if (typeof pdfModule === 'function') {
    const result = await pdfModule(buffer);
    return {
      text: (result.text || '').trim(),
      numpages: result.numpages || 1,
      info: result.info || {},
    };
  } else if (typeof pdfModule.default === 'function') {
    const result = await pdfModule.default(buffer);
    return {
      text: (result.text || '').trim(),
      numpages: result.numpages || 1,
      info: result.info || {},
    };
  }
  throw new Error('قالب کتابخانه پردازش فایل پی‌دی‌اف معتبر نیست');
}

@Injectable()
export class FileProcessorService {
  private readonly logger = new Logger(FileProcessorService.name);

  constructor(
    @InjectRepository(FileAttachment)
    private readonly fileRepo: Repository<FileAttachment>,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Processes a single file attachment asynchronously according to its type.
   */
  async processFile(fileId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) {
      this.logger.warn(`File attachment ${fileId} not found for processing`);
      return;
    }

    file.status = 'processing';
    file.errorMessage = undefined;
    await this.fileRepo.save(file);

    const timeoutSec = Math.max(5, await this.getSettingNumber('file_processing_timeout_sec', 120));

    const processPromise = (async () => {
      const buffer = await this.storage.getBuffer(file.minioKey);

      switch (file.fileType) {
        case 'image':
          return await this.processImage(file, buffer);
        case 'pdf':
          return await this.processPdf(file, buffer);
        case 'excel':
          return await this.processExcel(file, buffer);
        case 'text':
          return await this.processText(file, buffer);
        default:
          throw new Error(`Unsupported file type: ${file.fileType}`);
      }
    })();

    // Timeout guard to prevent infinite processing
    let timeoutTimer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(
        () => reject(new Error('پردازش فایل به دلیل اتمام زمان مجاز با خطا مواجه شد')),
        timeoutSec * 1000,
      );
    });

    const startTime = Date.now();
    const span = telemetry.startSpan('file.process', {
      'file.id': file.id,
      'file.type': file.fileType,
      'file.name': file.originalName,
      'file.size': file.fileSize,
    });
    try {
      await Promise.race([processPromise, timeoutPromise]);
      file.status = 'ready';
      file.errorMessage = undefined;
      file.metadata = {
        ...(file.metadata || {}),
        processingDurationMs: Date.now() - startTime,
        traceId: span.traceId,
      };
      await this.fileRepo.save(file);
      span.end('ok');
      this.logger.log(`File ${file.id} (${file.originalName}) processed successfully in ${Date.now() - startTime}ms.`);
    } catch (err: any) {
      this.logger.error(`Error processing file ${file.id}: ${err?.message || err}`);
      file.status = 'error';
      file.errorMessage = err?.message || 'خطا در پردازش فایل';
      file.metadata = {
        ...(file.metadata || {}),
        processingDurationMs: Date.now() - startTime,
        errorDetails: err?.message || String(err),
        traceId: span.traceId,
      };
      await this.fileRepo.save(file);
      span.end('error', err?.message || 'خطا در پردازش فایل');
    } finally {
      clearTimeout(timeoutTimer!);
    }
  }

  /**
   * Processes image files for vision models.
   */
  private async processImage(file: FileAttachment, buffer: Buffer): Promise<void> {
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${file.mimeType};base64,${base64Data}`;

    file.metadata = {
      ...(file.metadata || {}),
      isVision: true,
      dataUrl,
      sizeBytes: buffer.length,
    };
    file.extractedText = `[تصویر پیوست شده: ${file.originalName}]`;
  }

  /**
   * Extracts text from PDF files and detects visual/scanned content heuristically.
   */
  private async processPdf(file: FileAttachment, buffer: Buffer): Promise<void> {
    const parsed = await parsePdfBuffer(buffer);
    const numPages = parsed.numpages || 1;
    const text = (parsed.text || '').trim();

    // Heuristic: low text density per page or embedded image stream signatures
    const avgCharsPerPage = text.length / Math.max(1, numPages);
    const hasImageStream =
      buffer.includes(Buffer.from('/Subtype /Image')) ||
      buffer.includes(Buffer.from('/DCTDecode')) ||
      buffer.includes(Buffer.from('/JPXDecode'));

    const hasVisualContent = avgCharsPerPage < 80 || hasImageStream;

    file.extractedText = text.length > 0 ? text : `[سند PDF شامل محتوای بصری و اسکن‌شده بدون لایه متنی مستقیم]`;
    file.metadata = {
      ...(file.metadata || {}),
      numPages,
      charCount: text.length,
      hasVisualContent,
      info: parsed.info || {},
    };
  }

  /**
   * Parses Excel workbooks into structured Markdown/CSV or samples data if row count exceeds limit.
   */
  private async processExcel(file: FileAttachment, buffer: Buffer): Promise<void> {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const maxRows = await this.getSettingNumber('excel_max_rows', 5000);

    const sheetSummaries: string[] = [];
    let totalRowsAcrossSheets = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      const jsonData: any[][] = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      const rowCount = jsonData.length;
      totalRowsAcrossSheets += rowCount;

      sheetSummaries.push(`\n### برگه (Sheet): ${sheetName} (تعداد کل سطرها: ${rowCount})`);

      if (rowCount <= maxRows) {
        // Output complete CSV/table representation
        const csv = xlsx.utils.sheet_to_csv(worksheet);
        sheetSummaries.push(csv);
      } else {
        // Summarize: sample head rows + column statistics
        const sampleRows = jsonData.slice(0, 50);
        const headers = (jsonData[0] || []).map((h, i) => String(h || `ستون_${i + 1}`));

        // Column statistics
        const colStats = headers.map((header, colIdx) => {
          let nonEmptyCount = 0;
          const uniqueValues = new Set<string>();
          for (let r = 1; r < rowCount; r++) {
            const cell = jsonData[r]?.[colIdx];
            if (cell !== undefined && cell !== null && String(cell).trim() !== '') {
              nonEmptyCount++;
              if (uniqueValues.size < 10) uniqueValues.add(String(cell));
            }
          }
          return `- **${header}**: تعداد رکوردهای پر: ${nonEmptyCount} از ${rowCount - 1} | نمونه مقادیر: [${Array.from(uniqueValues).slice(0, 5).join(', ')}]`;
        });

        sheetSummaries.push(
          `> [!NOTE]\n> تعداد سطرهای این برگه (${rowCount}) از سقف مجاز (${maxRows}) بیشتر است. نمونه ۵۰ سطر نخست و خلاصه آماری ستون‌ها در ادامه آورده شده است:\n`,
        );
        sheetSummaries.push('#### آمار ستون‌ها:\n' + colStats.join('\n'));
        sheetSummaries.push(
          '\n#### نمونه ۵۰ سطر نخست:\n' +
            sampleRows.map((row) => row.join('\t')).join('\n'),
        );
      }
    }

    file.extractedText = sheetSummaries.join('\n\n');
    file.metadata = {
      ...(file.metadata || {}),
      sheets: workbook.SheetNames,
      totalRows: totalRowsAcrossSheets,
      isSampled: totalRowsAcrossSheets > maxRows,
    };
  }

  /**
   * Processes plain text and Markdown files.
   */
  private async processText(file: FileAttachment, buffer: Buffer): Promise<void> {
    const text = buffer.toString('utf-8');
    const maxChars = await this.getSettingNumber('text_max_chars', 100000);

    const isTruncated = text.length > maxChars;
    const effectiveText = isTruncated ? text.slice(0, maxChars) : text;

    file.extractedText = effectiveText;
    file.metadata = {
      ...(file.metadata || {}),
      charCount: text.length,
      isTruncated,
      format: file.originalName.toLowerCase().endsWith('.md') ? 'markdown' : 'text',
    };
  }

  private async getSettingNumber(key: string, defaultValue: number): Promise<number> {
    try {
      const val = await this.settings.get(key, String(defaultValue));
      if (val && typeof val === 'string' && val.trim() !== '') {
        const parsed = Number(val);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultValue;
  }
}
