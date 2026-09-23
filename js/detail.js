/* UwatchMe — detail and player screens */
(function () {
  'use strict';
  const F = window.__uwatchme;
  const esc = F.esc;
  const t = F.t;
  const ui = F.ui;
  F.views = F.views || {};

  const skeletonPage = () => '<div class="page watch-page"><div class="watch-bar">' + ui.backBtn() + '</div>' +
    '<div class="player-wrap"><div class="player"></div></div>' +
    '<div class="watch"><span class="sk sk-line"></span><span class="sk sk-line short"></span></div></div>';

  /* =====================================================================
     Film or series from TMDB: info, trailer, seasons, where to watch
     ===================================================================== */
  function pickTrailer(list) {
    const vids = (list || []).filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
    const score = v => (v.type === 'Trailer' ? 4 : 1) + (v.official ? 1 : 0) + (v.iso_639_1 === F.settings.lang ? 2 : 0);
    vids.sort((a, b) => score(b) - score(a));
    return vids[0] ? vids[0].key : null;
  }

  function providersHTML(prov) {
    let h = '<h2 class="section-title">' + esc(t('where_watch')) + '</h2>' +
      '<p class="muted small">' + esc(t('region_is', { r: F.regionName(F.settings.region) })) + ' <a class="link" href="#/settings">' + esc(t('change')) + '</a></p>';
    const groups = [['free', 'prov_free'], ['ads', 'prov_ads'], ['flatrate', 'prov_flatrate'], ['rent', 'prov_rent'], ['buy', 'prov_buy']];
    let any = false;
    if (prov) groups.forEach(g => {
      const list = prov[g[0]];
      if (!list || !list.length) return;
      any = true;
      h += '<div class="prov-group' + (g[0] === 'free' || g[0] === 'ads' ? ' prov-free' : '') + '"><h3>' + esc(t(g[1])) + '</h3><ul class="prov-list">' +
        list.map(p => '<li><a href="' + esc(prov.link) + '" target="_blank" rel="noopener">' +
          (p.logo_path ? '<img src="' + esc(F.tmdbImg(p.logo_path, 'w92')) + '" alt="" width="32" height="32" loading="lazy">' : '') +
          '<span>' + esc(p.provider_name) + '</span></a></li>').join('') + '</ul></div>';
    });
    if (!any) h += '<p class="muted">' + esc(t('no_providers')) + '</p>';
    else h += '<p class="credit">' + esc(t('justwatch')) + '</p>';
    return h;
  }

  async function loadSeason(tok, id, n, box) {
    box.innerHTML = '<span class="sk sk-line"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span>';
    try {
      const s = await F.api.tmdb('tv/' + id + '/season/' + n);
      if (!F.isCurrent(tok)) return;
      const eps = s.episodes || [];
      box.innerHTML = eps.length ? '<ol class="eps">' + eps.map(e =>
        '<li class="ep ep-info"><span class="ep-img"><span class="fallback"></span>' + ui.imgTag(F.tmdbImg(e.still_path, 'w300')) + '</span>' +
        '<span class="ep-body"><span class="ep-title">' + esc(t('episode_n', { n: e.episode_number })) + (e.name ? ': ' + esc(e.name) : '') + '</span>' +
        (e.overview ? '<span class="ep-overview">' + esc(e.overview) + '</span>' : '') + '</span></li>').join('') + '</ol>'
        : '<p class="muted">' + esc(t('playlist_empty')) + '</p>';
    } catch (e) {
      if (F.isCurrent(tok)) box.innerHTML = '<p class="muted">' + esc(t('load_error')) + '</p>';
    }
  }

  F.views.title = async ({ type, id }) => {
    if (!/^(movie|tv)$/.test(type) || !/^\d+$/.test(id)) { F.render(ui.errorPage(true)); return; }
    const tok = F.render('<div class="page"><div class="backdrop">' + ui.backBtn() + '</div><div class="detail"><span class="sk sk-line"></span><span class="sk sk-line short"></span></div></div>');
    let d;
    try {
      d = await F.api.tmdb(type + '/' + id, {
        append_to_response: 'videos,watch/providers,recommendations',
        include_video_language: F.settings.lang + ',en,null'
      });
    } catch (e) {
      if (F.isCurrent(tok)) F.fill(ui.errorPage(e.status === 404));
      return;
    }
    if (!F.isCurrent(tok)) return;

    if (!d.overview && F.settings.lang !== 'en') {
      try { const en = await F.api.tmdb(type + '/' + id, { language: 'en-US' }); d.overview = en.overview; } catch (e) {}
      if (!F.isCurrent(tok)) return;
    }

    const title = d.title || d.name || d.original_title || d.original_name || '';
    const year = (d.release_date || d.first_air_date || '').slice(0, 4);
    const meta = [
      year,
      type === 'movie' && d.runtime ? t('minutes', { n: d.runtime }) : '',
      type === 'tv' && d.number_of_seasons ? F.tn('seasons_count', d.number_of_seasons) : '',
      (d.genres || []).slice(0, 3).map(g => g.name).join(', ')
    ].filter(Boolean);
    const match = F.catalogMatch(type, id);
    const trailer = pickTrailer(d.videos && d.videos.results);
    const item = { key: 'tmdb:' + type + ':' + id, kind: 'tmdb', title, img: F.tmdbImg(d.poster_path, 'w342'), href: '#/title/' + type + '/' + id };
    const provAll = d['watch/providers'] && d['watch/providers'].results;
    const prov = provAll ? provAll[F.settings.region] : null;
    const recs = ((d.recommendations && d.recommendations.results) || []).map(x => F.map.tmdb(x, x.media_type || type)).filter(x => x && x.img);
    let seasons = (d.seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
    if (!seasons.length) seasons = (d.seasons || []).filter(s => s.episode_count > 0);

    F.fill('<div class="page title-page">' +
      '<div class="backdrop' + (d.backdrop_path ? '' : ' backdrop-empty') + '">' + (d.backdrop_path ? ui.imgTag(F.tmdbImg(d.backdrop_path, 'w1280')) : '') + ui.backBtn() + '</div>' +
      '<div class="detail">' +
        '<div class="detail-head"><span class="detail-poster"><span class="fallback">' + esc(title) + '</span>' + ui.imgTag(item.img) + '</span>' +
        '<div class="detail-headtext"><h1>' + esc(title) + '</h1>' + (meta.length ? '<ul class="meta">' + meta.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') + '</div></div>' +
        '<div class="btns detail-actions">' +
          (match ? '<a class="btn btn-primary" href="#/show/' + encodeURIComponent(match.id) + '">' + F.icon('play', 20) + '<span>' + esc(t('watch_free_eps')) + '</span></a>' : '') +
          (trailer ? '<button class="btn' + (match ? '' : ' btn-primary') + '" type="button" id="btn-trailer">' + F.icon('play', 18) + '<span>' + esc(t('trailer')) + '</span></button>' : '') +
          ui.listBtn(item) +
        '</div>' +
        (d.tagline ? '<p class="tagline">' + esc(d.tagline) + '</p>' : '') +
        (d.overview ? '<p class="overview">' + esc(d.overview) + '</p>' : '') +
        '<section class="providers">' + providersHTML(prov) + '</section>' +
        (type === 'tv' && seasons.length ? '<section><h2 class="section-title">' + esc(t('episodes')) + '</h2>' +
          '<div class="chips" id="seasons" role="group" aria-label="' + esc(t('seasons')) + '">' +
          seasons.map((s, i) => '<button type="button" class="chip" data-n="' + s.season_number + '" aria-pressed="' + (i === 0) + '">' +
            esc(s.season_number > 0 ? t('season_n', { n: s.season_number }) : (s.name || '0')) + '</button>').join('') +
          '</div><div id="season-box" class="season-box"></div></section>' : '') +
      '</div>' +
      (recs.length ? ui.row('r-recs', t('row_more_like')) : '') +
      '</div>');

    const root = document.getElementById('view');
    ui.bindListBtn(root, item);
    const tb = document.getElementById('btn-trailer');
    if (tb) tb.addEventListener('click', () => ui.openVideoModal(trailer));
    if (recs.length) ui.fillRow(tok, 'r-recs', () => Promise.resolve(recs));

    const chips = document.getElementById('seasons');
    if (chips) {
      const box = document.getElementById('season-box');
      chips.addEventListener('click', e => {
        const c = e.target.closest('.chip');
        if (!c) return;
        chips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
        loadSeason(tok, id, c.dataset.n, box);
      });
      loadSeason(tok, id, seasons[0].season_number, box);
    }
  };

  /* =====================================================================
     Free series from an official YouTube playlist (catalog.json)
     ===================================================================== */
  const epItem = (e, i, seen) => '<li><button class="ep" type="button" data-i="' + i + '">' +
    '<span class="ep-num">' + (i + 1) + '</span>' +
    '<span class="ep-img"><span class="fallback"></span>' + ui.imgTag(e.thumb) + '</span>' +
    '<span class="ep-body"><span class="ep-title" dir="auto">' + esc(e.title) + '</span>' +
    (seen.has(e.videoId) ? '<span class="ep-seen">' + F.icon('check', 14) + ' ' + esc(t('watched')) + '</span>' : '') +
    '</span></button></li>';

  F.views.show = async ({ id }, query) => {
    const s = F.catalogData.series.find(x => x.id === id);
    if (!s) { F.render(ui.errorPage(true)); return; }
    const tok = F.render(skeletonPage());
    let pl;
    try { pl = await F.api.playlist(s.playlistId); }
    catch (e) { if (F.isCurrent(tok)) F.fill(ui.errorPage(e.status === 404 || e.status === 403)); return; }
    if (!F.isCurrent(tok)) return;

    const eps = (pl.episodes || []).slice();
    if (s.reverse) eps.reverse();
    const title = F.showTitle(s);
    const key = 'show:' + s.id;
    const listItem = { key, kind: 'show', title, img: F.posterUrl(s.poster) || s.thumb || pl.thumb, href: '#/show/' + encodeURIComponent(s.id) };
    if (!eps.length) { F.fill('<div class="page"><div class="watch-bar">' + ui.backBtn() + '</div>' + ui.empty(t('playlist_empty')) + '</div>'); return; }

    const prog = F.progress.get(key);
    const wanted = query.e || (prog && prog.videoId);
    let idx = Math.max(0, eps.findIndex(e => e.videoId === wanted));
    let startAt = 0;
    if (prog && prog.videoId === eps[idx].videoId && prog.t > 10 && !(prog.dur && prog.t > prog.dur - 20)) startAt = Math.floor(prog.t);
    const seen = F.seen.get(s.id);

    F.fill('<div class="page watch-page">' +
      '<div class="watch-bar">' + ui.backBtn() + '</div>' +
      '<div class="player-wrap"><div class="player" id="pbox"><div id="yt-player"></div><div class="player-msg" id="pmsg" hidden></div></div></div>' +
      '<div class="watch">' +
        '<h1 class="watch-title">' + esc(title) + '</h1>' +
        '<p class="ep-line" id="ep-count"></p>' +
        '<p class="ep-now" id="ep-title" dir="auto"></p>' +
        (s.channel ? '<p class="muted small">' + esc(t('from_channel', { c: s.channel })) + '</p>' : '') +
        '<div class="btns">' +
          '<button class="btn btn-primary" type="button" id="btn-next">' + F.icon('next', 20) + '<span>' + esc(t('next_ep')) + '</span></button>' +
          '<button class="btn" type="button" id="btn-prev">' + esc(t('prev_ep')) + '</button>' +
          ui.listBtn(listItem) +
        '</div>' +
        '<h2 class="section-title">' + esc(t('episodes')) + ' <span class="count">' + eps.length + '</span></h2>' +
        '<ol class="eps" id="eps">' + eps.map((e, i) => epItem(e, i, seen)).join('') + '</ol>' +
      '</div></div>');

    const root = document.getElementById('view');
    ui.bindListBtn(root, listItem);
    const $count = document.getElementById('ep-count');
    const $title = document.getElementById('ep-title');
    const $next = document.getElementById('btn-next');
    const $prev = document.getElementById('btn-prev');
    const $list = document.getElementById('eps');
    const $msg = document.getElementById('pmsg');
    const $box = document.getElementById('pbox');
    let player = null, timer = null;

    const record = (i, tNow, dur) => F.progress.save(key, {
      kind: 'show', id: s.id, title, img: eps[i].thumb || s.thumb, videoId: eps[i].videoId,
      ep: i + 1, epTitle: eps[i].title, total: eps.length, t: tNow, dur
    });
    function markSeen(i) {
      F.seen.add(s.id, eps[i].videoId);
      const body = $list.querySelector('[data-i="' + i + '"] .ep-body');
      if (body && !body.querySelector('.ep-seen')) body.insertAdjacentHTML('beforeend', '<span class="ep-seen">' + F.icon('check', 14) + ' ' + esc(t('watched')) + '</span>');
    }
    function saveNow() {
      if (!player || typeof player.getCurrentTime !== 'function') return;
      const tNow = player.getCurrentTime() || 0;
      const dur = player.getDuration() || 0;
      if (tNow < 3) return;
      record(idx, tNow, dur);
      if (dur && tNow / dur > 0.9) markSeen(idx);
    }
    function paint() {
      $count.textContent = t('episode_of', { n: idx + 1, m: eps.length });
      $title.textContent = eps[idx].title;
      $next.disabled = idx >= eps.length - 1;
      $prev.disabled = idx <= 0;
      $list.querySelectorAll('.ep[aria-current]').forEach(b => b.removeAttribute('aria-current'));
      const cur = $list.querySelector('[data-i="' + idx + '"]');
      if (cur) cur.setAttribute('aria-current', 'true');
      $msg.hidden = true;
    }
    function showBlocked() {
      const v = eps[idx].videoId;
      $msg.innerHTML = '<p>' + esc(t('yt_blocked')) + '</p><div class="btns">' +
        '<a class="btn" href="https://www.youtube.com/watch?v=' + encodeURIComponent(v) + '" target="_blank" rel="noopener">' + F.icon('external', 18) + '<span>' + esc(t('open_youtube')) + '</span></a>' +
        (idx < eps.length - 1 ? '<button class="btn btn-primary" type="button" data-skip>' + esc(t('next_ep')) + '</button>' : '') + '</div>';
      $msg.hidden = false;
      const sk = $msg.querySelector('[data-skip]');
      if (sk) sk.addEventListener('click', () => go(idx + 1));
    }
    function go(i) {
      if (i < 0 || i >= eps.length) return;
      saveNow();
      idx = i;
      paint();
      history.replaceState(null, '', '#/show/' + encodeURIComponent(s.id) + '?e=' + encodeURIComponent(eps[i].videoId));
      record(i, 0, 0);
      if (player && player.loadVideoById) player.loadVideoById(eps[i].videoId);
      const r = $box.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.5) $box.scrollIntoView({ block: 'start', behavior: F.reducedMotion() ? 'auto' : 'smooth' });
    }

    $list.addEventListener('click', e => { const b = e.target.closest('.ep'); if (b) go(Number(b.dataset.i)); });
    $next.addEventListener('click', () => go(idx + 1));
    $prev.addEventListener('click', () => go(idx - 1));
    paint();

    F.onLeave(() => {
      clearInterval(timer);
      try { saveNow(); } catch (e) {}
      try { if (player && player.destroy) player.destroy(); } catch (e) {}
    });

    let YT;
    try { YT = await F.yt.ready(); } catch (e) { if (F.isCurrent(tok)) showBlocked(); return; }
    if (!F.isCurrent(tok)) return;
    player = new YT.Player('yt-player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: eps[idx].videoId,
      playerVars: { playsinline: 1, rel: 0, start: startAt, autoplay: query.e ? 1 : 0, origin: location.origin },
      events: {
        onStateChange(ev) {
          const S = YT.PlayerState;
          clearInterval(timer);
          if (ev.data === S.PLAYING) timer = setInterval(saveNow, 5000);
          if (ev.data === S.PAUSED) saveNow();
          if (ev.data === S.ENDED) {
            markSeen(idx);
            if (idx < eps.length - 1) {
              if (F.settings.autoplay) go(idx + 1);
              else record(idx + 1, 0, 0);
            } else {
              F.progress.remove(key);
            }
          }
        },
        onError() { clearInterval(timer); showBlocked(); }
      }
    });
  };

  /* =====================================================================
     Public-domain film from the Internet Archive — plays here or in any
     installed video player (MX Player, VLC, etc.)
     ===================================================================== */
  function androidIntent(url, title) {
    const u = new URL(url);
    return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=' + u.protocol.replace(':', '') +
      ';action=android.intent.action.VIEW;type=video/*;S.title=' + encodeURIComponent(title) + ';end';
  }
  function externalButtons(url, title) {
    let h = '';
    if (F.platform.android) {
      h += '<a class="btn btn-primary" href="' + esc(androidIntent(url, title)) + '">' + F.icon('external', 18) + '<span>' + esc(t('open_player')) + '</span></a>';
    }
    if (F.platform.ios) {
      h += '<a class="btn btn-primary" href="' + esc('vlc-x-callback://x-callback-url/stream?url=' + encodeURIComponent(url)) + '">' + F.icon('external', 18) + '<span>' + esc(t('open_vlc')) + '</span></a>';
      h += '<a class="btn" href="' + esc('infuse://x-callback-url/play?url=' + encodeURIComponent(url)) + '">' + F.icon('external', 18) + '<span>' + esc(t('open_infuse')) + '</span></a>';
    }
    h += '<button class="btn" type="button" data-copy="' + esc(url) + '">' + F.icon('copy', 18) + '<span>' + esc(t('copy_link')) + '</span></button>';
    h += '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener" download>' + F.icon('download', 18) + '<span>' + esc(t('download')) + '</span></a>';
    return h;
  }

  F.views.film = async ({ id }) => {
    const tok = F.render(skeletonPage());
    let f;
    try { f = await F.api.archiveItem(id); }
    catch (e) { if (F.isCurrent(tok)) F.fill(ui.errorPage(e.status === 404 || e.status === 403 || e.status === 400)); return; }
    if (!F.isCurrent(tok)) return;

    const key = 'film:' + f.id;
    const item = { key, kind: 'film', title: f.title, img: f.thumb, href: '#/film/' + encodeURIComponent(f.id) };
    const v = f.video;
    let desc = F.toText(f.description);
    if (desc.length > 1400) desc = desc.slice(0, 1400).trim() + '…';

    F.fill('<div class="page watch-page">' +
      '<div class="watch-bar">' + ui.backBtn() + '</div>' +
      '<div class="player-wrap"><div class="player">' +
        (v ? '<video id="vid" controls playsinline preload="metadata" poster="' + esc(f.thumb) + '" src="' + esc(v.url) + '"></video>'
           : '<div class="player-msg"><p>' + esc(t('no_video')) + '</p></div>') +
      '</div></div>' +
      '<div class="watch">' +
        '<h1 class="watch-title">' + esc(f.title) + '</h1>' +
        '<ul class="meta">' + [f.year, f.runtime].filter(Boolean).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
        '<div class="btns">' + (v ? externalButtons(v.url, f.title) : '') + ui.listBtn(item) + '</div>' +
        '<p class="muted small">' + esc(t('public_domain')) + '</p>' +
        (desc ? '<div class="overview prose">' + esc(desc) + '</div>' : '') +
      '</div></div>');

    const root = document.getElementById('view');
    ui.bindListBtn(root, item);
    const cb = root.querySelector('[data-copy]');
    if (cb) cb.addEventListener('click', () => ui.copy(cb.dataset.copy));

    const vid = document.getElementById('vid');
    if (!vid) return;
    const prog = F.progress.get(key);
    vid.addEventListener('loadedmetadata', () => {
      if (prog && prog.t > 10 && vid.duration && prog.t < vid.duration - 20) vid.currentTime = prog.t;
    }, { once: true });
    let last = 0;
    const save = () => {
      if (vid.ended || !vid.duration || vid.currentTime < 3) return;
      F.progress.save(key, { kind: 'film', id: f.id, title: f.title, img: f.thumb, t: vid.currentTime, dur: vid.duration });
    };
    vid.addEventListener('timeupdate', () => { const n = Date.now(); if (n - last > 5000) { last = n; save(); } });
    vid.addEventListener('pause', save);
    vid.addEventListener('ended', () => F.progress.remove(key));
    F.onLeave(() => { save(); try { vid.pause(); vid.removeAttribute('src'); vid.load(); } catch (e) {} });
  };
})();
