import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, X, User, LogOut, Bookmark as BookmarkIcon, Settings as SettingsIcon, Shuffle, Bell } from 'lucide-react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { markNotificationAsRead, markAllNotificationsAsRead, clearAllNotifications } from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { searchAnime, getRandomAnime } from '../../services/jikanApi';
import SettingsModal from '../SettingsModal/SettingsModal';
import './Navbar.css';

function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Navbar({ onShowAuth }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { nsfw } = useSettings();
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [surpriseLoading, setSurpriseLoading] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);
  const notificationRef = useRef(null);

  const handleSurpriseMe = async () => {
    if (surpriseLoading) return;
    setSurpriseLoading(true);
    setDropdownOpen(false);
    try {
      const res = await getRandomAnime();
      if (res?.data?.mal_id) {
        navigate(`/anime/${res.data.mal_id}`);
      }
    } catch (err) {
      console.error('Failed to get a random anime:', err);
    } finally {
      setSurpriseLoading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchResults(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setNotificationOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time notifications listener
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const docRef = doc(db, 'notifications', user.uid);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const list = snap.data().notifications || [];
        const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
        setNotifications(sorted);
        setUnreadCount(sorted.filter(n => !n.read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    }, (err) => {
      console.error('Error listening to notifications:', err);
    });

    return () => unsubscribe();
  }, [isAuthenticated, user]);

  const handleNotificationClick = async (notif) => {
    setNotificationOpen(false);
    navigate(`/watch/${notif.animeId}/${notif.episode || '1'}`);
    if (!notif.read) {
      await markNotificationAsRead(user.uid, notif.id);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
  };

  const handleClearAll = async () => {
    if (!user) return;
    await clearAllNotifications(user.uid);
  };

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Realtime search with debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      Promise.resolve().then(() => {
        setSearchResults([]);
        setShowSearchResults(false);
      });
      return;
    }
    Promise.resolve().then(() => {
      setSearchLoading(true);
      setShowSearchResults(true);
    });
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchAnime({ q, limit: 6, sfw: !nsfw });
        setSearchResults(res?.data || []);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, nsfw]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/browse?q=${encodeURIComponent(trimmed)}`);
      setSearchQuery('');
      setShowSearchResults(false);
      setMobileOpen(false);
    }
  };

  const handleResultClick = (malId) => {
    navigate(`/anime/${malId}`);
    setSearchQuery('');
    setShowSearchResults(false);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const navItems = [
    { label: 'Home', to: '/home' },
    { label: 'Browse', to: '/browse' },
    { label: 'Schedule', to: '/schedule' },
    { label: 'Music', to: '/music' },
    { label: 'Torrent', to: '/torrent' },
    { label: 'Random', to: '/random' },
  ];

  const getInitial = () => {
    if (user?.displayName) return user.displayName.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <>
      <header className={`header-container${scrolled ? ' scrolled' : ''}`}>
        <nav className="navbar-capsule">
          <a href="/#" className="nav-logo">
            <span className="nav-logo-text">MioAnime</span>
          </a>

          <div className="nav-links">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="header-actions">
          {/* Realtime Search */}
          <div className="nav-search-wrapper" ref={searchRef}>
            <form className="nav-search" onSubmit={handleSearchSubmit}>
              <input type="text" placeholder="Search anime..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim().length >= 2) setShowSearchResults(true); }} />
              <Search size={16} className="nav-search-icon" />
            </form>

            {showSearchResults && (
              <div className="nav-search-dropdown">
                {searchLoading ? (
                  <div className="nav-search-loading">
                    <div className="spinner" style={{ width: 20, height: 20 }} />
                    <span>Searching...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    {searchResults.map((item) => (
                      <div key={item.mal_id} className="nav-search-result" onClick={() => handleResultClick(item.mal_id)}>
                        <img src={item.images?.jpg?.small_image_url || ''} alt={item.title} className="nav-search-result-img" />
                        <div className="nav-search-result-info">
                          <span className="nav-search-result-title">{item.title_english || item.title}</span>
                          <span className="nav-search-result-meta">
                            {item.type}{item.episodes ? ` • ${item.episodes} eps` : ''}{item.score ? ` • ★ ${item.score}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="nav-search-view-all" onClick={handleSearchSubmit}>
                      View all results for &ldquo;{searchQuery}&rdquo;
                    </button>
                  </>
                ) : (
                  <div className="nav-search-no-results">No results found</div>
                )}
              </div>
            )}
          </div>

          {/* Real-time Notifications Bell */}
          {isAuthenticated && (
            <div className="nav-notification-wrapper" ref={notificationRef}>
              <button
                className={`nav-notification-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setNotificationOpen(!notificationOpen)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>
              {notificationOpen && (
                <div className="nav-notification-dropdown">
                  <div className="notification-dropdown-header">
                    <span>Notifications</span>
                    <div className="notification-header-actions">
                      {unreadCount > 0 && (
                        <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                          Mark all as read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button className="clear-all-notifications-btn" onClick={handleClearAll}>
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="notification-dropdown-list">
                    {notifications.length > 0 ? (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notification-item ${n.read ? 'read' : 'unread'}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          {n.fromUserAvatar ? (
                            <img src={n.fromUserAvatar} alt="user avatar" className="notification-item-avatar" />
                          ) : (
                            <div className="notification-item-avatar-placeholder">
                              {n.fromUserName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="notification-item-content">
                            <p className="notification-item-text">
                              <strong>{n.fromUserName}</strong> replied to your comment on <em>{n.animeTitle}</em>: "{n.text}"
                            </p>
                            <span className="notification-item-time">{formatTimeAgo(n.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="notification-dropdown-empty">
                        <span>No notifications yet</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="nav-user" ref={dropdownRef}>
            <button className="nav-avatar nav-avatar--anonymous" onClick={() => setDropdownOpen(!dropdownOpen)} aria-label="User menu">
              {isAuthenticated && user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} />
              ) : isAuthenticated ? (
                getInitial()
              ) : (
                <User size={18} />
              )}
            </button>
             {dropdownOpen && (
              <div className="nav-dropdown">
                {isAuthenticated ? (
                  <button className="nav-dropdown-item" onClick={() => { navigate('/profile'); setDropdownOpen(false); }}>
                    <User size={15} /><span>{user?.displayName || user?.email || 'Profile'}</span>
                  </button>
                ) : (
                  <div className="nav-dropdown-item" style={{ pointerEvents: 'none', opacity: 0.7 }}>
                    <User size={15} /><span>Anonymous</span>
                  </div>
                )}
                <div className="nav-dropdown-divider" />
                <button className="nav-dropdown-item" onClick={() => { navigate('/bookmarks'); setDropdownOpen(false); }}>
                  <BookmarkIcon size={15} /><span>Bookmarks</span>
                </button>
                <div className="nav-dropdown-divider" />
                 <button className="nav-dropdown-item" onClick={() => { setSettingsOpen(true); setDropdownOpen(false); }}>
                  <SettingsIcon size={15} /><span>Settings</span>
                </button>

                <div className="nav-dropdown-divider" />
                {isAuthenticated ? (
                  <button className="nav-dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={15} /><span>Sign Out</span>
                  </button>
                ) : (
                  <button className="nav-dropdown-item" onClick={() => { onShowAuth(); setDropdownOpen(false); }}>
                    <LogOut size={15} style={{ transform: 'rotate(180deg)' }} /><span>Sign In</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <button className="nav-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <div className={`nav-menu-mobile${mobileOpen ? ' open' : ''}`}>
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={closeMobile}>
            {item.label}
          </NavLink>
        ))}
        <form className="nav-search" onSubmit={handleSearchSubmit}>
          <input type="text" placeholder="Search anime..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
          <Search size={16} className="nav-search-icon" />
        </form>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
