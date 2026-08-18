import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { installImageFallback } from '@/lib/imageFallback'

// Global broken-image safety net. Installed before render so it catches
// failures from the very first paint (server rail icons, avatars, banners).
// One capture-phase listener covers every <img> in the app — including
// future ones — instead of 147 individual onError handlers.
installImageFallback()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
