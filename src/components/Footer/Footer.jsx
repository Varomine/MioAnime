import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Brand */}
        <a href="/#" className="footer-brand">
          MioAnime
        </a>

        {/* Copy */}
        <span className="footer-copy">
          &copy; {currentYear} MioAnime. All rights reserved.
        </span>

        {/* Disclaimer */}
        <p className="footer-disclaimer">
          This site does not store any files on its server. All contents are provided by non-affiliated third parties.
        </p>
      </div>
    </footer>
  );
}
