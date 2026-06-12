import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initAnalyticsIfConsented } from './lib/analytics-init'

// E4: do NOT initialize analytics here unconditionally. PostHog is started only
// if the user has previously granted consent (and only with an env-provided key,
// on the EU host). See src/lib/analytics-init.js and ConsentModal.jsx.
initAnalyticsIfConsented()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
