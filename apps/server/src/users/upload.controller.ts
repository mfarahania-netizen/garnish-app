import { Controller, Post, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { readFileSync, unlinkSync } from 'fs';

// SECURITY (advisor audit): never trust the client. The saved extension is SERVER-derived from an allowlisted
// MIME (not extname(originalname), which an attacker controls), the MIME is allowlisted (not a regex over
// spoofable input), and after the write we verify the real MAGIC BYTES — so a non-image with a spoofed image
// MIME is rejected + deleted. Combined with nosniff + CSP on the static route (main.ts), a stored-XSS /
// content-sniffing vector through /uploads is closed.
const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/** True only if the buffer's leading bytes match a real JPEG/PNG/GIF/WEBP signature. */
export function isImageMagic(buf: Buffer): boolean {
  if (!buf || buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const gif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38; // GIF8
  const webp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50; // WEBP
  return jpeg || png || gif || webp;
}

@Controller('upload')
export class UploadController {
  @UseGuards(AuthGuard('jwt'))
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(__dirname, '..', '..', 'uploads', 'avatars'),
      filename: (_req, file, callback) => {
        // SERVER-controlled extension from the allowlisted MIME — never the attacker-supplied originalname.
        const ext = MIME_EXT[file.mimetype] || '.bin';
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (!MIME_EXT[file.mimetype]) {
        return callback(new BadRequestException('Only JPEG/PNG/GIF/WebP images are allowed'), false);
      }
      callback(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // ۵ مگابایت
  }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file?.path) throw new BadRequestException('No file uploaded');
    // defense-in-depth: confirm the bytes are really an image (a spoofed MIME passes the filter but cannot
    // forge the magic bytes). Delete + reject anything that isn't.
    let head: Buffer;
    try {
      head = readFileSync(file.path).subarray(0, 12);
    } catch {
      throw new BadRequestException('Upload failed');
    }
    if (!isImageMagic(head)) {
      try { unlinkSync(file.path); } catch { /* best-effort cleanup */ }
      throw new BadRequestException('File content is not a valid image');
    }
    // در محیط واقعی، فایل را به CDN یا سرویس ذخیره‌سازی ارسال می‌کنیم
    return { avatarUrl: `/uploads/avatars/${file.filename}` };
  }
}
