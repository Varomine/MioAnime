import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import App from './App';
import './index.css';

if (typeof window !== 'undefined') {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    // Block F12 and all extended function keys (F13-F24, which includes F18)
    const fKeyNumber = e.key.startsWith('F') ? parseInt(e.key.substring(1), 10) : null;
    if (e.key === 'F12' || (fKeyNumber && fKeyNumber >= 13 && fKeyNumber <= 24)) {
      e.preventDefault();
    }
    if (e.ctrlKey && (e.key === 'i' || e.key === 'I' || e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C' || e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C' || e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
    }
  });

  // Security: Detect DevTools activation, freeze execution, and redirect to Google
  const detectDevTools = () => {
    const startTime = performance.now();
    debugger;
    const endTime = performance.now();
    if (endTime - startTime > 100) {
      window.location.replace("https://google.com");
      return;
    }

    const element = new Image();
    Object.defineProperty(element, 'id', {
      get() {
        window.location.replace("https://google.com");
      }
    });
    console.log(element);
  };
  setInterval(detectDevTools, 1000);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
