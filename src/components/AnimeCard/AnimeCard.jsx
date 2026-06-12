import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Play, Bookmark, Loader2 } from 'lucide-react';
import './AnimeCard.css';

export default function AnimeCard({ 
  anime, 
  onClick, 
  onBookmark, 
  isBookmarked,
  isHoveredOverride = false,
  onMouseEnter,
  onMouseLeave
}) {
  const navigate = useNavigate();
  const [localLoading, setLocalLoading] = useState(false);

  if (!anime) return null;

  const imageUrl =
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    '';

  const title = anime.title_english || anime.title || 'Untitled';
  const score = anime.score || null;
  const type = anime.type || '';
  const episodes = anime.episodes;
  const trailerUrl = anime.trailer?.url || '';

  const progressMap = anime.progress || {};
  const currentEpisode = anime.currentEpisode || 1;
  const epProgress = progressMap[currentEpisode];
  const progressPercent = epProgress && epProgress.duration > 0
    ? (epProgress.currentTime / epProgress.duration) * 100
    : 0;

  const handleCardClick = () => {
    if (onClick) {
      onClick(anime);
    } else if (anime.isHistory) {
      navigate(`/watch/${anime.mal_id}/${currentEpisode}`);
    } else {
      navigate(`/anime/${anime.mal_id}`);
    }
  };

  const handleTrailerClick = (e) => {
    e.stopPropagation();
    if (trailerUrl) {
      window.open(trailerUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBookmarkClick = async (e) => {
    e.stopPropagation();
    if (onBookmark) {
      setLocalLoading(true);
      try {
        await onBookmark(anime);
      } catch (err) {
        console.error('Failed to toggle bookmark:', err);
      } finally {
        setLocalLoading(false);
      }
    }
  };

  return (
    <div 
      className={`anime-card${anime.isHistory ? ' anime-card--history' : ''}${isHoveredOverride ? ' is-hovered' : ''}`} 
      onClick={handleCardClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Poster */}
      <img
        className="anime-card-image"
        src={imageUrl}
        alt={title}
        loading="lazy"
        draggable={false}
      />

      {/* Score Badge */}
      {score && (
        <div className="anime-card-score">
          <Star size={11} />
          {score.toFixed(1)}
        </div>
      )}

      {/* Episode Badge (for Continue Watching) */}
      {anime.isHistory && currentEpisode && (
        <div className="anime-card-episode-badge">
          EP {currentEpisode}
        </div>
      )}

      {/* Hover Overlay */}
      <div className="anime-card-overlay">
        <div className="anime-card-info">
          <span className="anime-card-title">{title}</span>
          <div className="anime-card-meta">
            {type && <span>{type}</span>}
            {type && episodes != null && <span className="anime-card-meta-dot" />}
            {episodes != null && (
              <span>{episodes === 0 ? '?' : episodes} ep{episodes !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="anime-card-actions">
        {trailerUrl && (
          <button
            className="anime-card-action-btn"
            onClick={handleTrailerClick}
            aria-label="Preview"
            title="Preview"
          >
            <Play size={12} fill="currentColor" />
          </button>
        )}
        {!anime.isHistory && (
          <button
            className={`anime-card-action-btn${isBookmarked ? ' bookmarked' : ''}`}
            onClick={handleBookmarkClick}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            disabled={localLoading}
          >
            {localLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Bookmark size={12} fill={isBookmarked ? 'currentColor' : 'none'} />
            )}
          </button>
        )}
      </div>
      {/* Resume Progress Bar */}
      {progressPercent > 0 && (
        <div className="anime-card-progress-bar">
          <div className="anime-card-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}
    </div>
  );
}
