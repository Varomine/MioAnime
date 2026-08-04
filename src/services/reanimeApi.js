export async function getReanimeEpisodes(anilistId) {
  const url = `https://reanime-api.sapis.workers.dev/api/anil/${anilistId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Reanime API returned status ${response.status}`);
  }
  const data = await response.json();
  return data;
}
