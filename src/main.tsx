import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA service worker
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => console.log("PWA Service Worker registered successfully:", reg.scope))
      .catch((err) => console.error("PWA Service Worker registration failed:", err));
  });
} else if ("serviceWorker" in navigator) {
  // In development, also register service worker for testing install prompts
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => console.log("PWA Service Worker registered (dev):", reg.scope))
      .catch((err) => console.error("PWA Service Worker registration failed (dev):", err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
