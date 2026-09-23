/* UwatchMe — core: config, storage, i18n helpers, API client, catalog, progress, router */
(function () {
  'use strict';
  const F = window.__uwatchme = window.__uwatchme || {};

  F.config = {
    appName: 'UwatchMe',
    appNameAr: 'UwatchMe',
    defaultRegion: 'DZ',
    regions: ['DZ', 'MA', 'TN', 'EG', 'SA', 'AE', 'QA', 'FR', 'BE', 'CH', 'DE', 'GB', 'CA', 'US', 'TR']
  };

  /* ---------- storage ---------- */
  const PREFIX = 'uwatchme.';
  F.store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(PREFIX + k); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch (e) {} },
    keys(prefix) {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length)); } } catch (e) {}
      return out;
    }
  };

  /* ---------- settings & i18n ---------- */
  function detectLang() {
    const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return ['ar', 'fr', 'en'].indexOf(l) >= 0 ? l : 'en';
  }
  F.settings = Object.assign({ lang: detectLang(), region: F.config.defaultRegion, autoplay: true }, F.store.get('settings', {}));
  F.saveSettings = patch => { Object.assign(F.settings, patch); F.store.set('settings', F.settings); };

  F.t = (key, vars) => {
    const d = F.dict[F.settings.lang] || F.dict.en;
    let s = d[key] != null ? d[key] : (F.dict.en[key] != null ? F.dict.en[key] : key);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  };
  F.tn = (key, n) => {
    const d = F.dict[F.settings.lang] || F.dict.en;
    return F.t(n === 1 && d[key + '_one'] ? key + '_one' : key, { n });
  };
  F.dir = () => (F.settings.lang === 'ar' ? 'rtl' : 'ltr');
  F.tmdbLang = () => ({ ar: 'ar', fr: 'fr-FR', en: 'en-US' })[F.settings.lang] || 'en-US';
  F.appName = () => (F.settings.lang === 'ar' ? F.config.appNameAr : F.config.appName);
  F.regionName = code => {
    try { return new Intl.DisplayNames([F.settings.lang], { type: 'region' }).of(code) || code; }
    catch (e) { return code; }
  };

  /* ---------- small utils ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  F.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  F.toText = html => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(String(html).replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return (doc.body.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  F.norm = s => String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .toLowerCase().trim();
  F.debounce = (fn, ms) => { let tm; return function () { const a = arguments; clearTimeout(tm); tm = setTimeout(() => fn.apply(null, a), ms); }; };
  F.tmdbImg = (p, size) => (p ? 'https://image.tmdb.org/t/p/' + (size || 'w342') + p : '');
  F.posterUrl = p => (!p ? '' : (/^https?:\/\//.test(p) ? p : F.tmdbImg(p, 'w342')));
  F.platform = (() => {
    const ua = navigator.userAgent || '';
    return {
      android: /Android/i.test(ua),
      ios: /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      standalone: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    };
  })();
  F.reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- API client (all keys stay on the server in /api) ---------- */
  const memo = new Map();
  async function getJSON(url, opts) {
    const r = await fetch(url, opts);
    let body = null;
    try { body = await r.json(); } catch (e) {}
    if (!r.ok) {
      const err = new Error((body && body.error) || ('HTTP ' + r.status));
      err.status = r.status;
      throw err;
    }
    return body;
  }
  function cached(url) {
    if (!memo.has(url)) {
      const p = getJSON(url).catch(e => { memo.delete(url); console.warn('[uwatchme]', url, e.message); throw e; });
      memo.set(url, p);
    }
    return memo.get(url);
  }
  F.api = {
    tmdb(path, params) {
      const q = new URLSearchParams(Object.assign({ language: F.tmdbLang() }, params || {}));
      q.set('path', path);
      return cached('/api/tmdb?' + q.toString());
    },
    playlist(id) { return cached('/api/yt?playlist=' + encodeURIComponent(id)); },
    archiveSearch(o) {
      const q = new URLSearchParams({ collection: o.collection || 'feature_films', page: String(o.page || 1) });
      if (o.q) q.set('q', o.q);
      return cached('/api/archive?' + q.toString());
    },
    archiveItem(id) { return cached('/api/archive?id=' + encodeURIComponent(id)); }
  };
  F.clearMemo = () => memo.clear();

  /* ---------- catalog of official free series (catalog.json) ---------- */
  F.catalogData = { series: [], archiveBlocklist: [] };
  F.loadCatalog = async () => {
    try {
      const c = await getJSON('/catalog.json', { cache: 'no-cache' });
      F.catalogData = {
        series: Array.isArray(c.series) ? c.series.filter(s => s && s.id && s.playlistId) : [],
        archiveBlocklist: Array.isArray(c.archiveBlocklist) ? c.archiveBlocklist : []
      };
    } catch (e) { console.warn('[uwatchme] catalog.json not loaded', e.message); }
    return F.catalogData;
  };
  F.catalogMatch = (type, id) => F.catalogData.series.find(s => s.tmdbId && String(s.tmdbId) === String(id) && (s.tmdbType || 'tv') === type);
  F.showTitle = s => (F.settings.lang === 'ar' && s.titleAr ? s.titleAr : s.title);
  F.blocked = id => F.catalogData.archiveBlocklist.indexOf(id) >= 0;

  /* ---------- mapping API data to cards ---------- */
  F.map = {
    tmdb(r, forcedType) {
      const type = forcedType || r.media_type;
      if (type !== 'movie' && type !== 'tv') return null;
      const date = r.release_date || r.first_air_date || '';
      return {
        kind: 'tmdb', key: 'tmdb:' + type + ':' + r.id, type, id: r.id,
        title: r.title || r.name || r.original_title || r.original_name || '',
        img: F.tmdbImg(r.poster_path, 'w342'), year: date.slice(0, 4),
        href: '#/title/' + type + '/' + r.id,
        free: !!F.catalogMatch(type, r.id)
      };
    },
    show(s) {
      return {
        kind: 'show', key: 'show:' + s.id, id: s.id, title: F.showTitle(s),
        img: s.thumb || '', poster: F.posterUrl(s.poster),
        href: '#/show/' + encodeURIComponent(s.id), free: true,
        sub: s.count ? F.tn('episodes_count', s.count) : ''
      };
    },
    film(a) {
      return {
        kind: 'film', key: 'film:' + a.id, id: a.id, title: a.title || a.id,
        img: 'https://archive.org/services/img/' + encodeURIComponent(a.id),
        sub: a.year ? String(a.year) : '',
        href: '#/film/' + encodeURIComponent(a.id), free: true
      };
    },
    progress(p) {
      const isShow = p.kind === 'show';
      const left = p.dur ? Math.max(1, Math.round((p.dur - p.t) / 60)) : 0;
      return {
        key: p.key, title: p.title, img: p.img,
        href: isShow ? '#/show/' + encodeURIComponent(p.id) + '?e=' + encodeURIComponent(p.videoId) : '#/film/' + encodeURIComponent(p.id),
        sub: isShow ? F.t('episode_n', { n: p.ep }) : (left ? F.t('min_left', { n: left }) : ''),
        pct: p.dur ? (p.t / p.dur) * 100 : 0
      };
    }
  };

  /* ---------- watch progress, seen episodes, my list ---------- */
  F.progress = {
    all() { return F.store.get('progress', {}); },
    get(key) { return this.all()[key] || null; },
    save(key, data) {
      const all = this.all();
      all[key] = Object.assign({}, all[key], data, { at: Date.now() });
      const keys = Object.keys(all);
      if (keys.length > 60) keys.sort((a, b) => all[a].at - all[b].at).slice(0, keys.length - 60).forEach(k => { delete all[k]; });
      F.store.set('progress', all);
    },
    remove(key) { const all = this.all(); delete all[key]; F.store.set('progress', all); },
    recent(n) {
      const all = this.all();
      return Object.keys(all).map(k => Object.assign({ key: k }, all[k])).sort((a, b) => b.at - a.at).slice(0, n || 20);
    },
    clear() { F.store.del('progress'); F.store.keys('seen.').forEach(k => F.store.del(k)); }
  };
  F.seen = {
    get(showId) { return new Set(F.store.get('seen.' + showId, [])); },
    add(showId, videoId) {
      const s = F.store.get('seen.' + showId, []);
      if (s.indexOf(videoId) < 0) { s.push(videoId); if (s.length > 2000) s.shift(); F.store.set('seen.' + showId, s); }
    }
  };
  F.mylist = {
    all() { return F.store.get('list', []); },
    has(key) { return this.all().some(i => i.key === key); },
    toggle(item) {
      let l = this.all();
      if (l.some(i => i.key === item.key)) { l = l.filter(i => i.key !== item.key); F.store.set('list', l); return false; }
      l.unshift({ key: item.key, kind: item.kind, title: item.title, img: item.img || '', href: item.href });
      F.store.set('list', l);
      return true;
    }
  };

  /* ---------- YouTube IFrame API loader ---------- */
  F.yt = {
    _p: null,
    ready() {
      if (this._p) return this._p;
      this._p = new Promise((resolve, reject) => {
        if (window.YT && window.YT.Player) { resolve(window.YT); return; }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.onerror = () => { this._p = null; reject(new Error('YouTube player failed to load')); };
        document.head.appendChild(s);
      });
      return this._p;
    }
  };

  /* ---------- hash router ---------- */
  const routes = [];
  let leaveFns = [];
  let token = 0;
  F.route = (pattern, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ re, keys, fn });
  };
  F.onLeave = fn => { leaveFns.push(fn); };
  F.render = html => {
    leaveFns.forEach(fn => { try { fn(); } catch (e) {} });
    leaveFns = [];
    token++;
    const v = document.getElementById('view');
    v.innerHTML = html;
    window.scrollTo(0, 0);
    try { v.focus({ preventScroll: true }); } catch (e) {}
    return token;
  };
  F.fill = html => { document.getElementById('view').innerHTML = html; };
  F.isCurrent = tok => tok === token;
  F.resolve = () => {
    const raw = location.hash.replace(/^#/, '') || '/';
    const qi = raw.indexOf('?');
    const path = qi >= 0 ? raw.slice(0, qi) : raw;
    const query = {};
    new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '').forEach((v, k) => { query[k] = v; });
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch (e) { params[k] = m[i + 1]; } });
        r.fn(params, query);
        return;
      }
    }
    F.navigate('#/');
  };
  F.navigate = h => { if (location.hash === h) F.resolve(); else location.hash = h; };
  F.navCount = 0;
  F.back = () => { if (F.navCount > 1) history.back(); else F.navigate('#/'); };
})();
