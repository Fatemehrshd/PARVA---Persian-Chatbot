import { BadRequestException } from '@nestjs/common';
import { assertModelSupportsAttachments } from '../src/modules/chat/chat.service';

describe('Attachment Capability Guards', () => {
  it('allows image when supportsVision is true', () => {
    expect(() => {
      assertModelSupportsAttachments(
        { supportsVision: true, supportsDocument: true },
        [{ fileType: 'image' }],
      );
    }).not.toThrow();
  });

  it('throws BadRequestException when model does not support vision', () => {
    expect(() => {
      assertModelSupportsAttachments(
        { supportsVision: false, supportsDocument: true },
        [{ fileType: 'image' }],
      );
    }).toThrow(new BadRequestException('مدل انتخابی از پردازش تصویر پشتیبانی نمی‌کند'));
  });

  it('allows documents when supportsDocument is true', () => {
    expect(() => {
      assertModelSupportsAttachments(
        { supportsVision: true, supportsDocument: true },
        [{ fileType: 'document' }],
      );
    }).not.toThrow();
  });

  it('throws BadRequestException when model does not support documents', () => {
    expect(() => {
      assertModelSupportsAttachments(
        { supportsVision: true, supportsDocument: false },
        [{ fileType: 'document' }],
      );
    }).toThrow(new BadRequestException('مدل انتخابی از تحلیل اسناد و فایل‌ها پشتیبانی نمی‌کند'));
  });

  it('does nothing if attachments list is empty', () => {
    expect(() => {
      assertModelSupportsAttachments(
        { supportsVision: false, supportsDocument: false },
        [],
      );
    }).not.toThrow();
  });
});
