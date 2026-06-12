import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Star,
  Clock,
  Calendar,
  Bookmark,
  Eye as EyeIcon,
  Loader2,
  X,
} from 'lucide-react';

function getYouTubeId(trailerOrUrl) {
  if (!trailerOrUrl) return '';
  if (typeof trailerOrUrl === 'object') {
    if (trailerOrUrl.youtube_id) return trailerOrUrl.youtube_id;
    const urls = [trailerOrUrl.url, trailerOrUrl.embed_url].filter(Boolean);
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    for (const url of urls) {
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return match[2];
      }
    }
    return '';
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = trailerOrUrl.match(regExp);
  return (match && match[2].length === 11) ? match[2] : '';
}



function decodeBase64Image(coverPath) {
  if (!coverPath) return '';
  if (coverPath.startsWith('/i/')) {
    const base64Str = coverPath.substring(3);
    try {
      return window.atob(base64Str);
    } catch (e) {
      console.error('Failed to decode base64 cover:', e);
      return '';
    }
  }
  return coverPath;
}
import {
  getBannerAnime,
  getTrendingAnime,
  getCurrentSeasonAnime,
  getMostFavoriteAnime,
  getUpcomingAnime,
  getStatusText,
  getStatusClass,
  getTopAnime,
  searchAnime,
} from '../../services/jikanApi';

import AnimeRow from '../../components/AnimeRow/AnimeRow';
import { getWatchHistory } from '../../services/watchHistoryService';
import { useAuth } from '../../contexts/AuthContext';
import { addBookmark, removeBookmark, isBookmarked, getBookmarks } from '../../services/bookmarkService';
import './Home.css';

function Home({ onShowAuth }) {
  const navigate = useNavigate();

  // Hero banner state
  const [bannerAnime, setBannerAnime] = useState([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  // Section data state
  const [trending, setTrending] = useState([]);
  const [seasonal, setSeasonal] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);

  // Loading states
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [seasonalLoading, setSeasonalLoading] = useState(true);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  // New section states
  const [trendingWeek, setTrendingWeek] = useState([]);
  const [trendingWeekLoading, setTrendingWeekLoading] = useState(true);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularMoviesLoading, setPopularMoviesLoading] = useState(true);
  const [resolvingTrendingId, setResolvingTrendingId] = useState(null);

  // Auth & Bookmarks state
  const { user, isAuthenticated } = useAuth();
  const [isBannerBookmarked, setIsBannerBookmarked] = useState(false);
  const [userBookmarks, setUserBookmarks] = useState([]);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Fetch watch history when user changes
  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        const history = await getWatchHistory();
        if (active) {
          setContinueWatching(history);
        }
      } catch (err) {
        console.error('Failed to fetch watch history:', err);
      }
    };
    fetchHistory();
    return () => {
      active = false;
    };
  }, [user]);

  // Fetch whether current banner is bookmarked
  useEffect(() => {
    const checkBannerBookmark = async () => {
      const activeAnime = bannerAnime[currentBanner];
      if (!activeAnime) return;
      if (isAuthenticated && user) {
        const res = await isBookmarked(user.uid, activeAnime.mal_id);
        setIsBannerBookmarked(res);
      } else {
        setIsBannerBookmarked(false);
      }
    };
    checkBannerBookmark();
  }, [currentBanner, bannerAnime, isAuthenticated, user]);



  // Fetch all user bookmarks for card list rows
  useEffect(() => {
    let active = true;
    const fetchBookmarks = async () => {
      if (isAuthenticated && user) {
        try {
          const list = await getBookmarks(user.uid);
          if (active) {
            setUserBookmarks(list.map((b) => b.mal_id));
          }
        } catch (err) {
          console.error(err);
        }
      } else {
        if (active) setUserBookmarks([]);
      }
    };
    fetchBookmarks();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  const handleBannerBookmark = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) {
      if (onShowAuth) onShowAuth();
      return;
    }
    const activeAnime = bannerAnime[currentBanner];
    if (!activeAnime || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (isBannerBookmarked) {
        await removeBookmark(user.uid, activeAnime.mal_id);
        setIsBannerBookmarked(false);
        setUserBookmarks(prev => prev.filter(id => id !== activeAnime.mal_id));
      } else {
        await addBookmark(user.uid, activeAnime);
        setIsBannerBookmarked(true);
        setUserBookmarks(prev => [...prev, activeAnime.mal_id]);
      }
    } catch (err) {
      console.error('Failed to toggle banner bookmark:', err);
    } finally {
      setBookmarkLoading(false);
    }
  }, [bannerAnime, currentBanner, isBannerBookmarked, bookmarkLoading, isAuthenticated, user, onShowAuth]);

  const handleCardBookmark = useCallback(async (animeItem) => {
    if (!isAuthenticated) {
      if (onShowAuth) onShowAuth();
      return;
    }
    const isBooked = userBookmarks.includes(animeItem.mal_id);
    try {
      if (isBooked) {
        await removeBookmark(user.uid, animeItem.mal_id);
        setUserBookmarks(prev => prev.filter(id => id !== animeItem.mal_id));
      } else {
        await addBookmark(user.uid, animeItem);
        setUserBookmarks(prev => [...prev, animeItem.mal_id]);
      }
    } catch (err) {
      console.error('Failed to toggle card bookmark:', err);
    }
  }, [isAuthenticated, user, userBookmarks, onShowAuth]);

  const handleTrendingClick = useCallback(async (item) => {
    if (resolvingTrendingId) return;
    setResolvingTrendingId(item.id);
    try {
      const res = await searchAnime({ q: item.title, limit: 1 });
      if (res?.data?.length > 0) {
        navigate(`/anime/${res.data[0].mal_id}`);
      } else {
        alert(`Could not find "${item.title}" on database.`);
      }
    } catch (err) {
      console.error('Failed to resolve MAL ID:', err);
    } finally {
      setResolvingTrendingId(null);
    }
  }, [resolvingTrendingId, navigate]);



  // Auto-rotate timer refs
  const autoRotateRef = useRef(null);
  const restartTimeoutRef = useRef(null);

  // Start auto-rotate
  const startAutoRotate = useCallback(() => {
    if (showTrailer) return;
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    autoRotateRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentBanner((prev) =>
          prev >= bannerAnime.length - 1 ? 0 : prev + 1
        );
        setIsTransitioning(false);
      }, 500);
    }, 8000);
  }, [bannerAnime, showTrailer]);

  // Stop auto-rotate and restart after delay
  const handleManualNavigation = useCallback(
    (newIndex) => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentBanner(newIndex);
        setIsTransitioning(false);
      }, 500);

      if (!showTrailer) {
        restartTimeoutRef.current = setTimeout(() => {
          startAutoRotate();
        }, 10000);
      }
    },
    [startAutoRotate, showTrailer]
  );

  const goToPrev = useCallback(() => {
    const newIndex =
      currentBanner <= 0 ? bannerAnime.length - 1 : currentBanner - 1;
    handleManualNavigation(newIndex);
  }, [currentBanner, bannerAnime, handleManualNavigation]);

  const goToNext = useCallback(() => {
    const newIndex =
      currentBanner >= bannerAnime.length - 1 ? 0 : currentBanner + 1;
    handleManualNavigation(newIndex);
  }, [currentBanner, bannerAnime, handleManualNavigation]);

  const goToDot = useCallback(
    (index) => {
      if (index === currentBanner) return;
      handleManualNavigation(index);
    },
    [currentBanner, handleManualNavigation]
  );

  // Fetch banner anime
  useEffect(() => {
    let cancelled = false;

    async function fetchBanner() {
      try {
        const response = await getBannerAnime();
        if (!cancelled && response?.data) {
          setBannerAnime(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch banner anime:', err);
      } finally {
        if (!cancelled) setBannerLoading(false);
      }
    }

    fetchBanner();
    return () => {
      cancelled = true;
    };
  }, []);

  // Start auto-rotate when banner data is ready
  useEffect(() => {
    if (bannerAnime.length > 1 && !showTrailer) {
      startAutoRotate();
    }
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    };
  }, [bannerAnime.length, startAutoRotate, showTrailer]);

  // Fetch section data with staggered delays
  useEffect(() => {
    let cancelled = false;



    async function fetchSections() {
      // Trending
      try {
        const trendingRes = await getTrendingAnime();
        if (!cancelled && trendingRes?.data) setTrending(trendingRes.data);
      } catch (err) {
        console.error('Failed to fetch trending:', err);
      } finally {
        if (!cancelled) setTrendingLoading(false);
      }

      // Delay for rate limiting
      await new Promise((r) => setTimeout(r, 400));

      // Current Season
      try {
        const seasonRes = await getCurrentSeasonAnime();
        if (!cancelled && seasonRes?.data) setSeasonal(seasonRes.data);
      } catch (err) {
        console.error('Failed to fetch seasonal:', err);
      } finally {
        if (!cancelled) setSeasonalLoading(false);
      }

      await new Promise((r) => setTimeout(r, 400));

      // Most Favorite
      try {
        const favRes = await getMostFavoriteAnime();
        if (!cancelled && favRes?.data) setFavorites(favRes.data);
      } catch (err) {
        console.error('Failed to fetch favorites:', err);
      } finally {
        if (!cancelled) setFavoritesLoading(false);
      }

      await new Promise((r) => setTimeout(r, 400));

      // Fetch Jikan Top 10 for Trending This Week
      try {
        const topRes = await getTopAnime({ filter: 'airing', limit: 10 });
        if (!cancelled && topRes?.data) {
          setTrendingWeek(topRes.data.slice(0, 10));
        }
      } catch (err) {
        console.error('Failed to fetch weekly trending:', err);
      } finally {
        if (!cancelled) setTrendingWeekLoading(false);
      }

      await new Promise((r) => setTimeout(r, 400));

      // Popular Movies
      try {
        const moviesRes = await getTopAnime({ type: 'movie', filter: 'bypopularity', limit: 10 });
        if (!cancelled && moviesRes?.data) {
          setPopularMovies(moviesRes.data.slice(0, 10));
        }
      } catch (err) {
        console.error('Failed to fetch popular movies:', err);
      } finally {
        if (!cancelled) setPopularMoviesLoading(false);
      }

      await new Promise((r) => setTimeout(r, 400));

      // Upcoming
      try {
        const upRes = await getUpcomingAnime();
        if (!cancelled && upRes?.data) setUpcoming(upRes.data);
      } catch (err) {
        console.error('Failed to fetch upcoming:', err);
      } finally {
        if (!cancelled) setUpcomingLoading(false);
      }
    }

    fetchSections();
    return () => {
      cancelled = true;
    };
  }, []);



  // Current anime for hero
  const anime = bannerAnime[currentBanner];
  const bannerImage =
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.jpg?.image_url ||
    '';
  const japaneseTitle = anime?.title_japanese || '';
  const mainTitle = anime?.title_english || anime?.title || '';
  const score = anime?.score || 0;
  const type = anime?.type || '';
  const season = anime?.season
    ? anime.season.charAt(0).toUpperCase() + anime.season.slice(1)
    : '';
  const year = anime?.year || '';
  const duration = anime?.duration || '';
  const status = anime?.status || '';
  const genres = anime?.genres || [];
  const synopsis = anime?.synopsis || '';
  const trailer = anime?.trailer || {};

  return (
    <div className="home-page">
      {/* ===== HERO BANNER ===== */}
      <section className="hero-banner">
        {bannerLoading ? (
          <div className="hero-banner-skeleton">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Background Image */}
            <div
              className={`hero-bg ${isTransitioning ? 'hero-bg-exit' : 'hero-bg-enter'}`}
              style={{ backgroundImage: `url(${bannerImage})` }}
            />

            {/* Gradient Overlay */}
            <div className="hero-gradient-overlay" />

            {/* Content */}
            <div
              className={`hero-content ${isTransitioning ? 'hero-content-exit' : 'hero-content-enter'}`}
            >
              {japaneseTitle ? (
                <>
                  <span className="hero-japanese-subtitle">{japaneseTitle}</span>
                  <h1 className="hero-title-fallback">{mainTitle}</h1>
                </>
              ) : (
                <h1 className="hero-title-fallback">{mainTitle}</h1>
              )}

              {/* Info Row */}
              <div className="hero-info-row">
                {score > 0 && (
                  <span className="hero-score-badge">
                    <Star size={14} />
                    {score.toFixed(1)}
                  </span>
                )}
                {type && <span className="hero-type-badge">{type}</span>}
                {(season || year) && (
                  <span className="hero-season-badge">
                    <Calendar size={13} />
                    {season} {year}
                  </span>
                )}
                {duration && (
                  <span className="hero-duration-badge">
                    <Clock size={13} />
                    {duration}
                  </span>
                )}
                {status && (
                  <span
                    className={`status-badge ${getStatusClass(status)}`}
                  >
                    {getStatusText(status)}
                  </span>
                )}
              </div>

              {/* Genres */}
              {genres.length > 0 && (
                <div className="hero-genres">
                  {genres.slice(0, 5).map((genre) => (
                    <span key={genre.mal_id} className="genre-tag">
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Synopsis */}
              {synopsis && (
                <div className="hero-synopsis-wrapper">
                  <p className="hero-synopsis">
                    {synopsis}
                  </p>
                </div>
              )}

              {/* CTA Buttons */}
              <div className="hero-actions">
                {anime?.status?.toLowerCase() === 'not yet aired' ? (
                  <button
                    className="btn btn-secondary hero-btn"
                    disabled
                    style={{ cursor: 'not-allowed', opacity: 0.6 }}
                  >
                    Not Yet Aired
                  </button>
                ) : (
                  <button
                    className="btn btn-primary hero-btn"
                    onClick={() => navigate(`/watch/${anime?.mal_id}`)}
                  >
                    <Play size={18} fill="currentColor" />
                    Watch Episode 1
                  </button>
                )}

                {getYouTubeId(anime?.trailer) && (
                  <button
                    className="btn btn-secondary hero-btn"
                    onClick={() => setShowTrailer(true)}
                  >
                    <EyeIcon size={18} />
                    Watch Trailer
                  </button>
                )}

                <button
                  className={`btn hero-btn ${isBannerBookmarked ? 'btn-bookmark-active' : 'btn-secondary'}`}
                  onClick={handleBannerBookmark}
                  disabled={bookmarkLoading}
                >
                  {bookmarkLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Bookmark size={18} fill={isBannerBookmarked ? 'currentColor' : 'none'} />
                  )}
                  {isBannerBookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
              </div>
            </div>

            {/* Navigation Arrows */}
            {bannerAnime.length > 1 && (
              <>
                <button
                  className="hero-arrow hero-arrow-left"
                  onClick={goToPrev}
                  aria-label="Previous slide"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  className="hero-arrow hero-arrow-right"
                  onClick={goToNext}
                  aria-label="Next slide"
                >
                  <ChevronRight size={28} />
                </button>
              </>
            )}

            {/* Dot Indicators */}
            {bannerAnime.length > 1 && (
              <div className="hero-dots">
                {bannerAnime.map((_, index) => (
                  <button
                    key={index}
                    className={`hero-dot ${index === currentBanner ? 'active' : ''}`}
                    onClick={() => goToDot(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== ANIME ROW SECTIONS ===== */}
      <div className="home-sections">
        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <AnimeRow
            title="Continue Watching"
            anime={continueWatching.map(item => ({
              mal_id: item.mal_id,
              title: item.title,
              title_english: item.title_english,
              images: { jpg: { large_image_url: item.image, image_url: item.image } },
              score: item.score,
              type: item.type,
              episodes: item.episodes,
              currentEpisode: item.currentEpisode,
              progress: item.progress,
              isHistory: true
            }))}
          />
        )}

        {/* Trending Now */}
        <AnimeRow
          title="Trending Now"
          anime={trending}
          loading={trendingLoading}
          viewAllLink="/browse?status=airing"
          onBookmark={handleCardBookmark}
          bookmarkedIds={userBookmarks}
        />

        {/* Popular This Season */}
        <AnimeRow
          title="Popular This Season"
          anime={seasonal}
          loading={seasonalLoading}
          viewAllLink="/browse?year=2026&season=spring"
          onBookmark={handleCardBookmark}
          bookmarkedIds={userBookmarks}
        />

        {/* Most Favorite */}
        <AnimeRow
          title="Most Favorite"
          anime={favorites}
          loading={favoritesLoading}
          viewAllLink="/browse"
          onBookmark={handleCardBookmark}
          bookmarkedIds={userBookmarks}
        />

        {/* Trending This Week & Popular Movies Dual Columns Section */}
        <div className="home-dual-columns-section">
          {/* Trending This Week */}
          <div className="home-dual-column">
            <h2 className="home-dual-title">Trending This Week</h2>
            <div className="home-list-container">
              {trendingWeekLoading ? (
                <div className="home-list-loader">
                  <Loader2 className="spinner animate-spin" size={24} />
                  <span>Loading...</span>
                </div>
              ) : trendingWeek.length > 0 ? (
                trendingWeek.map((item, index) => (
                  <div
                    key={item.mal_id}
                    className="home-list-card"
                    onClick={() => navigate(`/anime/${item.mal_id}`)}
                  >
                    <span className={`home-list-rank rank-${index + 1}`}>
                      #{index + 1}
                    </span>
                    <div className="home-list-img-wrapper">
                      <img
                        src={item.images?.jpg?.large_image_url || item.images?.jpg?.image_url}
                        alt={item.title_english || item.title}
                        className="home-list-img"
                        loading="lazy"
                      />
                    </div>
                    <div className="home-list-details">
                      <h3 className="home-list-title">
                        {item.title_english || item.title}
                      </h3>
                      <div className="home-list-meta">
                        {item.score > 0 && (
                          <span className="home-list-score">
                            <Star size={11} fill="currentColor" />
                            {item.score.toFixed(1)}
                          </span>
                        )}
                        {(item.season || item.year) && (
                          <span> • {item.season ? item.season.toUpperCase() : item.year}</span>
                        )}
                        {item.status && (
                          <span>
                             • {item.status === 'Finished Airing' ? 'FINISHED' : 'AIRING'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="home-list-right">
                      <span className="home-list-type">
                        {item.type === 'Movie' ? 'MOVIE' : item.type === 'TV' ? 'TV Show' : item.type || 'TV Show'}
                      </span>
                      <span className="home-list-episodes">
                        {item.type === 'Movie' ? '' : (item.episodes ? `${item.episodes} ep` : '')}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="home-list-empty">No trending data available.</div>
              )}
            </div>
          </div>

          {/* Popular Movies */}
          <div className="home-dual-column">
            <h2 className="home-dual-title">Popular Movies</h2>
            <div className="home-list-container">
              {popularMoviesLoading ? (
                <div className="home-list-loader">
                  <Loader2 className="spinner animate-spin" size={24} />
                  <span>Loading...</span>
                </div>
              ) : popularMovies.length > 0 ? (
                popularMovies.map((item, index) => (
                  <div
                    key={item.mal_id}
                    className="home-list-card"
                    onClick={() => navigate(`/anime/${item.mal_id}`)}
                  >
                    <span className={`home-list-rank rank-${index + 1}`}>
                      #{index + 1}
                    </span>
                    <div className="home-list-img-wrapper">
                      <img
                        src={item.images?.jpg?.large_image_url || item.images?.jpg?.image_url}
                        alt={item.title_english || item.title}
                        className="home-list-img"
                        loading="lazy"
                      />
                    </div>
                    <div className="home-list-details">
                      <h3 className="home-list-title">
                        {item.title_english || item.title}
                      </h3>
                      <div className="home-list-meta">
                        {item.score > 0 && (
                          <span className="home-list-score">
                            <Star size={11} fill="currentColor" />
                            {item.score.toFixed(1)}
                          </span>
                        )}
                        {(item.season || item.year) && (
                          <span> • {item.season ? item.season.toUpperCase() : item.year}</span>
                        )}
                        {item.status && (
                          <span>
                             • {item.status === 'Finished Airing' ? 'FINISHED' : 'AIRING'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="home-list-right">
                      <span className="home-list-type">MOVIE</span>
                      <span className="home-list-episodes">
                        {item.duration ? item.duration.replace(' hr', ' hour').replace(' min', ' mins').replace(' hrs', ' hours') : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="home-list-empty">No movies available.</div>
              )}
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <AnimeRow
          title="Coming Soon"
          anime={upcoming}
          loading={upcomingLoading}
          viewAllLink="/browse?status=upcoming"
          onBookmark={handleCardBookmark}
          bookmarkedIds={userBookmarks}
        />
      </div>
      {showTrailer && getYouTubeId(anime?.trailer) && (
        <div className="modal-overlay" onClick={() => setShowTrailer(false)}>
          <div className="modal-content trailer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="trailer-modal-header">
              <h3 className="trailer-modal-title">{mainTitle} - Official Trailer</h3>
              <button className="trailer-modal-close" onClick={() => setShowTrailer(false)} aria-label="Close trailer">
                <X size={20} />
              </button>
            </div>
            <div className="trailer-video-container">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(anime.trailer)}?autoplay=1`}
                title={`${mainTitle} Trailer`}
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
