import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Play, Bookmark, ExternalLink, Star, Tv, Clock, Calendar, AlertCircle, ChevronLeft, ChevronRight, X, Loader2, AlertTriangle, MessageSquare, Send, Trash2 } from 'lucide-react';
import { searchAnikage, getAnikageEpisodes, getAnikageStreams, getBestSource } from '../../services/animepaheApi';
import { search123Anime, get123AnimeStream } from '../../services/123animeApi';
import { searchOtaku, getOtakuStream } from '../../services/otakuApi';
import { getHAnimeStreams } from '../../services/hanimeApi';
import { searchAniDb, getAniDbAnime, getAniDbEpisodeStream, findBestAniDbMatch } from '../../services/aniDbApi';
import { searchVerse, getVerseStream } from '../../services/verseApi';
import { searchBd, getBdAnimeDetails, getBdStream } from '../../services/bdApi';
import { getReanimeEpisodes } from '../../services/reanimeApi';
import { getAnimeById, getAnimeRelations, getStatusText, getStatusClass } from '../../services/jikanApi';

import { searchMio, getMioAnime, getMioEpisodes, getMioEpisodeStream } from '../../services/mioApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { addBookmark, removeBookmark, isBookmarked, updateBookmarkCategory, getBookmarks } from '../../services/bookmarkService';
import { updateWatchHistory, saveEpisodeProgress, getEpisodeProgress } from '../../services/watchHistoryService';
import { getComments, addComment, deleteComment, addReply, deleteReply } from '../../services/commentService';
import { addNotification } from '../../services/notificationService';
import HlsPlayer from '../../components/HlsPlayer/HlsPlayer';
import './Streaming.css';

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

function findBestVerseMatch(animeData, items) {
  if (!animeData || !items || items.length === 0) return null;

  const targetTitles = [
    animeData.title,
    animeData.title_english,
    ...(animeData.title_synonyms || [])
  ].filter(Boolean);

  const scoredResults = items.map(r => {
    const resultTitles = [
      r.title,
      r.alternativeTitle
    ].filter(Boolean);

    let bestScore = 0;

    for (const t of targetTitles) {
      const tNorm = normalizeTitle(t);
      const tSeason = getSeasonNumber(t) || 1;
      const tBase = cleanTitleForBaseComparison(tNorm);

      for (const rT of resultTitles) {
        const rNorm = normalizeTitle(rT);
        const rSeason = getSeasonNumber(rNorm) || 1;
        const rBase = cleanTitleForBaseComparison(rNorm);

        if (tSeason !== rSeason) continue;

        if (tBase === rBase) {
          bestScore = Math.max(bestScore, 100);
        } else if (tBase.includes(rBase) || rBase.includes(tBase)) {
          const ratio = Math.min(tBase.length, rBase.length) / Math.max(tBase.length, rBase.length);
          const score = 50 + Math.floor(ratio * 40);
          bestScore = Math.max(bestScore, score);
        } else {
          const tTokens = tBase.split(' ').filter(tk => tk.length > 2);
          const rTokens = rBase.split(' ').filter(tk => tk.length > 2);
          if (tTokens.length > 0 && rTokens.length > 0) {
            const common = tTokens.filter(tk => rTokens.includes(tk));
            const maxRatio = Math.max(common.length / tTokens.length, common.length / rTokens.length);
            if (maxRatio >= 0.7) {
              bestScore = Math.max(bestScore, Math.floor(maxRatio * 50));
            }
          }
        }
      }
    }

    return { result: r, score: bestScore };
  });

  const validMatches = scoredResults.filter(item => item.score > 0);
  if (validMatches.length === 0) return null;

  validMatches.sort((a, b) => b.score - a.score);
  return validMatches[0].result;
}



function normalizeMioTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0e00-\u0e7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMioSeasonNumber(titleStr) {
  const norm = titleStr.toLowerCase();
  
  // 1. Check Thai season pattern "ภาค [เลข]" (e.g. ภาค 4, ภาค 1)
  const thaiMatch = norm.match(/ภาค\s*(\d+)/);
  if (thaiMatch) {
    return parseInt(thaiMatch[1]);
  }

  // 2. Check standard English season patterns
  const seasonMatch = norm.match(/season\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/);
  if (seasonMatch) {
    const val = seasonMatch[1];
    if (/\d+/.test(val)) return parseInt(val);
    const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    return words[val] || null;
  }
  const ordinalMatch = norm.match(/(\d+)(st|nd|rd|th)\s+season/);
  if (ordinalMatch) {
    return parseInt(ordinalMatch[1]);
  }
  const romanMatch = norm.match(/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/);
  if (romanMatch) {
    const roman = romanMatch[1];
    const map = { ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    return map[roman] || null;
  }
  return null;
}

function cleanMioTitleForBaseComparison(normTitle) {
  return normTitle
    .replace(/ภาค\s*\d+/g, '')
    .replace(/season\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/g, '')
    .replace(/(\d+)(st|nd|rd|th)\s+season/g, '')
    .replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/g, '')
    .replace(/[\u0e00-\u0e7f]/g, '')
    .replace(/\b(ova|sp|special|ona|movie|completed|etc)\b/g, '')
    .replace(/\b\d+(-\d+)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestMioMatch(animeData, results) {
  if (!animeData || !results || results.length === 0) return null;

  const targetTitles = [
    animeData.title,
    animeData.title_english,
    ...(animeData.title_synonyms || [])
  ].filter(Boolean);

  const scoredResults = results.map(r => {
    const resultTitles = [
      r.title
    ].filter(Boolean);

    let bestScore = 0;

    for (const t of targetTitles) {
      const tNorm = normalizeMioTitle(t);
      const tSeason = getMioSeasonNumber(t) || 1;
      const tBase = cleanMioTitleForBaseComparison(tNorm);

      for (const rT of resultTitles) {
        const rNorm = normalizeMioTitle(rT);
        const rSeason = getMioSeasonNumber(rNorm) || 1;
        const rBase = cleanMioTitleForBaseComparison(rNorm);

        if (tSeason !== rSeason) continue;

        if (tBase === rBase) {
          bestScore = Math.max(bestScore, 100);
        } else if (tBase.includes(rBase) || rBase.includes(tBase)) {
          const ratio = Math.min(tBase.length, rBase.length) / Math.max(tBase.length, rBase.length);
          const score = 50 + Math.floor(ratio * 40);
          bestScore = Math.max(bestScore, score);
        } else {
          const tTokens = tBase.split(' ').filter(tk => tk.length > 2);
          const rTokens = rBase.split(' ').filter(tk => tk.length > 2);
          if (tTokens.length > 0 && rTokens.length > 0) {
            const common = tTokens.filter(tk => rTokens.includes(tk));
            const maxRatio = Math.max(common.length / tTokens.length, common.length / rTokens.length);
            if (maxRatio >= 0.7) {
              bestScore = Math.max(bestScore, Math.floor(maxRatio * 50));
            }
          }
        }
      }
    }

    return { result: r, score: bestScore };
  });

  const validMatches = scoredResults.filter(item => item.score > 0);
  if (validMatches.length === 0) return null;

  validMatches.sort((a, b) => b.score - a.score);
  return validMatches[0].result;
}

// Cache slugs to avoid re-searching
const slugCache = new Map();

// Render text with highlighted mentions
function renderCommentText(text) {
  if (!text) return null;
  const regex = /(@[a-zA-Z0-9._@-]+)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return <span key={index} className="mention-highlight">{part}</span>;
    }
    return part;
  });
}

function Streaming({ onShowAuth }) {
  const { id, episode } = useParams();
  const episodeParam = episode;
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { defaultServer } = useSettings();

  const [anime, setAnime] = useState(null);
  const [animeLoading, setAnimeLoading] = useState(true);

  const [anikageSlug, setAnikageSlug] = useState(null);
  const [anikageEpisodes, setAnikageEpisodes] = useState([]);
  const [totalEpisodeCount, setTotalEpisodeCount] = useState(0);

  const [currentEpisode, setCurrentEpisode] = useState(parseInt(episodeParam) || 1);
  const [streamSources, setStreamSources] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [introTimestamp, setIntroTimestamp] = useState(null);
  const [outroTimestamp, setOutroTimestamp] = useState(null);

  const [activeServer, setActiveServer] = useState(defaultServer === 'miko' ? 'koto' : (defaultServer || 'neko'));
  const [showServerModal, setShowServerModal] = useState(false);
  const [selectedNekoSourceIndex, setSelectedNekoSourceIndex] = useState(0);
  const [fourAnimoServer, setFourAnimoServer] = useState('hd-1');

  // Report Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportServer, setReportServer] = useState(defaultServer === 'miko' ? 'koto' : (defaultServer || 'neko'));
  const [reportProblem, setReportProblem] = useState('Server not working');
  const [reportNote, setReportNote] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Comment States
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [fetchCommentsLoading, setFetchCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState(null);

  // Reply States
  const [activeReplyCommentId, setActiveReplyCommentId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { userId, userName }
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null); // { id, parentCommentId, type: 'comment' | 'reply' }

  const prevDefaultServerRef = useRef(defaultServer);

  // Fetch Comments on mount, id, or episode change
  useEffect(() => {
    if (!id) return;
    let active = true;
    setFetchCommentsLoading(true);
    getComments(id, currentEpisode).then(list => {
      if (active) {
        setComments(list || []);
        setFetchCommentsLoading(false);
      }
    }).catch(err => {
      console.error('Failed to fetch comments:', err);
      if (active) setFetchCommentsLoading(false);
    });
    return () => { active = false; };
  }, [id, currentEpisode, isAuthenticated]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;
    setCommentLoading(true);
    setCommentError(null);
    try {
      const newComment = await addComment(
        id,
        currentEpisode,
        user.uid,
        user.displayName || user.email,
        user.photoURL,
        commentText
      );
      if (newComment) {
        setComments(prev => [newComment, ...prev]);
        setCommentText('');
      } else {
        throw new Error('Failed to post comment.');
      }
    } catch (err) {
      setCommentError(err.message || 'Failed to post comment.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    setDeleteConfirmTarget({ id: commentId, type: 'comment' });
  };

  const executeDeleteConfirm = async () => {
    if (!deleteConfirmTarget || !user) return;
    const { id: targetId, parentCommentId, type } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);
    setCommentError(null);
    try {
      if (type === 'comment') {
        const success = await deleteComment(id, currentEpisode, targetId, user.uid);
        if (success) {
          setComments(prev => prev.filter(c => c.id !== targetId));
        } else {
          throw new Error('Failed to delete comment.');
        }
      } else if (type === 'reply') {
        const success = await deleteReply(id, currentEpisode, parentCommentId, targetId, user.uid);
        if (success) {
          setComments(prev => prev.map(c => {
            if (c.id === parentCommentId) {
              return {
                ...c,
                replies: (c.replies || []).filter(r => r.id !== targetId)
              };
            }
            return c;
          }));
        } else {
          throw new Error('Failed to delete reply.');
        }
      }
    } catch (err) {
      setCommentError(err.message || 'Failed to delete comment.');
    }
  };

  const handleToggleReply = (commentId, parentUserId, parentUserName) => {
    if (activeReplyCommentId === commentId) {
      setActiveReplyCommentId(null);
      setReplyText('');
      setReplyingTo(null);
    } else {
      setActiveReplyCommentId(commentId);
      setReplyText('');
      setReplyingTo({
        userId: parentUserId,
        userName: parentUserName
      });
    }
  };

  const handleReplyToReply = (commentId, replyUserId, replyUserName) => {
    setActiveReplyCommentId(commentId);
    setReplyText(`@${replyUserName} `);
    setReplyingTo({
      userId: replyUserId,
      userName: replyUserName
    });
  };

  const handlePostReply = async (e, commentId) => {
    e.preventDefault();
    if (!replyText.trim() || !user) return;
    setReplyLoading(true);
    setCommentError(null);
    try {
      const result = await addReply(
        id,
        currentEpisode,
        commentId,
        user.uid,
        user.displayName || user.email,
        user.photoURL,
        replyText
      );

      if (result && result.reply) {
        setComments(prev => prev.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              replies: [...(c.replies || []), result.reply]
            };
          }
          return c;
        }));

        // Find notification target user (prioritize user being replied to directly if mentioned)
        let targetUserId = result.parentUserId;
        if (replyingTo && replyText.startsWith(`@${replyingTo.userName}`)) {
          targetUserId = replyingTo.userId;
        }

        // Trigger notification to the target user (if it's not the replier themselves)
        if (targetUserId && targetUserId !== user.uid) {
          await addNotification({
            targetUserId,
            fromUserId: user.uid,
            fromUserName: user.displayName || user.email,
            fromUserAvatar: user.photoURL || '',
            animeId: id,
            animeTitle: titleDisplay,
            episode: currentEpisode,
            text: replyText
          });
        }

        setReplyText('');
        setActiveReplyCommentId(null);
        setReplyingTo(null);
      } else {
        throw new Error('Failed to post reply.');
      }
    } catch (err) {
      setCommentError(err.message || 'Failed to post reply.');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleDeleteReply = (commentId, replyId) => {
    setDeleteConfirmTarget({ id: replyId, parentCommentId: commentId, type: 'reply' });
  };

  // Sync server if default changes in settings
  useEffect(() => {
    if (defaultServer && defaultServer !== prevDefaultServerRef.current) {
      setActiveServer(defaultServer);
      prevDefaultServerRef.current = defaultServer;
    }
  }, [defaultServer]);

  // Reset selected neko source on episode or id change
  useEffect(() => {
    setSelectedNekoSourceIndex(0);
  }, [currentEpisode, id]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [sourceError, setSourceError] = useState(null);

  const [oneTwoThreeId, setOneTwoThreeId] = useState(null);
  const [oneTwoThreeLoading, setOneTwoThreeLoading] = useState(false);
  const [oneTwoThreeEmbedUrl, setOneTwoThreeEmbedUrl] = useState(null);
  const [oneTwoThreeError, setOneTwoThreeError] = useState(null);

  const [otakuOsid, setOtakuOsid] = useState(null);
  const [otakuLoading, setOtakuLoading] = useState(false);
  const [otakuError, setOtakuError] = useState(null);

  const [aniDbId, setAniDbId] = useState(null);
  const [aniDbLoading, setAniDbLoading] = useState(false);
  const [aniDbError, setAniDbError] = useState(null);
  const [aniDbSubtitles, setAniDbSubtitles] = useState([]);
  const [aniDbEpisodes, setAniDbEpisodes] = useState([]);
  const [aniDbEpisodesLoading, setAniDbEpisodesLoading] = useState(false);

  const [bdId, setBdId] = useState(null);
  const [bdAnimeDetails, setBdAnimeDetails] = useState(null);
  const [bdLoading, setBdLoading] = useState(false);
  const [bdError, setBdError] = useState(null);

  const [aniZipEpisodes, setAniZipEpisodes] = useState([]);
  const [aniZipLoading, setAniZipLoading] = useState(false);
  const [anilistId, setAnilistId] = useState(null);

  const [reanimeEpisodes, setReanimeEpisodes] = useState([]);
  const [reanimeLoading, setReanimeLoading] = useState(false);
  const [reanimeError, setReanimeError] = useState(null);



  const [mioId, setMioId] = useState(null);
  const [mioLoading, setMioLoading] = useState(false);
  const [mioError, setMioError] = useState(null);
  const [mioEpisodes, setMioEpisodes] = useState([]);

  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkCategory, setBookmarkCategory] = useState('');
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [relations, setRelations] = useState([]);
  const [relationsLoading, setRelationsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('episodes');

  // Episode pagination state
  const [episodesPage, setEpisodesPage] = useState(0);

  // Watch progress state
  const [initialProgress, setInitialProgress] = useState(null);

  // Track if slug has been resolved for this anime ID
  const resolvedForId = useRef(null);

  const rangesScrollRef = useRef(null);
  const scrollRanges = useCallback((direction) => {
    if (rangesScrollRef.current) {
      const scrollAmount = direction === 'left' ? -120 : 120;
      rangesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }, []);


  // iOS check
  const IS_IOS = useMemo(() => {
    return typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }, []);

  // Get best source from streamSources for iOS fallback
  const bestSource = useMemo(() => {
    return getBestSource(streamSources);
  }, [streamSources]);

  const hardsubSources = useMemo(() => {
    const hardsubs = streamSources.filter(s => s.type === 'hardsub' || s.quality?.toLowerCase().includes('hardsub'));
    return hardsubs.length > 0 ? hardsubs : streamSources;
  }, [streamSources]);

  // Search Anikage for matching anime
  async function searchAnikageForAnime(animeData, malId, cancelled) {
    if (malId === 5042) {
      slugCache.set(5042, { slug: '8XzUtDNZYp', totalEpisodes: 12 });
      setAnikageSlug('8XzUtDNZYp');
      setTotalEpisodeCount(12);
      resolvedForId.current = 5042;
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    const titles = [...new Set([
      animeData.title,
      animeData.title_english,
      animeData.title_japanese,
    ].filter(Boolean))];

    let allCandidates = [];
    const seenSlugs = new Set();

    for (const title of titles) {
      if (cancelled) return;
      try {
        const results = await searchAnikage(title);
        if (results && results.length > 0) {
          for (const r of results) {
            if (r.slug && !seenSlugs.has(r.slug)) {
              seenSlugs.add(r.slug);
              allCandidates.push(r);
            }
          }
        }
      } catch (err) {
        console.error(`Search failed for "${title}":`, err);
      }
    }

    const match = findBestAnikageMatch(animeData, allCandidates);

    if (match) {
      // Cache it
      slugCache.set(malId, { slug: match.slug, totalEpisodes: match.totalEpisodes || match.currentEpisode || 0 });
      setAnikageSlug(match.slug);
      setTotalEpisodeCount(match.totalEpisodes || match.currentEpisode || 0);
      resolvedForId.current = malId;
      setSearchLoading(false);
      return;
    }

    if (!cancelled) {
      setSearchError('This server does not have that anime.');
      setSearchLoading(false);
    }
  }

  // Search 123Anime for matching anime
  async function searchOneTwoThreeForAnime(animeData, cancelled) {
    setOneTwoThreeLoading(true);
    setOneTwoThreeError(null);

    const titles = [...new Set([
      animeData.title,
      animeData.title_english,
      animeData.title_japanese,
    ].filter(Boolean))];

    for (const title of titles) {
      if (cancelled) return;
      try {
        const match = await search123Anime(title);
        if (match && match.id) {
          setOneTwoThreeId(match.id);
          setOneTwoThreeLoading(false);
          return;
        }
      } catch (err) {
        console.error(`123Anime search failed for "${title}":`, err);
      }
    }

    if (!cancelled) {
      setOneTwoThreeError('Anime not found on 123Anime server.');
      setOneTwoThreeLoading(false);
    }
  }

  // Search Otaku for matching anime
  async function searchOtakuForAnime(animeData, cancelled) {
    setOtakuLoading(true);
    setOtakuError(null);

    const titles = [...new Set([
      animeData.title_english,
      animeData.title,
      animeData.title_japanese,
      ...(animeData.title_synonyms || [])
    ].filter(Boolean))];

    for (const title of titles) {
      if (cancelled) return;
      try {
        const match = await searchOtaku(title);
        if (match && match.osid) {
          setOtakuOsid(match.osid);
          setOtakuLoading(false);
          return;
        }
      } catch (err) {
        console.error(`Otaku search failed for "${title}":`, err);
      }
    }

    if (!cancelled) {
      setOtakuError('Anime not found on Otaku server.');
      setOtakuLoading(false);
    }
  }

  // Search BD for matching anime
  async function searchBdForAnime(animeData, cancelled) {
    setBdLoading(true);
    setBdError(null);

    const titles = [...new Set([
      animeData.title_english,
      animeData.title,
      animeData.title_japanese,
      ...(animeData.title_synonyms || [])
    ].filter(Boolean))];

    for (const title of titles) {
      if (cancelled) return;
      try {
        const match = await searchBd(title);
        if (match && match.id) {
          setBdId(match.id);
          const details = await getBdAnimeDetails(match.id);
          if (!cancelled && details) {
            setBdAnimeDetails(details);
          }
          setBdLoading(false);
          return;
        }
      } catch (err) {
        console.error(`BD search failed for "${title}":`, err);
      }
    }

    if (!cancelled) {
      setBdError('Anime not found on BD server.');
      setBdLoading(false);
    }
  }

  // Search AniDB for matching anime
  async function searchAniDbForAnime(animeData, cancelled) {
    setAniDbLoading(true);
    setAniDbError(null);

    const titles = [...new Set([
      animeData.title_english,
      animeData.title,
      animeData.title_japanese
    ].filter(Boolean))];

    for (const title of titles) {
      if (cancelled) return;
      try {
        const results = await searchAniDb(title);
        if (cancelled) return;
        const match = findBestAniDbMatch(animeData, results);
        if (match && match.id) {
          setAniDbId(match.id);
          setAniDbLoading(false);
          fetchAniDbEpisodesList(match.id, cancelled);
          return;
        }
      } catch (err) {
        console.error(`AniDB search failed for "${title}":`, err);
      }
    }

    if (!cancelled) {
      setAniDbError('Anime not found on DB server.');
      setAniDbLoading(false);
    }
  }

  // Fetch episodes for AniDB
  async function fetchAniDbEpisodesList(aniDbId, cancelled) {
    setAniDbEpisodesLoading(true);
    try {
      const data = await getAniDbAnime(aniDbId);
      if (cancelled) return;
      setAniDbEpisodes(data?.episodes || []);
    } catch (err) {
      console.error('AniDB episodes fetch failed:', err);
    } finally {
      if (!cancelled) setAniDbEpisodesLoading(false);
    }
  }

  // Fetch AniZip mappings for episode screenshots and titles
  async function fetchAniZip(malId, cancelled) {
    setAniZipLoading(true);
    try {
      const res = await fetch(`https://api.ani.zip/mappings?mal_id=${malId}`);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        const idAnilist = data?.mappings?.anilist_id;
        setAnilistId(idAnilist);
        
        if (data.episodes) {
          const parsed = Object.values(data.episodes)
            .filter(ep => {
              const num = parseInt(ep.episode);
              if (isNaN(num)) return false;
              if (ep.airdate) {
                const now = new Date();
                const epDate = new Date(ep.airdate);
                if (epDate > now) return false;
              }
              return true;
            })
            .map(ep => {
              const num = parseInt(ep.episode);
              const title = ep.title?.en || ep.title?.ja || ep.title?.['x-jat'] || `Episode ${num}`;
              return {
                number: num,
                title: title,
                img: ep.image || null,
                description: ep.overview || ep.summary || ''
              };
            })
            .sort((a, b) => a.number - b.number);
          setAniZipEpisodes(parsed);
        }
      }
    } catch (err) {
      console.error('api.ani.zip fetch failed:', err);
    } finally {
      if (!cancelled) setAniZipLoading(false);
    }
  }

  // ---- Fetch Reanime episodes when anilistId is resolved ----
  useEffect(() => {
    if (!anilistId) {
      setReanimeEpisodes([]);
      return;
    }
    let cancelled = false;
    async function fetchReanime() {
      setReanimeLoading(true);
      setReanimeError(null);
      try {
        const data = await getReanimeEpisodes(anilistId);
        if (cancelled) return;
        if (data && data.success && data.episodes) {
          setReanimeEpisodes(data.episodes);
        } else {
          setReanimeError('No streaming episodes found on Reanime.');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Reanime fetch error:', err);
          setReanimeError('Failed to fetch streaming episodes from Reanime.');
        }
      } finally {
        if (!cancelled) setReanimeLoading(false);
      }
    }
    fetchReanime();
    return () => { cancelled = true; };
  }, [anilistId]);



  // Search Mio for matching anime
  async function searchMioForAnime(animeData, cancelled) {
    setMioLoading(true);
    setMioError(null);
    setMioEpisodes([]);

    const titles = [...new Set([
      animeData.title,
      animeData.title_english,
      animeData.title_japanese,
    ].filter(Boolean))];

    for (const title of titles) {
      if (cancelled) return;
      try {
        const results = await searchMio(title);
        const match = findBestMioMatch(animeData, results);
        if (match && match.id && String(match.id).trim() && !String(match.id).includes('.') && !String(match.id).includes('/')) {
          setMioId(match.id);
          const details = await getMioAnime(match.id);
          if (cancelled) return;
          if (details && details.seasons && details.seasons.length > 0) {
            const seasonUrl = details.seasons[0].url;
            const eps = await getMioEpisodes(seasonUrl);
            if (cancelled) return;
            setMioEpisodes(eps || []);
            setMioLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error(`Mio search/details fetch failed for "${title}":`, err);
      }
    }

    if (!cancelled) {
      setMioError('Anime not found on Mio server.');
      setMioLoading(false);
    }
  }

  // ---- Step 1+2: Fetch Jikan + search Anikage IN PARALLEL ----
  useEffect(() => {
    let cancelled = false;
    const malId = parseInt(id);

    // Reset state for new anime
    Promise.resolve().then(() => {
      if (cancelled) return;
      setAnime(null);
      setAnimeLoading(true);
      setAnikageSlug(null);
      setAnikageEpisodes([]);
      setSearchError(null);
      setStreamSources([]);
      setOneTwoThreeId(null);
      setOneTwoThreeEmbedUrl(null);
      setOneTwoThreeError(null);
      setOtakuOsid(null);
      setOtakuError(null);
      setBdId(null);
      setBdAnimeDetails(null);
      setBdError(null);
      setAniDbId(null);
      setAniDbError(null);
      setAniDbSubtitles([]);
      setAniDbEpisodes([]);
      setAniZipEpisodes([]);
      setAniZipLoading(false);
      setAnilistId(null);
      setReanimeEpisodes([]);
      setReanimeLoading(false);
      setReanimeError(null);
      setMioId(null);
      setMioError(null);
      setMioEpisodes([]);
    });
    resolvedForId.current = null;
  
    // Check slug cache
    if (malId === 5042) {
      slugCache.set(5042, { slug: '8XzUtDNZYp', totalEpisodes: 12 });
      Promise.resolve().then(() => {
        if (cancelled) return;
        setAnikageSlug('8XzUtDNZYp');
        setTotalEpisodeCount(12);
      });
    } else if (slugCache.has(malId)) {
      const cached = slugCache.get(malId);
      Promise.resolve().then(() => {
        if (cancelled) return;
        setAnikageSlug(cached.slug);
        setTotalEpisodeCount(cached.totalEpisodes || 0);
      });
    }
  
    // Fetch Jikan anime data
    const fetchAnime = async () => {
      try {
        const data = await getAnimeById(malId);
        if (cancelled) return;
        setAnime(data.data);
        setAnimeLoading(false);
  
        // Search Anikage to resolve slug (needed for Neko server streams)
        if (malId === 5042) {
          // Already overridden
        } else if (!slugCache.has(malId)) {
          searchAnikageForAnime(data.data, malId, cancelled);
        }
  
        // Search 123Anime
        searchOneTwoThreeForAnime(data.data, cancelled);
  
        // Search Otaku
        searchOtakuForAnime(data.data, cancelled);

        // Search BD
        searchBdForAnime(data.data, cancelled);
  
        // Search AniDB
        searchAniDbForAnime(data.data, cancelled);
  
        // Fetch AniZip mappings
        fetchAniZip(malId, cancelled);
  
        // Search Mio
        searchMioForAnime(data.data, cancelled);
      } catch (err) {
        if (!cancelled) { console.error('Jikan error:', err); setAnimeLoading(false); }
      }
    };

    fetchAnime();
    window.scrollTo(0, 0);

    return () => { cancelled = true; };
  }, [id]);

  // ---- Step 3: Fetch episodes from Anikage (runs when slug resolved) ----
  useEffect(() => {
    if (!anikageSlug) return;
    let cancelled = false;

    const fetchEpisodes = async () => {
      setEpisodesLoading(true);
      try {
        const { total, episodes } = await getAnikageEpisodes(anikageSlug);
        if (cancelled) return;
        setAnikageEpisodes(episodes);
        if (total > 0) setTotalEpisodeCount(total);
      } catch (err) { console.error('Episodes error:', err); }
      finally { if (!cancelled) setEpisodesLoading(false); }
    };

    fetchEpisodes();
    return () => { cancelled = true; };
  }, [anikageSlug]);

  const lastStreamFetchKey = useRef('');

  // ---- Step 4: Get stream when episode changes ----
  useEffect(() => {
    let cancelled = false;

    const fetchStream = async () => {
      const fetchKey = `${activeServer}-${id}-${currentEpisode}-${aniDbId || ''}-${anikageSlug || ''}-${otakuOsid || ''}-${bdId || ''}`;
      if (lastStreamFetchKey.current === fetchKey && streamSources.length > 0) {
        return;
      }
      lastStreamFetchKey.current = fetchKey;

      setSubtitles([]);
      if (activeServer === 'neko') {
        if (!anikageSlug) {
          if (searchLoading) {
            setSourceLoading(true);
            return;
          }
          if (searchError) {
            setSourceError(searchError);
          }
          return;
        }
        setSourceLoading(true);
        setSourceError(null);
        setStreamSources([]);
        setIntroTimestamp(null);
        setOutroTimestamp(null);

        try {
          const data = await getAnikageStreams(anikageSlug, currentEpisode, activeServer);
          if (cancelled) return;
          if (!data?.sources?.length) {
            setSourceError('No streaming source for this episode.');
            return;
          }
          setStreamSources(data.sources);
          setIntroTimestamp(data.intro);
          setOutroTimestamp(data.outro);
        } catch (err) {
          if (!cancelled) { console.error('Stream error:', err); setSourceError('Failed to load stream.'); }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      } else if (activeServer === '123') {
        if (!oneTwoThreeId) return;
        setSourceLoading(true);
        setSourceError(null);
        setOneTwoThreeEmbedUrl(null);
        setStreamSources([]);

        try {
          const data = await get123AnimeStream(oneTwoThreeId, currentEpisode);
          if (cancelled) return;
          if (!data || !data.streaming_link) {
            setSourceError('No streaming source for this episode.');
            return;
          }
          setOneTwoThreeEmbedUrl(data.streaming_link);
          if (data.direct_m3u8) {
            setStreamSources([{ quality: '123Anime', streamUrl: data.direct_m3u8 }]);
          }
        } catch (err) {
          if (!cancelled) { console.error('123Anime stream fetch error:', err); setSourceError('Failed to load stream.'); }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      } else if (activeServer === 'otaku') {
        if (!otakuOsid) return;
        setSourceLoading(true);
        setSourceError(null);
        setStreamSources([]);

        try {
          const streamUrl = await getOtakuStream(otakuOsid, currentEpisode);
          if (cancelled) return;
          if (!streamUrl) {
            setSourceError('No streaming source for this episode.');
            return;
          }
          setStreamSources([{ quality: 'Auto', streamUrl }]);
        } catch (err) {
          if (!cancelled) { console.error('Otaku stream fetch error:', err); setSourceError('Failed to load stream.'); }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      } else if (activeServer === 'hanime') {
        if (!anime) return;
        setSourceLoading(true);
        setSourceError(null);
        setStreamSources([]);

        try {
          const data = await getHAnimeStreams(anime, currentEpisode);
          if (cancelled) return;
          if (!data || !data.streams || data.streams.length === 0) {
            setSourceError('No streaming source available for this episode on HAnime.');
            return;
          }
          setStreamSources(data.streams);
        } catch (err) {
          if (!cancelled) { console.error('HAnime stream fetch error:', err); setSourceError('Failed to load stream.'); }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      } else if (activeServer === 'db') {
        if (!aniDbId) return;
        setSourceLoading(true);
        setSourceError(null);
        setStreamSources([]);
        setAniDbSubtitles([]);

        try {
          let eps = aniDbEpisodes;
          if (eps.length === 0) {
            const freshAnime = await getAniDbAnime(aniDbId);
            if (freshAnime && Array.isArray(freshAnime.episodes)) {
              eps = freshAnime.episodes;
              setAniDbEpisodes(freshAnime.episodes);
            }
          }

          // 1. Try matching exact episode number
          let epMatch = eps.find(ep => ep.number === currentEpisode);
          
          // 2. Try matching 1-based index (e.g. Episode 1 -> eps[0])
          if (!epMatch && eps[currentEpisode - 1]) {
            epMatch = eps[currentEpisode - 1];
          }

          // 3. Try matching cumulative episode offset (e.g. eps start at 67 for Season 4)
          if (!epMatch && eps.length > 0) {
            const minEp = Math.min(...eps.map(e => e.number || 1));
            const targetNum = minEp + currentEpisode - 1;
            epMatch = eps.find(ep => ep.number === targetNum) || eps[0];
          }

          const epId = epMatch ? epMatch.id : null;
          if (!epId) {
            setSourceError('Episode not found on DB server.');
            return;
          }

          const streamData = await getAniDbEpisodeStream(epId);
          if (cancelled) return;

          if (streamData && streamData.streamUrl) {
            setStreamSources([{
              url: streamData.streamUrl,
              streamUrl: streamData.streamUrl,
              quality: streamData.quality || 'Auto',
              type: streamData.type || 'm3u8'
            }]);
          } else if (streamData && streamData.embedUrl) {
            setStreamSources([{
              url: streamData.embedUrl,
              quality: 'Auto',
              type: 'iframe'
            }]);
          } else {
            setSourceError('No streaming source for this episode on DB.');
          }
        } catch (err) {
          if (!cancelled) { console.error('DB stream fetch error:', err); setSourceError('Failed to load stream from DB.'); }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      } else if (activeServer === 'nexus') {
        // Nexus uses an iframe directly based on anilistId. We don't fetch any stream sources.
        setSourceLoading(false);
        setSourceError(null);
        setStreamSources([]);
      } else if (activeServer === 'bd') {
        if (!bdId) return;
        setSourceLoading(true);
        setSourceError(null);
        setStreamSources([]);

        try {
          let details = bdAnimeDetails;
          if (!details) {
            details = await getBdAnimeDetails(bdId);
            if (!cancelled && details) {
              setBdAnimeDetails(details);
            }
          }

          if (!details || !Array.isArray(details.servers) || details.servers.length === 0) {
            setSourceError('No streaming source for this episode on BD.');
            return;
          }

          let targetDataId = null;
          const targetEpNum = String(currentEpisode);
          const targetEpPadded = String(currentEpisode).padStart(2, '0');

          for (const srv of details.servers) {
            if (Array.isArray(srv.episodes)) {
              const epMatch = srv.episodes.find(ep => ep.name === targetEpNum || ep.name === targetEpPadded || ep.slug === targetEpNum || ep.slug === targetEpPadded || parseInt(ep.name, 10) === currentEpisode);
              if (epMatch && epMatch.dataId) {
                targetDataId = epMatch.dataId;
                break;
              }
            }
          }

          if (!targetDataId) {
            for (const srv of details.servers) {
              if (Array.isArray(srv.episodes) && srv.episodes[currentEpisode - 1]) {
                targetDataId = srv.episodes[currentEpisode - 1].dataId;
                if (targetDataId) break;
              }
            }
          }

          if (!targetDataId) {
            setSourceError('Episode not found on BD server.');
            return;
          }

          const watchData = await getBdStream(targetDataId);
          if (cancelled) return;
          if (!watchData || !Array.isArray(watchData.sources) || watchData.sources.length === 0) {
            setSourceError('No streaming source for this episode on BD.');
            return;
          }

          const sources = watchData.sources.map(s => {
            const urlStr = s.url || s.rawUrl || '';
            let q = 'HD';
            if (urlStr.includes('1080p')) {
              q = '1080p';
            } else if (urlStr.includes('720p')) {
              q = '720p';
            } else if (urlStr.includes('480p')) {
              q = '480p';
            } else if (urlStr.includes('360p')) {
              q = '360p';
            } else if (s.server === 'R-HD') {
              q = '1080p';
            } else if (s.server === 'SR') {
              q = '720p';
            } else if (s.quality && !s.quality.includes('index')) {
              q = s.quality;
            }
            return {
              quality: q,
              streamUrl: urlStr
            };
          });

          setStreamSources(sources);

          if (Array.isArray(watchData.subtitles) && watchData.subtitles.length > 0) {
            const uniqueSubs = [];
            const seenFiles = new Set();
            for (const sub of watchData.subtitles) {
              const fileUrl = sub.file || sub.src || sub.url;
              if (fileUrl && !seenFiles.has(fileUrl)) {
                seenFiles.add(fileUrl);
                uniqueSubs.push({
                  ...sub,
                  default: uniqueSubs.length === 0
                });
              }
            }
            setSubtitles(uniqueSubs);
          }
        } catch (err) {
          if (!cancelled) { console.error('BD stream fetch error:', err); setSourceError('Failed to load stream.'); }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      } else if (activeServer === 'reanime') {
        // Reanime uses the worker API loaded episodes. We don't fetch HLS stream sources.
        setSourceLoading(false);
        setSourceError(null);
        setStreamSources([]);
      } else if (activeServer === 'fouranimo') {
        // 4animo uses an iframe directly based on malId. We don't fetch HLS stream sources.
        setSourceLoading(false);
        setSourceError(null);
        setStreamSources([]);
      } else if (activeServer === 'mio') {
        if (mioLoading) {
          setSourceLoading(true);
          setSourceError(null);
          setStreamSources([]);
          return;
        }

        if (mioError) {
          setSourceLoading(false);
          setSourceError(mioError);
          setStreamSources([]);
          return;
        }

        if (!mioEpisodes || mioEpisodes.length === 0) {
          setSourceLoading(false);
          setSourceError('No streaming source for this episode on Mio.');
          setStreamSources([]);
          return;
        }

        setSourceLoading(true);
        setSourceError(null);
        setStreamSources([]);

        try {
          const targetEp = mioEpisodes.find(ep => {
            const match = ep.title.match(/ตอนที่\s*(\d+(\.\d+)?)/);
            if (match) {
              const epNum = parseFloat(match[1]);
              return epNum === currentEpisode;
            }
            return false;
          }) || mioEpisodes[currentEpisode - 1] || mioEpisodes[0];

          if (!targetEp) {
            setSourceError('No streaming source for this episode on Mio.');
            return;
          }

          const proxiedUrl = await getMioEpisodeStream(targetEp.url);
          if (cancelled) return;
          if (!proxiedUrl) {
            setSourceError('No streaming source for this episode on Mio.');
            return;
          }
          setStreamSources([{ quality: 'Mio', streamUrl: proxiedUrl, url: proxiedUrl }]);
        } catch (err) {
          if (!cancelled) {
            console.error('Mio stream fetch error:', err);
            setSourceError('Failed to load stream.');
          }
        } finally {
          if (!cancelled) setSourceLoading(false);
        }
      }
    };

    fetchStream();
    return () => { cancelled = true; };
  }, [activeServer, anikageSlug, oneTwoThreeId, otakuOsid, bdId, bdAnimeDetails, aniDbId, anilistId, mioEpisodes, mioLoading, currentEpisode, anime, id]);

  // ---- Related anime (relations from Jikan API, only anime) ----
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setRelationsLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await getAnimeRelations(id);
        if (!cancelled) {
          setRelations(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch relations:', err);
      } finally {
        if (!cancelled) setRelationsLoading(false);
      }
    }, 2000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [id]);

  const animeRelations = useMemo(() => {
    return relations
      .map(rel => ({
        ...rel,
        entry: rel.entry.filter(entry => entry.type === 'anime')
      }))
      .filter(rel => rel.entry.length > 0);
  }, [relations]);

  // ---- Update URL on ep change ----
  useEffect(() => {
    const p = parseInt(episodeParam) || 1;
    if (currentEpisode !== p) navigate(`/watch/${id}/${currentEpisode}`, { replace: true });
  }, [currentEpisode, id, navigate, episodeParam]);

  // ---- Listen to message from iframe player for watch progress ----
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'PLAYER_TIMEUPDATE') {
        const { currentTime, duration } = e.data;
        if (currentTime && duration) {
          saveEpisodeProgress(parseInt(id), currentEpisode, currentTime, duration);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, currentEpisode]);

  // ---- Fetch watch progress asynchronously ----
  useEffect(() => {
    let active = true;
    async function fetchProgress() {
      setInitialProgress(null);
      try {
        const time = await getEpisodeProgress(parseInt(id), currentEpisode);
        if (active) {
          setInitialProgress(time || 0);
        }
      } catch (err) {
        console.error('Failed to get episode progress:', err);
        if (active) setInitialProgress(0);
      }
    }
    fetchProgress();
    return () => { active = false; };
  }, [id, currentEpisode, user]);

  // ---- Bookmark ----
  useEffect(() => {
    if (!anime || !isAuthenticated || !user) return;
    getBookmarks(user.uid).then(list => {
      const item = list.find(b => b.mal_id === anime.mal_id);
      if (item) {
        setBookmarked(true);
        setBookmarkCategory(item.category || 'Plan to Watch');
      } else {
        setBookmarked(false);
        setBookmarkCategory('');
      }
    }).catch(() => {
      setBookmarked(false);
      setBookmarkCategory('');
    });
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
      } else {
        await addBookmark(user.uid, anime, 'Plan to Watch');
        setBookmarked(true);
        setBookmarkCategory('Plan to Watch');
      }
    } catch (err) { console.error(err); }
    finally { setBookmarkLoading(false); }
  }, [anime, bookmarked, bookmarkLoading, isAuthenticated, user, onShowAuth]);

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

  const handleOpenReport = () => {
    setReportServer(activeServer);
    setReportProblem('Server not working');
    setReportNote('');
    setReportSuccess(false);
    setReportError(null);
    setShowReportModal(true);
  };

  const handleSendReport = async (e) => {
    e.preventDefault();
    setReportSending(true);
    setReportError(null);
    setReportSuccess(false);

    const webhookUrl = 'https://discord.com/api/webhooks/1059125897787088989/8wvWuE3N_YFndO27EczfQ8i_9e4p7_Rnm4rE6A5zOHnHXGON28zMuJDJM1LqJh7F5lxi';

    const payload = {
      embeds: [
        {
          title: "🚨 New Stream Issue Report",
          color: 14980699, // Gold color #E4A85D
          fields: [
            {
              name: "Anime Title",
              value: `${titleDisplay} (MAL ID: ${id})`,
              inline: true
            },
            {
              name: "Episode",
              value: `Episode ${currentEpisode}`,
              inline: true
            },
            {
              name: "Reported Server",
              value: reportServer.toUpperCase(),
              inline: true
            },
            {
              name: "Issue Category",
              value: reportProblem,
              inline: true
            },
            {
              name: "User Notes",
              value: reportNote.trim() || "*No additional notes provided.*",
              inline: false
            }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setReportSuccess(true);
        setReportNote('');
      } else {
        throw new Error(`Failed to send report. Status: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to send issue report to Discord:', err);
      setReportError('Failed to submit report. Please try again.');
    } finally {
      setReportSending(false);
    }
  };



  // ---- Episode list (from Anikage or generated) ----
  const episodeList = useMemo(() => {
    if (aniZipEpisodes.length > 0) {
      return aniZipEpisodes;
    }

    const isAiring = Boolean(anime?.airing || (anime?.status && anime.status.toLowerCase() === 'currently airing'));

    // Determine the count of episodes that have actually aired
    let count = 0;
    if (isAiring && anikageEpisodes.length > 0) {
      count = anikageEpisodes.length;
    } else if (anime) {
      if (!isAiring || anime.status === 'Finished Airing') {
        count = anime.episodes || 1;
      } else {
        // Currently Airing or Upcoming: only show up to currentEpisode
        count = currentEpisode;
      }
    } else if (totalEpisodeCount > 0) {
      count = totalEpisodeCount;
    }

    if (activeServer === 'neko') {
      if (anikageEpisodes.length > 0) {
        return anikageEpisodes.filter(ep => ep.number > 0).sort((a, b) => a.number - b.number);
      }
      if (count > 0) {
        // Allow up to 1500 episodes for long running anime
        return Array.from({ length: Math.min(count, 1500) }, (_, i) => ({ number: i + 1, title: `Episode ${i + 1}` }));
      }
      return [];
    } else if (activeServer === 'db') {
      if (aniDbEpisodes.length > 0) {
        return aniDbEpisodes.map((ep, idx) => ({
          number: idx + 1,
          realNumber: ep.number,
          title: ep.title || `Episode ${idx + 1}`,
          img: ep.img || null
        })).sort((a, b) => a.number - b.number);
      }
      if (count > 0) {
        return Array.from({ length: Math.min(count, 1500) }, (_, i) => ({ number: i + 1, title: `Episode ${i + 1}` }));
      }
      return [];
    } else if (activeServer === 'mio') {
      if (mioEpisodes.length > 0) {
        return mioEpisodes.map(ep => {
          const match = ep.title.match(/ตอนที่\s*(\d+(\.\d+)?)/);
          const num = match ? parseFloat(match[1]) : 0;
          return { number: num, title: ep.title, img: null };
        }).filter(ep => ep.number > 0).sort((a, b) => a.number - b.number);
      }
      if (count > 0) {
        return Array.from({ length: Math.min(count, 1500) }, (_, i) => ({ number: i + 1, title: `Episode ${i + 1}` }));
      }
      return [];
    } else {
      // For Koto: we always show up to the currently aired count
      return Array.from({ length: Math.max(count, currentEpisode) }, (_, i) => {
        const existing = anikageEpisodes.find(ep => ep.number === i + 1);
        return {
          number: i + 1,
          title: existing?.title || `Episode ${i + 1}`,
          img: existing?.img || null
        };
      });
    }
  }, [aniZipEpisodes, anikageEpisodes, aniDbEpisodes, mioEpisodes, totalEpisodeCount, anime, activeServer, currentEpisode]);

  const maxEpisode = episodeList.length > 0 ? Math.max(...episodeList.map(ep => ep.number)) : 0;

  const currentEpInfo = useMemo(() => {
    const fromList = episodeList.find(ep => ep.number === currentEpisode);
    if (fromList) return fromList;

    if (activeServer === 'db') {
      const existing = aniDbEpisodes.find(ep => ep.number === currentEpisode) || aniDbEpisodes[currentEpisode - 1];
      if (existing) return existing;
    }
    if (activeServer === 'mio') {
      const targetEp = mioEpisodes.find(ep => {
        const match = ep.title.match(/ตอนที่\s*(\d+(\.\d+)?)/);
        return match && parseFloat(match[1]) === currentEpisode;
      });
      if (targetEp) {
        return {
          number: currentEpisode,
          title: targetEp.title,
          img: anime?.images?.jpg?.large_image_url || null,
          description: ''
        };
      }
    }
    const existing = anikageEpisodes.find(ep => ep.number === currentEpisode);
    if (existing) return existing;
    return {
      number: currentEpisode,
      title: `Episode ${currentEpisode}`,
      img: anime?.images?.jpg?.large_image_url || null,
      description: ''
    };
  }, [episodeList, anikageEpisodes, aniDbEpisodes, mioEpisodes, activeServer, currentEpisode, anime]);

  // ---- Episode Pagination calculations ----
  const PAGE_SIZE = 100;
  const totalPages = Math.ceil(episodeList.length / PAGE_SIZE);

  // Sync active page tab to show current episode
  const [prevEpisode, setPrevEpisode] = useState(currentEpisode);
  if (currentEpisode !== prevEpisode) {
    setPrevEpisode(currentEpisode);
    setEpisodesPage(Math.floor((currentEpisode - 1) / PAGE_SIZE));
  }

  const paginatedEpisodes = useMemo(() => {
    const start = episodesPage * PAGE_SIZE;
    return episodeList.slice(start, start + PAGE_SIZE);
  }, [episodeList, episodesPage]);

  // ---- Update watch history when anime and episode are playing ----
  useEffect(() => {
    if (anime && (streamSources.length > 0 || activeServer === 'koto' || activeServer === 'db' || activeServer === 'nexus' || activeServer === 'reanime' || activeServer === 'fouranimo' || activeServer === 'bd' || activeServer === 'mio' || (activeServer === '123' && oneTwoThreeEmbedUrl))) {
      updateWatchHistory(anime, currentEpisode, currentEpInfo?.img);
    }
  }, [anime, currentEpisode, streamSources, currentEpInfo, activeServer, oneTwoThreeEmbedUrl]);

  // ---- Episode nav handlers ----
  const handleEpisodeSelect = useCallback((n) => { if (n !== currentEpisode) setCurrentEpisode(n); }, [currentEpisode]);
  const handlePrev = useCallback(() => { if (currentEpisode > 1) setCurrentEpisode(p => p - 1); }, [currentEpisode]);
  const handleNext = useCallback(() => { if (currentEpisode < maxEpisode) setCurrentEpisode(p => p + 1); }, [currentEpisode, maxEpisode]);

  // ---- Derived display values ----
  const titleDisplay = anime?.title_english || anime?.title || '';
  const score = anime?.score || 'N/A';
  const type = anime?.type || '';
  const season = anime?.season ? anime.season.charAt(0).toUpperCase() + anime.season.slice(1) : '';
  const year = anime?.year || anime?.aired?.prop?.from?.year || '';
  const seasonYear = [season, year].filter(Boolean).join(' ');
  const duration = anime?.duration || '';
  const status = anime?.status || '';
  const synopsis = anime?.synopsis || '';
  const genres = anime?.genres || [];
  const totalEps = totalEpisodeCount || anime?.episodes || '?';

  // Loading state — only show loader if we don't have slug yet
  if (animeLoading && !anikageSlug) {
    return (
      <div className="streaming-page page-content">
        <div className="page-loader"><div className="spinner" /><span className="page-loader-text">Loading...</span></div>
      </div>
    );
  }

  return (
    <div className="streaming-page page-content">
      <div className="streaming-layout container">
        {/* Main Player Area */}
        <div className="streaming-main">
          <div className="streaming-player">
            {activeServer === 'koto' ? (
              <iframe
                src={`https://megaplay.buzz/stream/mal/${id}/${currentEpisode}/sub`}
                className="streaming-iframe"
                allowFullScreen
                scrolling="no"
                allow="autoplay; fullscreen; picture-in-picture"
                title={`${titleDisplay} - Episode ${currentEpisode} (Koto)`}
              />
            ) : activeServer === '123' ? (
              oneTwoThreeLoading || sourceLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{oneTwoThreeLoading ? 'Finding anime on 123Anime...' : `Loading ep ${currentEpisode}...`}</span>
                </div>
              ) : oneTwoThreeError || sourceError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{oneTwoThreeError || sourceError}</span>
                </div>
              ) : oneTwoThreeEmbedUrl ? (
                <iframe
                  src={oneTwoThreeEmbedUrl}
                  className="streaming-iframe"
                  allowFullScreen
                  scrolling="no"
                  allow="autoplay; fullscreen; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin"
                  title={`${titleDisplay} - Episode ${currentEpisode} (123Anime)`}
                />
              ) : (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>No streaming source available for 123Anime.</span>
                </div>
              )
            ) : activeServer === 'otaku' ? (
              otakuLoading || sourceLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{otakuLoading ? 'Finding anime on Otaku...' : `Loading ep ${currentEpisode}...`}</span>
                </div>
              ) : otakuError || sourceError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{otakuError || sourceError}</span>
                </div>
              ) : streamSources.length > 0 ? (
                IS_IOS && bestSource ? (
                  <iframe
                    src={`/embed.html?sources=${encodeURIComponent(JSON.stringify(streamSources))}&poster=${encodeURIComponent(anime?.images?.jpg?.large_image_url || '')}&t=${initialProgress}`}
                    className="streaming-iframe"
                    allowFullScreen
                    scrolling="no"
                    allow="autoplay; fullscreen; picture-in-picture"
                    title={`${titleDisplay} - Episode ${currentEpisode} (Otaku)`}
                  />
                ) : (
                  <HlsPlayer
                    key={`otaku-${id}-${currentEpisode}`}
                    sources={streamSources}
                    title={`${titleDisplay} - Episode ${currentEpisode}`}
                    intro={introTimestamp}
                    outro={outroTimestamp}
                    initialTime={initialProgress}
                    onProgress={(time, duration) => {
                      saveEpisodeProgress(parseInt(id), currentEpisode, time, duration);
                    }}
                  />
                )
              ) : (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>No streaming source available for Otaku.</span>
                </div>
              )
            ) : activeServer === 'hanime' ? (
              sourceLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{`Loading ep ${currentEpisode} on HAnime...`}</span>
                </div>
              ) : sourceError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{sourceError}</span>
                </div>
              ) : streamSources.length > 0 ? (
                <HlsPlayer
                  key={`hanime-${id}-${currentEpisode}`}
                  sources={streamSources}
                  title={`${titleDisplay} - Episode ${currentEpisode}`}
                  intro={introTimestamp}
                  outro={outroTimestamp}
                  initialTime={initialProgress}
                  onProgress={(time, duration) => {
                    saveEpisodeProgress(parseInt(id), currentEpisode, time, duration);
                  }}
                />
              ) : (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>No streaming source available for HAnime.</span>
                </div>
              )
            ) : activeServer === 'db' ? (
              sourceLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{`Loading ep ${currentEpisode} on DB...`}</span>
                </div>
              ) : sourceError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{sourceError}</span>
                </div>
              ) : streamSources.length > 0 ? (
                streamSources[0].type === 'iframe' ? (
                  <iframe
                    src={streamSources[0].url}
                    className="streaming-iframe"
                    allowFullScreen
                    scrolling="no"
                    allow="autoplay; fullscreen; picture-in-picture"
                    title={`${titleDisplay} - Episode ${currentEpisode} (DB)`}
                  />
                ) : (
                  <HlsPlayer
                    key={`db-${id}-${currentEpisode}`}
                    sources={streamSources}
                    title={`${titleDisplay} - Episode ${currentEpisode}`}
                    intro={introTimestamp}
                    outro={outroTimestamp}
                    initialTime={initialProgress}
                    onProgress={(time, duration) => {
                      saveEpisodeProgress(parseInt(id), currentEpisode, time, duration);
                    }}
                  />
                )
              ) : (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>No streaming source available for DB.</span>
                </div>
              )
            ) : activeServer === 'nexus' ? (
              aniZipLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>Resolving AniList ID for Nexus...</span>
                </div>
              ) : !anilistId ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>Nexus requires a valid AniList ID which was not found for this MAL ID.</span>
                </div>
              ) : (
                <iframe
                  src={`https://anime-nexus-blue.vercel.app/anime/${anilistId}/${currentEpisode}/sub`}
                  className="streaming-iframe"
                  allowFullScreen
                  scrolling="no"
                  allow="autoplay; fullscreen; picture-in-picture"
                  title={`${titleDisplay} - Episode ${currentEpisode} (Nexus)`}
                />
              )
            ) : activeServer === 'bd' ? (
              bdLoading || sourceLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{bdLoading ? 'Finding anime on BD...' : `Loading ep ${currentEpisode}...`}</span>
                </div>
              ) : bdError || sourceError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{bdError || sourceError}</span>
                </div>
              ) : streamSources.length > 0 ? (
                <HlsPlayer
                  key={`bd-${id}-${currentEpisode}`}
                  sources={streamSources}
                  subtitles={subtitles}
                  title={`${titleDisplay} - Episode ${currentEpisode}`}
                  intro={introTimestamp}
                  outro={outroTimestamp}
                  initialTime={initialProgress}
                  onProgress={(time, duration) => {
                    saveEpisodeProgress(parseInt(id), currentEpisode, time, duration);
                  }}
                />
              ) : (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>No streaming source available for BD.</span>
                </div>
              )
            ) : activeServer === 'reanime' ? (
              aniZipLoading || reanimeLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>Resolving Reanime server...</span>
                </div>
              ) : !anilistId ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>Reanime requires a valid AniList ID which was not found for this MAL ID.</span>
                </div>
              ) : reanimeError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{reanimeError}</span>
                </div>
              ) : (() => {
                const targetEp = reanimeEpisodes.find(e => e.episode === currentEpisode);
                const embedUrl = targetEp?.servers?.find(s => s.type === 'sub')?.embed_url || targetEp?.primary_embed_url || targetEp?.servers?.[0]?.embed_url;
                if (!embedUrl) {
                  return (
                    <div className="streaming-player-error">
                      <AlertCircle size={40} />
                      <span>No streaming source available for Reanime on Episode {currentEpisode}.</span>
                    </div>
                  );
                }
                return (
                  <iframe
                    src={embedUrl}
                    className="streaming-iframe"
                    allowFullScreen
                    scrolling="no"
                    allow="autoplay; fullscreen; picture-in-picture"
                    sandbox="allow-same-origin allow-scripts"
                    title={`${titleDisplay} - Episode ${currentEpisode} (Reanime)`}
                  />
                );
              })()
            ) : activeServer === 'fouranimo' ? (
              animeLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{`Loading ep ${currentEpisode} on 4animo (${fourAnimoServer.toUpperCase()})...`}</span>
                </div>
              ) : (
                <iframe
                  key={`fouranimo-${id}-${currentEpisode}-${fourAnimoServer}`}
                  src={`https://cdn.4animo.xyz/embed/${fourAnimoServer}/mal/${id}/${currentEpisode}/sub?k=1`}
                  className="streaming-iframe"
                  allowFullScreen
                  scrolling="no"
                  allow="autoplay; fullscreen; picture-in-picture"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  title={`${titleDisplay} - Episode ${currentEpisode} (4animo ${fourAnimoServer.toUpperCase()})`}
                />
              )
            ) : activeServer === 'mio' ? (
              mioLoading || sourceLoading || initialProgress === null ? (
                <div className="streaming-player-loading">
                  <div className="spinner" />
                  <span>{mioLoading ? 'Finding anime on Mio...' : `Loading ep ${currentEpisode}...`}</span>
                </div>
              ) : mioError || sourceError ? (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>{mioError || sourceError}</span>
                </div>
              ) : streamSources.length > 0 ? (
                <HlsPlayer
                  key={`mio-${id}-${currentEpisode}`}
                  sources={streamSources}
                  title={`${titleDisplay} - Episode ${currentEpisode}`}
                  intro={introTimestamp}
                  outro={outroTimestamp}
                  initialTime={initialProgress}
                  onProgress={(time, duration) => {
                    saveEpisodeProgress(parseInt(id), currentEpisode, time, duration);
                  }}
                />
              ) : (
                <div className="streaming-player-error">
                  <AlertCircle size={40} />
                  <span>No streaming source available for Mio.</span>
                </div>
              )
            ) : sourceLoading || searchLoading || initialProgress === null ? (
              <div className="streaming-player-loading">
                <div className="spinner" />
                <span>{searchLoading ? 'Finding anime...' : `Loading ep ${currentEpisode}...`}</span>
              </div>
            ) : sourceError ? (
              <div className="streaming-player-error">
                <AlertCircle size={40} />
                <span>{sourceError}</span>
              </div>
            ) : streamSources.length > 0 ? (
              activeServer === 'neko' ? (
                hardsubSources.length > 0 ? (
                  <iframe
                    src={hardsubSources[selectedNekoSourceIndex]?.embedUrl || hardsubSources[0]?.embedUrl}
                    className="streaming-iframe"
                    allowFullScreen
                    scrolling="no"
                    allow="autoplay; fullscreen; picture-in-picture"
                    sandbox="allow-same-origin allow-scripts"
                    title={`${titleDisplay} - Episode ${currentEpisode} (Neko)`}
                  />
                ) : (
                  <div className="streaming-player-error">
                    <AlertCircle size={40} />
                    <span>No sources available on Neko.</span>
                  </div>
                )
              ) : IS_IOS && bestSource ? (
                <iframe
                  src={`/embed.html?sources=${encodeURIComponent(JSON.stringify(streamSources))}&poster=${encodeURIComponent(anime?.images?.jpg?.large_image_url || '')}&t=${initialProgress}`}
                  className="streaming-iframe"
                  allowFullScreen
                  scrolling="no"
                  allow="autoplay; fullscreen; picture-in-picture"
                  title={`${titleDisplay} - Episode ${currentEpisode}`}
                />
              ) : (
                <HlsPlayer
                  key={`${activeServer}-${id}-${currentEpisode}`}
                  sources={streamSources}
                  title={`${titleDisplay} - Episode ${currentEpisode}`}
                  intro={introTimestamp}
                  outro={outroTimestamp}
                  initialTime={initialProgress}
                  onProgress={(time, duration) => {
                    saveEpisodeProgress(parseInt(id), currentEpisode, time, duration);
                  }}
                />
              )
            ) : searchError ? (
              <div className="streaming-player-error"><AlertCircle size={40} /><span>{searchError}</span></div>
            ) : (
              <div className="streaming-player-loading"><Play size={48} /><span>Select an episode</span></div>
            )}
          </div>

          {activeServer === 'neko' && hardsubSources.length > 1 && (
            <div className="streaming-neko-sources">
              <span className="neko-sources-label">Source:</span>
              <div className="neko-sources-list">
                {hardsubSources.map((src, idx) => (
                  <button
                    key={idx}
                    className={`neko-source-btn ${selectedNekoSourceIndex === idx ? 'active' : ''}`}
                    onClick={() => setSelectedNekoSourceIndex(idx)}
                  >
                    {src.quality.replace('hardsub ', '').replace('softsub ', '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeServer === 'fouranimo' && (
            <div className="streaming-neko-sources">
              <span className="neko-sources-label">Server:</span>
              <div className="neko-sources-list">
                {['hd-1', 'hd-2', 'hd-3', 'hd-4'].map((srv) => (
                  <button
                    key={srv}
                    className={`neko-source-btn ${fourAnimoServer === srv ? 'active' : ''}`}
                    onClick={() => setFourAnimoServer(srv)}
                  >
                    {srv.toUpperCase().replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Unified Episode Navigation & Server Control Row */}
          <div className="streaming-ep-controls-row">
            <div className="streaming-ep-nav">
              <button className="streaming-ep-nav-btn" onClick={handlePrev} disabled={currentEpisode <= 1} title={`Episode ${currentEpisode - 1}`}>
                <ChevronLeft size={16} />
              </button>
              <div className="streaming-ep-nav-current">
                <span className="streaming-ep-nav-number">Ep {currentEpisode}</span>
              </div>
              <button className="streaming-ep-nav-btn" onClick={handleNext} disabled={maxEpisode > 0 && currentEpisode >= maxEpisode} title={`Episode ${currentEpisode + 1}`}>
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="streaming-controls-actions">
              <button className="streaming-server-modal-trigger" onClick={() => setShowServerModal(true)}>
                <Tv size={14} />
                <span>SERVER</span>
              </button>
              <button className="streaming-report-trigger" onClick={handleOpenReport}>
                <AlertTriangle size={14} />
                <span>REPORT</span>
              </button>
            </div>
          </div>

          {/* Episode Info */}
          {currentEpInfo && (
            <div className="streaming-ep-info">
              {currentEpInfo.img && <img src={currentEpInfo.img} alt={currentEpInfo.title} className="streaming-ep-thumb" loading="lazy" />}
              <div className="streaming-ep-details">
                <span className="streaming-ep-num">Episode {currentEpInfo.number}</span>
                <h3 className="streaming-ep-title">{currentEpInfo.title}</h3>
                {currentEpInfo.description && <p className="streaming-ep-desc">{currentEpInfo.description}</p>}
              </div>
            </div>
          )}

          {/* Anime Info */}
          <div className="streaming-info">
            <span className="streaming-now-playing">NOW PLAYING</span>
            <h1 className="streaming-title">{titleDisplay}</h1>
            <p className="streaming-episode-label">Episode {currentEpisode} of {totalEps}</p>
            <div className="streaming-meta">
              {score !== 'N/A' && <span className="streaming-meta-badge streaming-score"><Star size={13} />{score}</span>}
              {type && <span className="streaming-meta-badge"><Tv size={13} />{type}</span>}
              {seasonYear && <span className="streaming-meta-badge"><Calendar size={13} />{seasonYear}</span>}
              {duration && <span className="streaming-meta-badge"><Clock size={13} />{duration}</span>}
              {status && <span className={`status-badge ${getStatusClass(status)}`}>{getStatusText(status)}</span>}
            </div>
            {genres.length > 0 && <div className="streaming-genres">{genres.map(g => <span key={g.mal_id} className="genre-tag">{g.name}</span>)}</div>}
            {synopsis && <p className="streaming-synopsis">{synopsis}</p>}
            <div className="streaming-info-actions">
              <Link to={`/anime/${id}`} className="btn btn-secondary"><ExternalLink size={14} /> Full Details</Link>
              <div className="streaming-bookmark-wrapper">
                <button className={`btn ${bookmarked ? 'btn-bookmark-active' : 'btn-secondary'}`} onClick={handleBookmark} disabled={bookmarkLoading}>
                  {bookmarkLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
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

          {/* Comments Section */}
          <div className="streaming-comments-card glass-effect">
            <div className="comments-header">
              <MessageSquare size={18} className="comments-header-icon" />
              <h2>Comments ({comments.length})</h2>
            </div>

            {isAuthenticated ? (
              <form className="comments-form" onSubmit={handlePostComment}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts about this episode..."
                  required
                  rows={3}
                  maxLength={500}
                  className="comments-textarea"
                />
                <div className="comments-form-actions">
                  <button type="submit" className="btn btn-primary comments-submit-btn" disabled={commentLoading || !commentText.trim()}>
                    {commentLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>Post Comment</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="comments-form-locked">
                <textarea
                  disabled
                  placeholder="You must be logged in to comment..."
                  rows={3}
                  className="comments-textarea locked"
                />
                <div className="comments-locked-overlay">
                  <p>Please <button type="button" className="comments-login-link" onClick={onShowAuth}>Sign In</button> to join the discussion.</p>
                </div>
              </div>
            )}

              {commentError && <div className="comments-error">{commentError}</div>}

              {fetchCommentsLoading ? (
                <div className="comments-loading">
                  <Loader2 size={24} className="animate-spin" />
                  <span>Loading comments...</span>
                </div>
              ) : comments.length > 0 ? (
                <div className="comments-list">
                  {comments.map((c) => (
                    <div key={c.id} className="comment-item-container">
                      <div className="comment-item">
                        <div className="comment-avatar">
                          {c.userAvatar ? (
                            <img src={c.userAvatar} alt={`${c.userName}'s avatar`} />
                          ) : (
                            <div className="comment-avatar-placeholder">
                              {c.userName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="comment-content">
                          <div className="comment-meta">
                            <span className="comment-username">{c.userName}</span>
                            <span className="comment-date">
                              {new Date(c.createdAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="comment-text">{renderCommentText(c.text)}</p>
                          <div className="comment-actions-row">
                            <button
                              type="button"
                              className="comment-action-btn reply-btn"
                              onClick={() => {
                                if (isAuthenticated) {
                                  handleToggleReply(c.id, c.userId, c.userName);
                                } else {
                                  onShowAuth();
                                }
                              }}
                            >
                              <MessageSquare size={12} />
                              <span>Reply</span>
                            </button>
                            {user && c.userId === user.uid && (
                              <button
                                type="button"
                                className="comment-action-btn delete-btn"
                                onClick={() => handleDeleteComment(c.id)}
                                title="Delete comment"
                              >
                                <Trash2 size={12} />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Inline Reply Form */}
                      {activeReplyCommentId === c.id && (
                        <form className="comment-reply-form" onSubmit={(e) => handlePostReply(e, c.id)}>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${c.userName}...`}
                            required
                            rows={2}
                            maxLength={300}
                            className="reply-textarea"
                          />
                          <div className="reply-form-actions">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveReplyCommentId(null)}>
                              Cancel
                            </button>
                            <button type="submit" className="btn btn-primary btn-sm reply-submit-btn" disabled={replyLoading || !replyText.trim()}>
                              {replyLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              <span>Reply</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Replies List */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="comment-replies-list">
                          {c.replies.map((r) => (
                            <div key={r.id} className="reply-item">
                              <div className="reply-avatar">
                                {r.userAvatar ? (
                                  <img src={r.userAvatar} alt={`${r.userName}'s avatar`} />
                                ) : (
                                  <div className="reply-avatar-placeholder">
                                    {r.userName.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="reply-content">
                                <div className="reply-meta">
                                  <span className="reply-username">{r.userName}</span>
                                  <span className="reply-date">
                                    {new Date(r.createdAt).toLocaleString(undefined, {
                                      year: 'numeric',
                                      month: 'numeric',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="reply-text">{renderCommentText(r.text)}</p>
                                <div className="reply-actions-row">
                                  <button
                                    type="button"
                                    className="reply-action-btn reply-btn"
                                    onClick={() => {
                                      if (isAuthenticated) {
                                        handleReplyToReply(c.id, r.userId, r.userName);
                                      } else {
                                        onShowAuth();
                                      }
                                    }}
                                  >
                                    <MessageSquare size={12} />
                                    <span>Reply</span>
                                  </button>
                                  {user && r.userId === user.uid && (
                                    <button
                                      type="button"
                                      className="reply-action-btn delete-btn"
                                      onClick={() => handleDeleteReply(c.id, r.id)}
                                      title="Delete reply"
                                    >
                                      <Trash2 size={12} />
                                      <span>Delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="comments-empty">
                  <p>No comments yet. Be the first to share your thoughts!</p>
                </div>
              )}
            </div>
          </div>

        {/* Episodes Panel */}
        <div className="streaming-episodes-panel">
          <div className="streaming-panel-tabs">
            <button 
              className={`streaming-panel-tab ${activeTab === 'episodes' ? 'active' : ''}`}
              onClick={() => setActiveTab('episodes')}
            >
              Episodes
            </button>
            <button 
              className={`streaming-panel-tab ${activeTab === 'relations' ? 'active' : ''}`}
              onClick={() => setActiveTab('relations')}
            >
              Relations
            </button>
          </div>

          {activeTab === 'episodes' ? (
            <>
              <div className="streaming-episodes-header">
                <span className="streaming-episodes-count">
                  {episodesLoading ? 'Loading...' : episodeList.length > 0 ? `${episodeList.length} available` : 'N/A'}
                </span>
              </div>

              {episodesLoading ? (
                <div className="streaming-episodes-loading"><div className="spinner" /><span>Loading...</span></div>
              ) : episodeList.length > 0 ? (
                <>
                  {totalPages > 1 && (
                    <div className="streaming-ep-ranges-container">
                      <button
                        className="streaming-range-scroll-btn left"
                        onClick={() => scrollRanges('left')}
                        aria-label="Scroll left"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <div className="streaming-ep-pagination" ref={rangesScrollRef}>
                        {Array.from({ length: totalPages }, (_, i) => {
                          const start = i * PAGE_SIZE + 1;
                          const end = Math.min((i + 1) * PAGE_SIZE, episodeList.length);
                          return (
                            <button
                              key={i}
                              className={`streaming-page-tab-btn ${episodesPage === i ? 'active' : ''}`}
                              onClick={() => setEpisodesPage(i)}
                            >
                              {start}-{end}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="streaming-range-scroll-btn right"
                        onClick={() => scrollRanges('right')}
                        aria-label="Scroll right"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                  <div className="streaming-episodes-list-vertical">
                    {paginatedEpisodes.map(ep => (
                      <button key={ep.number}
                        className={`streaming-episode-row ${ep.number === currentEpisode ? 'active' : ''}`}
                        onClick={() => handleEpisodeSelect(ep.number)}
                      >
                        <div className="streaming-episode-row-img-container">
                          {ep.img ? (
                            <img src={ep.img} alt={ep.title} className="streaming-episode-row-img" loading="lazy" />
                          ) : (
                            <div className="streaming-episode-row-placeholder">
                              <Play size={16} />
                            </div>
                          )}
                          {ep.number === currentEpisode && (
                            <div className="streaming-episode-row-playing">
                              <span>PLAYING</span>
                            </div>
                          )}
                        </div>
                        <div className="streaming-episode-row-info">
                          <span className="streaming-episode-row-number">Episode {ep.number}</span>
                          <span className="streaming-episode-row-title">{ep.title || `Episode ${ep.number}`}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : ((activeServer === 'neko' || activeServer === 'miko') && searchError) ? (
                <div className="streaming-episodes-empty"><AlertCircle size={24} /><p>{searchError}</p></div>
              ) : (
                <div className="streaming-episodes-empty"><AlertCircle size={24} /><p>No episodes available.</p></div>
              )}
            </>
          ) : (
            <>
              <div className="streaming-episodes-header">
                <h3>RELATIONS</h3>
                <span className="streaming-episodes-count">
                  {relationsLoading ? 'Loading...' : animeRelations.length > 0 ? `${animeRelations.length} types` : 'N/A'}
                </span>
              </div>

              {relationsLoading ? (
                <div className="streaming-episodes-loading"><div className="spinner" /><span>Loading relations...</span></div>
              ) : animeRelations.length > 0 ? (
                <div className="streaming-relations-container">
                  {animeRelations.map((rel, idx) => (
                    <div key={idx} className="streaming-relation-group">
                      <span className="streaming-relation-type">{rel.relation}</span>
                      <div className="streaming-relation-entries">
                        {rel.entry.map(entry => (
                          <Link key={entry.mal_id} to={`/anime/${entry.mal_id}`} className="streaming-relation-card glass-effect">
                            <span className="streaming-relation-title">{entry.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="streaming-episodes-empty"><p>No related anime found.</p></div>
              )}
            </>
          )}
        </div>
      </div>
      {/* Server Selection Modal */}
      {showServerModal && (
        <div className="modal-overlay" onClick={() => setShowServerModal(false)}>
          <div className="modal-content server-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="server-modal-header">
              <h2 className="server-modal-title">SERVER</h2>
              <button className="server-modal-close" onClick={() => setShowServerModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="server-modal-options">
              {/* 1. KOTO */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'koto' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('koto');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">Koto</span>
                  <div className="server-tags">
                    <span className="server-tag best">Fast</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 2. NEKO */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'neko' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('neko');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">neko</span>
                  <div className="server-tags">
                    <span className="server-tag best">Fast</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 3. DB */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'db' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('db');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">DB</span>
                  <div className="server-tags">
                    <span className="server-tag best">EN</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 4. REANIME */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'reanime' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('reanime');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">Reanime</span>
                  <div className="server-tags">
                    <span className="server-tag best">Fast</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 5. 4ANIMO */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'fouranimo' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('fouranimo');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">4animo</span>
                  <div className="server-tags">
                    <span className="server-tag best">Fast</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 6. 123 */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === '123' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('123');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">123</span>
                  <div className="server-tags">
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 7. MIO */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'mio' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('mio');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">Mio</span>
                  <div className="server-tags">
                    <span className="server-tag">TH</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 8. NEXUS */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'nexus' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('nexus');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">Nexus</span>
                  <div className="server-tags">
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 9. BD */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'bd' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('bd');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">BD</span>
                  <div className="server-tags">
                    <span className="server-tag best">Fast</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 10. OTAKU */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'otaku' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('otaku');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">Otaku</span>
                  <div className="server-tags">
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>

              {/* 11. HANIME */}
              <button
                type="button"
                className={`server-modal-option ${activeServer === 'hanime' ? 'active' : ''}`}
                onClick={() => {
                  setActiveServer('hanime');
                  setShowServerModal(false);
                }}
              >
                <div className="server-modal-details">
                  <span className="server-name">HAnime</span>
                  <div className="server-tags">
                    <span className="server-tag hentai">18+</span>
                    <span className="server-tag">EN</span>
                  </div>
                </div>
                <span className="server-status-dot" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content report-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h3 className="report-modal-title">Report Issue</h3>
              <button className="report-modal-close" onClick={() => setShowReportModal(false)} aria-label="Close report modal">
                <X size={20} />
              </button>
            </div>
            
            {reportSuccess ? (
              <div className="report-modal-success">
                <div className="report-success-icon">✓</div>
                <h4>Report Submitted Successfully</h4>
                <p>Thank you! Our team will investigate the issue for this server.</p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => setShowReportModal(false)}>Close</button>
              </div>
            ) : (
              <form className="report-modal-form" onSubmit={handleSendReport}>
                <div className="report-form-group">
                  <label htmlFor="report-server-select">Server</label>
                  <select
                    id="report-server-select"
                    value={reportServer}
                    onChange={(e) => setReportServer(e.target.value)}
                    className="report-select-input"
                  >
                    <option value="koto">Koto (EN)</option>
                    <option value="neko">Neko (EN/FAST)</option>
                    <option value="db">DB (EN/EN)</option>
                    <option value="reanime">Reanime (EN/FAST)</option>
                    <option value="fouranimo">4animo (EN/FAST)</option>
                    <option value="123">123 (EN)</option>
                    <option value="mio">Mio (TH)</option>
                    <option value="nexus">Nexus (EN)</option>
                    <option value="bd">BD (EN/FAST)</option>
                    <option value="otaku">Otaku (EN)</option>
                    <option value="zone" style={{ display: 'none' }}>Zone (EN)</option>
                    <option value="hanime">HAnime (18+ EN)</option>
                  </select>
                </div>

                <div className="report-form-group">
                  <label htmlFor="report-problem-select">Problem Type</label>
                  <select
                    id="report-problem-select"
                    value={reportProblem}
                    onChange={(e) => setReportProblem(e.target.value)}
                    className="report-select-input"
                  >
                    <option value="Server not working">Server not working / Offline</option>
                    <option value="Anime not matched">Anime not matched (Shows wrong show)</option>
                    <option value="Subtitles not working">Subtitles not working / Missing</option>
                    <option value="Video buffering/stuttering">Video buffering / Slow loading</option>
                    <option value="Incorrect episode">Incorrect / Missing episode</option>
                    <option value="Other">Other issue</option>
                  </select>
                </div>

                <div className="report-form-group">
                  <label htmlFor="report-note-textarea">Additional Notes (Optional)</label>
                  <textarea
                    id="report-note-textarea"
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Describe the issue in detail..."
                    className="report-textarea-input"
                    rows={4}
                    maxLength={1000}
                  />
                </div>

                {reportError && <div className="report-modal-error">{reportError}</div>}

                <div className="report-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReportModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={reportSending}>
                    {reportSending ? <Loader2 size={16} className="animate-spin" /> : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmTarget(null)}>
          <div className="delete-confirm-modal glass-effect" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <AlertTriangle size={24} className="delete-confirm-icon" />
              <h3>Delete {deleteConfirmTarget.type === 'comment' ? 'Comment' : 'Reply'}?</h3>
            </div>
            <p className="delete-confirm-text">
              Are you sure you want to delete this {deleteConfirmTarget.type}? This action cannot be undone.
            </p>
            <div className="delete-confirm-actions">
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setDeleteConfirmTarget(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-danger btn-sm" 
                onClick={executeDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Streaming;
