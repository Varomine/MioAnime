import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import App from './App';
import './index.css';

if (typeof window !== 'undefined') {
  // 1. Disable Right-Click Context Menu
  document.addEventListener('contextmenu', e => e.preventDefault());

  // 2. Disable Inspect & Source-Viewing Keyboard Shortcuts
  document.addEventListener('keydown', e => {
    // Block F12 and F1-F24 function keys
    const fKeyNumber = e.key.startsWith('F') ? parseInt(e.key.substring(1), 10) : null;
    if (e.key === 'F12' || (fKeyNumber && fKeyNumber >= 1 && fKeyNumber <= 24)) {
      e.preventDefault();
      return false;
    }

    // Block Ctrl/Cmd + Shift + I / J / C / K
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C', 'k', 'K'].includes(e.key)) {
      e.preventDefault();
      return false;
    }

    // Block Ctrl/Cmd + U (View Source), Ctrl/Cmd + S (Save Page), Ctrl/Cmd + I/J/C
    if ((e.ctrlKey || e.metaKey) && ['u', 'U', 's', 'S', 'i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
      e.preventDefault();
      return false;
    }
  });

  // 3. DevTools Detection & Protection
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
    console.clear();
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
