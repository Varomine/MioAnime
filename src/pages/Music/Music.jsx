import { useState, useEffect, useMemo } from 'react';
import { Search, Play, Music as MusicIcon, ChevronLeft, Calendar, Disc, User, Loader2, AlertCircle } from 'lucide-react';
import HlsPlayer from '../../components/HlsPlayer/HlsPlayer';
import './Music.css';

export default function Music() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Lists
  const [featuredAnime, setFeaturedAnime] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Selected Anime and Themes Details
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [themes, setThemes] = useState([]);
  const [currentTheme, setCurrentTheme] = useState(null);
  const [activeTab, setActiveTab] = useState('OP'); // 'OP' or 'ED'

  // Fetch featured anime on load
  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch 12 anime with images
        const res = await fetch('https://api.animethemes.moe/anime?page[size]=12&include=images');
        if (!res.ok) throw new Error('Failed to fetch featured themes.');
        const json = await res.json();
        setFeaturedAnime(json.anime || []);
      } catch (err) {
        console.error('Featured themes fetch error:', err);
        setError('Failed to load initial themes list. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setHasSearched(false);
      setSearchResults([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    setSelectedAnime(null);
    try {
      // Search matching anime names and include images in a single call to prevent latency & Cloudflare blocks
      const res = await fetch(`https://api.animethemes.moe/search?q=${encodeURIComponent(query)}&fields[search]=anime&include[anime]=images`);
      if (!res.ok) throw new Error('Search failed.');
      const json = await res.json();
      const searchAnimeList = json.search?.anime || [];
      
      setSearchResults(searchAnimeList);
      setHasSearched(true);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search anime themes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnime = async (anime) => {
    setDetailsLoading(true);
    setError(null);
    setSelectedAnime(anime);
    setCurrentTheme(null);
    try {
      // Fetch details using slug
      const res = await fetch(`https://api.animethemes.moe/anime/${anime.slug}?include=animethemes.song.artists,animethemes.animethemeentries.videos,images`);
      if (!res.ok) throw new Error('Failed to load anime theme details.');
      const json = await res.json();
      const animeDetails = json.anime;
      
      if (animeDetails) {
        setSelectedAnime(animeDetails);
        const animethemes = animeDetails.animethemes || [];
        setThemes(animethemes);
        
        // Auto-select first opening or theme
        const ops = animethemes.filter(t => t.type?.startsWith('OP'));
        const eds = animethemes.filter(t => t.type?.startsWith('ED'));
        
        if (ops.length > 0) {
          setActiveTab('OP');
          setCurrentTheme(ops[0]);
        } else if (eds.length > 0) {
          setActiveTab('ED');
          setCurrentTheme(eds[0]);
        } else if (animethemes.length > 0) {
          setActiveTab('OP');
          setCurrentTheme(animethemes[0]);
        }
      }
    } catch (err) {
      console.error('Details fetch error:', err);
      setError('Could not load themes for this anime. Please try again.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handlePlayTheme = (theme) => {
    setCurrentTheme(theme);
  };

  const handleBackToList = () => {
    setSelectedAnime(null);
    setThemes([]);
    setCurrentTheme(null);
  };

  // Get anime cover image with local placeholder fallback
  const getCoverImage = (animeItem) => {
    if (!animeItem) return '/music_placeholder.png';
    const images = animeItem.images || [];
    const large = images.find(img => img.facet === 'Large Cover');
    if (large) return large.link;
    const small = images.find(img => img.facet === 'Small Cover');
    if (small) return small.link;
    return '/music_placeholder.png';
  };

  const filteredThemes = themes.filter(t => {
    if (activeTab === 'OP') return t.type?.startsWith('OP');
    return t.type?.startsWith('ED');
  });

  const currentVideoUrl = currentTheme?.animethemeentries?.[0]?.videos?.[0]?.link || '';

  const playerSources = useMemo(() => {
    return currentVideoUrl ? [{ quality: '1080p', streamUrl: currentVideoUrl }] : [];
  }, [currentVideoUrl]);

  return (
    <div className="music-page page-content container">
      {/* Header banner */}
      <div className="music-header">
        <h1 className="music-page-title">Anime Themes</h1>
        <p className="music-page-subtitle">Listen and watch clean Opening and Ending credits of your favorite anime series</p>
      </div>

      {/* Search Input bar */}
      {!selectedAnime && (
        <form className="music-search-bar" onSubmit={handleSearchSubmit}>
          <div className="music-input-wrapper">
            <input
              type="text"
              placeholder="Search anime themes (e.g. Naruto, Bleach, Attack on Titan)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="music-search-input"
            />
            <Search className="music-search-icon" size={18} />
            {searchQuery && (
              <button
                type="button"
                className="music-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setHasSearched(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
          <button type="submit" className="btn btn-primary music-search-submit-btn">
            Search
          </button>
        </form>
      )}

      {/* Error state */}
      {error && (
        <div className="music-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="page-loader">
          <div className="spinner"></div>
          <p className="page-loader-text">Fetching themes...</p>
        </div>
      )}

      {/* Details/Player View */}
      {selectedAnime && (
        <div className="music-player-layout animate-fade-in">
          {/* Back button */}
          <button className="btn btn-secondary music-back-btn" onClick={handleBackToList}>
            <ChevronLeft size={16} /> Back to List
          </button>

          {detailsLoading ? (
            <div className="music-details-loader">
              <Loader2 className="animate-spin" size={32} />
              <span>Loading theme videos...</span>
            </div>
          ) : (
            <div className="music-player-container">
              {/* Left Side: Custom HlsPlayer */}
              <div className="music-player-main">
                {currentVideoUrl ? (
                  <div className="music-video-wrapper">
                    <HlsPlayer
                      sources={playerSources}
                      poster={getCoverImage(selectedAnime)}
                      key={currentVideoUrl}
                    />
                  </div>
                ) : (
                  <div className="music-no-video">
                    <AlertCircle size={32} />
                    <span>No video file available for this theme.</span>
                  </div>
                )}

                {/* Now Playing Info */}
                {currentTheme && (
                  <div className="music-now-playing">
                    <div className="music-now-playing-header">
                      <span className="badge badge-gold music-theme-type-badge">{currentTheme.type}</span>
                      <h2 className="music-now-playing-title">{currentTheme.song?.title || 'Unknown Song'}</h2>
                    </div>
                    {currentTheme.song?.artists && currentTheme.song.artists.length > 0 && (
                      <div className="music-now-playing-artist">
                        <User size={14} />
                        <span>{currentTheme.song.artists.map(art => art.name).join(', ')}</span>
                      </div>
                    )}
                    <div className="music-now-playing-anime">
                      <Disc size={14} />
                      <span>{selectedAnime.name}</span>
                      {selectedAnime.year && (
                        <>
                          <Calendar size={14} style={{ marginLeft: 12 }} />
                          <span>{selectedAnime.year}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: OP/ED selection playlist */}
              <div className="music-playlist-panel">
                <div className="music-playlist-tabs">
                  <button
                    className={`music-playlist-tab ${activeTab === 'OP' ? 'active' : ''}`}
                    onClick={() => setActiveTab('OP')}
                  >
                    Openings (OP)
                  </button>
                  <button
                    className={`music-playlist-tab ${activeTab === 'ED' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ED')}
                  >
                    Endings (ED)
                  </button>
                </div>

                <div className="music-playlist-scroll">
                  {filteredThemes.length > 0 ? (
                    filteredThemes.map((t) => {
                      const isPlaying = currentTheme?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`playlist-item ${isPlaying ? 'active' : ''}`}
                          onClick={() => handlePlayTheme(t)}
                        >
                          <span className="playlist-item-play-icon">
                            <Play size={14} fill={isPlaying ? "var(--accent-gold)" : "none"} />
                          </span>
                          <div className="playlist-item-info">
                            <span className="playlist-item-type">{t.type}</span>
                            <span className="playlist-item-title">{t.song?.title || 'Unknown Song'}</span>
                            {t.song?.artists && t.song.artists.length > 0 && (
                              <span className="playlist-item-artist">
                                {t.song.artists.map(a => a.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="music-playlist-empty">
                      No themes found in this category.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Anime Grid (only shown if no selected anime and not loading) */}
      {!selectedAnime && !loading && (
        <div className="music-list-section animate-fade-in">
          <h2 className="music-section-title">
            {hasSearched ? `Search Results (${searchResults.length})` : 'Popular Anime Themes'}
          </h2>

          {(hasSearched ? searchResults : featuredAnime).length > 0 ? (
            <div className="music-grid">
              {(hasSearched ? searchResults : featuredAnime).map((anime) => {
                const cover = getCoverImage(anime);
                const title = anime.name;
                const year = anime.year;
                const type = anime.media_format;
                const key = anime.id;
                
                return (
                  <div
                    key={key}
                    className="music-anime-card"
                    onClick={() => handleSelectAnime(anime)}
                  >
                    <div className="music-card-poster-wrapper">
                      {cover ? (
                        <img
                          src={cover}
                          alt={title}
                          className="music-card-poster"
                          loading="lazy"
                        />
                      ) : (
                        <div className="music-card-poster-placeholder">
                          <MusicIcon size={32} />
                        </div>
                      )}
                      <div className="music-card-hover-overlay">
                        <Play size={32} fill="var(--accent-gold)" />
                      </div>
                    </div>
                    <div className="music-card-info">
                      <h3 className="music-card-title">{title}</h3>
                      <div className="music-card-meta">
                        {year && <span>{year}</span>}
                        {type && <span>• {type}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="music-empty-state">
              <MusicIcon size={48} className="music-empty-icon" />
              <h3>No anime found</h3>
              <p>Try searching for a different anime name to discover its themes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
