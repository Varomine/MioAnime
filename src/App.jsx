import { useState, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import AuthModal from './components/AuthModal/AuthModal';

// Lazy load pages for performance
const Landing = lazy(() => import('./pages/Landing/Landing'));
const Home = lazy(() => import('./pages/Home/Home'));
const Browse = lazy(() => import('./pages/Browse/Browse'));
const Schedule = lazy(() => import('./pages/Schedule/Schedule'));
const Music = lazy(() => import('./pages/Music/Music'));
const Torrent = lazy(() => import('./pages/Torrent/Torrent'));
const Bookmark = lazy(() => import('./pages/Bookmark/Bookmark'));
const AnimeDetail = lazy(() => import('./pages/AnimeDetail/AnimeDetail'));
const Streaming = lazy(() => import('./pages/Streaming/Streaming'));
const Random = lazy(() => import('./pages/Random/Random'));
const Profile = lazy(() => import('./pages/Profile/Profile'));

function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner"></div>
      <p className="page-loader-text">Loading</p>
    </div>
  );
}

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <Navbar onShowAuth={() => setShowAuthModal(true)} />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home onShowAuth={() => setShowAuthModal(true)} />} />
            <Route path="/browse" element={<Browse onShowAuth={() => setShowAuthModal(true)} />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/music" element={<Music />} />
            <Route path="/torrent" element={<Torrent />} />
            <Route path="/random" element={<Random />} />
            <Route path="/profile" element={<Profile onShowAuth={() => setShowAuthModal(true)} />} />
            <Route
              path="/bookmarks"
              element={<Bookmark onShowAuth={() => setShowAuthModal(true)} />}
            />
            <Route path="/anime/:id" element={<AnimeDetail onShowAuth={() => setShowAuthModal(true)} />} />
            <Route path="/watch/:id" element={<Streaming onShowAuth={() => setShowAuthModal(true)} />} />
            <Route path="/watch/:id/:episode" element={<Streaming onShowAuth={() => setShowAuthModal(true)} />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}

export default App;
