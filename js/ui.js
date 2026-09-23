/* UwatchMe — UI building blocks */
(function () {
  'use strict';
  const F = window.__uwatchme;
  const esc = F.esc;
  const t = F.t;
  const ui = F.ui = {};

  const ICONS = {
    home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    series: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="m8.5 2.5 3.5 3.5 3.5-3.5"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
    anime: '<path d="M12 3.5 14 9l5.5 2-5.5 2-2 5.5-2-5.5-5.5-2L10 9z"/>',
    list: '<path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    next: '<path d="M6 6v12l8.5-6z" fill="currentColor"/><path d="M18 6v12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  F.icon = (name, size) => {
    const s = size || 22;
    return '<svg class="ic ic-' + name + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  };

  ui.imgTag = src => (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '');
  const badge = () => '<span class="badge-free">' + esc(t('free')) + '</span>';

  /* Poster card (2:3) — discovery titles and free films */
  ui.poster = it => '<a class="poster" href="' + esc(it.href) + '">' +
    '<span class="poster-img"><span class="fallback">' + esc(it.title) + '</span>' + ui.imgTag(it.poster || it.img) + (it.free ? badge() : '') + '</span>' +
    '<span class="poster-title">' + esc(it.title) + '</span>' +
    ((it.sub || it.year) ? '<span class="poster-sub">' + esc(it.sub || it.year) + '</span>' : '') +
    '</a>';

  /* Wide card (16:9) — full episodes you can play right here */
  ui.wide = it => '<a class="wide" href="' + esc(it.href) + '">' +
    '<span class="wide-img"><span class="fallback">' + esc(it.title) + '</span>' + ui.imgTag(it.img) + (it.free ? badge() : '') +
    (it.pct ? '<span class="wide-bar"><i style="width:' + Math.max(3, Math.min(100, it.pct)).toFixed(1) + '%"></i></span>' : '') +
    '</span>' +
    '<span class="wide-title" dir="auto">' + esc(it.title) + '</span>' +
    (it.sub ? '<span class="wide-sub">' + esc(it.sub) + '</span>' : '') +
    '</a>';

  ui.wideRemovable = it => '<div class="wide-wrap">' + ui.wide(it) +
    '<button class="wide-x" type="button" data-remove="' + esc(it.key) + '" aria-label="' + esc(t('remove') + ': ' + it.title) + '">' + F.icon('x', 18) + '</button></div>';

  ui.skeletons = (kind, n) => {
    let h = '';
    for (let i = 0; i < (n || 6); i++) h += '<span class="sk sk-' + kind + '"></span>';
    return h;
  };

  ui.row = (id, title, opts) => {
    const o = opts || {};
    return '<section class="row" id="' + id + '" aria-labelledby="' + id + '-h">' +
      '<div class="row-head"><h2 id="' + id + '-h">' + esc(title) + '</h2>' +
      (o.more ? '<a class="row-more" href="' + esc(o.more) + '">' + esc(t('see_all')) + '</a>' : '') + '</div>' +
      '<div class="row-track">' + ui.skeletons(o.card === 'wide' ? 'wide' : 'poster') + '</div></section>';
  };

  ui.fillRow = async (tok, id, loader, opts) => {
    const o = opts || {};
    let items;
    try { items = await loader(); }
    catch (e) {
      if (!F.isCurrent(tok)) return;
      const sec = document.getElementById(id);
      if (!sec) return;
      if (o.hideOnError) { sec.remove(); return; }
      sec.querySelector('.row-track').outerHTML = '<p class="row-note">' + esc(t('load_error')) + '</p>';
      return;
    }
    if (!F.isCurrent(tok)) return;
    const sec = document.getElementById(id);
    if (!sec) return;
    if (!items || !items.length) {
      if (o.empty) sec.querySelector('.row-track').outerHTML = '<p class="row-note">' + esc(o.empty) + '</p>';
      else sec.remove();
      return;
    }
    const card = o.card === 'wide' ? ui.wide : ui.poster;
    sec.querySelector('.row-track').innerHTML = items.map(card).join('');
  };

  ui.empty = (text, action) => '<div class="empty"><img src="/icons/mark.svg" alt="" width="56" height="56"><p>' + esc(text) + '</p>' + (action || '') + '</div>';

  ui.backBtn = () => '<button class="icon-btn back-btn" type="button" data-back aria-label="' + esc(t('back')) + '">' + F.icon('back') + '</button>';

  ui.errorPage = missing => '<div class="page"><div class="watch-bar">' + ui.backBtn() + '</div>' +
    ui.empty(t(missing ? 'not_found' : 'load_error'), missing ? '' : '<button class="btn" type="button" data-retry>' + esc(t('retry')) + '</button>') + '</div>';

  const listBtnInner = on => F.icon(on ? 'check' : 'plus', 20) + '<span>' + esc(t(on ? 'in_list' : 'add_list')) + '</span>';
  ui.listBtn = item => '<button class="btn" type="button" data-list aria-pressed="' + F.mylist.has(item.key) + '">' + listBtnInner(F.mylist.has(item.key)) + '</button>';
  ui.bindListBtn = (root, item) => {
    const b = root.querySelector('[data-list]');
    if (!b) return;
    b.addEventListener('click', () => {
      const on = F.mylist.toggle(item);
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = listBtnInner(on);
    });
  };

  ui.toast = msg => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  };

  ui.copy = async text => {
    try { await navigator.clipboard.writeText(text); ui.toast(t('copied')); }
    catch (e) { window.prompt(t('copy_link'), text); }
  };

  /* Trailer / any YouTube video in an overlay */
  ui.openVideoModal = key => {
    const opener = document.activeElement;
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', t('trailer'));
    m.innerHTML = '<div class="modal-box"><button class="icon-btn modal-close" type="button" aria-label="' + esc(t('close')) + '">' + F.icon('x') + '</button>' +
      '<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(key) + '?autoplay=1&playsinline=1&rel=0" title="' + esc(t('trailer')) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></div>';
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      if (!m.isConnected) return;
      m.remove();
      document.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
    }
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('.modal-close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(m);
    m.querySelector('.modal-close').focus();
    F.onLeave(close);
  };
})();
