// Run: node tests/api.test.mjs  (from the project root)
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import tmdb from '../api/tmdb.js';
import yt from '../api/yt.js';
import archive from '../api/archive.js';
import { _resetCatalog } from '../lib/catalog.js';

function mockRes() {
  const r = { statusCode: 200, headers: {}, body: undefined };
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.send = b => { r.body = typeof b === 'string' ? JSON.parse(b) : b; return r; };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  return r;
}
const req = (url, headers) => ({ url, headers: headers || {} });
let calls = [];
function mockFetch(routes) {
  calls = [];
  globalThis.fetch = async (u, opts) => {
    const s = String(u);
    calls.push({ url: s, opts });
    for (const [pat, body, status] of routes) {
      if (s.includes(pat)) return new Response(JSON.stringify(body), { status: status || 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  };
}

const original = readFileSync('catalog.json', 'utf8');
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok  ', name); }
  catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; }
}

try {
  // ---------- TMDB ----------
  process.env.TMDB_TOKEN = 'tok';
  await test('tmdb rejects paths outside allowlist', async () => {
    const res = mockRes();
    await tmdb(req('/api/tmdb?path=account/123'), res);
    assert.equal(res.statusCode, 400);
  });
  await test('tmdb forwards, uses bearer, forces include_adult=false', async () => {
    mockFetch([['api.themoviedb.org/3/search/multi', { results: [{ id: 1 }] }]]);
    const res = mockRes();
    await tmdb(req('/api/tmdb?path=search/multi&query=Dune&include_adult=true&api_key=leak'), res);
    assert.equal(res.statusCode, 200);
    const u = new URL(calls[0].url);
    assert.equal(u.searchParams.get('include_adult'), 'false');
    assert.equal(u.searchParams.get('api_key'), null);
    assert.equal(calls[0].opts.headers.authorization, 'Bearer tok');
    assert.match(res.headers['cache-control'], /s-maxage/);
  });
  await test('tmdb allows detail with season', async () => {
    mockFetch([['tv/1399/season/2', { episodes: [] }]]);
    const res = mockRes();
    await tmdb(req('/api/tmdb?path=tv/1399/season/2&language=fr-FR'), res);
    assert.equal(res.statusCode, 200);
  });
  await test('tmdb reports missing key', async () => {
    delete process.env.TMDB_TOKEN;
    const res = mockRes();
    await tmdb(req('/api/tmdb?path=trending/all/week'), res);
    assert.equal(res.statusCode, 500);
    process.env.TMDB_TOKEN = 'tok';
  });

  // ---------- YouTube ----------
  writeFileSync('catalog.json', JSON.stringify({ series: [{ id: 'x-abcdef', title: 'X', category: 'arabic', playlistId: 'PLallowed123456' }], archiveBlocklist: ['blockedfilm'] }));
  _resetCatalog();
  process.env.YOUTUBE_API_KEY = 'ytkey';
  process.env.ADMIN_KEY = 'secret';
  const ytRoutes = [
    ['/playlists?', { items: [{ snippet: { title: 'Series S1', channelTitle: 'Official TV', thumbnails: { high: { url: 'h.jpg' } } }, contentDetails: { itemCount: 3 } }] }],
    ['/playlistItems?', { items: [
      { snippet: { title: 'Ep 1', thumbnails: { medium: { url: 'm1.jpg' } } }, contentDetails: { videoId: 'v1', videoPublishedAt: '2024-01-01' }, status: { privacyStatus: 'public' } },
      { snippet: { title: 'Private video' }, contentDetails: { videoId: 'v2' }, status: { privacyStatus: 'private' } },
      { snippet: { title: 'Ep 3', thumbnails: {} }, contentDetails: { videoId: 'v3' }, status: { privacyStatus: 'unlisted' } }
    ] }]
  ];
  await test('yt refuses playlists not in catalog', async () => {
    mockFetch(ytRoutes);
    const res = mockRes();
    await yt(req('/api/yt?playlist=PLnotinthelist99'), res);
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
  });
  await test('yt serves catalog playlist and drops private videos', async () => {
    mockFetch(ytRoutes);
    const res = mockRes();
    await yt(req('/api/yt?playlist=PLallowed123456'), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.episodes.map(e => e.videoId), ['v1', 'v3']);
    assert.equal(res.body.channel, 'Official TV');
    assert.equal(res.body.thumb, 'h.jpg');
  });
  await test('yt admin key unlocks preview of new playlists', async () => {
    mockFetch(ytRoutes);
    const res = mockRes();
    await yt(req('/api/yt?playlist=PLnotinthelist99', { 'x-admin-key': 'secret' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
  });
  await test('yt wrong admin key still refused', async () => {
    mockFetch(ytRoutes);
    const res = mockRes();
    await yt(req('/api/yt?playlist=PLnotinthelist99', { 'x-admin-key': 'nope' }), res);
    assert.equal(res.statusCode, 403);
  });
  await test('yt rejects malformed id', async () => {
    const res = mockRes();
    await yt(req('/api/yt?playlist=../../etc'), res);
    assert.equal(res.statusCode, 400);
  });

  // ---------- Internet Archive ----------
  await test('archive search builds a safe query and filters blocklist', async () => {
    mockFetch([['advancedsearch.php', { response: { numFound: 2, docs: [{ identifier: 'nosferatu', title: 'Nosferatu', year: 1922 }, { identifier: 'blockedfilm', title: 'B' }] } }]]);
    const res = mockRes();
    await archive(req('/api/archive?collection=feature_films&q=' + encodeURIComponent('nos") OR (x')), res);
    assert.equal(res.statusCode, 200);
    const q = new URL(calls[0].url).searchParams.get('q');
    assert.equal(q, 'collection:(feature_films) AND mediatype:(movies) AND title:(nos OR x)');
    assert.deepEqual(res.body.items.map(i => i.id), ['nosferatu']);
    assert.equal(res.body.items[0].year, '1922');
  });
  await test('archive rejects unknown collections', async () => {
    const res = mockRes();
    await archive(req('/api/archive?collection=movies'), res);
    assert.equal(res.statusCode, 400);
  });
  await test('archive item picks h.264 mp4 and encodes the file name', async () => {
    mockFetch([['archive.org/metadata/nosferatu', {
      metadata: { title: 'Nosferatu', year: '1922', collection: ['feature_films', 'moviesandfilms'], description: '<p>Classic</p>' },
      files: [
        { name: 'Nosferatu 512kb.mp4', format: '512Kb MPEG4', size: '100' },
        { name: 'Nosferatu (1922).mp4', format: 'h.264', size: '900' },
        { name: 'Nosferatu.ogv', format: 'Ogg Video', size: '50' }
      ]
    }]]);
    const res = mockRes();
    await archive(req('/api/archive?id=nosferatu'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.video.url, 'https://archive.org/download/nosferatu/Nosferatu%20(1922).mp4');
  });
  await test('archive item outside public-domain collections is refused', async () => {
    mockFetch([['archive.org/metadata/random', { metadata: { title: 'R', collection: 'opensource_movies' }, files: [] }]]);
    const res = mockRes();
    await archive(req('/api/archive?id=random'), res);
    assert.equal(res.statusCode, 403);
  });
  await test('archive blocklisted item is hidden', async () => {
    const res = mockRes();
    await archive(req('/api/archive?id=blockedfilm'), res);
    assert.equal(res.statusCode, 404);
  });
} finally {
  writeFileSync('catalog.json', original);
}
console.log('\n' + passed + ' passed');
