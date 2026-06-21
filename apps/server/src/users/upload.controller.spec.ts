import { isImageMagic } from './upload.controller';

const buf = (...bytes: number[]) => Buffer.from([...bytes, ...new Array(Math.max(0, 12 - bytes.length)).fill(0)]);

describe('isImageMagic — upload content validation (advisor audit)', () => {
  it('accepts real image signatures', () => {
    expect(isImageMagic(buf(0xff, 0xd8, 0xff, 0xe0))).toBe(true); // JPEG
    expect(isImageMagic(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true); // PNG
    expect(isImageMagic(buf(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(true); // GIF89a
    expect(isImageMagic(buf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe(true); // RIFF…WEBP
  });

  it('REJECTS a spoofed non-image (HTML/script bytes that passed a faked image MIME)', () => {
    expect(isImageMagic(Buffer.from('<!DOCTYPE html><script>alert(1)</script>'))).toBe(false);
    expect(isImageMagic(Buffer.from('<svg onload=alert(1)>'))).toBe(false);
    expect(isImageMagic(buf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20))).toBe(false); // RIFF but AVI, not WEBP
  });

  it('rejects empty / too-short buffers (never throws)', () => {
    expect(isImageMagic(Buffer.alloc(0))).toBe(false);
    expect(isImageMagic(Buffer.from([0xff, 0xd8]))).toBe(false); // truncated
    expect(isImageMagic(null as any)).toBe(false);
  });
});
