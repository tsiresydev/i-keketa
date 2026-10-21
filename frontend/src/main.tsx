import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* L'enregistrement du service worker est optionnel. */
    });
  });
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Élément racine #root introuvable.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
