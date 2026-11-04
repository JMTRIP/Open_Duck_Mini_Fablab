import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Polices embarquées : le téléphone n'a pas Internet quand il est sur le Wi-Fi du canard.
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource/share-tech-mono/latin-400.css';
import './index.css';
import App from './App';
import { bloquerGestesNavigateur } from './lib/appareil';

bloquerGestesNavigateur();

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
