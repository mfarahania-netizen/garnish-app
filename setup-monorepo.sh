#!/bin/bash
set -e

echo "🚀 در حال ساخت ساختار مونورپو..."

# ───── ۱. ساخت پوشه‌ها ─────
mkdir -p apps/web
mkdir -p apps/server/src
mkdir -p packages/shared/data
mkdir -p packages/shared/src/types
mkdir -p packages/shared/src/constants
mkdir -p packages/config

# ───── ۲. انتقال فرانت‌اند به apps/web ─────
echo "📁 انتقال فایل‌های فرانت‌اند..."

[ -d "src" ]      && { git mv src apps/web/src 2>/dev/null || mv src apps/web/src; }
[ -d "public" ]   && { git mv public apps/web/public 2>/dev/null || mv public apps/web/public; }
[ -f "index.html" ] && { git mv index.html apps/web/index.html 2>/dev/null || mv index.html apps/web/index.html; }
[ -f "vite.config.js" ] && { git mv vite.config.js apps/web/vite.config.js 2>/dev/null || mv vite.config.js apps/web/vite.config.js; }

# پکیج‌جیسون اصلی رو می‌بریم توی وب
[ -f "package.json" ] && { git mv package.json apps/web/package.json 2>/dev/null || mv package.json apps/web/package.json; }

# ───── ۳. انتقال داده‌های JSON به پکیج اشتراکی ─────
echo "📊 انتقال داده‌ها..."

# recipes_clean.json
if [ -f "apps/web/src/recipes_clean.json" ]; then
  git mv apps/web/src/recipes_clean.json packages/shared/data/recipes_clean.json 2>/dev/null || mv apps/web/src/recipes_clean.json packages/shared/data/recipes_clean.json
fi

# recipes_metadata.json (اگه هست)
[ -f "apps/web/src/recipes_metadata.json" ] && { git mv apps/web/src/recipes_metadata.json packages/shared/data/recipes_metadata.json 2>/dev/null || mv apps/web/src/recipes_metadata.json packages/shared/data/recipes_metadata.json; }

# ingredients.json (اگه هست)
[ -f "apps/web/src/ingredients.json" ] && { git mv apps/web/src/ingredients.json packages/shared/data/ingredients.json 2>/dev/null || mv apps/web/src/ingredients.json packages/shared/data/ingredients.json; }

# ───── ۴. بایگانی سرور قدیمی Express ─────
echo "🗄️ بایگانی سرور قدیمی..."
[ -d "server" ] && mv server _old_server_backup

# ───── ۵. ساخت فایل‌های پیکربندی مونورپو ─────
echo "📝 ساخت فایل‌های تنظیمات..."

# root package.json
cat > package.json << 'ROOTPKG'
{
  "name": "garnish-os",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
  },
  "devDependencies": {
    "turbo": "^1.13.3",
    "prettier": "^3.2.5"
  },
  "packageManager": "pnpm@9.1.0",
  "engines": {
    "node": ">=18"
  }
}
ROOTPKG

# pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    }
  }
}
EOF

# .gitignore (اگر نباشد اضافه می‌کنه)
if [ ! -f .gitignore ]; then
  cat > .gitignore << 'GITIGNORE'
node_modules
dist
.env
*.log
GITIGNORE
fi

echo "✅ ساختار مونورپو با موفقیت ساخته شد!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "حالا دستور زیر رو اجرا کن تا وابستگی‌ها نصب بشن:"
echo "  pnpm install"