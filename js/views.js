/* UwatchMe — main screens */
(function () {
  'use strict';
  const F = window.__uwatchme;
  const esc = F.esc;
  const t = F.t;
  const ui = F.ui;
  F.views = F.views || {};

  /* ---------- row loaders ---------- */
  const tmdbRow = (path, params, type) => () => F.api.tmdb(path, params)
    .then(r => (r.results || []).map(x => F.map.tmdb(x, type)).filter(x => x && x.img));
  const catalogRow = cats => () => Promise.resolve(
    F.catalogData.series.filter(s => !cats || cats.indexOf(s.category) >= 0).map(F.map.show));
  const archiveRow = col => () => F.api.archiveSearch({ collection: col })
    .then(r => (r.items || []).filter(a => !F.blocked(a.id)).map(F.map.film));

  const Q = {
    arabicTv: ['discover/tv', { with_original_language: 'ar', sort_by: 'popularity.desc' }, 'tv'],
    turkishTv: ['discover/tv', { with_original_language: 'tr', sort_by: 'popularity.desc' }, 'tv'],
    animeTv: ['discover/tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' }, 'tv'],
    animeFilms: ['discover/movie', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' }, 'movie'],
    popularTv: ['discover/tv', { sort_by: 'popularity.desc', without_genres: '10763,10764,10767' }, 'tv'],
    popularFilms: ['discover/movie', { sort_by: 'popularity.desc' }, 'movie'],
    arabicFilms: ['discover/movie', { with_original_language: 'ar', sort_by: 'popularity.desc' }, 'movie']
  };
  const q = k => tmdbRow(Q[k][0], Q[k][1], Q[k][2]);

  /* ---------- home ---------- */
  function heroHTML(recent) {
    let h = null;
    if (recent) {
      const it = F.map.progress(recent);
      h = {
        kicker: t('hero_resume'), title: recent.title,
        sub: recent.kind === 'show' ? (recent.epTitle || '') : '',
        img: recent.img, href: it.href,
        cta: recent.kind === 'show' ? t('resume_ep', { n: recent.ep }) : t('resume')
      };
    } else if (F.catalogData.series.length) {
      const s = F.catalogData.series[0];
      h = {
        kicker: t('hero_free'), title: F.showTitle(s),
        sub: s.channel ? t('from_channel', { c: s.channel }) : '',
        img: s.thumb, href: '#/show/' + encodeURIComponent(s.id), cta: t('watch_ep', { n: 1 })
      };
    }
    if (!h) return '';
    return '<section class="hero">' +
      '<a class="hero-arch" href="' + esc(h.href) + '" tabindex="-1" aria-hidden="true"><span class="fallback"></span>' + ui.imgTag(h.img) + '</a>' +
      '<div class="hero-body"><p class="hero-kicker">' + esc(h.kicker) + '</p>' +
      '<h1 class="hero-title">' + esc(h.title) + '</h1>' +
      (h.sub ? '<p class="hero-sub" dir="auto">' + esc(h.sub) + '</p>' : '') +
      '<a class="btn btn-primary" href="' + esc(h.href) + '">' + F.icon('play', 20) + '<span>' + esc(h.cta) + '</span></a></div></section>';
  }

  F.views.home = () => {
    const recent = F.progress.recent(12);
    const tok = F.render('<div class="page home">' + heroHTML(recent[0]) +
      (recent.length > 1 ? ui.row('r-cont', t('row_continue'), { card: 'wide' }) : '') +
      ui.row('r-free', t('row_free_series'), { card: 'wide' }) +
      ui.row('r-films', t('row_free_films'), { more: '#/free/feature_films' }) +
      ui.row('r-trend', t('row_trending')) +
      ui.row('r-ar', t('row_arabic')) +
      ui.row('r-tr', t('row_turkish')) +
      ui.row('r-anime', t('row_anime')) +
      '</div>');
    if (recent.length > 1) ui.fillRow(tok, 'r-cont', () => Promise.resolve(recent.slice(1).map(F.map.progress)), { card: 'wide' });
    ui.fillRow(tok, 'r-free', catalogRow(null), { card: 'wide', empty: t('free_series_empty') });
    ui.fillRow(tok, 'r-films', archiveRow('feature_films'));
    ui.fillRow(tok, 'r-trend', tmdbRow('trending/all/week', {}));
    ui.fillRow(tok, 'r-ar', q('arabicTv'));
    ui.fillRow(tok, 'r-tr', q('turkishTv'));
    ui.fillRow(tok, 'r-anime', q('animeTv'));
  };

  /* ---------- browse tabs ---------- */
  function browse(titleKey, rows) {
    const tok = F.render('<div class="page"><h1 class="page-title">' + esc(t(titleKey)) + '</h1>' +
      rows.map(r => ui.row(r.id, t(r.title), r)).join('') + '</div>');
    rows.forEach(r => ui.fillRow(tok, r.id, r.load, r));
  }

  F.views.series = () => browse('nav_series', [
    { id: 'b-far', title: 'row_free_arabic', card: 'wide', load: catalogRow(['arabic']) },
    { id: 'b-ftr', title: 'row_free_turkish', card: 'wide', load: catalogRow(['turkish']) },
    { id: 'b-fkid', title: 'row_free_kids', card: 'wide', load: catalogRow(['kids']) },
    { id: 'b-foth', title: 'row_free_other', card: 'wide', load: catalogRow(['other']) },
    { id: 'b-ar', title: 'row_arabic', load: q('arabicTv') },
    { id: 'b-tr', title: 'row_turkish', load: q('turkishTv') },
    { id: 'b-pop', title: 'row_popular_series', load: q('popularTv') }
  ]);

  F.views.films = () => browse('nav_films', [
    { id: 'b-fpl', title: 'row_free_film_playlists', card: 'wide', load: catalogRow(['films']) },
    { id: 'b-ia', title: 'row_free_films', more: '#/free/feature_films', load: archiveRow('feature_films') },
    { id: 'b-popf', title: 'row_popular_films', load: q('popularFilms') },
    { id: 'b-arf', title: 'row_arabic_films', load: q('arabicFilms') }
  ]);

  F.views.anime = () => browse('nav_anime', [
    { id: 'b-fan', title: 'row_free_anime', card: 'wide', load: catalogRow(['anime']) },
    { id: 'b-cart', title: 'row_cartoons', more: '#/free/animationandcartoons', load: archiveRow('animationandcartoons') },
    { id: 'b-an', title: 'row_anime', load: q('animeTv') },
    { id: 'b-anf', title: 'row_anime_films', load: q('animeFilms') }
  ]);

  /* ---------- full grid of public-domain films / cartoons ---------- */
  const GRID_TITLES = { feature_films: 'row_free_films', animationandcartoons: 'row_cartoons' };
  F.views.freeGrid = ({ collection }) => {
    if (!GRID_TITLES[collection]) { F.navigate('#/films'); return; }
    const tok = F.render('<div class="page"><div class="watch-bar">' + ui.backBtn() + '</div>' +
      '<h1 class="page-title">' + esc(t(GRID_TITLES[collection])) + '</h1>' +
      '<p class="page-note">' + esc(t('public_domain_note')) + '</p>' +
      '<div class="grid" id="grid"></div><div class="more-wrap"><button class="btn" id="more" type="button">' + esc(t('load_more')) + '</button></div></div>');
    const grid = document.getElementById('grid');
    const btn = document.getElementById('more');
    let page = 0, busy = false, done = false;
    async function next() {
      if (busy || done) return;
      busy = true; btn.disabled = true; page++;
      try {
        const r = await F.api.archiveSearch({ collection, page });
        if (!F.isCurrent(tok)) return;
        grid.insertAdjacentHTML('beforeend', (r.items || []).filter(a => !F.blocked(a.id)).map(F.map.film).map(ui.poster).join(''));
        if (!r.items || !r.items.length || page * (r.rows || 30) >= r.total) { done = true; btn.hidden = true; }
      } catch (e) {
        if (!F.isCurrent(tok)) return;
        page--; ui.toast(t('load_error'));
      }
      busy = false; btn.disabled = false;
    }
    btn.addEventListener('click', next);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) next(); }, { rootMargin: '600px' });
      io.observe(btn);
      F.onLeave(() => io.disconnect());
    }
    next();
  };

  /* ---------- search ---------- */
  F.views.search = (params, query) => {
    const q0 = query.q || '';
    const tok = F.render('<div class="page"><form class="search-bar" role="search" id="sform">' +
      '<label class="search-field"><span class="sr-only">' + esc(t('search')) + '</span>' + F.icon('search') +
      '<input id="q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="' + esc(t('search_ph')) + '" value="' + esc(q0) + '"></label></form>' +
      '<div id="results" class="results" aria-live="polite"></div></div>');
    const input = document.getElementById('q');
    const out = document.getElementById('results');
    let seq = 0;

    async function run(raw) {
      const s = raw.trim();
      history.replaceState(null, '', '#/search' + (s ? '?q=' + encodeURIComponent(s) : ''));
      const my = ++seq;
      if (s.length < 2) { out.innerHTML = ui.empty(t('search_hint')); return; }
      out.innerHTML = '<div class="grid results-loading">' + ui.skeletons('poster', 6) + '</div>';
      const ns = F.norm(s);
      const local = F.catalogData.series.filter(x => F.norm(x.title).indexOf(ns) >= 0 || F.norm(x.titleAr).indexOf(ns) >= 0).map(F.map.show);
      const res = await Promise.all([
        F.api.archiveSearch({ q: s, collection: 'feature_films' }).then(r => r.items || []).catch(() => []),
        F.api.archiveSearch({ q: s, collection: 'animationandcartoons' }).then(r => r.items || []).catch(() => []),
        F.api.tmdb('search/multi', { query: s }).then(r => r.results || []).catch(() => [])
      ]);
      if (my !== seq || !F.isCurrent(tok)) return;
      const films = res[0].concat(res[1]).filter(a => !F.blocked(a.id)).map(F.map.film);
      const tm = res[2].map(x => F.map.tmdb(x)).filter(Boolean);
      if (!local.length && !films.length && !tm.length) { out.innerHTML = ui.empty(t('search_empty', { q: s })); return; }
      let h = '';
      if (local.length || films.length) {
        h += '<section class="row"><div class="row-head"><h2>' + esc(t('search_free')) + '</h2></div>';
        if (local.length) h += '<div class="grid grid-wide">' + local.map(ui.wide).join('') + '</div>';
        if (films.length) h += '<div class="grid' + (local.length ? ' grid-gap' : '') + '">' + films.map(ui.poster).join('') + '</div>';
        h += '</section>';
      }
      if (tm.length) h += '<section class="row"><div class="row-head"><h2>' + esc(t('search_tmdb')) + '</h2></div><div class="grid">' + tm.map(ui.poster).join('') + '</div></section>';
      out.innerHTML = h;
    }

    input.addEventListener('input', F.debounce(() => run(input.value), 450));
    document.getElementById('sform').addEventListener('submit', e => { e.preventDefault(); input.blur(); run(input.value); });
    if (q0) run(q0); else { out.innerHTML = ui.empty(t('search_hint')); input.focus(); }
  };

  /* ---------- my list ---------- */
  F.views.list = () => {
    const recent = F.progress.recent(30);
    const saved = F.mylist.all().map(i => Object.assign({}, i, { free: i.kind === 'show' || i.kind === 'film' }));
    F.render('<div class="page"><h1 class="page-title">' + esc(t('nav_list')) + '</h1>' +
      '<section class="row"><div class="row-head"><h2>' + esc(t('row_continue')) + '</h2></div>' +
      (recent.length ? '<div class="grid grid-wide" id="cont">' + recent.map(p => ui.wideRemovable(F.map.progress(p))).join('') + '</div>'
        : '<p class="row-note">' + esc(t('continue_empty')) + '</p>') + '</section>' +
      '<section class="row"><div class="row-head"><h2>' + esc(t('saved')) + '</h2></div>' +
      (saved.length ? '<div class="grid">' + saved.map(ui.poster).join('') + '</div>'
        : '<p class="row-note">' + esc(t('list_empty')) + '</p>') + '</section></div>');
    const cont = document.getElementById('cont');
    if (cont) cont.addEventListener('click', e => {
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      F.progress.remove(b.dataset.remove);
      b.closest('.wide-wrap').remove();
      if (!cont.children.length) cont.outerHTML = '<p class="row-note">' + esc(t('continue_empty')) + '</p>';
    });
  };

  /* ---------- settings ---------- */
  F.views.settings = () => {
    const s = F.settings;
    const langs = [['ar', 'العربية'], ['fr', 'Français'], ['en', 'English']];
    const app = F.appName();
    let install = '';
    if (!F.platform.standalone) {
      if (F.installPrompt) install = '<button class="btn btn-primary" id="install" type="button">' + esc(t('install')) + '</button>';
      else if (F.platform.ios) install = '<p class="muted">' + esc(t('ios_install')) + '</p>';
    }
    F.render('<div class="page"><h1 class="page-title">' + esc(t('settings')) + '</h1><div class="settings-body">' +
      '<div class="field"><span class="label" id="lang-l">' + esc(t('lang')) + '</span><div class="chips" role="group" aria-labelledby="lang-l">' +
      langs.map(l => '<button type="button" class="chip" data-lang="' + l[0] + '" lang="' + l[0] + '" aria-pressed="' + (s.lang === l[0]) + '">' + l[1] + '</button>').join('') + '</div></div>' +
      '<div class="field"><label class="label" for="region">' + esc(t('region')) + '</label><select id="region">' +
      F.config.regions.map(r => '<option value="' + r + '"' + (r === s.region ? ' selected' : '') + '>' + esc(F.regionName(r)) + '</option>').join('') + '</select></div>' +
      '<label class="field field-row"><span class="label">' + esc(t('autoplay')) + '</span><input type="checkbox" id="autoplay"' + (s.autoplay ? ' checked' : '') + '></label>' +
      '<div class="field"><div class="btns">' + install + '<button class="btn" id="clear" type="button">' + esc(t('clear_history')) + '</button></div></div>' +
      '<div class="field about"><h2>' + esc(t('about_title', { app })) + '</h2><p>' + esc(t('about_text', { app })) + '</p>' +
      '<p class="credit">' + esc(t('tmdb_credit')) + '</p><p class="credit">' + esc(t('justwatch')) + '</p></div>' +
      '</div></div>');

    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.lang === F.settings.lang) return;
      F.saveSettings({ lang: b.dataset.lang });
      F.clearMemo();
      F.chrome();
      F.views.settings();
    }));
    document.getElementById('region').addEventListener('change', e => F.saveSettings({ region: e.target.value }));
    document.getElementById('autoplay').addEventListener('change', e => F.saveSettings({ autoplay: e.target.checked }));
    document.getElementById('clear').addEventListener('click', () => { F.progress.clear(); ui.toast(t('history_cleared')); });
    const ib = document.getElementById('install');
    if (ib) ib.addEventListener('click', async () => {
      const p = F.installPrompt;
      if (!p) return;
      p.prompt();
      try { await p.userChoice; } catch (e) {}
      F.installPrompt = null;
      ib.remove();
    });
  };
})();
