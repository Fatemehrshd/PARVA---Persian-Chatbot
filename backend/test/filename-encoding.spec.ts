import { fixUtf8MangledString } from '../src/modules/files/files.service';

describe('Filename Encoding & Mojibake Resolution', () => {
  it('decodes Windows-1252 mangled Persian filenames correctly', () => {
    const mangled = 'Ø§ÛŒÙ† ÛŒÙ‡ pdf ØªØ³Øª Ù‡Ø³Øª Ù†Ø¸Ø±Øª Ú†ÛŒÙ‡.pdf';
    const expected = 'این یه pdf تست هست نظرت چیه.pdf';
    expect(fixUtf8MangledString(mangled)).toBe(expected);
  });

  it('decodes Latin-1 mangled Persian filenames correctly', () => {
    const mangled = 'Ø±Ø²ÙˆÙ…Ù‡_Ù…Ù‡Ø¯ÛŒØ§Ø±_ÙˆØ§Ø¹Ø¸_2026-09-14.pdf';
    const expected = 'رزومه_مهدیار_واعظ_2026-09-14.pdf';
    expect(fixUtf8MangledString(mangled)).toBe(expected);
  });

  it('preserves clean ASCII filenames intact', () => {
    const ascii = 'monthly_report_2026.pdf';
    expect(fixUtf8MangledString(ascii)).toBe(ascii);
  });

  it('preserves already-valid UTF-8 Persian filenames intact', () => {
    const persian = 'فایل_تستی_پروژه.pdf';
    expect(fixUtf8MangledString(persian)).toBe(persian);
  });

  it('handles empty or falsy inputs gracefully', () => {
    expect(fixUtf8MangledString('')).toBe('');
    expect(fixUtf8MangledString(null as any)).toBe(null);
    expect(fixUtf8MangledString(undefined as any)).toBe(undefined);
  });
});
