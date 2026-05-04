import yts from 'yt-search';

export async function getFirstYoutubeVideo(query: string): Promise<string | null> {
  try {
    console.log(`[YouTube] Buscando: ${query}`);
    const r = await yts(query);
    const videos = r.videos;
    
    if (videos && videos.length > 0) {
      console.log(`[YouTube] Encontrado: ${videos[0].title} (${videos[0].url})`);
      return videos[0].url;
    }
    
    return null;
  } catch (err) {
    console.error('[YouTube Search Error]', err);
    return null;
  }
}
