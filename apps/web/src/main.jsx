import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// GES v1 foundation (Phase 1): tokens first (CSS vars), legacy index.css, then base.css
// (resets/a11y/RTL helpers — consumes tokens, retires the legacy fixed-width #root).
import './styles/tokens.css'
import './index.css'
import './styles/base.css'
import App from './App.jsx'
import { initAnalyticsIfConsented } from './lib/analytics-init'
import { installPrivateCacheUpgradeGuard, purgeLegacyPrivateCaches } from './lib/private-session-cache'

async function bootstrap() {
  // An old worker may still recreate an authenticated API cache until the new
  // worker claims the page. Keep purging across the ownership transition.
  installPrivateCacheUpgradeGuard()
  // Purge legacy private caches before React children can issue account-scoped
  // requests. AuthProvider mount is intentionally too late for this boundary.
  await purgeLegacyPrivateCaches()
  initAnalyticsIfConsented()

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
