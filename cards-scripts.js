/* به نام خداوند بخشنده مهربان */

document.addEventListener('DOMContentLoaded', () => {
  // ارجاع‌ها
  const body = document.body;
  const panel = document.getElementById('gateway-panel');
  const headerTrigger = document.getElementById('gateway-trigger');
  const gateHint = document.getElementById('gate-hint');
  const container = document.getElementById('cards-container');
  const viewButtons = document.querySelectorAll('.view-switcher button');
  const modeButtons = document.querySelectorAll('.day-night-switcher button');
  const desktopLeft = document.getElementById('desktop-controls-left');
  const desktopRight = document.getElementById('desktop-controls-right');
  const mobileControls = document.getElementById('mobile-controls');
  const logoRainBox = document.getElementById('logo-rain');
  const cardCatalog = new Map((window.NIAT_CARDS || []).filter(intent => intent.id).map(intent => [intent.id, intent]));

  const getIntentChildren = intent => {
    if (Array.isArray(intent?.menu)) return intent.menu;
    if (Array.isArray(intent?.submenu)) return intent.submenu;
    return [];
  };
  const paymentUrlForIntent = intent => {
    const params = new URLSearchParams({ cause: intent.cause });
    return `payment-form.html?${params.toString()}`;
  };
  container?.querySelectorAll('.card').forEach(card => {
    const intent = cardCatalog.get(card.dataset.intentId);
    if (!intent) return;
    const title = card.querySelector('.card-title');
    const image = card.querySelector('img');
    if (title) title.textContent = intent.title;
    if (image) image.alt = intent.title;
    card.setAttribute('aria-label', intent.title);
  });

  setView(localStorage.getItem('cardViewMode') || 'small');
  setMode(localStorage.getItem('dayNightMode') || 'day');
  if (panel) panel.inert = true;
  hideControls();

  let isExpanded=false, isAnimating=false;
  let activeToggle = headerTrigger;

  // ——— افکت «بارش لطیف» لوگو SVG (کم‌مصرف، احترام به کاهش حرکت) ———
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  class LogoRain {
    constructor(container){
      this.box = container;
      this.timer = null;
      this.maxNodes = 60;
      this.spawnEvery = 260; // ms
      this.batchSize = 3;
      this.active = false;
    }
    positionToButton(){
      try{
        const r = headerTrigger.getBoundingClientRect();
        const top = Math.max(0, r.bottom + 8);
        // جایگذاری از زیر دکمه تا پایین
        this.box.style.top = `${top}px`;
        this.box.style.left = '0px';
        this.box.style.right = '0px';
        this.box.style.bottom = '0px';
      }catch{}
    }
    dropOne(){
      if (!this.box) return;
      const d = document.createElement('i');
      d.className = 'logo-drop';
      // قرارگیری افقی تصادفی (در سراسر عرض صفحه)
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const left = Math.floor(Math.random() * vw);
      d.style.left = `${left}px`;
      // پارامترهای حرکت
      const dur = 6.5 + Math.random()*2.4;         // 6.5..8.9s
      const delay = Math.random()*0.8;             // 0..0.8s
      const travel = 0.40 + Math.random()*0.22;    // 40%..62% ارتفاع
      d.style.setProperty('--dur', `${dur}s`);
      d.style.setProperty('--delay', `${delay}s`);
      d.style.setProperty('--travel', `${Math.round(travel*100)}vh`);
      d.addEventListener('animationend', () => d.remove());
      this.box.appendChild(d);
      // محدودیت تعداد نودها برای پرفورمنس
      const nodes = this.box.querySelectorAll('.logo-drop');
      if (nodes.length > this.maxNodes){
        const extra = nodes.length - this.maxNodes;
        for (let i=0; i<extra; i++) nodes[i].remove();
      }
    }
    start(){
      if (this.active || prefersReduced) return;
      this.active = true;
      this.positionToButton();
      window.addEventListener('resize', this._onResize, { passive:true });
      this.timer = setInterval(() => {
        for (let i=0; i<this.batchSize; i++) this.dropOne();
      }, this.spawnEvery);
    }
    stop(){
      if (!this.active) return;
      this.active = false;
      window.removeEventListener('resize', this._onResize);
      if (this.timer){ clearInterval(this.timer); this.timer = null; }
      // محو سریع بدون تداخل کلیک‌ها
      this.box.querySelectorAll('.logo-drop').forEach(n => n.style.opacity='0');
      setTimeout(() => { this.box.innerHTML=''; }, 900);
    }
    _onResize = () => this.positionToButton();
  }
  const rain = new LogoRain(logoRainBox);

  // ——— چرخه باز/بسته پنل کارت‌ها + کنترل افکت‌ها ———
  function togglePanel(e, control, focusOverride = null) {
    e.preventDefault();
    if (isAnimating) return;
    activeToggle = control || headerTrigger;
    const focusFirst = focusOverride ?? e.detail === 0;
    isExpanded ? collapsePanel(focusFirst) : expandPanel(focusFirst);
  }
  headerTrigger?.addEventListener('click', (e) => togglePanel(e, headerTrigger));
  gateHint?.addEventListener('click', (e) => togglePanel(e, gateHint));
  [headerTrigger, gateHint].forEach((control) => control?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') togglePanel(e, control, true);
  }));

  function sortTopThenRight(wraps){
    return wraps
      .map(w => ({ w, c:w.querySelector('.card'), rect:w.getBoundingClientRect() }))
      .sort((a,b) => (a.rect.top - b.rect.top) || (b.rect.left - a.rect.left));
  }

  function activateTease(){
    body.classList.add('tease-active');       // درخشش دکمه
    if (!prefersReduced) rain.start();        // بارش لوگو
  }
  function deactivateTease(){
    body.classList.remove('tease-active');
    rain.stop();
  }

  // حالت آغازین: پنل بسته → افکت‌های دعوت فعال
  activateTease();

  function expandPanel(focusFirst = false){
    isAnimating = true; isExpanded = true;
    headerTrigger?.setAttribute('aria-expanded','true');
    gateHint?.setAttribute('aria-expanded','true');
    gateHint?.setAttribute('aria-hidden','true');
    gateHint?.setAttribute('tabindex','-1');
    panel?.setAttribute('aria-hidden','false');
    if (panel) panel.inert = false;
    panel?.classList.remove('collapsed'); panel?.classList.add('expanded');
    body.classList.add('panel-opened');   // راهنمای کلیک محو شود
    setCardsFocusable(true);

    // شروع بازشدن: افکت‌ها خاموش شوند
    deactivateTease();

    const wraps = Array.from(document.querySelectorAll('.card-wrap'));
    const ordered = sortTopThenRight(wraps);
    ordered.forEach(({w,c},i) => {
      setTimeout(() => { c?.classList.add('visible'); w?.classList.add('card-ready'); }, i*120);
    });
    const total = ordered.length*120 + 550;
    setTimeout(() => {
      showControls();
      // پس از اتمام توالی ورود: پس‌زمینه فعال شود
      body.classList.add('bg-revealed');
      isAnimating = false;
      if (focusFirst) container?.querySelector('.card')?.focus();
    }, total);
  }

  function collapsePanel(returnFocus = false){
    isAnimating = true; isExpanded = false;
    headerTrigger?.setAttribute('aria-expanded','false');
    gateHint?.setAttribute('aria-expanded','false');
    gateHint?.removeAttribute('aria-hidden');
    gateHint?.removeAttribute('tabindex');
    panel?.setAttribute('aria-hidden','true');
    if (panel) panel.inert = true;
    body.classList.remove('panel-opened');   // راهنمای کلیک دوباره نمایش داده شود
    setCardsFocusable(false);

    // شروع جمع‌شدن: پس‌زمینه خاموش تا مزاحم نباشد
    body.classList.remove('bg-revealed');

    hideControls();
    const wraps = Array.from(document.querySelectorAll('.card-wrap'));
    const ordered = sortTopThenRight(wraps).reverse();
    ordered.forEach(({w,c},i) => { setTimeout(() => { w?.classList.remove('card-ready'); c?.classList.remove('visible'); }, i*120); });
    const total = ordered.length*120 + 400;
    setTimeout(() => {
      panel?.classList.remove('expanded'); panel?.classList.add('collapsed');
      // پس از پایان جمع‌شدن: افکت‌های دعوت دوباره فعال شوند
      activateTease();
      isAnimating=false;
      if (returnFocus) activeToggle?.focus();
    }, total);
  }

  // ——— منو/لینک کارت‌ها + افکت‌های موجود ———
  container?.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;

    const intent = cardCatalog.get(card.dataset.intentId);
    if (!intent) return;

    // پرواز آرام کبوترها
    pigeons.burstAt(e.clientX, e.clientY);

    // منوی اختصاصی کارت
    const items = getIntentChildren(intent);
    if (items.length){
      e.stopPropagation();
      openMenuAt(e, items);
      return;
    }

    // لینک مستقیم کارت
    window.open(paymentUrlForIntent(intent), '_blank', 'noopener,noreferrer');
  });

  // ——— دسترس‌پذیری کیبورد کارت‌ها: فوکوس و فعال‌سازی با Enter/Space ———
  // تا زمانی که پنل بسته است، کارت‌های نامرئی از ترتیب فوکوس خارج می‌مانند
  function setCardsFocusable(enabled){
    const cards = [...(container?.querySelectorAll('.card') || [])];
    cards.forEach((card, index) => card.setAttribute('tabindex', enabled && index === 0 ? '0' : '-1'));
  }
  container?.querySelectorAll('.card').forEach((card) => {
    card.setAttribute('tabindex', '-1');
    card.setAttribute('role', 'button');
    const alt = card.querySelector('img')?.getAttribute('alt');
    if (alt) card.setAttribute('aria-label', alt);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); return; }
      const cards = [...container.querySelectorAll('.card')];
      const index = cards.indexOf(card);
      let targetIndex = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') targetIndex = Math.min(cards.length - 1, index + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') targetIndex = Math.max(0, index - 1);
      if (e.key === 'Home') targetIndex = 0;
      if (e.key === 'End') targetIndex = cards.length - 1;
      if (targetIndex !== null && cards[targetIndex]) {
        e.preventDefault();
        cards[targetIndex].focus();
      }
    });
  });

  function buildMenu(items){
    const ul = document.createElement('ul');
    ul.setAttribute('role', 'menu');
    items.forEach(item => {
      const li = document.createElement('li');
      const children = getIntentChildren(item);
      if (children.length){
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-item';
        button.setAttribute('role', 'menuitem');
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.textContent = item.title;
        const childList = buildMenu(children);
        childList.setAttribute('role', 'menu');
        childList.hidden = true;
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          ul.querySelectorAll('li.expanded').forEach(o => {
            if (o === li) return;
            o.classList.remove('expanded');
            o.children[0]?.setAttribute('aria-expanded', 'false');
            if (o.children[1]) o.children[1].hidden = true;
          });
          const opening = button.getAttribute('aria-expanded') !== 'true';
          button.setAttribute('aria-expanded', String(opening));
          childList.hidden = !opening;
          li.classList.toggle('expanded', opening);
          if (opening && e.detail === 0) childList.querySelector('[role="menuitem"]')?.focus();
        });
        li.appendChild(button);
        li.appendChild(childList);
      } else {
        const a = document.createElement('a');
        a.setAttribute('role', 'menuitem');
        a.href = paymentUrlForIntent(item); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = item.title;
        li.appendChild(a);
      }
      ul.appendChild(li);
    });
    return ul;
  }

  let activeMenuCard = null;
  function openMenuAt(e, items){
    closeMenus(false);
    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.appendChild(buildMenu(items));
    menu.setAttribute('role', 'region');
    menu.setAttribute('aria-label', 'گزینه‌های نیت');
    menu.addEventListener('pointerdown', ev => ev.stopPropagation());
    menu.addEventListener('keydown', handleMenuKeydown);
    activeMenuCard = e.target.closest('.card');
    activeMenuCard?.setAttribute('aria-expanded', 'true');
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    let left = e.clientX - r.width/2, top = e.clientY;
    if (left < 8) left = 8;
    if (left + r.width > innerWidth - 8) left = innerWidth - r.width - 8;
    if (top + r.height > innerHeight - 8) top = innerHeight - r.height - 8;
    if (top < 8) top = 8;
    menu.style.left = left + 'px';
    menu.style.top  = top  + 'px';
    requestAnimationFrame(() => menu.classList.add('show'));
    if (e.detail === 0) menu.querySelector('[role="menuitem"]')?.focus();
  }

  function closeMenus(restoreFocus = false){
    document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
    activeMenuCard?.setAttribute('aria-expanded', 'false');
    const card = activeMenuCard;
    activeMenuCard = null;
    if (restoreFocus) card?.focus();
  }

  function handleMenuKeydown(ev) {
    const current = ev.target.closest('[role="menuitem"]');
    if (!current) return;
    const list = current.parentElement?.parentElement;
    const options = [...list.children]
      .map(item => item.querySelector(':scope > [role="menuitem"]'))
      .filter(Boolean);
    const index = options.indexOf(current);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const next = ev.key === 'ArrowDown'
        ? (index + 1) % options.length
        : (index - 1 + options.length) % options.length;
      options[next]?.focus();
    } else if (ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault();
      options[ev.key === 'Home' ? 0 : options.length - 1]?.focus();
    } else if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && current.tagName === 'BUTTON') {
      ev.preventDefault();
      if (ev.key === 'ArrowRight' && current.getAttribute('aria-expanded') !== 'true') current.click();
      else if (ev.key === 'ArrowLeft' && current.getAttribute('aria-expanded') === 'true') current.click();
      else if (ev.key === 'ArrowLeft' && list.classList.contains('is-submenu')) {
        const parentItem = list.parentElement;
        const parent = parentItem?.parentElement?.querySelector(':scope > button[role="menuitem"]');
        parentItem?.classList.remove('expanded');
        list.hidden = true;
        parent?.setAttribute('aria-expanded', 'false');
        parent?.focus();
      }
    }
  }

  document.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('.dropdown-menu')) closeMenus(false); }, true);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (document.querySelector('.dropdown-menu')) {
      ev.preventDefault();
      closeMenus(true);
    } else if (isExpanded) {
      ev.preventDefault();
      collapsePanel(true);
    }
  });
  window.addEventListener('resize', () => closeMenus(false));

  // Tooltip
  const tip = document.createElement('div'); tip.className = 'tooltip-pop'; document.body.appendChild(tip);
  function placeTooltip(el){
    const text = el.getAttribute('data-tooltip'); if (!text) return;
    tip.textContent = text;
    tip.style.left = '-9999px'; tip.style.top = '-9999px';
    tip.classList.add('show');
    const r = el.getBoundingClientRect(), pad = 10, desktop = window.matchMedia('(min-width:651px)').matches;
    const tw = tip.offsetWidth, th = tip.offsetHeight; let tx, ty;
    if (!desktop) { tx = r.left + (r.width - tw)/2; ty = r.top - th - pad; if (ty < 8) ty = r.bottom + pad; }
    else {
      const inLeft = !!el.closest('#desktop-controls-left');
      const preferRight = inLeft || (r.left < innerWidth/2);
      if (preferRight){ tx = r.right + pad; ty = r.top + (r.height - th)/2; if (tx + tw > innerWidth - 8) tx = innerWidth - tw - 8; }
      else { tx = r.left - tw - pad; ty = r.top + (r.height - th)/2; if (tx < 8) tx = 8; }
      if (ty < 8) ty = 8; if (ty + th > innerHeight - 8) ty = innerHeight - th - 8;
    }
    tx = Math.max(8, Math.min(tx, innerWidth - tw - 8));
    tip.style.left = `${tx}px`; tip.style.top = `${ty}px`;
  }
  function hideTooltip(){ tip.classList.remove('show'); }
  function bindTooltips(){
    document.querySelectorAll('[data-tooltip]').forEach(el => {
      el.addEventListener('mouseenter', () => placeTooltip(el));
      el.addEventListener('mouseleave', hideTooltip);
      el.addEventListener('focusin',  () => placeTooltip(el));
      el.addEventListener('focusout', hideTooltip);
      el.addEventListener('touchstart', () => { placeTooltip(el); setTimeout(hideTooltip,1200); }, { passive:true });
    });
    window.addEventListener('resize', hideTooltip);
  }

  function setView(view){
    container.classList.remove('view-small','view-big');
    container.classList.add(view === 'big' ? 'view-big' : 'view-small');
    viewButtons.forEach(btn => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    localStorage.setItem('cardViewMode', view);
  }
  viewButtons.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

  function setMode(mode){
    body.classList.toggle('night-mode', mode === 'night');
    modeButtons.forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    localStorage.setItem('dayNightMode', mode);
  }
  modeButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

  function setControlsFocusable(enabled){
    document.querySelectorAll('.controls-fade button').forEach(button => {
      if (enabled) button.removeAttribute('tabindex');
      else button.setAttribute('tabindex', '-1');
    });
    [desktopLeft, desktopRight, mobileControls].forEach(control => {
      if (!control) return;
      control.setAttribute('aria-hidden', String(!enabled));
      control.inert = !enabled;
    });
  }
  function showControls(){
    desktopLeft?.classList.remove('hide'); desktopRight?.classList.remove('hide'); mobileControls?.classList.remove('hide');
    setControlsFocusable(true);
  }
  function hideControls(){
    desktopLeft?.classList.add('hide'); desktopRight?.classList.add('hide'); mobileControls?.classList.add('hide');
    setControlsFocusable(false);
  }

  bindTooltips();

  // ——— کلاس پرواز آرام کبوترها (آرام، پراکنده، بدون سقوط) ———
  const pigeons = new PigeonGlide();
});

/* ساخته شده توسط مهدی باغبانپور بروجنی */
