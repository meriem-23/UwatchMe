// TMDB proxy: keeps the key on the server and only allows the endpoints UwatchMe uses.
// Env: TMDB_TOKEN (v4 "API Read Access Token", preferred) or TMDB_API_KEY (v3 key).
const ALLOWED = new RegExp('^(' + [
  'trending/(all|movie|tv)/(day|week)',
  'discover/(movie|tv)',
  'search/(multi|movie|tv)',
  'movie/\\d+(/(videos|watch/providers|recommendations))?',
  'tv/\\d+(/(videos|watch/providers|recommendations|season/\\d+))?',
  'genre/(movie|tv)/list',
  'watch/providers/regions'
].join('|') + ')$');

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = (url.searchParams.get('path') || '').replace(/^\/+/, '');
  if (!ALLOWED.test(path)) return res.status(400).json({ error: 'Path not allowed' });

  const token = process.env.TMDB_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) return res.status(500).json({ error: 'TMDB is not configured: add TMDB_TOKEN in Vercel environment variables.' });

  const target = new URL('https://api.themoviedb.org/3/' + path);
  for (const [k, v] of url.searchParams) {
    if (k === 'path' || k === 'api_key') continue;
    target.searchParams.set(k, String(v).slice(0, 200));
  }
  if (/^(discover|search)\//.test(path)) target.searchParams.set('include_adult', 'false');

  const headers = { accept: 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  else target.searchParams.set('api_key', key);

  try {
    const r = await fetch(target, { headers });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', r.ok ? 'public, s-maxage=21600, stale-while-revalidate=86400' : 'no-store');
    return res.status(r.status).send(body);
  } catch (e) {
    return res.status(502).json({ error: 'TMDB is unreachable right now.' });
  }
}
