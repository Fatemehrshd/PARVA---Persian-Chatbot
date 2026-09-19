import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { tracedFetch } from '../../shared/traced-fetch';

export type TtsEngine = 'auto' | 'edge' | 'openai';

export interface SynthesizeOptions {
  text: string;
  engine?: TtsEngine;
  voice?: string;
  rate?: string;
  pitch?: string;
  model?: string;
}

export interface VoiceOption {
  id: string;
  shortName: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  lang?: string;
}

export interface EngineInfo {
  id: string;
  name: string;
  description: string;
  available: boolean;
  voices: VoiceOption[];
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  // Map friendly short names to Microsoft Edge Persian neural voices
  private resolveEdgeVoice(voice?: string): string {
    const v = (voice || '').toLowerCase();
    if (v === 'farid' || v.includes('farid')) {
      return 'fa-IR-FaridNeural';
    }
    // Default to Dilara (female, natural Persian voice)
    return 'fa-IR-DilaraNeural';
  }

  getAvailableEngines(): { engines: EngineInfo[]; defaultEngine: string; defaultVoice: string } {
    const hasOpenAi = !!(process.env.OPENAI_API_KEY || process.env.AI_PROVIDER_API_KEY);

    return {
      defaultEngine: 'edge',
      defaultVoice: 'dilara',
      engines: [
        {
          id: 'edge',
          name: 'Microsoft Edge Neural (پیش‌فرض هوشمند)',
          description: 'صدای طبیعی و استودیویی بدون نیاز به کلید، کاملاً بهینه‌شده برای لحن و تلفظ زبان فارسی',
          available: true,
          voices: [
            {
              id: 'fa-IR-DilaraNeural',
              shortName: 'dilara',
              name: 'دیلارام (صدای طبیعی زن)',
              gender: 'female',
              lang: 'fa-IR',
            },
            {
              id: 'fa-IR-FaridNeural',
              shortName: 'farid',
              name: 'فرید (صدای طبیعی مرد)',
              gender: 'male',
              lang: 'fa-IR',
            },
          ],
        },
        {
          id: 'openai',
          name: 'OpenAI / Compatible Speech API',
          description: 'سرویس صوت رسمی OpenAI و پرووایدرهای سازگار (مدل‌های tts-1 و tts-1-hd)',
          available: hasOpenAi,
          voices: [
            { id: 'nova', shortName: 'nova', name: 'Nova (زن)', gender: 'female' },
            { id: 'alloy', shortName: 'alloy', name: 'Alloy (خنثی)', gender: 'neutral' },
            { id: 'echo', shortName: 'echo', name: 'Echo (مرد)', gender: 'male' },
            { id: 'shimmer', shortName: 'shimmer', name: 'Shimmer (زن)', gender: 'female' },
          ],
        },
      ],
    };
  }

  private async synthesizeEdge(options: SynthesizeOptions): Promise<Readable> {
    const text = (options.text || '').trim();
    const selectedVoice = this.resolveEdgeVoice(options.voice);
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0Hz';

    // Locate tts_stream.py script across development and build environments
    const candidates = [
      path.resolve(__dirname, 'tts_stream.py'),
      path.resolve(__dirname, '../../src/modules/tts/tts_stream.py'),
      path.resolve(process.cwd(), 'src/modules/tts/tts_stream.py'),
      path.resolve(process.cwd(), 'dist/modules/tts/tts_stream.py'),
    ];
    const targetScript = candidates.find((p) => fs.existsSync(p)) || candidates[0];

    // Detect python executable (python or python3)
    const pythonCmd = process.env.PYTHON_BIN || 'python';

    return new Promise((resolve, reject) => {
      let resolved = false;
      const child = spawn(pythonCmd, [targetScript, selectedVoice, rate, pitch], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.on('error', (err) => {
        this.logger.error(`Failed to start python TTS process: ${err.message}`, err.stack);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      // Write text to stdin as UTF-8
      child.stdin.setDefaultEncoding('utf-8');
      child.stdin.write(text);
      child.stdin.end();

      // Collect stderr for debugging
      let stderrOutput = '';
      child.stderr.on('data', (chunk) => {
        stderrOutput += chunk.toString();
      });

      child.on('close', (code) => {
        if (code !== 0 && !resolved) {
          this.logger.warn(`TTS python process exited with code ${code}: ${stderrOutput}`);
          resolved = true;
          reject(new Error(`Edge TTS process failed with exit code ${code}: ${stderrOutput}`));
        }
      });

      // Resolve with stdout stream
      resolve(child.stdout);
    });
  }

  private async synthesizeOpenAi(options: SynthesizeOptions): Promise<Readable> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_PROVIDER_API_KEY;
    if (!apiKey) {
      throw new Error('کلید API برای موتور صوتی OpenAI تنظیم نشده است');
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${baseUrl}/audio/speech`;

    const voice = options.voice || 'nova';
    const model = options.model || 'tts-1';

    const response = await tracedFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: options.text,
        voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI TTS responded with ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('No audio body received from OpenAI TTS');
    }

    return Readable.fromWeb(response.body as any);
  }

  async synthesizeStream(options: SynthesizeOptions): Promise<Readable> {
    const text = (options.text || '').trim();
    if (!text) {
      throw new Error('Text is required for TTS synthesis');
    }

    const engine = (options.engine || 'auto').toLowerCase() as TtsEngine;

    if (engine === 'openai') {
      return this.synthesizeOpenAi(options);
    }

    if (engine === 'edge') {
      return this.synthesizeEdge(options);
    }

    // Default 'auto' mode: try Edge Neural first (studio-grade Persian quality and free)
    // If it fails or is blocked, seamlessly fall back to OpenAI TTS if available
    try {
      return await this.synthesizeEdge(options);
    } catch (edgeErr: any) {
      this.logger.warn(
        `Edge Neural TTS failed: ${edgeErr.message}. Attempting fallback to OpenAI TTS...`,
      );
      if (process.env.OPENAI_API_KEY || process.env.AI_PROVIDER_API_KEY) {
        try {
          return await this.synthesizeOpenAi(options);
        } catch (openAiErr: any) {
          this.logger.error(`OpenAI TTS fallback also failed: ${openAiErr.message}`);
        }
      }
      throw edgeErr;
    }
  }
}
