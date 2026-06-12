import { useEffect, useRef, useState, useCallback } from 'react';
import './HlsPlayer.css';

// Detect actual Safari/iOS (not Chrome pretending)
const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const USE_NATIVE_HLS = IS_SAFARI || IS_IOS;

// Pre-load hls.js immediately if not Safari
let hlsPromise = null;
function preloadHls() {
  if (hlsPromise) return hlsPromise;
  if (window.Hls) { hlsPromise = Promise.resolve(window.Hls); return hlsPromise; }
  hlsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js';
    s.onload = () => resolve(window.Hls);
    s.onerror = () => reject(new Error('Failed to load hls.js'));
    document.head.appendChild(s);
  });
  return hlsPromise;
}
if (!USE_NATIVE_HLS) preloadHls(); // start loading immediately

export default function HlsPlayer({ sources, poster, intro, outro, initialTime = 0, onProgress }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const progressRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);

  const introRef = useRef(intro);
  const outroRef = useRef(outro);
  const onProgressRef = useRef(onProgress);
  const lastProgressSaveRef = useRef(0);
  const lastTimeRef = useRef(initialTime);
  const hasSeekedRef = useRef(false);

  useEffect(() => {
    introRef.current = intro;
    outroRef.current = outro;
  }, [intro, outro]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    lastTimeRef.current = initialTime;
  }, [sources, initialTime]);

  const qualityOptions = sources?.length > 0
    ? (sources.length > 1 ? ['auto', ...sources.map(s => s.quality)] : [sources[0].quality])
    : [];

  const getStreamUrl = useCallback((quality) => {
    if (!sources?.length) return null;
    if (quality === 'auto' || !sources.find(s => s.quality === quality)) {
      const priority = ['1080p', '720p', '480p', '360p'];
      for (const q of priority) {
        const s = sources.find(src => src.quality === q);
        if (s) return s.streamUrl;
      }
      return sources[0]?.streamUrl;
    }
    return sources.find(s => s.quality === quality)?.streamUrl || null;
  }, [sources]);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, []);

  const streamUrl = getStreamUrl(currentQuality);

  // ---- MAIN: Initialize player ----
  useEffect(() => {
    if (!streamUrl) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    Promise.resolve().then(() => {
      setLoading(true);
    });

    video.pause();

    const resumePlayback = () => {
      setLoading(false);
      const targetTime = lastTimeRef.current;
      
      const seekAndPlay = () => {
        if (targetTime > 1) {
          video.currentTime = targetTime;
        }
        video.play().catch(() => {});
      };

      if (video.readyState >= 1) {
        seekAndPlay();
      } else {
        const onLoaded = () => {
          seekAndPlay();
          video.removeEventListener('loadedmetadata', onLoaded);
        };
        video.addEventListener('loadedmetadata', onLoaded);
      }
    };

    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('index.txt') || streamUrl.includes('/stream/');

    // Safari / iOS OR Non-HLS streams (like direct WebM/MP4 links)
    if (USE_NATIVE_HLS || !isHls) {
      destroyHls();
      video.src = streamUrl;
      
      const onLoadedData = () => {
        resumePlayback();
      };
      
      let nativeRetryCount = 0;
      const onError = () => {
        nativeRetryCount++;
        const lastTime = lastTimeRef.current;
        const retryDelay = Math.min(1000 * Math.pow(1.5, nativeRetryCount), 8000);
        console.warn(`Native playback error, retrying #${nativeRetryCount} in ${retryDelay}ms...`);
        setTimeout(() => {
          if (cancelled) return;
          video.load();
          
          const seekAndPlay = () => {
            if (lastTime > 1) {
              video.currentTime = lastTime;
            }
            video.play().catch(() => {});
          };

          if (video.readyState >= 1) {
            seekAndPlay();
          } else {
            const onLoaded = () => {
              seekAndPlay();
              video.removeEventListener('loadedmetadata', onLoaded);
            };
            video.addEventListener('loadedmetadata', onLoaded);
          }
        }, retryDelay);
      };

      video.addEventListener('loadeddata', onLoadedData, { once: true });
      video.addEventListener('error', onError);
      
      return () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        destroyHls();
      };
    }

    // Chrome / Firefox / Edge: hls.js
    let cancelled = false;
    preloadHls().then((Hls) => {
      if (cancelled || !Hls.isSupported()) {
        if (!cancelled) { console.error('Browser not supported'); setLoading(false); }
        return;
      }

      destroyHls();

      const retryPolicy = {
        maxTimeToFirstByteMs: 15000,
        maxLoadTimeMs: 25000,
        timeoutRetry: {
          maxNumRetry: 30,
          retryDelayMs: 1000,
          maxRetryDelayMs: 8000
        },
        errorRetry: {
          maxNumRetry: 30,
          retryDelayMs: 1000,
          maxRetryDelayMs: 8000
        }
      };

      const hlsConfig = {
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 30 * 1000 * 1000,
        enableSoftwareAES: true,
        fragLoadPolicy: { default: retryPolicy },
        manifestLoadPolicy: { default: retryPolicy },
        playlistLoadPolicy: { default: retryPolicy }
      };

      const hls = new Hls(hlsConfig);

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        resumePlayback();
      });

      // Error handling with silent automatic reloads on fatal errors
      let mediaRecoverCount = 0;
      let networkRecoverCount = 0;
      let generalRetryCount = 0;

      const reloadHlsStream = () => {
        generalRetryCount++;
        const lastTime = lastTimeRef.current;
        const retryDelay = Math.min(1000 * Math.pow(1.5, generalRetryCount), 8000);
        console.warn(`HLS fatal error, reloading stream (retry #${generalRetryCount}) in ${retryDelay}ms...`);
        
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        
        setTimeout(() => {
          if (cancelled) return;
          
          const newHls = new Hls(hlsConfig);
          
          hlsRef.current = newHls;
          newHls.loadSource(streamUrl);
          newHls.attachMedia(video);
          
          newHls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            setLoading(false);
            
            const seekAndPlay = () => {
              if (lastTime > 1) {
                video.currentTime = lastTime;
              }
              video.play().catch(() => {});
            };

            if (video.readyState >= 1) {
              seekAndPlay();
            } else {
              const onLoaded = () => {
                seekAndPlay();
                video.removeEventListener('loadedmetadata', onLoaded);
              };
              video.addEventListener('loadedmetadata', onLoaded);
            }
          });

          newHls.on(Hls.Events.ERROR, (_, errorData) => {
            if (cancelled || !errorData.fatal) return;
            reloadHlsStream();
          });
        }, retryDelay);
      };

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (cancelled) return;
        console.warn('[HLS]', data.type, data.details, data.fatal ? 'FATAL' : '');

        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          mediaRecoverCount++;
          if (mediaRecoverCount <= 3) {
            hls.recoverMediaError();
          } else {
            reloadHlsStream();
          }
        } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          networkRecoverCount++;
          if (networkRecoverCount <= 3) {
            hls.startLoad();
          } else {
            reloadHlsStream();
          }
        } else {
          reloadHlsStream();
        }
      });

      // Stall recovery
      let stallTimer = null;
      const onWaiting = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          if (video.paused || !hlsRef.current) return;
          console.log('[HLS] stall detected, recovering...');
          hlsRef.current.recoverMediaError();
        }, 6000);
      };
      const onPlaying = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);

      return () => {
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        if (stallTimer) clearTimeout(stallTimer);
      };
    }).catch((err) => {
      if (!cancelled) { console.error('Failed to load player:', err); setLoading(false); }
    });

    return () => { cancelled = true; destroyHls(); };
  }, [streamUrl, destroyHls]);

  // Reset seek tracking when URL changes
  useEffect(() => {
    hasSeekedRef.current = false;
  }, [streamUrl]);

  // Handle late-resolving initialTime (e.g. database progress fetch)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !initialTime || hasSeekedRef.current) return;
    
    if (video.readyState >= 1) {
      video.currentTime = initialTime;
      hasSeekedRef.current = true;
    } else {
      const handleLoaded = () => {
        video.currentTime = initialTime;
        hasSeekedRef.current = true;
        video.removeEventListener('loadedmetadata', handleLoaded);
      };
      video.addEventListener('loadedmetadata', handleLoaded);
      return () => video.removeEventListener('loadedmetadata', handleLoaded);
    }
  }, [initialTime, streamUrl]);

  // ---- Video events ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const triggerProgress = (time, dur) => {
      if (onProgressRef.current && dur) {
        onProgressRef.current(time, dur);
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      triggerProgress(video.currentTime, video.duration);
    };
    const onTime = () => {
      const t = video.currentTime;
      if (video.readyState === 0) return;
      setCurrentTime(t);
      lastTimeRef.current = t;
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
      
      const currentIntro = introRef.current;
      const currentOutro = outroRef.current;
      setShowSkipIntro(!!(currentIntro && t >= currentIntro.start && t < currentIntro.end));
      setShowSkipOutro(!!(currentOutro && t >= currentOutro.start && t < currentOutro.end));

      const now = Date.now();
      if (now - lastProgressSaveRef.current > 4000) {
        lastProgressSaveRef.current = now;
        triggerProgress(t, video.duration);
      }
    };
    const onDur = () => setDuration(video.duration || 0);
    const onVol = () => { setVolume(video.volume); setMuted(video.muted); };
    const onEnd = () => {
      setPlaying(false);
      triggerProgress(video.currentTime, video.duration);
    };

    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onSeeking = () => setLoading(true);
    const onSeeked = () => setLoading(false);
    const onCanPlay = () => setLoading(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('volumechange', onVol);
    video.addEventListener('ended', onEnd);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('volumechange', onVol);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  // ---- Auto-hide controls ----
  const resetControlsTimer = useCallback(() => {
    Promise.resolve().then(() => setShowControls(true));
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => { if (playing) setShowControls(false); }, 3500);
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      Promise.resolve().then(() => setShowControls(true));
      return;
    }
    resetControlsTimer();
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, [playing, resetControlsTimer]);

  // ---- Fullscreen ----
  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    const v = videoRef.current;
    if (!c) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      if (c.requestFullscreen) c.requestFullscreen();
      else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
      else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
    }
  }, []);

  useEffect(() => {
    const fn = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', fn);
    document.addEventListener('webkitfullscreenchange', fn);
    return () => { document.removeEventListener('fullscreenchange', fn); document.removeEventListener('webkitfullscreenchange', fn); };
  }, []);

  // ---- Player actions ----
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, []);

  const seek = useCallback((e) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  }, [duration]);

  const handleTouchSeek = useCallback((e) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const toggleMute = useCallback(() => { const v = videoRef.current; if (v) v.muted = !v.muted; }, []);
  const skipIntro = useCallback(() => {
    const currentIntro = introRef.current;
    if (videoRef.current && currentIntro) {
      videoRef.current.currentTime = currentIntro.end;
      setShowSkipIntro(false);
    }
  }, []);

  const skipOutro = useCallback(() => {
    const currentOutro = outroRef.current;
    if (videoRef.current && currentOutro) {
      videoRef.current.currentTime = currentOutro.end;
      setShowSkipOutro(false);
    }
  }, []);
  const switchQuality = useCallback((q) => {
    if (videoRef.current && videoRef.current.readyState > 0) {
      lastTimeRef.current = videoRef.current.currentTime;
    }
    setCurrentQuality(q);
    setShowQualityMenu(false);
  }, []);


  // ---- Keyboard ----
  useEffect(() => {
    const fn = (e) => {
      if (!containerRef.current?.contains(document.activeElement) && !isFullscreen) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(duration, v.currentTime + 10); break;
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); break;
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); break;
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [togglePlay, toggleFullscreen, toggleMute, duration, isFullscreen]);

  useEffect(() => () => destroyHls(), [destroyHls]);

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  };

  const pPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bPct = duration > 0 ? (buffered / duration) * 100 : 0;

  if (!sources?.length) {
    return (<div className="vp-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="vp-placeholder-icon"><polygon points="5 3 19 12 5 21 5 3" /></svg><span>No video source available</span></div>);
  }

  return (
    <div ref={containerRef} className={`vp ${isFullscreen ? 'vp--fullscreen' : ''} ${showControls ? 'vp--show-controls' : ''}`}
      onMouseMove={resetControlsTimer} onTouchStart={resetControlsTimer}
      onClick={(e) => { if (showQualityMenu && !e.target.closest('.vp-quality')) setShowQualityMenu(false); }}
      tabIndex={0}>

      <video ref={videoRef} className="vp-video" playsInline webkit-playsinline=""
        poster={poster} preload="auto" onClick={togglePlay} onDoubleClick={toggleFullscreen} />

      {loading && <div className="vp-overlay vp-loading"><div className="vp-spinner" /></div>}

      {!playing && !loading && showControls && (
        <button className="vp-big-play" onClick={togglePlay} aria-label="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
        </button>
      )}

      {showSkipIntro && <button className="vp-skip-btn" onClick={skipIntro}>Skip Intro →</button>}
      {showSkipOutro && <button className="vp-skip-btn vp-skip-outro" onClick={skipOutro}>Skip Outro →</button>}

      <div className={`vp-gradient ${showControls ? 'visible' : ''}`} />

      <div className={`vp-controls ${showControls ? 'visible' : ''}`}>
        <div
          className="vp-progress-wrapper"
          ref={progressRef}
          onClick={seek}
          onTouchStart={handleTouchSeek}
          onTouchMove={handleTouchSeek}
        >
          <div className="vp-progress-bar">
            {intro && duration > 0 && (
              <div
                className="vp-progress-highlight vp-progress-intro"
                style={{
                  left: `${(intro.start / duration) * 100}%`,
                  width: `${((intro.end - intro.start) / duration) * 100}%`
                }}
                title="Intro"
              />
            )}
            {outro && duration > 0 && (
              <div
                className="vp-progress-highlight vp-progress-outro"
                style={{
                  left: `${(outro.start / duration) * 100}%`,
                  width: `${((outro.end - outro.start) / duration) * 100}%`
                }}
                title="Outro"
              />
            )}
            <div className="vp-progress-buffered" style={{ width: `${bPct}%` }} />
            <div className="vp-progress-played" style={{ width: `${pPct}%` }}><div className="vp-progress-thumb" /></div>
          </div>
        </div>

        <div className="vp-controls-row">
          <div className="vp-controls-left">
            <button className="vp-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing
                ? <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="6 3 20 12 6 21 6 3" /></svg>}
            </button>
            <div className="vp-volume">
              <button className="vp-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted || volume === 0
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />{volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}</svg>}
              </button>
              <input type="range" className="vp-volume-slider" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={handleVolumeChange} />
            </div>
            <span className="vp-time">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>

          <div className="vp-controls-right">
            {qualityOptions.length > 1 && (
              <div className="vp-quality">
                <button className="vp-btn vp-quality-btn" onClick={() => setShowQualityMenu(!showQualityMenu)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span className="vp-quality-label">{currentQuality === 'auto' ? 'Auto' : currentQuality}</span>
                </button>
                {showQualityMenu && (
                  <div className="vp-quality-menu">
                    {qualityOptions.map(q => (
                      <button key={q} className={`vp-quality-option ${currentQuality === q ? 'active' : ''}`} onClick={() => switchQuality(q)}>
                        {q === 'auto' ? 'Auto' : q}
                        {currentQuality === q && <span className="vp-quality-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Show current quality badge when only 1 source */}
            {qualityOptions.length === 1 && <span className="vp-quality-badge">{qualityOptions[0]}</span>}

            <button className="vp-btn" onClick={toggleFullscreen} aria-label="Fullscreen">
              {isFullscreen
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}