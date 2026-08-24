import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import App from './App';
import './index.css';

// Anti-inspect protection
if (typeof window !== 'undefined') {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    const fKeyNumber = e.key.startsWith('F') ? parseInt(e.key.substring(1), 10) : null;
    if (e.key === 'F12' || (fKeyNumber && fKeyNumber >= 1 && fKeyNumber <= 24)) {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C', 'k', 'K'].includes(e.key)) {
      e.preventDefault();
      return false;
    }
    if ((e.ctrlKey || e.metaKey) && ['u', 'U', 's', 'S', 'i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
      e.preventDefault();
      return false;
    }
  });
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
