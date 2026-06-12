import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Check, User, Save, Loader2, AlertCircle, Search } from 'lucide-react';
import { searchAnime, getAnimeCharacters } from '../../services/jikanApi';
import './Profile.css';

const AVATARS = [
  { name: 'Mio Akiyama', url: '/mio_favicon.png' },
  { name: 'Yui Hirasawa', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Yui' },
  { name: 'Ritsu Tainaka', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ritsu' },
  { name: 'Tsumugi Kotobuki', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mugi' },
  { name: 'Azusa Nakano', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Azusa' },
  { name: 'Son Goku', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Goku' },
  { name: 'Monkey D. Luffy', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luffy' },
  { name: 'Roronoa Zoro', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Zoro' },
  { name: 'Naruto Uzumaki', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Naruto' },
  { name: 'Kakashi Hatake', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Kakashi' }
];

const QUICK_ANIME = [
  { name: 'K-On!', id: 5680 },
  { name: 'Naruto', id: 20 },
  { name: 'One Piece', id: 21 },
  { name: 'Demon Slayer', id: 38000 },
  { name: 'Jujutsu Kaisen', id: 40748 },
  { name: 'Oshi no Ko', id: 52034 }
];

export default function Profile({ onShowAuth }) {
  const { user, isAuthenticated, updateUserProfile } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Character Search States
  const [avatarTab, setAvatarTab] = useState('default'); // 'default' or 'anime'
  const [animeSearchQuery, setAnimeSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingAnime, setSearchingAnime] = useState(false);
  const [selectedAnimeId, setSelectedAnimeId] = useState(null);
  const [loadedAnimeTitle, setLoadedAnimeTitle] = useState('');
  const [characters, setCharacters] = useState([]);
  const [fetchingCharacters, setFetchingCharacters] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setSelectedAvatar(user.photoURL || AVATARS[0].url);
    }
  }, [user]);

  // Auto-load K-On characters when switching to the anime tab for the first time
  useEffect(() => {
    if (avatarTab === 'anime' && !selectedAnimeId) {
      handleSelectAnime(5680, 'K-On!');
    }
  }, [avatarTab]);

  const handleAnimeSearch = async () => {
    if (!animeSearchQuery.trim()) return;
    setSearchingAnime(true);
    setError(null);
    setSearchResults([]);
    try {
      const res = await searchAnime({ q: animeSearchQuery.trim(), limit: 5 });
      const list = res.data || [];
      setSearchResults(list);
      if (list.length === 0) {
        setError('No anime found matching your query.');
      }
    } catch (err) {
      console.error('Failed to search anime:', err);
      setError('Failed to search anime. Please try again.');
    } finally {
      setSearchingAnime(false);
    }
  };

  const handleSelectAnime = async (animeId, animeTitle) => {
    setSelectedAnimeId(animeId);
    setLoadedAnimeTitle(animeTitle);
    setFetchingCharacters(true);
    setError(null);
    try {
      const res = await getAnimeCharacters(animeId);
      // Filter out characters without valid images and limit to top 15 characters
      const list = (res.data || [])
        .filter(char => char.character?.images?.jpg?.image_url && !char.character.images.jpg.image_url.includes('questionmark'))
        .slice(0, 15);
      setCharacters(list);
    } catch (err) {
      console.error('Failed to fetch characters:', err);
      setError('Failed to load character avatars.');
      setCharacters([]);
    } finally {
      setFetchingCharacters(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      setSaving(false);
      return;
    }

    try {
      const result = await updateUserProfile({
        displayName: displayName.trim(),
        photoURL: selectedAvatar
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        throw new Error(result.error || 'Failed to update profile.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  // If not authenticated, render login prompt
  if (!isAuthenticated) {
    return (
      <div className="profile-page page-content">
        <div className="profile-container container">
          <div className="profile-unauth-card glass-effect">
            <User size={48} className="profile-unauth-icon" />
            <h1 className="profile-unauth-title">Profile Settings</h1>
            <p className="profile-unauth-desc">Please sign in to view and customize your profile settings.</p>
            <button type="button" className="btn btn-primary" onClick={onShowAuth}>Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page page-content">
      <div className="profile-container container">
        <div className="profile-layout glass-effect">
          
          <div className="profile-header-section">
            <div className="profile-avatar-large">
              {selectedAvatar ? (
                <img src={selectedAvatar} alt="Current profile avatar" />
              ) : (
                <User size={36} />
              )}
            </div>
            <div className="profile-header-info">
              <h1 className="profile-title">{user.displayName || 'User Profile'}</h1>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            <div className="profile-form-group">
              <label htmlFor="profile-displayname-input">Display Name</label>
              <input
                id="profile-displayname-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name..."
                maxLength={40}
                required
                className="profile-input-field"
              />
            </div>

            <div className="profile-form-group">
              <label>Choose Avatar Type</label>
              <div className="profile-avatar-tabs">
                <button
                  type="button"
                  className={`profile-avatar-tab-btn ${avatarTab === 'default' ? 'active' : ''}`}
                  onClick={() => setAvatarTab('default')}
                >
                  Default Avatars
                </button>
                <button
                  type="button"
                  className={`profile-avatar-tab-btn ${avatarTab === 'anime' ? 'active' : ''}`}
                  onClick={() => setAvatarTab('anime')}
                >
                  Search Anime Characters
                </button>
              </div>
            </div>

            <div className="profile-form-group">
              {avatarTab === 'default' ? (
                <div className="profile-avatar-grid">
                  {AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`profile-avatar-option ${selectedAvatar === avatar.url ? 'active' : ''}`}
                      onClick={() => setSelectedAvatar(avatar.url)}
                      title={avatar.name}
                    >
                      <img src={avatar.url} alt={avatar.name} loading="lazy" />
                      {selectedAvatar === avatar.url && (
                        <span className="profile-avatar-checked">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="profile-anime-avatar-picker">
                  {/* Search Bar */}
                  <div className="profile-anime-search-bar">
                    <div className="profile-search-input-wrapper">
                      <input
                        type="text"
                        placeholder="Search anime (e.g. Naruto, K-On)..."
                        value={animeSearchQuery}
                        onChange={(e) => setAnimeSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAnimeSearch();
                          }
                        }}
                        className="profile-anime-search-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary profile-anime-search-btn"
                      onClick={handleAnimeSearch}
                      disabled={searchingAnime}
                    >
                      {searchingAnime ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </div>

                  {/* Popular quick chips */}
                  <div className="profile-quick-select">
                    <span className="profile-quick-label">Popular Shows:</span>
                    <div className="profile-quick-chips">
                      {QUICK_ANIME.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className={`profile-quick-chip ${selectedAnimeId === a.id ? 'active' : ''}`}
                          onClick={() => handleSelectAnime(a.id, a.name)}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Results list */}
                  {searchResults.length > 0 && (
                    <div className="profile-search-results">
                      <span className="profile-group-sublabel">Search Results:</span>
                      <div className="profile-search-results-list">
                        {searchResults.map((anime) => (
                          <button
                            key={anime.mal_id}
                            type="button"
                            className={`profile-search-result-item ${selectedAnimeId === anime.mal_id ? 'active' : ''}`}
                            onClick={() => handleSelectAnime(anime.mal_id, anime.title_english || anime.title)}
                          >
                            <img src={anime.images?.jpg?.small_image_url || anime.images?.jpg?.image_url} alt={anime.title} />
                            <div className="profile-search-result-info">
                              <span className="profile-search-result-title">{anime.title_english || anime.title}</span>
                              <span className="profile-search-result-type">{anime.type || 'TV'} • {anime.year || 'N/A'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Characters grid */}
                  {fetchingCharacters ? (
                    <div className="profile-characters-loading">
                      <Loader2 size={24} className="animate-spin" />
                      <span>Loading character avatars...</span>
                    </div>
                  ) : characters.length > 0 ? (
                    <div className="profile-characters-wrapper">
                      <span className="profile-group-sublabel">Avatars from {loadedAnimeTitle}:</span>
                      <div className="profile-characters-grid">
                        {characters.map((char, index) => {
                          const imgUrl = char.character.images?.jpg?.image_url;
                          return (
                            <button
                              key={index}
                              type="button"
                              className={`profile-avatar-option ${selectedAvatar === imgUrl ? 'active' : ''}`}
                              onClick={() => setSelectedAvatar(imgUrl)}
                              title={char.character.name}
                            >
                              <img src={imgUrl} alt={char.character.name} loading="lazy" />
                              {selectedAvatar === imgUrl && (
                                <span className="profile-avatar-checked">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              )}
                              <div className="profile-character-name-overlay">
                                <span>{char.character.name}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : selectedAnimeId ? (
                    <div className="profile-characters-empty">
                      <span>No characters found for this anime.</span>
                    </div>
                  ) : (
                    <div className="profile-characters-prompt">
                      <span>Search for an anime or select a popular show to view characters!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="profile-error-box">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="profile-success-box">
                <span>✓ Profile updated successfully!</span>
              </div>
            )}

            <div className="profile-form-actions">
              <button
                type="submit"
                className="btn btn-primary profile-save-btn"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
