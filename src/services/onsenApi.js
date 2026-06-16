// Onsen API Service
// Base URL: https://anime-onsen-api.vercel.app

export async function getOnsenStream(malId, episode) {
  if (!malId) return null;
  try {
    const url = `https://anime-onsen-api.vercel.app/api/source/${malId}/episode/${episode}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Onsen API returned status ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch Onsen stream for MAL ID ${malId} Ep ${episode}:`, error);
    return null;
  }
}
