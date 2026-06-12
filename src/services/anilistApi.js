// Anilist GraphQL API Service
// Endpoint: https://graphql.anilist.co
// Used for: Schedule page

const ANILIST_URL = 'https://graphql.anilist.co';

async function anilistQuery(query, variables = {}) {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Anilist API error: ${response.status}`);
  }

  return response.json();
}

const SCHEDULE_QUERY = `
query ($page: Int, $start: Int, $end: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
      currentPage
      total
    }
    airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
      id
      airingAt
      timeUntilAiring
      episode
      media {
        id
        idMal
        title {
          romaji
          english
          native
        }
        format
        genres
        episodes
        status
        averageScore
        popularity
        description(asHtml: false)
        coverImage {
          extraLarge
          large
          medium
          color
        }
        bannerImage
        season
        seasonYear
        studios(isMain: true) {
          edges {
            isMain
            node {
              id
              name
            }
          }
        }
      }
    }
  }
}
`;

// Get timestamps for the current week (Monday to Sunday)
function getWeekTimestamps() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: Math.floor(monday.getTime() / 1000),
    end: Math.floor(sunday.getTime() / 1000),
  };
}

// Get day name from unix timestamp
function getDayName(timestamp) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(timestamp * 1000).getDay()];
}

// Get short day name from unix timestamp
function getShortDayName(timestamp) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(timestamp * 1000).getDay()];
}

export async function getWeeklySchedule() {
  const { start, end } = getWeekTimestamps();
  const allSchedules = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const result = await anilistQuery(SCHEDULE_QUERY, { page, start, end });
    const pageData = result.data.Page;
    allSchedules.push(...pageData.airingSchedules);
    hasNext = pageData.pageInfo.hasNextPage;
    page++;

    // Safety limit
    if (page > 10) break;
  }

  // Group by day
  const grouped = {};
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  dayOrder.forEach(day => {
    grouped[day] = [];
  });

  allSchedules.forEach(schedule => {
    const day = getDayName(schedule.airingAt);
    if (grouped[day]) {
      grouped[day].push(schedule);
    }
  });

  // Sort each day's entries by time
  Object.keys(grouped).forEach(day => {
    grouped[day].sort((a, b) => a.airingAt - b.airingAt);
  });

  return grouped;
}

export function formatAiringTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCountdown(seconds) {
  if (seconds <= 0) return 'Aired';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function getCurrentDayName() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

export { getDayName, getShortDayName };
