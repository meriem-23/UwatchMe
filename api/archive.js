// Internet Archive public-domain films and cartoons.
//   /api/archive?collection=feature_films&page=1&q=...   -> search
//   /api/archive?id=<identifier>                         -> one film with its best MP4
import { loadCatalog } from '../lib/catalog.js';

const COLLECTIONS = new Set(['feature_films', 'animationandcartoons']);
const ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const ROWS = 30;

const first = v => (Array.isArray(v) ? v[0] : v);
const cacheLong = res => res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');

function rank(f) {
  const fmt = String(f.format || '');
  if (/h\.264/i.test(fmt)) return 3;
  if (/^mpeg4$/i.test(fmt)) return 2;
  if (/512kb/i.test(fmt)) return 1;
  return 0;
}

async function item(res, id) {
  if (!ID_RE.test(id)) return res.status(400).json({ error: 'Invalid id' });
  if (loadCatalog().archiveBlocklist.includes(id)) return res.status(404).json({ error: 'Not available' });

  const r = await fetch('https://archive.org/metadata/' + encodeURIComponent(id), { headers: { accept: 'application/json' } });
  if (!r.ok) return res.status(502).json({ error: 'Internet Archive returned ' + r.status });
  const data = await r.json();
  const m = data && data.metadata;
  if (!m) return res.status(404).json({ error: 'Not found' });

  const cols = [].concat(m.collection || []);
  if (!cols.some(c => COLLECTIONS.has(c))) return res.status(403).json({ error: 'This item is not in a public-domain collection' });

  const files = (data.files || []).filter(f => /\.mp4$/i.test(f.name || ''));
  files.sort((a, b) => rank(b) - rank(a) || (Number(a.size) || 0) - (Number(b.size) || 0));
  const f = files[0];
  const video = f ? {
    url: 'https://archive.org/download/' + encodeURIComponent(id) + '/' + f.name.split('/').map(encodeURIComponent).join('/'),
    format: f.format || '',
    size: Number(f.size) || 0
  } : null;

  cacheLong(res);
  return res.status(200).json({
    id,
    title: String(first(m.title) || id),
    year: String(first(m.year) || String(first(m.date) || '').slice(0, 4) || ''),
    runtime: String(first(m.runtime) || ''),
    description: [].concat(m.description || []).join('\n').slice(0, 5000),
    license: String(first(m.licenseurl) || ''),
    thumb: 'https://archive.org/services/img/' + encodeURIComponent(id),
    video
  });
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('id');
  try {
    if (id) return await item(res, id);

    const collection = url.searchParams.get('collection') || 'feature_films';
    if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Unknown collection' });
    const page = Math.max(1, Math.min(200, parseInt(url.searchParams.get('page'), 10) || 1));
    const clean = String(url.searchParams.get('q') || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

    let query = 'collection:(' + collection + ') AND mediatype:(movies)';
    if (clean) query += ' AND title:(' + clean + ')';
    const params = new URLSearchParams({ q: query, rows: String(ROWS), page: String(page), output: 'json' });
    ['identifier', 'title', 'year'].forEach(fl => params.append('fl[]', fl));
    params.append('sort[]', 'downloads desc');

    const r = await fetch('https://archive.org/advancedsearch.php?' + params.toString(), { headers: { accept: 'application/json' } });
    if (!r.ok) return res.status(502).json({ error: 'Internet Archive returned ' + r.status });
    const data = await r.json();
    const block = new Set(loadCatalog().archiveBlocklist);
    const docs = (data.response && data.response.docs) || [];

    cacheLong(res);
    return res.status(200).json({
      page,
      rows: ROWS,
      total: (data.response && data.response.numFound) || 0,
      items: docs.filter(d => d.identifier && !block.has(d.identifier)).map(d => ({
        id: d.identifier,
        title: String(first(d.title) || d.identifier),
        year: String(first(d.year) || '')
      }))
    });
  } catch (e) {
    return res.status(502).json({ error: 'Internet Archive is unreachable right now.' });
  }
}
