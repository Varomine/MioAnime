// Logo Service using Kitsu mapping + Fanart.tv API
const FANART_API_KEY = 'bf5e2a48f60030dc696a30955819a44c';

/**
 * Resolves a MAL ID to a TVDB ID via Kitsu, then fetches its clear logo from Fanart.tv.
 */
export async function getAnimeLogoUrl(malId) {
  if (!malId) return null;
  
  try {
    // 1. Get Kitsu mapping to find the Kitsu anime ID
    const mappingUrl = `https://kitsu.io/api/edge/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item`;
    const mappingRes = await fetch(mappingUrl, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      }
    });
    if (!mappingRes.ok) return null;
    
    const mappingData = await mappingRes.json();
    const mappingItem = mappingData?.data?.[0];
    if (!mappingItem) return null;
    
    const kitsuAnimeId = mappingItem?.relationships?.item?.data?.id;
    if (!kitsuAnimeId) return null;
    
    // 2. Get all mappings for this Kitsu anime ID to find TVDB ID
    const kitsuMappingsUrl = `https://kitsu.io/api/edge/anime/${kitsuAnimeId}/mappings`;
    const kitsuMappingsRes = await fetch(kitsuMappingsUrl, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      }
    });
    if (!kitsuMappingsRes.ok) return null;
    
    const kitsuMappingsData = await kitsuMappingsRes.json();
    const mappingsList = kitsuMappingsData?.data || [];
    
    // Find mapping with thetvdb/series or thetvdb
    const tvdbMapping = mappingsList.find(m => 
      m?.attributes?.externalSite && 
      m.attributes.externalSite.toLowerCase().includes('thetvdb')
    );
    if (!tvdbMapping) return null;
    
    const tvdbId = tvdbMapping?.attributes?.externalId;
    if (!tvdbId) return null;
    
    // 3. Fetch logo from Fanart.tv using TVDB ID
    const fanartUrl = `https://webservice.fanart.tv/v3/tv/${tvdbId}?api_key=${FANART_API_KEY}`;
    const fanartRes = await fetch(fanartUrl);
    if (!fanartRes.ok) return null;
    
    const fanartData = await fanartRes.json();
    
    // Prioritize hdtvlogo then clearlogo
    const logoArray = fanartData?.hdtvlogo || fanartData?.clearlogo || [];
    if (logoArray.length === 0) return null;
    
    // Prefer English ('en') or neutral/no-language ('00')
    const bestLogo = logoArray.find(l => l.lang === 'en' || l.lang === '00') || logoArray[0];
    return bestLogo?.url || null;
  } catch (error) {
    console.error(`Failed to fetch logo for MAL ID ${malId}:`, error);
    return null;
  }
}
