# 🌌 AniVault — Premium Anime Streaming & Watchlist Platform

AniVault is a modern, high-end web application for anime streaming, scheduling, and watchlist tracking. Built with **React** and **Vite**, and styled with a custom **luxury black, charcoal, and gold design system**, it offers a premium, responsive user experience reminiscent of high-end streaming platforms like Netflix and Disney+.

---

## ✨ Features

### 🎬 Streaming & Video Player
* **Smart HLS Streaming**: Custom HLS video player integrated via a clean wrapper (`public/embed.html`) supporting `hls.js` for desktop/Android, and native HLS stream compatibility for iPhone/iOS devices.
* **Episode Navigation & Playlists**: Dedicated media controls supporting next/previous navigation, watch history tracking, and dynamically updated episode selectors.
* **Watch Progress Tracking**: Syncs current video progress and watch duration in real-time, displaying percentage progress indicators across row posters and bookmarks.

### 🏠 Home Page & Hero Carousel
* **Cinematic Carousel**: Interactive featured banner carousel cycling popular titles with automatic rotation, synopsis expanders, live rating displays, and quick-action play/bookmark shortcuts.
* **Horizontal Carousels**: Custom Netflix-style scrolling rows for *Continue Watching*, *Trending Now*, *Popular This Season*, *Most Favorite*, and *Upcoming Anime*.

### 🔍 Advanced Search & Browse Filters
* **Debounced Search**: Quick, real-time title search powered by debounced handlers to respect API rate limits.
* **Interactive Genre Pills**: Dropdown multi-select search displaying selected tags as premium interactive gold pills.
* **Sticky Sidebar Panel**: Desktop filters for Format, Season, Status, and Sorting order that stay locked to the viewport on scroll. Collapses into a responsive, scrollable header tab on mobile/tablet viewports.

### 📅 Weekly Airing Schedule
* **Live Countdown Timers**: Integrates AniList's GraphQL API to query airing times and display live tickers detailing when future episodes air.
* **Interactive Day Tabs**: Weekly grid filtered by broadcast day, complete with studio details, average ratings, and direct anime info link mappings.

### 📚 Cloud Bookmarks Library
* **Firestore Synced Collection**: Tracks personal watchlist entries stored securely in Firebase Cloud Firestore.
* **Category Filters**: Organize titles under watching statuses (*Watching*, *Plan to Watch*, *Completed*, *Dropped*, *On Hold*).
* **Guest Prompts**: Elegant guest view prompts with custom glass-morphism logins that trigger the Auth modal directly.

---

## 🛠️ Technology Stack

* **Frontend**: React (with React Router v7 and state hooks)
* **Build System**: Vite (optimized for speed and dynamic code splitting)
* **Styling**: Vanilla CSS utilizing custom layout properties and CSS variables for theming.
* **Icons**: [Lucide React](https://lucide.dev)
* **Database & Auth**: [Firebase Auth](https://firebase.google.com/docs/auth) & [Cloud Firestore](https://firebase.google.com/docs/firestore)
* **APIs & Data Integrations**:
  * [Jikan REST API](https://jikan.moe/) (MAL details, recommendations, seasonal catalog)
  * [AniList GraphQL API](https://anilist.co/) (weekly airing schedule, broadcast times)
  * [AnimePahe API](https://github.com/mdtahseen7/AnimepaheApi) (streaming sources and episode links)

---

## 🚀 Getting Started

### 📋 Prerequisites

Ensure you have **Node.js** (v18 or higher) and **npm** installed on your local machine.

### ⚙️ Installation & Configuration

1. **Clone the Repository** (or navigate to the workspace directory):
   ```bash
   git clone https://github.com/Varomine/AniVault && cd anime-site
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root and populate it with your configuration credentials (see `.env.example` as a template):
   ```ini
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   VITE_FIREBASE_PROJECT_ID=your_project_id_here
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   VITE_FIREBASE_APP_ID=your_app_id_here
   VITE_ANIMEPAHE_API_BASE=https://animepaheapi-1.onrender.com
   ```

4. **Launch Dev Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Run Lint Check**:
   To check for any code styling and React hook dependency compliance rules:
   ```bash
   npm run lint
   ```

6. **Build for Production**:
   Vite minifies assets and splits chunk outputs to output production-ready static assets:
   ```bash
   npm run build
   ```
