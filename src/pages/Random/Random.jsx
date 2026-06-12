import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Shuffle, Star, Calendar, Clock, Tv, Eye, AlertCircle } from 'lucide-react';
import { getRandomAnime, getStatusText, getStatusClass } from '../../services/jikanApi';
import './Random.css';

export default function Random() {
  const navigate = useNavigate();
  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  const fetchRandomAnime = async () => {
    setIsRolling(true);
    setLoading(true);
    setError(null);
    try {
      const res = await getRandomAnime();
      if (res?.data) {
        setAnime(res.data);
      } else {
        throw new Error('Failed to retrieve random anime data.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch a random anime. Please try again.');
    } finally {
      setLoading(false);
      // Extra delay to prevent button spamming and allow transition animation
      setTimeout(() => setIsRolling(false), 400);
    }
  };

  useEffect(() => {
    fetchRandomAnime();
  }, []);

  const handleWatch = () => {
    if (anime?.mal_id) {
      navigate(`/watch/${anime.mal_id}`);
    }
  };

  const handleViewDetails = () => {
    if (anime?.mal_id) {
      navigate(`/anime/${anime.mal_id}`);
    }
  };

  if (loading && !anime) {
    return (
      <div className="random-page page-content container">
        <div className="random-loading-container">
          <div className="spinner random-spinner"></div>
          <p className="random-loading-text">Channelling destiny...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="random-page page-content container">
      <div className="random-header-section">
        <h1 className="random-page-title gold-gradient">Destiny Roll</h1>
        <p className="random-page-desc">Roll the dice to find your next favorite anime masterpiece.</p>
      </div>

      <div className={`random-card-wrapper ${loading ? 'fade-out' : 'fade-in'}`}>
        {error ? (
          <div className="random-error-card">
            <AlertCircle size={40} className="random-error-icon" />
            <h2 className="random-error-title">Roll Failed</h2>
            <p className="random-error-text">{error}</p>
            <button className="btn btn-primary" onClick={fetchRandomAnime}>
              <Shuffle size={16} />
              <span>Retry Roll</span>
            </button>
          </div>
        ) : (
          anime && (
            <div className="random-anime-card glass-effect">
              {/* Left Column: Poster Image */}
              <div className="random-anime-poster-wrapper">
                <img
                  src={anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url}
                  alt={anime.title}
                  className="random-anime-poster"
                />
                {anime.score && (
                  <div className="random-anime-score">
                    <Star size={14} fill="currentColor" />
                    <span>{anime.score}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Information Panel */}
              <div className="random-anime-info">
                <div className="random-info-header">
                  {anime.title_japanese && (
                    <span className="random-japanese-title">{anime.title_japanese}</span>
                  )}
                  <h2 className="random-main-title">{anime.title_english || anime.title}</h2>
                  
                  <div className="random-meta-row">
                    {anime.type && (
                      <span className="random-meta-badge">
                        <Tv size={12} />
                        <span>{anime.type}</span>
                      </span>
                    )}
                    {anime.episodes && (
                      <span className="random-meta-badge">
                        <Clock size={12} />
                        <span>{anime.episodes} episodes</span>
                      </span>
                    )}
                    {(anime.year || anime.season) && (
                      <span className="random-meta-badge">
                        <Calendar size={12} />
                        <span>
                          {anime.season ? `${anime.season.toUpperCase()} ` : ''}
                          {anime.year || ''}
                        </span>
                      </span>
                    )}
                    {anime.status && (
                      <span className={`status-badge ${getStatusClass(anime.status)}`}>
                        {getStatusText(anime.status)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Genre Tags */}
                {anime.genres && anime.genres.length > 0 && (
                  <div className="random-genres-tags">
                    {anime.genres.slice(0, 5).map((genre) => (
                      <span key={genre.mal_id} className="genre-tag">
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Synopsis */}
                <div className="random-synopsis-section">
                  <h3 className="random-section-heading">Synopsis</h3>
                  <p className="random-synopsis-text">
                    {anime.synopsis || 'No synopsis available for this title.'}
                  </p>
                </div>

                {/* Interactive Actions */}
                <div className="random-actions-row">
                  {anime.status !== 'Not yet aired' ? (
                    <button className="btn btn-primary random-action-btn" onClick={handleWatch}>
                      <Play size={16} fill="currentColor" />
                      <span>Watch Episode 1</span>
                    </button>
                  ) : (
                    <button className="btn btn-primary random-action-btn" disabled>
                      <span>Not Yet Aired</span>
                    </button>
                  )}
                  
                  <button className="btn btn-secondary random-action-btn" onClick={handleViewDetails}>
                    <Eye size={16} />
                    <span>View Details</span>
                  </button>

                  <button
                    className={`btn btn-secondary random-action-btn roll-btn ${isRolling ? 'rolling' : ''}`}
                    onClick={fetchRandomAnime}
                    disabled={isRolling || loading}
                  >
                    <Shuffle size={16} className={isRolling ? 'spin' : ''} />
                    <span>Roll Again</span>
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
