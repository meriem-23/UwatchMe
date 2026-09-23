// Official YouTube playlist -> episode list. Only serves playlists listed in catalog.json,
// unless the request carries the admin key (admin.html uses it to preview new playlists).
// Env: YOUTUBE_API_KEY (YouTube Data API v3), ADMIN_KEY (any long random string).
import { loadCatalog } from '../lib/catalog.js';

const API = 'https://www.googleapis.com/youtube/v3/';
const MAX_PAGES = 10; // 10 x 50 = up to 500 episodes, 1 quota unit per page

function pickThumb(th, order) {
  if (!th) return '';
  for (const k of order) if (th[k] && th[k].url) return th[k].url;
  return '';
}

async function yt(endpoint, params) {
  const u = new URL(API + endpoint);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { accept: 'application/json' } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const errs = body && body.error && body.error.errors;
    const err = new Error((errs && errs[0] && errs[0].reason) || ('YouTube API ' + r.status));
    err.status = r.status;
    throw err;
  }
  return body;
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const id = (url.searchParams.get('playlist') || '').trim();
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(id)) return res.status(400).json({ error: 'Invalid playlist id' });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YouTube is not configured: add YOUTUBE_API_KEY in Vercel environment variables.' });

  const adminKey = process.env.ADMIN_KEY;
  const isAdmin = !!adminKey && req.headers['x-admin-key'] === adminKey;
  if (!isAdmin && !loadCatalog().series.some(s => s.playlistId === id)) {
    return res.status(403).json({ error: 'This playlist is not in the catalog.' });
  }

  try {
    const info = await yt('playlists', { part: 'snippet,contentDetails', id, key, maxResults: 1 });
    const p = info.items && info.items[0];
    if (!p) return res.status(404).json({ error: 'Playlist not found or private' });

    const episodes = [];
    let pageToken = '';
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await yt('playlistItems', { part: 'snippet,contentDetails,status', playlistId: id, maxResults: 50, pageToken, key });
      for (const it of page.items || []) {
        const s = it.snippet || {};
        const privacy = it.status && it.status.privacyStatus;
        const videoId = it.contentDetails && it.contentDetails.videoId;
        if (!videoId || (privacy !== 'public' && privacy !== 'unlisted')) continue;
        if (s.title === 'Private video' || s.title === 'Deleted video') continue;
        episodes.push({
          videoId,
          title: s.title || '',
          thumb: pickThumb(s.thumbnails, ['medium', 'high', 'default']),
          publishedAt: (it.contentDetails && it.contentDetails.videoPublishedAt) || s.publishedAt || ''
        });
      }
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }

    res.setHeader('Cache-Control', isAdmin ? 'no-store' : 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
      id,
      title: (p.snippet && p.snippet.title) || '',
      channel: (p.snippet && p.snippet.channelTitle) || '',
      thumb: pickThumb(p.snippet && p.snippet.thumbnails, ['maxres', 'standard', 'high', 'medium', 'default']),
      count: (p.contentDetails && p.contentDetails.itemCount) || episodes.length,
      episodes
    });
  } catch (e) {
    return res.status(e.status === 404 ? 404 : 502).json({ error: 'YouTube: ' + e.message });
  }
}
