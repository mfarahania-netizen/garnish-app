import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import './index.css'
import App from './App.jsx'

// شرط رو برمی‌داریم تا ببینیم واقعاً init اجرا میشه یا نه
posthog.init(
  import.meta.env.VITE_POSTHOG_KEY || 'phc_no4YAZLHfyjxDAappzGXTo5enLwuLG3UgfRE8Am6QdJ7',
  {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: false,
  }
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)