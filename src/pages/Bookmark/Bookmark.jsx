import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark as BookmarkIcon, Trash2, Search, Filter, LogIn, Heart, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getBookmarks, removeBookmark, updateBookmarkCategory } from '../../services/bookmarkService';
import './Bookmark.css';

const CATEGORIES = ['All', 'Watching', 'Plan to Watch', 'Completed', 'Dropped', 'On Hold'];

function BookmarkCardSkeleton() {
  return (
    <div className="bookmark-card bookmark-card-skeleton">
      <div className="bookmark-card-poster skeleton" />
      <div className="bookmark-card-body">
        <div className="skeleton skeleton-title" style={{ width: '80%' }} />
        <div className="skeleton skeleton-text" style={{ width: '50%' }} />
      </div>
    </div>
  );
}

export default function Bookmark({ onShowAuth }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [bookmarks, setBookmarks] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    await Promise.resolve();
    try {
      setLoading(true);
      const data = await getBookmarks(user.uid);
      setBookmarks(data);
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.resolve().then(() => fetchBookmarks());
    } else {
      Promise.resolve().then(() => setLoading(false));
    }
  }, [isAuthenticated, fetchBookmarks]);

  const handleRemove = async (e, animeId) => {
    e.stopPropagation();
    if (!user) return;
    const success = await removeBookmark(user.uid, animeId);
    if (success) {
      setBookmarks((prev) => prev.filter((b) => b.mal_id !== animeId));
    }
  };

  const handleCategoryChange = async (e, animeId, newCategory) => {
    e.stopPropagation();
    if (!user) return;
    const success = await updateBookmarkCategory(user.uid, animeId, newCategory);
    if (success) {
      setBookmarks((prev) =>
        prev.map((b) =>
          b.mal_id === animeId ? { ...b, category: newCategory } : b
        )
      );
    }
    setOpenDropdownId(null);
  };

  const toggleDropdown = (e, id) => {
    e.stopPropagation();
    setOpenDropdownId((prev) => (prev === id ? null : id));
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (openDropdownId === null) return;
    const handler = () => setOpenDropdownId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openDropdownId]);

  const filteredBookmarks = useMemo(() => {
    let list = bookmarks;

    if (activeCategory !== 'All') {
      list = list.filter((b) => b.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          (b.title || '').toLowerCase().includes(q) ||
          (b.title_english || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [bookmarks, activeCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts = { All: bookmarks.length };
    CATEGORIES.slice(1).forEach((cat) => {
      counts[cat] = bookmarks.filter((b) => b.category === cat).length;
    });
    return counts;
  }, [bookmarks]);

  // --- Unauthenticated State ---
  if (!isAuthenticated) {
    return (
      <div className="bookmark-page page-content">
        <div className="container">
          <div className="bookmark-login-prompt animate-fade-in-up">
            <div className="bookmark-login-glow" />
            <div className="bookmark-login-icon-wrapper">
              <Heart size={48} className="bookmark-login-icon" />
            </div>
            <h2 className="bookmark-login-title">Your Collection Awaits</h2>
            <p className="bookmark-login-text">
              Sign in to save your favorite anime, track your progress, and build your personal watchlist.
            </p>
            <button
              className="btn btn-primary bookmark-login-btn"
              onClick={onShowAuth}
            >
              <LogIn size={18} />
              Sign In to Continue
            </button>
            <div className="bookmark-login-features">
              <div className="bookmark-login-feature">
                <BookmarkIcon size={16} />
                <span>Sync across devices</span>
              </div>
              <div className="bookmark-login-feature">
                <Filter size={16} />
                <span>Organize by category</span>
              </div>
              <div className="bookmark-login-feature">
                <Search size={16} />
                <span>Quick search & filter</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Authenticated State ---
  return (
    <div className="bookmark-page page-content">
      <div className="container">
        {/* Header */}
        <div className="bookmark-header animate-fade-in-up">
          <div className="bookmark-header-left">
            <h1 className="bookmark-title">
              <BookmarkIcon size={28} className="bookmark-title-icon" />
              My Bookmarks
            </h1>
            <p className="bookmark-subtitle">
              {bookmarks.length} anime in your collection
            </p>
          </div>

          <div className="bookmark-search-wrapper">
            <Search size={16} className="bookmark-search-icon" />
            <input
              type="text"
              className="bookmark-search"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="bookmark-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bookmark-tabs-wrapper animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="bookmark-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`bookmark-tab${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
                <span className="bookmark-tab-count">{categoryCounts[cat] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="bookmark-content" key={activeCategory}>
          {loading ? (
            <div className="bookmark-grid anime-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <BookmarkCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="bookmark-empty empty-state">
              <BookmarkIcon size={48} className="empty-state-icon" />
              <p className="empty-state-title">
                {searchQuery
                  ? 'No results found'
                  : activeCategory === 'All'
                  ? 'No bookmarks yet'
                  : `No anime in "${activeCategory}"`}
              </p>
              <p className="empty-state-text">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Browse anime and add them to your collection.'}
              </p>
            </div>
          ) : (
            <div className="bookmark-grid anime-grid">
              {filteredBookmarks.map((item, index) => (
                <div
                  key={item.mal_id}
                  className="bookmark-card"
                  onClick={() => navigate(`/anime/${item.mal_id}`)}
                  style={{ animationDelay: `${index * 0.04}s` }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/anime/${item.mal_id}`)}
                >
                  <div className="bookmark-card-poster-wrapper">
                    <img
                      className="bookmark-card-poster"
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                    />

                    {/* Overlay Actions */}
                    <div className="bookmark-card-overlay">
                      <button
                        className="bookmark-card-remove"
                        onClick={(e) => handleRemove(e, item.mal_id)}
                        aria-label="Remove bookmark"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Category Badge */}
                    <span className="bookmark-card-category">
                      {item.category}
                    </span>

                    {/* Score */}
                    {item.score > 0 && (
                      <span className="bookmark-card-score">
                        ★ {item.score}
                      </span>
                    )}
                  </div>

                  <div className="bookmark-card-body">
                    <h3 className="bookmark-card-title" title={item.title}>
                      {item.title}
                    </h3>
                    <div className="bookmark-card-footer">
                      <span className="bookmark-card-type">{item.type}</span>

                      {/* Category dropdown */}
                      <div className="bookmark-card-dropdown-wrapper">
                        <button
                          className="bookmark-card-dropdown-trigger"
                          onClick={(e) => toggleDropdown(e, item.mal_id)}
                          aria-label="Change category"
                          title="Change category"
                        >
                          <ChevronDown size={14} />
                        </button>
                        {openDropdownId === item.mal_id && (
                          <div className="bookmark-card-dropdown" onClick={(e) => e.stopPropagation()}>
                            {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                              <button
                                key={cat}
                                className={`bookmark-dropdown-item${item.category === cat ? ' active' : ''}`}
                                onClick={(e) => handleCategoryChange(e, item.mal_id, cat)}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
