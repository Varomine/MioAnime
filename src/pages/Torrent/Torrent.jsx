import { useState, useEffect } from 'react';
import { Search, Download, Check, ExternalLink, AlertTriangle, Loader2, Database, Magnet } from 'lucide-react';
import './Torrent.css';

const POPULAR_SEARCHES = [
  'One Piece',
  'Naruto',
  'Demon Slayer',
  'Jujutsu Kaisen',
  'Bleach',
  'Chainsaw Man',
  'Attack on Titan',
  'My Hero Academia'
];

function formatBytes(bytes, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function Torrent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('One Piece');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const fetchTorrents = async (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const url = `https://feed.animetosho.org/json?qx=1&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch torrents (Status: ${res.status})`);
      }
      
      const data = await res.json();
      const rawResults = (data || []).map(item => ({
        title: item.title,
        size: formatBytes(item.total_size),
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        magnet: item.magnet_uri,
        torrent: item.torrent_url,
        link: item.link
      }));
      
      // Sort results by seeders descending as requested
      const sortedResults = [...rawResults].sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
      
      setResults(sortedResults);
    } catch (err) {
      console.error('Torrent search error:', err);
      setError('Failed to fetch torrent search results. Please check your network or try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Run initial search on mount
  useEffect(() => {
    const runFetch = async () => {
      await Promise.resolve();
      fetchTorrents(activeQuery);
    };
    runFetch();
  }, [activeQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveQuery(searchQuery.trim());
    }
  };

  const handleChipClick = (query) => {
    setSearchQuery(query);
    setActiveQuery(query);
  };

  const handleCopyMagnet = async (magnet, id) => {
    if (!magnet) return;
    try {
      await navigator.clipboard.writeText(magnet);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy magnet link:', err);
    }
  };

  return (
    <div className="torrent-page">
      <div className="torrent-container">
        
        {/* Header */}
        <div className="torrent-header">
          <div className="torrent-badge-icon">
            <Database size={24} className="gold-text" />
          </div>
          <h1 className="torrent-title">Torrent Index</h1>
          <p className="torrent-subtitle">
            Find high-quality anime releases, episodes, and movies indexed directly from torrent networks.
          </p>
        </div>

        {/* Search Panel */}
        <div className="torrent-search-panel">
          <form onSubmit={handleSearchSubmit} className="torrent-search-form">
            <div className="torrent-input-wrapper">
              <input
                type="text"
                placeholder="Search anime releases (e.g. Naruto, Demon Slayer)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="torrent-input"
              />
              <Search className="torrent-search-icon" size={18} />
            </div>
            <button type="submit" disabled={loading} className="torrent-submit-btn">
              {loading ? <Loader2 size={18} className="spinner" /> : 'Search'}
            </button>
          </form>

          {/* Quick chips */}
          <div className="torrent-chips-container">
            <span className="torrent-chips-label">Popular Searches:</span>
            <div className="torrent-chips">
              {POPULAR_SEARCHES.map((query) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => handleChipClick(query)}
                  className={`torrent-chip ${activeQuery === query ? 'active' : ''}`}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Block */}
        <div className="torrent-results-section">
          {loading ? (
            <div className="torrent-loading">
              <Loader2 className="spinner loading-spinner" size={40} />
              <p>Searching indexes for &ldquo;{activeQuery}&rdquo;...</p>
            </div>
          ) : error ? (
            <div className="torrent-error-card">
              <AlertTriangle className="error-icon" size={32} />
              <div className="error-text">
                <h3>Search Failed</h3>
                <p>{error}</p>
              </div>
              <button onClick={() => fetchTorrents(activeQuery)} className="torrent-retry-btn">
                Retry
              </button>
            </div>
          ) : results.length > 0 ? (
            <div className="torrent-results-wrapper">
              <div className="torrent-results-header">
                <span className="results-count">
                  Found <strong>{results.length}</strong> torrents for &ldquo;{activeQuery}&rdquo;
                </span>
                <span className="results-sorting-info">Sorted by Seeders (highest first)</span>
              </div>

              {/* Responsive Table / Card container */}
              <div className="torrent-table-container">
                <table className="torrent-table">
                  <thead>
                    <tr>
                      <th className="th-title">Title</th>
                      <th className="th-size text-center">Size</th>
                      <th className="th-seeders text-center">Seeders</th>
                      <th className="th-leechers text-center">Leechers</th>
                      <th className="th-actions text-center">Download / Magnet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((torrent, index) => {
                      const uniqueId = `${torrent.magnet || index}-${index}`;
                      const isCopied = copiedId === uniqueId;
                      
                      return (
                        <tr key={uniqueId}>
                          <td className="td-title">
                            <span className="torrent-display-title" title={torrent.title}>
                              {torrent.title}
                            </span>
                          </td>
                          <td className="td-size text-center font-mono">
                            {torrent.size || 'N/A'}
                          </td>
                          <td className="td-seeders text-center font-bold">
                            <span className="seeder-badge">
                              {torrent.seeders ?? 0}
                            </span>
                          </td>
                          <td className="td-leechers text-center font-bold">
                            <span className="leecher-badge">
                              {torrent.leechers ?? 0}
                            </span>
                          </td>
                          <td className="td-actions text-center">
                            <div className="torrent-actions-group">
                              
                              {/* Magnet Copy Action */}
                              <button
                                type="button"
                                className={`torrent-action-btn magnet-btn ${isCopied ? 'copied' : ''}`}
                                onClick={() => handleCopyMagnet(torrent.magnet, uniqueId)}
                                title={isCopied ? 'Copied Magnet Link!' : 'Copy Magnet Link'}
                              >
                                {isCopied ? <Check size={15} /> : <Magnet size={15} />}
                                <span className="action-btn-text">{isCopied ? 'Copied' : 'Magnet'}</span>
                              </button>

                              {/* Torrent Download File Action */}
                              {torrent.torrent && (
                                <a
                                  href={torrent.torrent}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="torrent-action-btn download-btn"
                                  title="Download .torrent file"
                                >
                                  <Download size={15} />
                                  <span className="action-btn-text">Torrent</span>
                                </a>
                              )}

                              {/* Web Info Page Link */}
                              {torrent.link && (
                                <a
                                  href={torrent.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="torrent-action-btn info-btn"
                                  title="View info page on AnimeTosho"
                                >
                                  <ExternalLink size={15} />
                                  <span className="action-btn-text">Source</span>
                                </a>
                              )}

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="torrent-empty-state">
              <Database size={48} className="empty-icon" />
              <h3>No Torrents Found</h3>
              <p>We couldn't find any active torrent releases for &ldquo;{activeQuery}&rdquo;.</p>
              <p className="empty-tip">Tip: Try searching for a simplified anime title or English title names.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
