import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Filter, ChevronLeft, ChevronRight, SlidersHorizontal, Check, ChevronDown } from 'lucide-react';
import AnimeCard from '../../components/AnimeCard/AnimeCard';
import { searchAnime, getSeasonalAnime, getGenres } from '../../services/jikanApi';
import useDebounce from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { addBookmark, removeBookmark, getBookmarks } from '../../services/bookmarkService';
import './Browse.css';

// ---- Constants ----
const SORT_OPTIONS = [
  { value: 'score', order: 'desc', label: 'Score (Highest)' },
  { value: 'popularity', order: 'asc', label: 'Popularity' },
  { value: 'title', order: 'asc', label: 'Title (A–Z)' },
  { value: 'favorites', order: 'desc', label: 'Favorites' },
  { value: 'members', order: 'desc', label: 'Members' },
];

const YEARS = Array.from({ length: 2026 - 1990 + 1 }, (_, i) => 2026 - i);

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

const FORMATS = [
  { value: 'tv', label: 'TV' },
  { value: 'tv_special', label: 'TV Short' },
  { value: 'movie', label: 'Movie' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Special' },
  { value: 'music', label: 'Music' },
];

const STATUSES = [
  { value: 'complete', label: 'Finished Airing' },
  { value: 'airing', label: 'Currently Airing' },
  { value: 'upcoming', label: 'Not Yet Aired' },
];

const ITEMS_PER_PAGE = 25;

// ---- Helpers ----
function parseArrayParam(param) {
  if (!param) return [];
  return param.split(',').filter(Boolean);
}

function serializeArrayParam(arr) {
  return arr.length > 0 ? arr.join(',') : '';
}

export default function Browse({ onShowAuth }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const { user, isAuthenticated } = useAuth();
  const { nsfw } = useSettings();
  const [userBookmarks, setUserBookmarks] = useState([]);

  // Fetch all user bookmarks
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

  // ---- Read initial state from URL ----
  const initialGenres = parseArrayParam(searchParams.get('genres'));
  const initialQuery = searchParams.get('q') || '';
  const initialSort = searchParams.get('sort') || 'score';
  const initialYear = searchParams.get('year') || '';
  const initialSeason = searchParams.get('season') || '';
  const initialFormats = parseArrayParam(searchParams.get('type'));
  const initialStatus = searchParams.get('status') || '';
  const initialPage = parseInt(searchParams.get('page'), 10) || 1;

  // ---- State ----
  const [queryText, setQueryText] = useState(initialQuery);
  const [selectedGenreIds, setSelectedGenreIds] = useState(initialGenres);
  const [sortBy, setSortBy] = useState(initialSort);
  const [year, setYear] = useState(initialYear);
  const [season, setSeason] = useState(initialSeason);
  const [selectedFormats, setSelectedFormats] = useState(initialFormats);
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(initialPage);

  const [allGenres, setAllGenres] = useState([]);
  const [genreSearchText, setGenreSearchText] = useState('');
  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);

  const [animeList, setAnimeList] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const genreDropdownRef = useRef(null);
  const genreInputRef = useRef(null);
  
  const sortDropdownRef = useRef(null);
  const sortTriggerRef = useRef(null);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const yearDropdownRef = useRef(null);
  const yearTriggerRef = useRef(null);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  const prevFiltersRef = useRef('');

  const debouncedGenreSearch = useDebounce(genreSearchText, 300);
  const debouncedQuery = useDebounce(queryText, 500);

  // ---- Fetch genres on mount ----
  useEffect(() => {
    let cancelled = false;
    async function fetchGenres() {
      try {
        const response = await getGenres();
        if (!cancelled && response?.data) {
          setAllGenres(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch genres:', err);
      }
    }
    fetchGenres();
    return () => { cancelled = true; };
  }, []);

  // ---- Close dropdowns on outside click ----
  useEffect(() => {
    function handleClickOutside(e) {
      // Genre dropdown
      if (
        genreDropdownRef.current &&
        !genreDropdownRef.current.contains(e.target) &&
        genreInputRef.current &&
        !genreInputRef.current.contains(e.target)
      ) {
        setGenreDropdownOpen(false);
      }
      // Sort dropdown
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target) &&
        sortTriggerRef.current &&
        !sortTriggerRef.current.contains(e.target)
      ) {
        setSortDropdownOpen(false);
      }
      // Year dropdown
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(e.target) &&
        yearTriggerRef.current &&
        !yearTriggerRef.current.contains(e.target)
      ) {
        setYearDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Sync filters → URL ----
  useEffect(() => {
    const params = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (selectedGenreIds.length > 0) params.genres = serializeArrayParam(selectedGenreIds);
    if (sortBy && sortBy !== 'score') params.sort = sortBy;
    if (year) params.year = year;
    if (season) params.season = season;
    if (selectedFormats.length > 0) params.type = serializeArrayParam(selectedFormats);
    if (status) params.status = status;
    if (page > 1) params.page = String(page);

    setSearchParams(params, { replace: true });
  }, [selectedGenreIds, sortBy, year, season, selectedFormats, status, page, debouncedQuery, setSearchParams]);

  // ---- Build a filter fingerprint for page-reset detection ----
  const filterFingerprint = useMemo(() => {
    return JSON.stringify({ selectedGenreIds, sortBy, year, season, selectedFormats, status, debouncedQuery });
  }, [selectedGenreIds, sortBy, year, season, selectedFormats, status, debouncedQuery]);

  // ---- Reset page to 1 when filters change ----
  useEffect(() => {
    if (prevFiltersRef.current && prevFiltersRef.current !== filterFingerprint) {
      setPage(1);
    }
    prevFiltersRef.current = filterFingerprint;
  }, [filterFingerprint]);

  // ---- Fetch anime ----
  useEffect(() => {
    let cancelled = false;

    async function fetchAnime() {
      setLoading(true);
      setError(null);

      try {
        let response;
        const useSeasonal = season && year;

        if (useSeasonal) {
          const params = { page, limit: ITEMS_PER_PAGE, sfw: !nsfw };
          if (selectedGenreIds.length > 0) params.genres = selectedGenreIds.join(',');
          if (selectedFormats.length === 1) params.filter = selectedFormats[0];
          const sortOption = SORT_OPTIONS.find((o) => o.value === sortBy);
          if (sortOption) {
            params.order_by = sortOption.value;
            params.sort = sortOption.order;
          }
          response = await getSeasonalAnime(year, season, params);
        } else {
          const params = {
            page,
            limit: ITEMS_PER_PAGE,
            sfw: !nsfw,
          };
          if (debouncedQuery) params.q = debouncedQuery;
          if (selectedGenreIds.length > 0) params.genres = selectedGenreIds.join(',');
          const sortOption = SORT_OPTIONS.find((o) => o.value === sortBy);
          if (sortOption) {
            params.order_by = sortOption.value;
            params.sort = sortOption.order;
          }
          if (year) params.start_date = `${year}-01-01`;
          if (year) params.end_date = `${year}-12-31`;
          if (selectedFormats.length > 0) params.type = selectedFormats.join(',');
          if (status) params.status = status;

          response = await searchAnime(params);
        }

        if (!cancelled && response) {
          setAnimeList(response.data || []);
          setTotalResults(response.pagination?.items?.total || response.data?.length || 0);
          setLastPage(response.pagination?.last_visible_page || 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch anime');
          setAnimeList([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnime();
    return () => { cancelled = true; };
  }, [selectedGenreIds, sortBy, year, season, selectedFormats, status, page, debouncedQuery, nsfw]);

  // ---- Genre handlers ----
  const toggleGenre = useCallback((genreId) => {
    setSelectedGenreIds((prev) => {
      const id = String(genreId);
      return prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
    });
  }, []);

  const removeGenre = useCallback((genreId) => {
    setSelectedGenreIds((prev) => prev.filter((g) => g !== String(genreId)));
  }, []);

  // ---- Filter displayed genres by search text ----
  const filteredGenres = useMemo(() => {
    if (!debouncedGenreSearch) return allGenres;
    const q = debouncedGenreSearch.toLowerCase();
    return allGenres.filter((g) => g.name.toLowerCase().includes(q));
  }, [allGenres, debouncedGenreSearch]);

  // ---- Selected genre objects for pills ----
  const selectedGenreObjects = useMemo(() => {
    return allGenres.filter((g) => selectedGenreIds.includes(String(g.mal_id)));
  }, [allGenres, selectedGenreIds]);

  // ---- Sidebar filter handlers ----
  const toggleSeason = useCallback((s) => {
    setSeason((prev) => {
      const newSeason = prev === s ? '' : s;
      // Auto-fill current year when selecting a season without a year
      if (newSeason && !year) {
        setYear(String(new Date().getFullYear()));
      }
      return newSeason;
    });
  }, [year]);

  const toggleFormat = useCallback((fmt) => {
    setSelectedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  }, []);

  const toggleStatus = useCallback((st) => {
    setStatus((prev) => (prev === st ? '' : st));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedGenreIds([]);
    setSortBy('score');
    setYear('');
    setSeason('');
    setSelectedFormats([]);
    setStatus('');
    setPage(1);
    setGenreSearchText('');
    setQueryText('');
  }, []);

  // ---- Count active sidebar filters for mobile badge ----
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (season) count++;
    if (selectedFormats.length > 0) count += selectedFormats.length;
    if (status) count++;
    return count;
  }, [season, selectedFormats, status]);

  // ---- Pagination helpers ----
  const getPageNumbers = useCallback(() => {
    const pages = [];
    const maxVisible = 7;

    if (lastPage <= maxVisible) {
      for (let i = 1; i <= lastPage; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(lastPage - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < lastPage - 2) pages.push('...');
      pages.push(lastPage);
    }

    return pages;
  }, [page, lastPage]);

  // ---- Scroll to top on page change ----
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // ---- Render ----
  return (
    <div className="browse-page">
      {/* Top Filter Bar */}
      <div className="browse-top-bar">
        {/* Anime Name Search */}
        <div className="browse-anime-search">
          <Search size={16} className="browse-anime-search-icon" />
          <input
            type="text"
            className="browse-anime-input"
            placeholder="Search anime by name..."
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          {queryText && (
            <button className="browse-clear-x" onClick={() => setQueryText('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Genre Multi-Select Search */}
        <div className="browse-genre-search" ref={genreInputRef}>
          <div className="browse-genre-search-wrapper">
            <Search size={16} className="browse-genre-search-icon" />
            <input
              type="text"
              className="browse-genre-input"
              placeholder="Search genres..."
              value={genreSearchText}
              onChange={(e) => {
                setGenreSearchText(e.target.value);
                setGenreDropdownOpen(true);
              }}
              onFocus={() => setGenreDropdownOpen(true)}
            />
            {genreSearchText && (
              <button
                className="browse-clear-x"
                onClick={() => {
                  setGenreSearchText('');
                  setGenreDropdownOpen(false);
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Selected Genre Pills */}
          {selectedGenreObjects.length > 0 && (
            <div className="browse-genre-pills">
              {selectedGenreObjects.map((genre) => (
                <span key={genre.mal_id} className="browse-genre-pill">
                  {genre.name}
                  <button
                    className="browse-genre-pill-remove"
                    onClick={() => removeGenre(genre.mal_id)}
                    aria-label={`Remove ${genre.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Genre Dropdown */}
          {genreDropdownOpen && (
            <div className="browse-genre-dropdown" ref={genreDropdownRef}>
              {filteredGenres.length > 0 ? (
                filteredGenres.map((genre) => {
                  const isSelected = selectedGenreIds.includes(String(genre.mal_id));
                  return (
                    <div
                      key={genre.mal_id}
                      className={`browse-genre-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleGenre(genre.mal_id)}
                    >
                      <span className="browse-genre-option-check">
                        <Check size={10} />
                      </span>
                      {genre.name}
                    </div>
                  );
                })
              ) : (
                <div className="browse-genre-no-results">
                  No genres found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sort By (Custom Dropdown) */}
        <div className="browse-custom-dropdown" ref={sortTriggerRef}>
          <span className="browse-select-label">Sort</span>
          <button
            className={`browse-custom-dropdown-btn ${sortDropdownOpen ? 'active' : ''}`}
            onClick={() => setSortDropdownOpen(prev => !prev)}
            aria-label="Select sorting option"
          >
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Score (Highest)'}
            <ChevronDown size={14} className="browse-custom-dropdown-chevron" />
          </button>

          {sortDropdownOpen && (
            <div className="browse-custom-dropdown-menu" ref={sortDropdownRef}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.value;
                return (
                  <div
                    key={opt.value}
                    className={`browse-custom-dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSortBy(opt.value);
                      setSortDropdownOpen(false);
                    }}
                  >
                    <span className="browse-genre-option-check">
                      <Check size={10} />
                    </span>
                    {opt.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Year (Custom Dropdown) */}
        <div className="browse-custom-dropdown" ref={yearTriggerRef}>
          <span className="browse-select-label">Year</span>
          <button
            className={`browse-custom-dropdown-btn ${yearDropdownOpen ? 'active' : ''}`}
            onClick={() => setYearDropdownOpen(prev => !prev)}
            aria-label="Select year"
          >
            {year || 'All Years'}
            <ChevronDown size={14} className="browse-custom-dropdown-chevron" />
          </button>

          {yearDropdownOpen && (
            <div className="browse-custom-dropdown-menu browse-custom-dropdown-menu--year" ref={yearDropdownRef}>
              <div
                className={`browse-custom-dropdown-option ${!year ? 'selected' : ''}`}
                onClick={() => {
                  setYear('');
                  setYearDropdownOpen(false);
                }}
              >
                <span className="browse-genre-option-check">
                  <Check size={10} />
                </span>
                All Years
              </div>
              {YEARS.map((y) => {
                const isSelected = String(year) === String(y);
                return (
                  <div
                    key={y}
                    className={`browse-custom-dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setYear(String(y));
                      setYearDropdownOpen(false);
                    }}
                  >
                    <span className="browse-genre-option-check">
                      <Check size={10} />
                    </span>
                    {y}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Filter Toggle */}
        <button
          className="browse-mobile-filter-toggle"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
        >
          <Filter size={16} />
          Filters
          {activeFilterCount > 0 && (
            <span className="filter-count">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Content: Sidebar (LEFT) + Main */}
      <div className="browse-content">
        {/* Sidebar Filters — NOW ON THE LEFT */}
        <aside className={`browse-filters-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="browse-sidebar-title">
            <SlidersHorizontal size={18} />
            Filters
          </div>

          {/* Season */}
          <div className="browse-filter-section">
            <div className="browse-filter-label">Season</div>
            <div className="browse-filter-options">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  className={`browse-filter-btn ${season === s ? 'active' : ''}`}
                  onClick={() => toggleSeason(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="browse-filter-section">
            <div className="browse-filter-label">Format</div>
            <div className="browse-filter-options">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  className={`browse-filter-btn ${selectedFormats.includes(fmt.value) ? 'active' : ''}`}
                  onClick={() => toggleFormat(fmt.value)}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="browse-filter-section">
            <div className="browse-filter-label">Status</div>
            <div className="browse-filter-options">
              {STATUSES.map((st) => (
                <button
                  key={st.value}
                  className={`browse-filter-btn ${status === st.value ? 'active' : ''}`}
                  onClick={() => toggleStatus(st.value)}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear All */}
          <button className="browse-sidebar-clear" onClick={clearAllFilters}>
            Clear All Filters
          </button>
        </aside>

        {/* Main Grid */}
        <div className="browse-main">
          {/* Results Header */}
          <div className="browse-results-header">
            <p className="browse-results-count">
              {loading ? (
                'Loading results...'
              ) : (
                <>
                  Found <span>{totalResults.toLocaleString()}</span> anime
                </>
              )}
            </p>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="browse-skeleton-grid">
              {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                <div key={i} className="browse-skeleton-card" style={{ animationDelay: `${i * 0.04}s` }} />
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="browse-no-results">
              <Search size={56} className="browse-no-results-icon" />
              <h3 className="browse-no-results-title">Something went wrong</h3>
              <p className="browse-no-results-text">{error}</p>
              <button className="browse-clear-filters-btn" onClick={() => setPage(page)}>
                Try Again
              </button>
            </div>
          )}

          {/* No Results */}
          {!loading && !error && animeList.length === 0 && (
            <div className="browse-no-results">
              <Search size={56} className="browse-no-results-icon" />
              <h3 className="browse-no-results-title">No results found</h3>
              <p className="browse-no-results-text">
                Try adjusting your filters or search criteria to find what you're looking for.
              </p>
              <button className="browse-clear-filters-btn" onClick={clearAllFilters}>
                <X size={14} />
                Clear All Filters
              </button>
            </div>
          )}

          {/* Results Grid */}
          {!loading && !error && animeList.length > 0 && (
            <>
              <div className="browse-results-grid">
                {animeList.map((anime) => (
                  <AnimeCard
                    key={anime.mal_id}
                    anime={anime}
                    onBookmark={handleCardBookmark}
                    isBookmarked={userBookmarks.includes(anime.mal_id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {lastPage > 1 && (
                <div className="browse-pagination">
                  <button
                    className="browse-pagination-btn browse-pagination-nav"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {getPageNumbers().map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="browse-pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        className={`browse-pagination-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <button
                    className="browse-pagination-btn browse-pagination-nav"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
