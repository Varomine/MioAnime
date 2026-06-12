import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, Tv, Star } from 'lucide-react';
import {
  getWeeklySchedule,
  formatAiringTime,
  formatCountdown,
  getCurrentDayName,
} from '../../services/anilistApi';
import './Schedule.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ScheduleCardSkeleton() {
  return (
    <div className="schedule-card schedule-card-skeleton">
      <div className="schedule-card-image skeleton" />
      <div className="schedule-card-info">
        <div className="skeleton skeleton-title" style={{ width: '75%' }} />
        <div className="skeleton skeleton-text" style={{ width: '50%' }} />
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
        <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
          <div className="skeleton" style={{ width: '48px', height: '20px', borderRadius: '9999px' }} />
          <div className="skeleton" style={{ width: '56px', height: '20px', borderRadius: '9999px' }} />
        </div>
      </div>
    </div>
  );
}

export default function Schedule() {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState({});
  const [activeDay, setActiveDay] = useState(getCurrentDayName());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  const today = getCurrentDayName();

  const fetchSchedule = useCallback(async () => {
    await Promise.resolve();
    try {
      setLoading(true);
      setError(null);
      const data = await getWeeklySchedule();
      setSchedule(data);
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      setError('Failed to load the weekly schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchSchedule());
  }, [fetchSchedule]);

  // Update countdown every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCardClick = (media) => {
    if (media.idMal) {
      navigate(`/anime/${media.idMal}`);
    }
  };

  const handleDayChange = (day) => {
    setActiveDay(day);
  };

  const getStudioName = (media) => {
    const mainStudio = media.studios?.edges?.find((e) => e.isMain);
    return mainStudio?.node?.name || null;
  };

  const getDisplayScore = (score) => {
    if (!score) return null;
    return (score / 10).toFixed(1);
  };

  const entries = schedule[activeDay] || [];

  return (
    <div className="schedule-page page-content">
      <div className="container">
        {/* Header */}
        <div className="schedule-header animate-fade-in-up">
          <div className="schedule-header-text">
            <h1 className="schedule-title">
              <Calendar size={28} className="schedule-title-icon" />
              Airing Schedule
            </h1>
            <p className="schedule-subtitle">
              Track weekly anime episodes as they air
            </p>
          </div>
        </div>

        {/* Day Tabs */}
        <div className="schedule-tabs-wrapper animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="schedule-tabs">
            {DAYS.map((day) => (
              <button
                key={day}
                className={`schedule-tab${activeDay === day ? ' active' : ''}${day === today ? ' today' : ''}`}
                onClick={() => handleDayChange(day)}
              >
                <span className="schedule-tab-label">{day}</span>
                <span className="schedule-tab-short">{day.slice(0, 3)}</span>
                {day === today && <span className="schedule-tab-today-dot" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="schedule-content" key={activeDay}>
          {loading ? (
            <div className="schedule-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <ScheduleCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="schedule-error empty-state">
              <Tv size={48} className="empty-state-icon" />
              <p className="empty-state-title">Something went wrong</p>
              <p className="empty-state-text">{error}</p>
              <button className="btn btn-primary" onClick={fetchSchedule}>
                Try Again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="schedule-empty empty-state">
              <Calendar size={48} className="empty-state-icon" />
              <p className="empty-state-title">No Airings</p>
              <p className="empty-state-text">
                No anime episodes are scheduled to air on {activeDay}.
              </p>
            </div>
          ) : (
            <div className="schedule-grid">
              {entries.map((entry, index) => {
                const { media, airingAt, episode } = entry;
                const title = media.title?.english || media.title?.romaji || 'Untitled';
                const studio = getStudioName(media);
                const score = getDisplayScore(media.averageScore);
                const genres = (media.genres || []).slice(0, 3);
                const isAired = airingAt < now;
                const remainingSeconds = airingAt - now;
                const countdown = isAired ? 'Aired' : formatCountdown(remainingSeconds);

                return (
                  <div
                    key={entry.id}
                    className={`schedule-card${media.idMal ? ' clickable' : ''}${isAired ? ' aired' : ''}`}
                    onClick={() => handleCardClick(media)}
                    style={{ animationDelay: `${index * 0.04}s` }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCardClick(media)}
                  >
                    <div className="schedule-card-image-wrapper">
                      <img
                        className="schedule-card-image"
                        src={media.coverImage?.large || media.coverImage?.extraLarge}
                        alt={title}
                        loading="lazy"
                      />
                      <div className="schedule-card-ep-badge">
                        EP {episode}
                      </div>
                    </div>

                    <div className="schedule-card-info">
                      <h3 className="schedule-card-title" title={title}>
                        {title}
                      </h3>

                      {studio && (
                        <span className="schedule-card-studio">{studio}</span>
                      )}

                      <div className="schedule-card-meta">
                        <span className={`schedule-card-time${!isAired ? ' upcoming' : ''}`}>
                          <Clock size={13} />
                          {formatAiringTime(airingAt)}
                        </span>

                        {score && (
                          <span className="schedule-card-score">
                            <Star size={13} />
                            {score}
                          </span>
                        )}
                      </div>

                      <div className={`schedule-countdown${isAired ? ' aired' : ' live'}`}>
                        {isAired ? 'Aired' : countdown}
                      </div>

                      {genres.length > 0 && (
                        <div className="schedule-card-genres">
                          {genres.map((genre) => (
                            <span key={genre} className="schedule-genre-tag">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
