import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Star, Play, Bookmark, Clock, Calendar, Tv, Loader2, X } from 'lucide-react';
import { getAnimeById, getAnimeCharacters, getAnimeRecommendations, getAnimeEpisodes, getAnimeRelations, getStatusText, getStatusClass } from '../../services/jikanApi';
import { searchAnikage, getAnikageEpisodes } from '../../services/animepaheApi';

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
import AnimeRow from '../../components/AnimeRow/AnimeRow';
import { useAuth } from '../../contexts/AuthContext';
import { addBookmark, removeBookmark, getBookmarks, updateBookmarkCategory } from '../../services/bookmarkService';
import './AnimeDetail.css';

// Helper functions for matching titles and seasons
function normalizeTitle(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSeasonNumber(titleStr) {
  if (!titleStr) return 1;
  const norm = titleStr.toLowerCase().trim();

  // 1. "Season 2", "Season 3", "Season Two"
  const seasonMatch = norm.match(/\bseason\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (seasonMatch) {
    const val = seasonMatch[1];
    if (/\d+/.test(val)) return parseInt(val, 10);
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    return words[val] || 1;
  }

  // 2. "2nd Season", "3rd Season", "2nd"
  const ordinalMatch = norm.match(/\b(\d+)(st|nd|rd|th)\b/);
  if (ordinalMatch) {
    return parseInt(ordinalMatch[1], 10);
  }

  // 3. Roman numerals at end of string: " II", " III", " IV", " V", " VI"
  const romanMatch = norm.match(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/);
  if (romanMatch) {
    const roman = romanMatch[1];
    const map = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    return map[roman] || 1;
  }

  return 1;
}

function cleanTitleForBaseComparison(normTitle) {
  return normTitle
    .replace(/\b(tv|movie|special|ova|ona)\b/g, '')
    .replace(/\bseason\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, '')
    .replace(/\b(\d+)(st|nd|rd|th)\s*season\b/g, '')
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, '')
    .replace(/\s+(ii|iii|iv|v|vi|vii|viii|ix|x)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestAnikageMatch(animeData, results) {
  if (!animeData || !results || results.length === 0) return null;

  const targetTitles = [
    animeData.title,
    animeData.title_english,
    ...(animeData.title_synonyms || [])
  ].filter(Boolean);

  const targetEps = animeData.episodes || animeData.episodes_aired || 0;
  const targetType = (animeData.type || animeData.format || '').toUpperCase();

  const scoredResults = results.map(r => {
    const resultTitles = [
      r.title?.english,
      r.title?.romaji,
      typeof r.title === 'string' ? r.title : null
    ].filter(Boolean);

    let baseScore = 0;

    for (const t of targetTitles) {
      const tNorm = normalizeTitle(t);
      const tSeason = getSeasonNumber(t) || 1;
      const tBase = cleanTitleForBaseComparison(tNorm);

      for (const rT of resultTitles) {
        const rNorm = normalizeTitle(rT);
        const rSeason = getSeasonNumber(rNorm) || 1;
        const rBase = cleanTitleForBaseComparison(rNorm);

        if (tSeason !== rSeason) continue;

        if (tNorm === rNorm) {
          baseScore = Math.max(baseScore, 100);
        } else if (tBase === rBase) {
          baseScore = Math.max(baseScore, 85);
        } else if (tNorm.includes(rNorm) || rNorm.includes(tNorm)) {
          const ratio = Math.min(tNorm.length, rNorm.length) / Math.max(tNorm.length, rNorm.length);
          baseScore = Math.max(baseScore, 50 + Math.floor(ratio * 30));
        } else {
          const tTokens = tBase.split(' ').filter(tk => tk.length > 1 && tk !== 'episode');
          const rTokens = rBase.split(' ').filter(tk => tk.length > 1 && tk !== 'episode');
          if (tTokens.length > 0 && rTokens.length > 0) {
            const common = tTokens.filter(tk => rTokens.includes(tk));
            const ratioTarget = common.length / tTokens.length;
            const ratioResult = common.length / rTokens.length;
            const maxRatio = Math.max(ratioTarget, ratioResult);
            if (ratioTarget >= 0.5 || ratioResult >= 0.5 || common.length >= 2) {
              baseScore = Math.max(baseScore, Math.floor(maxRatio * 70));
            }
          }
        }
      }
    }

    let finalScore = baseScore;

    // Episode count matching bonus / penalty
    const candEps = r.totalEpisodes || 0;
    if (targetEps > 0 && candEps > 0) {
      if (targetEps === candEps) {
        finalScore += 25; // Exact episode count match bonus
      } else if (Math.abs(targetEps - candEps) > 3) {
        finalScore -= 40; // Heavy penalty if TV series vs 1-episode special
      }
    }

    // Format / type matching bonus / penalty
    const candFormat = (r.format || '').toUpperCase();
    if (targetType && candFormat) {
      if (targetType === candFormat) {
        finalScore += 15;
      } else if ((targetType === 'MOVIE' || targetType === 'SPECIAL' || targetType === 'OVA') && candFormat === 'TV') {
        finalScore -= 30;
      }
    }

    return { result: r, score: finalScore };
  });

  const validMatches = scoredResults.filter(item => item.score >= 40);
  if (validMatches.length === 0) return null;

  validMatches.sort((a, b) => b.score - a.score);
  return validMatches[0].result;
}

function AnimeDetail({ onShowAuth }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [anime, setAnime] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [charsLoading, setCharsLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkCategory, setBookmarkCategory] = useState('');
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [episodesPage, setEpisodesPage] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState([]);
  const [relations, setRelations] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('episodes');


  useEffect(() => {
    async function fetchAnime() {
      setLoading(true); setError(null);
      try {
        const data = await getAnimeById(id);
        setAnime(data.data);
      } catch (err) {
        console.error('Failed to fetch anime:', err);
        setError('Failed to load anime details.');
      } finally { setLoading(false); }
    }
    fetchAnime();
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    async function fetchCharacters() {
      setCharsLoading(true);
      try { const data = await getAnimeCharacters(id); setCharacters(data.data || []); }
      catch (err) { console.error('Failed to fetch characters:', err); }
      finally { setCharsLoading(false); }
    }
    fetchCharacters();
  }, [id]);

  useEffect(() => {
    async function fetchRecommendations() {
      setRecsLoading(true);
      try { const data = await getAnimeRecommendations(id); setRecommendations(data.data || []); }
      catch (err) { console.error('Failed to fetch recommendations:', err); }
      finally { setRecsLoading(false); }
    }
    const timer = setTimeout(fetchRecommendations, 500);
    return () => clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    async function fetchRelations() {
      setRelationsLoading(true);
      try {
        const data = await getAnimeRelations(id);
        setRelations(data.data || []);
      } catch (err) {
        console.error('Failed to fetch relations:', err);
      } finally {
        setRelationsLoading(false);
      }
    }
    fetchRelations();
  }, [id]);

  const animeRelations = useMemo(() => {
    return relations
      .map(rel => ({
        ...rel,
        entry: rel.entry.filter(entry => entry.type === 'anime')
      }))
      .filter(rel => rel.entry.length > 0);
  }, [relations]);

  useEffect(() => {
    let cancelled = false;

    async function searchAnikageForAnime(animeData) {
      const titles = [...new Set([
        animeData.title_english,
        animeData.title,
        animeData.title_japanese
      ].filter(Boolean))];

      for (const title of titles) {
        if (cancelled) return null;
        try {
          const results = await searchAnikage(title);
          if (cancelled) return null;
          const match = findBestAnikageMatch(animeData, results);
          if (match && match.slug) {
            return match.slug;
          }
        } catch (err) {
          console.error(`Anikage search failed for "${title}":`, err);
        }
      }
      return null;
    }

    async function fetchEpisodes() {
      if (!anime) return;
      setEpisodesLoading(true);

      const isAiring = Boolean(anime.airing || (anime.status && anime.status.toLowerCase() === 'currently airing'));

      try {
        // 1. If currently airing, try Anikage search & episode list first
        if (isAiring) {
          const slug = await searchAnikageForAnime(anime);
          if (cancelled) return;

          if (slug) {
            const { episodes: anikageEps } = await getAnikageEpisodes(slug);
            if (cancelled) return;
            if (anikageEps && anikageEps.length > 0) {
              const formatted = anikageEps
                .filter(ep => ep.number > 0)
                .map(ep => ({
                  mal_id: ep.number,
                  title: ep.title || `Episode ${ep.number}`,
                  img: ep.img || null
                }))
                .sort((a, b) => a.mal_id - b.mal_id);

              setEpisodes(formatted);
              setEpisodesLoading(false);
              return;
            }
          }
        }

        // 2. If finished/not airing OR Anikage returned no episodes, use Tenrai API
        const data = await getAnimeEpisodes(id);
        if (cancelled) return;

        let tenraiEps = (data?.data || [])
          .filter(e => e.mal_id > 0)
          .map(e => ({ mal_id: e.mal_id, title: e.title || `Episode ${e.mal_id}` }))
          .sort((a, b) => a.mal_id - b.mal_id);

        if (tenraiEps.length > 0) {
          setEpisodes(tenraiEps);
        } else {
          // If Tenrai returned no episode array, generate episode list from anime.episodes or aired count
          const totalEps = anime.episodes || anime.episodes_aired || 0;
          if (totalEps > 0) {
            const fallback = Array.from({ length: totalEps }, (_, i) => ({
              mal_id: i + 1,
              title: `Episode ${i + 1}`
            }));
            setEpisodes(fallback);
          } else {
            setEpisodes([]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch episodes:', err);
        setEpisodes([]);
      } finally {
        if (!cancelled) setEpisodesLoading(false);
      }
    }

    fetchEpisodes();
    return () => { cancelled = true; };
  }, [id, anime]);

  useEffect(() => {
    async function checkBookmark() {
      if (!anime) return;
      if (isAuthenticated && user) {
        try {
          const list = await getBookmarks(user.uid);
          const ids = list.map(b => b.mal_id);
          setBookmarkedIds(ids);
          const item = list.find(b => b.mal_id === anime.mal_id);
          if (item) {
            setBookmarked(true);
            setBookmarkCategory(item.category || 'Plan to Watch');
          } else {
            setBookmarked(false);
            setBookmarkCategory('');
          }
        } catch (err) {
          console.error('Failed to check bookmark:', err);
        }
      } else {
        setBookmarked(false);
        setBookmarkCategory('');
        setBookmarkedIds([]);
      }
    }
    checkBookmark();
  }, [anime, isAuthenticated, user]);

  const handleBookmark = useCallback(async () => {
    if (!isAuthenticated) {
      if (onShowAuth) onShowAuth();
      return;
    }
    if (!anime || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await removeBookmark(user.uid, anime.mal_id);
        setBookmarked(false);
        setBookmarkCategory('');
        setBookmarkedIds(prev => prev.filter(id => id !== anime.mal_id));
      } else {
        await addBookmark(user.uid, anime, 'Plan to Watch');
        setBookmarked(true);
        setBookmarkCategory('Plan to Watch');
        setBookmarkedIds(prev => [...prev, anime.mal_id]);
      }
    } catch (err) { console.error('Bookmark action failed:', err); }
    finally { setBookmarkLoading(false); }
  }, [anime, bookmarked, bookmarkLoading, isAuthenticated, user, onShowAuth]);

  const handleCardBookmark = useCallback(async (targetAnime) => {
    if (!isAuthenticated) {
      if (onShowAuth) onShowAuth();
      return;
    }
    if (!targetAnime) return;
    try {
      const isCurrentlyBookmarked = bookmarkedIds.includes(targetAnime.mal_id);
      if (isCurrentlyBookmarked) {
        await removeBookmark(user.uid, targetAnime.mal_id);
        setBookmarkedIds(prev => prev.filter(id => id !== targetAnime.mal_id));
        if (targetAnime.mal_id === anime?.mal_id) {
          setBookmarked(false);
          setBookmarkCategory('');
        }
      } else {
        await addBookmark(user.uid, targetAnime, 'Plan to Watch');
        setBookmarkedIds(prev => [...prev, targetAnime.mal_id]);
        if (targetAnime.mal_id === anime?.mal_id) {
          setBookmarked(true);
          setBookmarkCategory('Plan to Watch');
        }
      }
    } catch (err) {
      console.error('Failed to toggle card bookmark:', err);
    }
  }, [anime, bookmarkedIds, isAuthenticated, user, onShowAuth]);

  const handleCategoryChange = async (newCategory) => {
    if (!isAuthenticated || !anime || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const success = await updateBookmarkCategory(user.uid, anime.mal_id, newCategory);
      if (success) {
        setBookmarkCategory(newCategory);
      }
    } catch (err) {
      console.error('Failed to change bookmark category:', err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const computedEpisodes = useMemo(() => {
    if (anime?.status?.toLowerCase() === 'not yet aired') {
      return [];
    }
    if (episodes.length > 0) {
      return episodes;
    }
    const count = typeof anime?.episodes === 'number' ? anime.episodes : 0;
    if (count > 0) {
      return Array.from({ length: count }, (_, i) => ({ mal_id: i + 1, title: `Episode ${i + 1}` }));
    }
    return [];
  }, [episodes, anime?.episodes, anime?.status]);

  const EP_PAGE_SIZE = 100;
  const epTotalPages = Math.ceil(computedEpisodes.length / EP_PAGE_SIZE);
  const paginatedEpisodes = useMemo(() => {
    const start = episodesPage * EP_PAGE_SIZE;
    return computedEpisodes.slice(start, start + EP_PAGE_SIZE);
  }, [computedEpisodes, episodesPage]);

  const displayCharacters = characters
    .map(char => { const jpVA = char.voice_actors?.find(va => va.language === 'Japanese'); return { ...char, jpVA }; })
    .slice(0, 10);

  // Transform recommendations to look like Jikan anime objects for AnimeRow
  const recAnimeList = recommendations.slice(0, 15).map(rec => {
    const e = rec.entry;
    return {
      mal_id: e.mal_id,
      title: e.title,
      title_english: e.title,
      images: e.images,
      score: null,
      type: null,
      episodes: null,
      trailer: null,
    };
  });

  if (loading) {
    return (<div className="detail-page page-content"><div className="page-loader"><div className="spinner" /><span className="page-loader-text">Loading anime details...</span></div></div>);
  }
  if (error || !anime) {
    return (<div className="detail-page page-content"><div className="page-loader"><span className="page-loader-text">{error || 'Anime not found.'}</span><button className="btn btn-secondary" onClick={() => navigate(-1)}>Go Back</button></div></div>);
  }

  const posterUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
  const bannerUrl = anime.images?.webp?.large_image_url || posterUrl;
  const title = anime.title_english || anime.title || '';
  const japaneseTitle = anime.title_japanese || '';
  const score = anime.score || 'N/A';
  const type = anime.type || '';
  const season = anime.season ? `${anime.season.charAt(0).toUpperCase() + anime.season.slice(1)}` : '';
  const year = anime.year || anime.aired?.prop?.from?.year || '';
  const seasonYear = [season, year].filter(Boolean).join(' ');
  const duration = anime.duration || '';
  const status = anime.status || '';
  const synopsis = anime.synopsis || 'No synopsis available.';
  const genres = anime.genres || [];
  const totalEpisodes = anime.episodes || '?';
  const trailerUrl = anime.trailer?.url || '';

  return (
    <div className="detail-page page-content">
      {/* Hero Section */}
      <section className="detail-hero">
        <div className="detail-hero-bg" style={{ backgroundImage: `url(${bannerUrl})` }} />
        <div className="detail-hero-overlay" />
        <div className="detail-hero-content container">
          <div className="detail-poster-wrapper animate-fade-in-up">
            <img src={posterUrl} alt={title} className="detail-poster" loading="eager" />
          </div>
          <div className="detail-info animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            {japaneseTitle && <span className="detail-japanese-title">{japaneseTitle}</span>}
            <h1 className="detail-title">{title}</h1>
            <div className="detail-meta-row">
              {score !== 'N/A' && <span className="detail-meta-badge detail-score"><Star size={14} />{score}</span>}
              {type && <span className="detail-meta-badge"><Tv size={14} />{type}</span>}
              {seasonYear && <span className="detail-meta-badge"><Calendar size={14} />{seasonYear}</span>}
              {duration && <span className="detail-meta-badge"><Clock size={14} />{duration}</span>}
              {totalEpisodes !== '?' && <span className="detail-meta-badge">{totalEpisodes} eps</span>}
              {status && <span className={`status-badge ${getStatusClass(status)}`}>{getStatusText(status)}</span>}
            </div>
            {genres.length > 0 && <div className="detail-genres">{genres.map(g => <span key={g.mal_id} className="genre-tag">{g.name}</span>)}</div>}
            <div className={`detail-synopsis ${synopsis.length > 300 ? (synopsisExpanded ? 'expanded' : 'clamped') : ''}`}>
              <p>{synopsis}</p>
            </div>
            {synopsis.length > 300 && <button className="detail-synopsis-toggle" onClick={() => setSynopsisExpanded(!synopsisExpanded)}>{synopsisExpanded ? 'SHOW LESS' : 'READ FULL SYNOPSIS'}</button>}
            <div className="detail-actions">
              {anime.status?.toLowerCase() === 'not yet aired' ? (
                <button className="btn btn-secondary" disabled style={{ cursor: 'not-allowed', opacity: 0.6 }}>
                  Not Yet Aired
                </button>
              ) : (
                <Link to={`/watch/${anime.mal_id}`} className="btn btn-primary"><Play size={16} /> Watch Episode 1</Link>
              )}
              {getYouTubeId(anime.trailer) && (
                <button onClick={() => setShowTrailer(true)} className="btn btn-secondary">
                  <Play size={16} fill="currentColor" /> Trailer
                </button>
              )}
              <div className="detail-bookmark-wrapper">
                <button className={`btn ${bookmarked ? 'btn-bookmark-active' : 'btn-secondary'}`} onClick={handleBookmark} disabled={bookmarkLoading}>
                  {bookmarkLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
                  )}
                  {bookmarked ? 'Bookmarked' : 'Bookmark'}
                </button>
                {bookmarked && (
                  <select
                    className="bookmark-category-select"
                    value={bookmarkCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    disabled={bookmarkLoading}
                  >
                    <option value="Watching">Watching</option>
                    <option value="Plan to Watch">Plan to Watch</option>
                    <option value="Completed">Completed</option>
                    <option value="Dropped">Dropped</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Episodes & Relations Section */}
      <section className="detail-episodes-section container">
        <div className="detail-tabs-header">
          <button 
            className={`detail-tab-toggle-btn ${activeTab === 'episodes' ? 'active' : ''}`}
            onClick={() => setActiveTab('episodes')}
          >
            Episodes
            {totalEpisodes !== '?' && <span className="detail-tab-count">({totalEpisodes})</span>}
          </button>
          <button 
            className={`detail-tab-toggle-btn ${activeTab === 'relations' ? 'active' : ''}`}
            onClick={() => setActiveTab('relations')}
          >
            Relations
            {animeRelations.length > 0 && <span className="detail-tab-count">({animeRelations.length})</span>}
          </button>
        </div>

        {activeTab === 'episodes' ? (
          episodesLoading ? (
            <div className="detail-episodes-loading">
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span>Loading episodes...</span>
            </div>
          ) : computedEpisodes.length === 0 ? (
            <p className="detail-no-data">No episode data available yet.</p>
          ) : (
            <>
              {epTotalPages > 1 && (
                <div className="detail-episodes-pagination">
                  {Array.from({ length: epTotalPages }, (_, i) => {
                    const start = i * EP_PAGE_SIZE + 1;
                    const end = Math.min((i + 1) * EP_PAGE_SIZE, computedEpisodes.length);
                    return (
                      <button
                        key={i}
                        className={`detail-page-tab-btn ${episodesPage === i ? 'active' : ''}`}
                        onClick={() => setEpisodesPage(i)}
                      >
                        {start}-{end}
                      </button>
                    );
                  })}
                </div>
              )}
              
              <div className="detail-episodes-grid">
                {paginatedEpisodes.map((ep, idx) => {
                  const epNum = ep.mal_id || (episodesPage * EP_PAGE_SIZE) + idx + 1;
                  return (
                    <Link key={epNum} to={`/watch/${anime.mal_id}/${epNum}`}
                      className="detail-episode-btn" title={ep.title || `Episode ${epNum}`}>
                      {epNum}
                    </Link>
                  );
                })}
              </div>
            </>
          )
        ) : (
          relationsLoading ? (
            <div className="detail-episodes-loading">
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span>Loading relations...</span>
            </div>
          ) : animeRelations.length > 0 ? (
            <div className="detail-relations-container">
              {animeRelations.map((rel, idx) => (
                <div key={idx} className="detail-relation-group">
                  <span className="detail-relation-type">{rel.relation}</span>
                  <div className="detail-relation-entries">
                    {rel.entry.map(entry => (
                      <Link 
                        key={entry.mal_id} 
                        to={`/anime/${entry.mal_id}`} 
                        className="detail-relation-card glass-effect"
                      >
                        <span className="detail-relation-title">{entry.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="detail-no-data">No related anime found.</p>
          )
        )}
      </section>

      {/* Characters & Cast */}
      <section className="detail-characters-section container">
        <h2 className="detail-section-title">Characters & Cast</h2>
        {charsLoading ? (
          <div className="detail-chars-loading">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton detail-character-skeleton" />)}
          </div>
        ) : displayCharacters.length > 0 ? (
          <div className="detail-characters-grid">
            {displayCharacters.map(char => (
              <div key={char.character.mal_id} className="detail-character-card">
                <div className="detail-character-main">
                  <img src={char.character.images?.jpg?.image_url || ''} alt={char.character.name} className="detail-character-image" loading="lazy" />
                  <div className="detail-character-info">
                    <span className="detail-character-name">{char.character.name}</span>
                    <span className={`detail-character-role ${char.role?.toLowerCase()}`}>{char.role}</span>
                  </div>
                </div>
                {char.jpVA && (
                  <div className="detail-va">
                    <div className="detail-va-info">
                      <span className="detail-va-name">{char.jpVA.person?.name || ''}</span>
                      <span className="detail-va-lang">JP VA</span>
                    </div>
                    <img src={char.jpVA.person?.images?.jpg?.image_url || ''} alt={char.jpVA.person?.name || ''} className="detail-va-image" loading="lazy" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="detail-no-data">No character data available.</p>}
      </section>

      {/* You May Also Like — using AnimeRow for arrows */}
      <section className="detail-recommendations container">
        {recAnimeList.length > 0 || recsLoading ? (
          <AnimeRow 
            title="You May Also Like" 
            anime={recAnimeList} 
            loading={recsLoading} 
            onBookmark={handleCardBookmark}
            bookmarkedIds={bookmarkedIds}
          />
        ) : (
          <>
            <h2 className="detail-section-title">You May Also Like</h2>
            <p className="detail-no-data">No recommendations available.</p>
          </>
        )}
      </section>
      {showTrailer && getYouTubeId(anime.trailer) && (
        <div className="modal-overlay" onClick={() => setShowTrailer(false)}>
          <div className="modal-content trailer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="trailer-modal-header">
              <h3 className="trailer-modal-title">{title} - Official Trailer</h3>
              <button className="trailer-modal-close" onClick={() => setShowTrailer(false)} aria-label="Close trailer">
                <X size={20} />
              </button>
            </div>
            <div className="trailer-video-container">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(anime.trailer)}?autoplay=1`}
                title={`${title} Trailer`}
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

export default AnimeDetail;
