# P0-A Pre-Stabilization Safety Snapshot

## Verdict

- [قطعی] Snapshot خارجی پیش از هر edit در stabilization ساخته شد و داخل repository قرار نگرفت.
- [قطعی] binary patch با `git apply --numstat --binary` خوانده شد و دقیقاً ۱۱۷ فایل tracked را گزارش کرد.
- [قطعی] archive فایل‌های untracked با `tar -tf` خوانده شد و دقیقاً ۴۳ فایل مجاز را شامل شد.
- [قطعی] ۳۵ فایل قدیمی `docs/qa/launch/**`، build output، cache، `node_modules` و فایل‌های `.env` وارد snapshot نشدند.

## Identity

- Branch: `fix/p0-a-safety-consent-session-isolation-v1`
- HEAD/base: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- `origin/master`: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Created: `2026-07-12T23:26:28+03:30`

## External paths and hashes

- Snapshot root: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260712-232628`
- Bundle: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260712-232628\garnish-p0-a-pre-stabilization-snapshot.zip`
- Bundle SHA256: `86fcf9ad02173b4e3d3e2e3d302b9cd898d33a9aa584dd26e818f874fec29a11`
- Binary patch: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260712-232628\tracked-diff.binary.patch`
- Binary patch SHA256: `f18170cd3c2f44daf9a90201b87dc1d93132ad83b0d649fc092552268cd91d79`
- Untracked archive: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260712-232628\untracked-p0a-files.zip`

## Bundle contents

- `tracked-diff.binary.patch`
- `git-status.txt`
- `untracked-p0a-manifest.txt`
- `untracked-p0a-files.zip`
- `metadata.txt`
- `component-sha256.txt`

## Recovery note

[قطعی] این snapshot فقط recovery evidence است و نباید stage یا commit شود. برای بازیابی باید ابتدا یک worktree تمیز از base ساخته، binary patch اعمال و سپس archive untracked در root همان worktree استخراج شود؛ هیچ عملیات بازیابی روی worktree فعلی در این gate انجام نشده است.
