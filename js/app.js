/* UwatchMe — boot, navigation chrome, routes */
(function () {
  'use strict';
  const F = window.__uwatchme;
  const esc = F.esc;
  const t = F.t;

  const TABS = [
    ['home', '/', 'nav_home'],
    ['series', '/series', 'nav_series'],
    ['film', '/films', 'nav_films'],
    ['anime', '/anime', 'nav_anime'],
    ['list', '/list', 'nav_list']
  ];

  function currentPath() { return (location.hash.replace(/^#/, '') || '/').split('?')[0]; }
  function sectionOf(p) {
    if (p === '/' || p === '') return '/';
    if (p.indexOf('/series') === 0) return '/series';
    if (p.indexOf('/films') === 0 || p === '/free/feature_films') return '/films';
    if (p.indexOf('/anime') === 0 || p === '/free/animationandcartoons') return '/anime';
    if (p.indexOf('/list') === 0) return '/list';
    return '';
  }
  function markActive() {
    const p = currentPath();
    const sec = sectionOf(p);
    document.querySelectorAll('#nav a').forEach(a => {
      if (a.dataset.path === sec) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    [['btn-search', '/search'], ['btn-settings', '/settings']].forEach(x => {
      const el = document.getElementById(x[0]);
      if (p.indexOf(x[1]) === 0) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
  }

  F.chrome = () => {
    const root = document.documentElement;
    root.lang = F.settings.lang;
    root.dir = F.dir();
    document.title = F.appName();
    document.querySelector('.brand-name').textContent = F.appName();
    document.querySelector('.brand').setAttribute('aria-label', F.appName());
    const nav = document.getElementById('nav');
    nav.setAttribute('aria-label', t('nav_label'));
    nav.innerHTML = TABS.map(x => '<a href="#' + x[1] + '" data-path="' + x[1] + '">' + F.icon(x[0], 22) + '<span>' + esc(t(x[2])) + '</span></a>').join('');
    const s = document.getElementById('btn-search');
    s.innerHTML = F.icon('search');
    s.setAttribute('aria-label', t('search'));
    const g = document.getElementById('btn-settings');
    g.innerHTML = F.icon('settings');
    g.setAttribute('aria-label', t('settings'));
    markActive();
  };

  F.route('/', F.views.home);
  F.route('/series', F.views.series);
  F.route('/films', F.views.films);
  F.route('/anime', F.views.anime);
  F.route('/free/:collection', F.views.freeGrid);
  F.route('/search', F.views.search);
  F.route('/list', F.views.list);
  F.route('/settings', F.views.settings);
  F.route('/title/:type/:id', F.views.title);
  F.route('/show/:id', F.views.show);
  F.route('/film/:id', F.views.film);

  window.addEventListener('hashchange', () => { F.navCount++; markActive(); F.resolve(); });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-back]')) { e.preventDefault(); F.back(); return; }
    if (e.target.closest('[data-retry]')) { e.preventDefault(); F.resolve(); }
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); F.installPrompt = e; });

  async function boot() {
    F.chrome();
    await F.loadCatalog();
    F.navCount = 1;
    F.resolve();
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.warn('[uwatchme] service worker', err));
    }
  }
  boot();
})();
