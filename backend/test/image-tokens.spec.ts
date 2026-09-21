import { calculateAttachmentTokens } from '../src/modules/chat/chat.service';

describe('calculateAttachmentTokens (Multimodal Image Token Calculation)', () => {
  it('returns 0 when attachments array is empty or undefined', () => {
    expect(calculateAttachmentTokens([])).toBe(0);
    expect(calculateAttachmentTokens(undefined as any)).toBe(0);
  });

  it('calculates image tokens based on dimensions (tiles formula: 85 base + 170 per tile)', () => {
    // 512x512 -> 1 tile -> 85 + 170 = 255
    const singleTile = [{
      fileType: 'image',
      metadata: { width: 512, height: 512 },
    }];
    expect(calculateAttachmentTokens(singleTile)).toBe(255);

    // 1024x1024 -> 2x2 = 4 tiles -> 85 + 4 * 170 = 765
    const fourTiles = [{
      fileType: 'image',
      metadata: { width: 1024, height: 1024 },
    }];
    expect(calculateAttachmentTokens(fourTiles)).toBe(765);

    // 1000x500 -> ceil(1000/512) * ceil(500/512) = 2 * 1 = 2 tiles -> 85 + 2 * 170 = 425
    const twoTiles = [{
      fileType: 'image',
      metadata: { width: 1000, height: 500 },
    }];
    expect(calculateAttachmentTokens(twoTiles)).toBe(425);
  });

  it('calculates image tokens based on file size when dimensions are missing', () => {
    // 100 KB -> 1 chunk (128 KB) -> 85 + 1 * 65 = 150
    const smallImage = [{
      fileType: 'image',
      fileSize: 100 * 1024,
    }];
    expect(calculateAttachmentTokens(smallImage)).toBe(150);

    // 256 KB -> 2 chunks -> 85 + 2 * 65 = 215
    const mediumImage = [{
      fileType: 'image',
      fileSize: 256 * 1024,
    }];
    expect(calculateAttachmentTokens(mediumImage)).toBe(215);
  });

  it('ignores unsupported non-document attachments', () => {
    const unsupported = [
      { fileType: 'audio', fileSize: 500 * 1024 },
      { fileType: 'archive', fileSize: 300 * 1024 },
    ];
    expect(calculateAttachmentTokens(unsupported)).toBe(0);
  });

  it('calculates document tokens for pdf and excel', () => {
    const pdfAndExcel = [
      { fileType: 'pdf', fileSize: 500 * 1024 },
      { fileType: 'excel', fileSize: 300 * 1024 },
    ];
    // (500 * 1024 / 500) * 100 = 102400
    // (300 * 1024 / 500) * 100 = 61440
    // Total = 163840
    expect(calculateAttachmentTokens(pdfAndExcel)).toBe(163840);
  });
});
