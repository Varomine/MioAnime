import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, Shuffle } from 'lucide-react';
import { getTrendingAnime, getTopAnime } from '../../services/jikanApi';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [randomLoading, setRandomLoading] = useState(false);
  // Fetch a randomized pool of popular anime to populate the moving cards background grid
  useEffect(() => {
    let active = true;
    
    // Pick two random pages from top 8 pages (ranks 1 to 200) to get a pool of 50 popular anime
    const page1 = Math.floor(Math.random() * 8) + 1;
    let page2 = Math.floor(Math.random() * 8) + 1;
    if (page1 === page2) {
      page2 = (page1 % 8) + 1;
    }

    Promise.all([
      getTopAnime({ page: page1, filter: 'bypopularity', limit: 25 }),
      getTopAnime({ page: page2, filter: 'bypopularity', limit: 25 })
    ])
      .then(([res1, res2]) => {
        if (!active) return;
        const combined = [...(res1?.data || []), ...(res2?.data || [])];
        
        // Filter out duplicate anime by mal_id
        const uniqueMap = new Map();
        combined.forEach(item => {
          if (item?.mal_id) uniqueMap.set(item.mal_id, item);
        });
        const uniqueList = Array.from(uniqueMap.values());
        
        // Shuffle the list to randomize columns on mount
        const shuffled = uniqueList.sort(() => Math.random() - 0.5);
        setTrending(shuffled);
      })
      .catch((err) => {
        console.error('Failed to fetch background grid media:', err);
        // Fallback: load trending if the parallel top load fails
        if (active) {
          getTrendingAnime().then(res => {
            if (active && res?.data) {
              setTrending(res.data.sort(() => Math.random() - 0.5));
            }
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Generates infinite loop column items
  const getColumnItems = useCallback((colIndex) => {
    if (trending.length === 0) return [];
    const colSize = 6;
    const colItems = [];
    for (let i = 0; i < colSize; i++) {
      const idx = (colIndex * colSize + i) % trending.length;
      colItems.push(trending[idx]);
    }
    // Duplicate for infinite keyframe scroll matching
    return [...colItems, ...colItems];
  }, [trending]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      navigate(`/browse?q=${encodeURIComponent(query)}`);
    }
  };

  const handleTagClick = (tag) => {
    navigate(`/browse?q=${encodeURIComponent(tag)}`);
  };

  const handleStartWatching = () => {
    navigate('/home');
  };

  const handleRandomAnime = async () => {
    if (randomLoading) return;
    setRandomLoading(true);
    try {
      // Pick a random page (1 to 4) of top popular anime to guarantee a high-quality valid detail page
      const randomPage = Math.floor(Math.random() * 4) + 1;
      const res = await getTopAnime({ page: randomPage, filter: 'bypopularity', limit: 25 });
      if (res?.data && res.data.length > 0) {
        const randomIdx = Math.floor(Math.random() * res.data.length);
        const selected = res.data[randomIdx];
        navigate(`/anime/${selected.mal_id}`);
      } else {
        throw new Error('Empty data from getTopAnime');
      }
    } catch (err) {
      console.error('Failed to get a random anime:', err);
      // Fallback: Pick a random anime from the currently scrolling list (which is guaranteed loaded)
      if (trending.length > 0) {
        const randomIdx = Math.floor(Math.random() * trending.length);
        navigate(`/anime/${trending[randomIdx].mal_id}`);
      }
    } finally {
      setRandomLoading(false);
    }
  };

  const popularTags = useMemo(() => {
    if (trending && trending.length > 0) {
      return trending.slice(0, 6).map(item => item.title_english || item.title);
    }
    return [];
  }, [trending]);

  return (
    <div className="landing-page">
      {/* ===== Tilted Scrolling Grid Backdrop ===== */}
      <div className="landing-grid-wrapper">
        <div className="landing-grid">
          {Array.from({ length: 5 }).map((_, colIdx) => {
            const colItems = getColumnItems(colIdx);
            const isReverse = colIdx % 2 === 1;
            return (
              <div key={colIdx} className={`grid-column ${isReverse ? 'reverse' : ''}`}>
                {colItems.length > 0 ? (
                  colItems.map((item, idx) => (
                    <div
                      key={`${colIdx}-${item.mal_id}-${idx}`}
                      className="grid-card"
                      onClick={() => navigate(`/anime/${item.mal_id}`)}
                    >
                      <img
                        src={item.images?.jpg?.large_image_url || item.images?.jpg?.image_url}
                        alt={item.title}
                        className="grid-card-img"
                        loading="lazy"
                      />
                      <div className="grid-card-overlay">
                        <span className="grid-card-title">{item.title_english || item.title}</span>
                        <span className="grid-card-play-btn">
                          <Play size={12} fill="currentColor" />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="grid-card skeleton" />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ambient Dark Tint Overlay */}
      <div className="landing-overlay" />

      {/* Landing Central Panels */}
      <div className="landing-content">
        <h1 className="landing-logo">MIOANIME</h1>
        <p className="landing-tagline">THE NEXT-GEN ANIME PLATFORM.</p>

        {/* Central Search Box */}
        <form className="landing-search-box" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Search anime..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="landing-search-input"
          />
          <button type="submit" className="landing-search-btn" aria-label="Search">
            <Search size={18} />
          </button>
        </form>

        {/* Tag Chips */}
        <div className="landing-tags-chips">
          {popularTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="landing-tag-chip"
              onClick={() => handleTagClick(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Actions buttons */}
        <div className="landing-actions">
          <button
            type="button"
            className="landing-cta-btn"
            onClick={handleStartWatching}
          >
            <span>Start Watching</span>
            <Play size={14} fill="currentColor" />
          </button>

          <button
            type="button"
            className="landing-cta-btn secondary"
            onClick={handleRandomAnime}
            disabled={randomLoading}
          >
            {randomLoading ? (
              <span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'var(--accent-gold)' }} />
            ) : (
              <>
                <span>Surprise Me</span>
                <Shuffle size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
