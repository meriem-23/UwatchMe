/* UwatchMe — catalog builder (admin.html). Writes nothing on the server: it produces catalog.json. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const CATS = { arabic: 'Séries arabes', turkish: 'Séries turques', anime: 'Anime', kids: 'Enfants', films: 'Films', other: 'Autres séries' };
  const img = src => (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : '');

  let catalog = { series: [], archiveBlocklist: [] };
  let preview = null;

  const keyInput = $('#admin-key');
  keyInput.value = sessionStorage.getItem('uwatchme.adminKey') || '';
  keyInput.addEventListener('input', () => sessionStorage.setItem('uwatchme.adminKey', keyInput.value.trim()));

  function status(msg, isErr) {
    const el = $('#status');
    el.textContent = msg || '';
    el.classList.toggle('status-err', !!isErr);
  }
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function playlistId(input) {
    const v = input.trim();
    try { const u = new URL(v); const l = u.searchParams.get('list'); if (l) return l; } catch (e) {}
    return /^[A-Za-z0-9_-]{10,64}$/.test(v) ? v : '';
  }
  function makeId(title, plId) {
    const slug = String(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return (slug || 'serie') + '-' + plId.slice(-6);
  }
  const posterSrc = p => (!p ? '' : /^https?:/.test(p) ? p : 'https://image.tmdb.org/t/p/w185' + p);

  async function loadCatalog() {
    try {
      const r = await fetch('/catalog.json', { cache: 'no-cache' });
      const c = await r.json();
      catalog = { series: Array.isArray(c.series) ? c.series : [], archiveBlocklist: Array.isArray(c.archiveBlocklist) ? c.archiveBlocklist : [] };
    } catch (e) { status('catalog.json introuvable : on part d\'un catalogue vide.', true); }
    $('#blocklist').value = catalog.archiveBlocklist.join('\n');
    renderTable();
  }

  async function loadPlaylist() {
    const id = playlistId($('#pl-url').value);
    if (!id) { status('Collez un lien de playlist YouTube (il contient « list= »).', true); return; }
    if (catalog.series.some(s => s.playlistId === id)) { status('Cette playlist est déjà dans le catalogue.', true); return; }
    if (!keyInput.value.trim()) { status('Entrez d\'abord la clé admin (étape 1).', true); return; }
    status('Chargement de la playlist…');
    $('#pl-load').disabled = true;
    try {
      const r = await fetch('/api/yt?playlist=' + encodeURIComponent(id), { headers: { 'x-admin-key': keyInput.value.trim() } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { status(r.status === 403 ? 'Clé admin incorrecte.' : (body.error || ('Erreur ' + r.status)), true); return; }
      if (!body.episodes || !body.episodes.length) { status('Cette playlist ne contient aucune vidéo publique.', true); return; }
      const eps = body.episodes;
      const newestFirst = eps.length > 1 && new Date(eps[0].publishedAt) > new Date(eps[eps.length - 1].publishedAt);
      preview = { pl: body, tmdb: null };
      $('#f-title').value = body.title;
      $('#f-title-ar').value = '';
      $('#f-reverse').checked = newestFirst;
      $('#tmdb-q').value = body.title;
      $('#tmdb-results').innerHTML = '';
      renderPreview();
      $('#step2').hidden = false;
      status(newestFirst ? 'Playlist chargée. Elle semble commencer par le dernier épisode : l\'ordre sera inversé.' : 'Playlist chargée.');
    } catch (e) {
      status('Réseau indisponible. Réessayez.', true);
    } finally {
      $('#pl-load').disabled = false;
    }
  }

  function renderPreview() {
    const pl = preview.pl;
    const eps = pl.episodes.slice();
    if ($('#f-reverse').checked) eps.reverse();
    $('#pl-preview').innerHTML = '<span class="wide-img">' + img(pl.thumb) + '</span><div>' +
      '<p class="label">' + esc(pl.title) + '</p>' +
      '<p class="muted small">Chaîne : ' + esc(pl.channel) + ' · ' + eps.length + ' vidéos publiques</p>' +
      '<p class="small">Premier épisode : ' + esc(eps[0].title) + '</p>' +
      '<p class="small">Dernier épisode : ' + esc(eps[eps.length - 1].title) + '</p></div>';
  }

  async function searchTmdb() {
    const q = $('#tmdb-q').value.trim();
    if (!q) return;
    const box = $('#tmdb-results');
    box.innerHTML = '<p class="muted small">Recherche…</p>';
    try {
      const r = await fetch('/api/tmdb?' + new URLSearchParams({ path: 'search/multi', query: q, language: 'fr-FR' }));
      const b = await r.json();
      if (!r.ok) { box.innerHTML = '<p class="status-err small">' + esc(b.error || 'Erreur TMDB') + '</p>'; return; }
      const list = (b.results || []).filter(x => x.media_type === 'tv' || x.media_type === 'movie').slice(0, 12);
      if (!list.length) { box.innerHTML = '<p class="muted small">Aucun résultat. Essayez le titre original.</p>'; return; }
      box.innerHTML = list.map((x, i) => '<button class="tmdb-pick" type="button" data-i="' + i + '" aria-pressed="false">' +
        '<span class="poster-img">' + img(posterSrc(x.poster_path)) + '</span>' +
        '<span class="cap">' + esc(x.name || x.title) + ' (' + esc((x.first_air_date || x.release_date || '').slice(0, 4)) + ')</span></button>').join('');
      box.onclick = e => {
        const b2 = e.target.closest('.tmdb-pick');
        if (!b2) return;
        const x = list[Number(b2.dataset.i)];
        const already = b2.getAttribute('aria-pressed') === 'true';
        box.querySelectorAll('.tmdb-pick').forEach(p => p.setAttribute('aria-pressed', 'false'));
        if (already) { preview.tmdb = null; return; }
        b2.setAttribute('aria-pressed', 'true');
        preview.tmdb = { id: x.id, type: x.media_type, poster: x.poster_path || '' };
      };
    } catch (e) { box.innerHTML = '<p class="status-err small">Réseau indisponible.</p>'; }
  }

  function addEntry() {
    if (!preview) return;
    const pl = preview.pl;
    const title = $('#f-title').value.trim() || pl.title;
    const entry = {
      id: makeId(title, pl.id),
      title,
      category: $('#f-cat').value,
      playlistId: pl.id,
      channel: pl.channel,
      thumb: pl.thumb,
      count: pl.episodes.length
    };
    const ar = $('#f-title-ar').value.trim();
    if (ar) entry.titleAr = ar;
    if ($('#f-reverse').checked) entry.reverse = true;
    if (preview.tmdb) {
      entry.tmdbId = preview.tmdb.id;
      entry.tmdbType = preview.tmdb.type;
      if (preview.tmdb.poster) entry.poster = preview.tmdb.poster;
    }
    catalog.series.push(entry);
    renderTable();
    cancel();
    status('« ' + title + ' » ajoutée. Téléchargez catalog.json quand vous avez fini.');
  }

  function cancel() {
    preview = null;
    $('#step2').hidden = true;
    $('#pl-url').value = '';
    $('#tmdb-results').innerHTML = '';
  }

  function renderTable() {
    $('#cat-count').textContent = '(' + catalog.series.length + ')';
    if (!catalog.series.length) { $('#table').innerHTML = '<p class="muted small">Aucune série pour l\'instant.</p>'; return; }
    $('#table').innerHTML = '<ol class="admin-list">' + catalog.series.map((s, i) =>
      '<li><span class="wide-img">' + img(s.thumb) + '</span>' +
      '<div><div class="t">' + esc(s.title) + (s.titleAr ? ' <span lang="ar" dir="rtl">(' + esc(s.titleAr) + ')</span>' : '') + '</div>' +
      '<div class="s">' + esc(CATS[s.category] || s.category) + ' · ' + esc(s.count || '?') + ' épisodes' + (s.tmdbId ? ' · TMDB ' + esc(s.tmdbType) + ' ' + esc(s.tmdbId) : '') + (s.reverse ? ' · ordre inversé' : '') + '</div></div>' +
      '<div class="acts">' +
        '<button type="button" data-act="up" data-i="' + i + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" data-act="down" data-i="' + i + '" aria-label="Descendre"' + (i === catalog.series.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button type="button" data-act="del" data-i="' + i + '" aria-label="Retirer">✕</button>' +
      '</div></li>').join('') + '</ol>';
  }

  $('#table').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const i = Number(b.dataset.i);
    const s = catalog.series;
    if (b.dataset.act === 'up' && i > 0) { const x = s[i - 1]; s[i - 1] = s[i]; s[i] = x; }
    if (b.dataset.act === 'down' && i < s.length - 1) { const x = s[i + 1]; s[i + 1] = s[i]; s[i] = x; }
    if (b.dataset.act === 'del' && window.confirm('Retirer « ' + s[i].title + ' » du catalogue ?')) s.splice(i, 1);
    renderTable();
  });

  function json() {
    catalog.archiveBlocklist = $('#blocklist').value.split(/\s+/).map(x => x.trim()).filter(Boolean);
    return JSON.stringify(catalog, null, 2) + '\n';
  }

  $('#pl-load').addEventListener('click', loadPlaylist);
  $('#pl-url').addEventListener('keydown', e => { if (e.key === 'Enter') loadPlaylist(); });
  $('#f-reverse').addEventListener('change', () => { if (preview) renderPreview(); });
  $('#tmdb-go').addEventListener('click', searchTmdb);
  $('#tmdb-q').addEventListener('keydown', e => { if (e.key === 'Enter') searchTmdb(); });
  $('#add').addEventListener('click', addEntry);
  $('#cancel').addEventListener('click', () => { cancel(); status(''); });
  $('#download').addEventListener('click', () => {
    const blob = new Blob([json()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalog.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(json()); toast('JSON copié'); }
    catch (e) { window.prompt('Copiez le JSON :', json()); }
  });

  loadCatalog();
})();
