import { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import './SettingsModal.css';

export default function SettingsModal({ isOpen, onClose }) {
  const { theme, setTheme, defaultServer, setDefaultServer, nsfw, setNsfw } = useSettings();
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServerDropdownOpen(false);
      }
    };
    if (serverDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [serverDropdownOpen]);

  if (!isOpen) return null;

  const themes = [
    { id: 'luxury-gold', name: 'Luxury Gold', color: '#E4A85D', bg: '#0a0a0a' },
    { id: 'amoled-black', name: 'AMOLED Black', color: '#e5e5e5', bg: '#000000' },
    { id: 'sapphire-blue', name: 'Sapphire Blue', color: '#3b82f6', bg: '#07090f' },
    { id: 'emerald-green', name: 'Emerald Green', color: '#10b981', bg: '#080d0b' },
    { id: 'amethyst-purple', name: 'Amethyst Purple', color: '#8b5cf6', bg: '#0c0910' },
    { id: 'crimson-red', name: 'Crimson Red', color: '#ef4444', bg: '#0d0707' },
    { id: 'rose-gold', name: 'Rose Gold', color: '#fda4af', bg: '#0f0a0b' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="settings-modal-body">
          {/* Default Server Selection (Custom Dropdown like Genre) */}
          <div className="settings-section">
            <h3 className="settings-section-title">Default Streaming Server</h3>
            <p className="settings-section-desc">Choose your preferred source server for watch pages.</p>
            
            <div className="server-custom-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className={`server-custom-dropdown-btn ${serverDropdownOpen ? 'active' : ''}`}
                onClick={() => setServerDropdownOpen(prev => !prev)}
              >
                <span>{defaultServer === 'neko' ? 'Neko' : defaultServer === 'miko' ? 'Miko' : defaultServer === 'koto' ? 'Koto' : defaultServer === '123' ? '123' : defaultServer === 'allanime' ? 'AllAnime' : defaultServer === 'hanime' ? 'HAnime' : defaultServer === 'verse' ? 'Verse' : defaultServer === 'senshi' ? 'Senshi' : defaultServer === 'onsen' ? 'Onsen' : defaultServer === 'reanime' ? 'Re:Anime' : defaultServer === 'mio' ? 'Mio' : 'Zone'}</span>
                <ChevronDown size={16} className={`server-custom-dropdown-chevron ${serverDropdownOpen ? 'rotated' : ''}`} />
              </button>

              {serverDropdownOpen && (
                <div className="server-custom-dropdown-menu animate-scale-in">
                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'koto' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('koto');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'koto' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Koto <span className="server-dropdown-tag best">Fast</span><span className="server-dropdown-tag">EN</span><span className="server-dropdown-tag ads">Ads</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'neko' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('neko');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'neko' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Neko <span className="server-dropdown-tag best">Fast</span><span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'verse' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('verse');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'verse' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Verse <span className="server-dropdown-tag best">Fast</span><span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'senshi' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('senshi');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'senshi' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Senshi <span className="server-dropdown-tag best">Fast</span><span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'onsen' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('onsen');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'onsen' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Onsen <span className="server-dropdown-tag best">Fast</span><span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'reanime' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('reanime');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'reanime' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Re:Anime <span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'mio' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('mio');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'mio' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Mio <span className="server-dropdown-tag best">Fast</span><span className="server-dropdown-tag">TH</span></span>
                  </button>



                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === '123' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('123');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === '123' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>123 <span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'allanime' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('allanime');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'allanime' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>AllAnime <span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'zone' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('zone');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'zone' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>Zone <span className="server-dropdown-tag">EN</span></span>
                  </button>

                  <button
                    type="button"
                    className={`server-custom-dropdown-option ${defaultServer === 'hanime' ? 'selected' : ''}`}
                    onClick={() => {
                      setDefaultServer('hanime');
                      setServerDropdownOpen(false);
                    }}
                  >
                    <span className="server-option-check-box">
                      {defaultServer === 'hanime' && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span>HAnime <span className="server-dropdown-tag hentai">18+</span><span className="server-dropdown-tag">EN</span></span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="settings-divider" />

          {/* NSFW Content Toggle */}
          <div className="settings-section">
            <h3 className="settings-section-title">Content Filtering</h3>
            <p className="settings-section-desc">Toggle visibility of 18+ adult and Hentai anime content in search results.</p>
            
            <div className="settings-nsfw-toggle-container">
              <span className="settings-nsfw-label">Show 18+ (Hentai) Content</span>
              <button
                type="button"
                className={`settings-toggle-switch ${nsfw ? 'active' : ''}`}
                onClick={() => setNsfw(!nsfw)}
                aria-label="Toggle NSFW content visibility"
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>
          </div>

          <div className="settings-divider" />

          {/* Theme Selection */}
          <div className="settings-section">
            <h3 className="settings-section-title">Accent Color Theme</h3>
            <p className="settings-section-desc">Choose a primary color identity for the user interface.</p>
            <div className="theme-options-grid">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-option-card ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                  style={{ '--theme-preview-color': t.color, '--theme-preview-bg': t.bg }}
                >
                  <span className="theme-option-preview">
                    <span className="theme-accent-dot" />
                    {theme === t.id && (
                      <span className="theme-active-check">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="theme-option-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-modal-footer">
          <button className="btn btn-primary settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
