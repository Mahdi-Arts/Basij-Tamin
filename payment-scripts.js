/* Copyright © 2026 Mahdi Baghbanpour. Proprietary project; see LICENSE.md. */

document.addEventListener('DOMContentLoaded', () => {
  // احترام به تنظیم «کاهش حرکت» کاربر
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // عناصر
  const params = new URLSearchParams(location.search);
  const initialCauseParam = params.get('cause') ? params.get('cause').replace(/_/g, ' ') : '';
  const resolveIntent = cause => typeof window.getIntentByCause === 'function' ? window.getIntentByCause(cause) : null;
  const initialIntent = resolveIntent(initialCauseParam);
  const pageTitle = document.getElementById('page-title');
  const provinceSel = document.getElementById('province');
  const citySel = document.getElementById('city');
  const intentsWrap = document.getElementById('intents-wrapper');
  const form = document.getElementById('payment-form');
  const grandTotal = document.getElementById('grand-total');
  const payBtn = document.getElementById('pay-btn');
  const bouquet = document.getElementById('bouquet');
  const totalLine = document.querySelector('.total-line');
  const summary = document.querySelector('.summary');
  const payActions = document.querySelector('.pay-actions');
  const pageShell = document.getElementById('payment-page');
  const thankModal = document.getElementById('thank-modal');
  const thankModalContent = thankModal?.querySelector('.modal-content');
  const closeThankModalBtn = document.getElementById('close-thank-modal');
  const redirectBtn = document.getElementById('redirect-btn');
  const thankTitle = document.getElementById('thank-title');
  const thankMessage = document.getElementById('thank-message');
  const paymentConfig = window.PAYMENT_CONFIG || {};

  // ابزار
  const faNF = new Intl.NumberFormat('fa-IR');
  const listFa = new Intl.ListFormat('fa', { type: 'conjunction', style: 'long' });

  // مودال: فوکوس محدود، Escape، بستن با پس‌زمینه و blur/inert صفحهٔ زیرین
  const modalFocusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  let lastFocusedBeforeModal = null;
  let modalAction = () => closeThankModal();
  function setModalPageState(open) {
    document.body.classList.toggle('modal-open', open);
    if (!pageShell) return;
    pageShell.classList.toggle('modal-blurred', open);
    if ('inert' in pageShell) pageShell.inert = open;
    if (open) pageShell.setAttribute('inert', '');
    else pageShell.removeAttribute('inert');
    pageShell.setAttribute('aria-hidden', open ? 'true' : 'false');
  }
  function getModalFocusables() {
    return thankModal ? [...thankModal.querySelectorAll(modalFocusableSelector)].filter(el => !el.hidden && el.offsetParent !== null) : [];
  }
  function openThankModal() {
    if (!thankModal) return;
    lastFocusedBeforeModal = document.activeElement;
    thankModal.classList.add('show');
    thankModal.setAttribute('aria-hidden', 'false');
    setModalPageState(true);
    requestAnimationFrame(() => (closeThankModalBtn || thankModalContent || thankModal)?.focus());
  }
  function closeThankModal({ restoreFocus = true } = {}) {
    if (!thankModal) return;
    thankModal.classList.remove('show');
    thankModal.setAttribute('aria-hidden', 'true');
    setModalPageState(false);
    if (restoreFocus && lastFocusedBeforeModal?.isConnected) lastFocusedBeforeModal.focus();
  }
  function handleThankModalKeydown(event) {
    if (!thankModal?.classList.contains('show')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeThankModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = getModalFocusables();
    if (!focusables.length) {
      event.preventDefault();
      thankModalContent?.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!thankModal.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  document.addEventListener('keydown', handleThankModalKeydown);
  closeThankModalBtn?.addEventListener('click', () => closeThankModal());
  redirectBtn?.addEventListener('click', () => modalAction());
  thankModal?.addEventListener('click', event => {
    if (event.target === thankModal) closeThankModal();
  });

  // استان/شهر (پیوند وابسته)
  provinceSel.disabled = false;
  provinceSel.innerHTML = '<option value="" selected>استان را انتخاب کنید</option>';
  PROVINCE_LIST.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; provinceSel.appendChild(o); });
  provinceSel.addEventListener('change', () => {
    const p = provinceSel.value;
    citySel.disabled = !p;
    citySel.innerHTML = '';
    const ph = document.createElement('option'); ph.value = ''; ph.selected = true;
    ph.textContent = p ? 'شهر را انتخاب کنید' : 'ابتدا استان را انتخاب کنید';
    citySel.appendChild(ph);
    getCitiesOf(p).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; citySel.appendChild(o); });
  });

  // موبایل
  const mobileInput = document.getElementById('mobile');
  const normalizeTo09 = raw => { let v = raw || ''; if (v.startsWith('0098')) v = v.slice(4); else if (v.startsWith('98')) v = v.slice(2); if (!v.startsWith('0')) v = '0' + v; return v; };
  mobileInput.addEventListener('input', () => { const raw = toEnDigits(mobileInput.value).replace(/[^\d]/g, ''); mobileInput.value = raw; });
  mobileInput.addEventListener('blur', () => { const raw = toEnDigits(mobileInput.value).replace(/[^\d]/g, ''); if (!raw) return; const val = normalizeTo09(raw); if (/^09\d{9}$/.test(val)) mobileInput.value = toFaDigits(val); });
  mobileInput.addEventListener('focus', () => { const raw = toEnDigits(mobileInput.value).replace(/[^\d]/g, ''); mobileInput.value = raw; });

  // کمک‌ها
  const formatIRR = n => faNF.format(n || 0) + ' تومان';
  const stripMoney = v => toEnDigits(v).replace(/[^\d]/g, '');
  const uniqueInOrder = arr => { const seen = new Set(), out = []; arr.forEach(v => { if (v && v !== 'نیت را انتخاب کنید' && !seen.has(v)) { seen.add(v); out.push(v); } }); return out; };

  // دسته‌گل: چیدمان و هم‌پوشانی تطبیقی
  const overlapRatioByCount = n => (n <= 2 ? 0 : n === 3 ? 0.20 : n === 4 ? 0.25 : n <= 7 ? 0.30 : 0.40);
  function layoutBouquet() {
    const flowers = [...bouquet.querySelectorAll('.flower')];
    const n = flowers.length;
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flower-h')) || 40;
    bouquet.style.height = h + 'px';
    if (n === 0) { bouquet.style.width = '0px'; return; }
    const r = overlapRatioByCount(n);
    const spacing = Math.round(h * (1 - r));
    const totalW = h + (n - 1) * spacing;
    bouquet.style.width = totalW + 'px';
    flowers.forEach((el, i) => { el.style.left = (i * spacing) + 'px'; });
  }
  const getIntentKeyFromRow = row => row.dataset.intentCause || '';
  const getIntentLabelFromRow = row => (row.querySelector('.intent-trigger')?.textContent || '').trim();
  const getIntentRows = () => [...intentsWrap.querySelectorAll('.intent-row')];
  const getRowAmount = row => parseAmount(row.querySelector('.amount-select'), row.querySelector('.custom-amount'));
  const panelOutsideClosers = new WeakMap();
  const panelTriggers = new WeakMap();
  function removeOutsideCloser(panel) {
    const closer = panelOutsideClosers.get(panel);
    if (!closer) return;
    document.removeEventListener('pointerdown', closer, true);
    panelOutsideClosers.delete(panel);
  }
  function closePanelElement(panel, focusTarget = null) {
    if (!panel) return;
    removeOutsideCloser(panel);
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    (panelTriggers.get(panel) || panel.previousElementSibling)?.setAttribute('aria-expanded', 'false');
    if (focusTarget) focusTarget.focus();
  }
  function closeAllPanels() {
    document.querySelectorAll('.intent-panel.open, .amount-panel.open').forEach(panel => closePanelElement(panel));
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !thankModal?.classList.contains('show')) closeAllPanels();
  });
  function removeFlowerIfUnused(key, excludedRow = null) {
    if (!key) return;
    const stillUsed = getIntentRows().some(row => row !== excludedRow && getIntentKeyFromRow(row) === key && getRowAmount(row) > 0);
    if (!stillUsed) removeFlowerByKey(key);
  }
  function highlightFlower(key) {
    const el = bouquet.querySelector(`.flower[data-key="${CSS.escape(key)}"]`);
    if (!el) return; el.classList.remove('bloom-pulse'); void el.offsetWidth; el.classList.add('bloom-pulse');
  }
  function removeFlowerByKey(key) {
    const el = bouquet.querySelector(`.flower[data-key="${CSS.escape(key)}"]`);
    if (!el) return;
    el.classList.add('fade-out');
    setTimeout(() => {
      if (el.isConnected && el.classList.contains('fade-out')) { el.remove(); layoutBouquet(); }
    }, 420);
  }
  function ensureFlower(key) {
    let el = bouquet.querySelector(`.flower[data-key="${CSS.escape(key)}"]`);
    if (el) { el.classList.remove('fade-out'); return el; }
    el = document.createElement('img'); el.className = 'flower'; el.setAttribute('data-key', key);
    el.src = 'images/decorations/narges3.webp'; el.alt = '';
    bouquet.insertBefore(el, bouquet.firstChild);
    return el;
  }
  function flyFlowerFromRowToBouquet(row, onDone) {
    const fly = document.createElement('img'); fly.src = 'images/decorations/narges3.webp'; fly.alt = '';
    fly.style.cssText = 'position:fixed;width:42px;height:42px;pointer-events:none;z-index:2147483646;opacity:0;';
    const r = row.getBoundingClientRect(); const startX = r.left + r.width * 0.18, startY = r.top + r.height * 0.12;
    fly.style.left = startX + 'px'; fly.style.top = startY + 'px'; document.body.appendChild(fly);
    const bq = bouquet.getBoundingClientRect(); const endX = bq.left + 4, endY = bq.top + (bq.height / 2);
    const midX = (startX + endX) / 2 + (Math.random() * 60 - 30); const midY = Math.min(startY, endY) - (70 + Math.random() * 50);
    const dur = 760 + Math.random() * 420; const start = performance.now();
    requestAnimationFrame(function anim(t) {
      const k = Math.min(1, (t - start) / dur); const ease = k < .5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
      const x = (1 - ease) * (1 - ease) * startX + 2 * (1 - ease) * ease * midX + ease * ease * endX;
      const y = (1 - ease) * (1 - ease) * startY + 2 * (1 - ease) * ease * midY + ease * ease * endY;
      fly.style.opacity = String(Math.min(1, k * 1.2));
      fly.style.transform = `translate3d(${x - startX}px, ${y - startY}px, 0) scale(${.92 + .08 * k}) rotate(${(k * 20 - 10).toFixed(1)}deg)`;
      if (k < 1) requestAnimationFrame(anim); else { fly.remove(); onDone?.(); }
    });
  }
  const pendingFlowerKeys = new Set();
  function upsertFlowerForRow(row) {
    const key = getIntentKeyFromRow(row);
    if (!key || key === 'نیت را انتخاب کنید') return;
    if (!row.isConnected || getRowAmount(row) <= 0) return;
    const existed = !!bouquet.querySelector(`.flower[data-key="${CSS.escape(key)}"]`);
    if (existed || pendingFlowerKeys.has(key)) { highlightFlower(key); layoutBouquet(); return; }
    pendingFlowerKeys.add(key);
    layoutBouquet();
    flyFlowerFromRowToBouquet(row, () => {
      pendingFlowerKeys.delete(key);
      const stillUsed = getIntentRows().some(candidate => getIntentKeyFromRow(candidate) === key && getRowAmount(candidate) > 0);
      if (stillUsed) { ensureFlower(key); layoutBouquet(); highlightFlower(key); }
    });
  }

  // جای‌گذاری دسته‌گل میان «جمع مبلغ» و دکمه
  function positionBouquet() {
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flower-h')) || 40;
    const sumRect = summary.getBoundingClientRect();
    const totalRect = totalLine.getBoundingClientRect();
    const btnRect = payBtn.getBoundingClientRect();
    const minGap = Math.ceil(h * 0.70);
    const currentGap = btnRect.top - totalRect.bottom;
    const base = 6;
    const extra = Math.max(0, minGap - currentGap);
    payActions.style.marginTop = (base + extra) + 'px';
    const gapMid = ((totalRect.bottom + btnRect.top) / 2) - sumRect.top;
    bouquet.style.top = (gapMid - (h / 2)) + 'px';
    bouquet.style.left = '50%';
    bouquet.style.transform = 'translateX(-50%)';
  }

  // کنترل اسکرول بدون CLS
  function updateScrollMode() {
    const needScroll = document.documentElement.scrollHeight > window.innerHeight + 2;
    document.body.classList.toggle('scroll-allowed', needScroll);
  }

  // ساخت منوی چندسطحی با زیرمنوی بسته پیش‌فرض
  function buildMenuList(tree = [], onPick) {
    const ul = document.createElement('ul');
    (tree || []).forEach(node => {
      const li = document.createElement('li');
      if (node.menu || node.submenu) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'menu-item parent'; btn.textContent = node.title;
        btn.setAttribute('role', 'menuitem'); btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');

        const subWrap = document.createElement('div');
        subWrap.className = 'submenu'; subWrap.setAttribute('role', 'menu'); subWrap.setAttribute('aria-hidden', 'true');
        subWrap.appendChild(buildMenuList(node.menu || node.submenu, onPick));

        function openSub() {
          // بستن سایر زیرمنوهای باز در همین سطح
          li.parentElement?.querySelectorAll(':scope > li > .submenu.open').forEach(s => {
            if (s !== subWrap) { s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); s.previousElementSibling?.setAttribute('aria-expanded', 'false'); }
          });
          btn.setAttribute('aria-expanded', 'true');
          subWrap.classList.add('open'); subWrap.setAttribute('aria-hidden', 'false');
          setTimeout(() => rovingFocus(subWrap, btn), 0);
        }
        function closeSub() {
          btn.setAttribute('aria-expanded', 'false');
          subWrap.classList.remove('open'); subWrap.setAttribute('aria-hidden', 'true');
        }

        btn.addEventListener('click', (e) => { e.stopPropagation(); (btn.getAttribute('aria-expanded') === 'true') ? closeSub() : openSub(); });
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); openSub(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); closeSub(); btn.focus(); }
        });

        li.append(btn, subWrap);
      } else {
        const leaf = document.createElement('button');
        leaf.type = 'button'; leaf.className = 'menu-item'; leaf.textContent = node.title;
        leaf.setAttribute('role', 'menuitem');
        leaf.addEventListener('click', (e) => { e.stopPropagation(); onPick(node); });
        li.append(leaf);
      }
      ul.appendChild(li);
    });
    return ul;
  }
  const rovingStates = new WeakMap();
  function rovingFocus(panel, returnFocus = null) {
    const items = [...panel.querySelectorAll(':scope > ul > li > .menu-item')];
    if (!items.length) return;
    let state = rovingStates.get(panel);
    if (!state) {
      state = { items: [], index: 0, returnFocus };
      state.onKeydown = event => {
        if (!state.items.includes(event.target)) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); state.setActive(state.index + 1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); state.setActive(state.index - 1); }
        else if (event.key === 'Home') { event.preventDefault(); state.setActive(0); }
        else if (event.key === 'End') { event.preventDefault(); state.setActive(state.items.length - 1); }
        else if (event.key === 'Escape') { event.preventDefault(); closePanelElement(panel, state.returnFocus); }
      };
      panel.addEventListener('keydown', state.onKeydown);
      rovingStates.set(panel, state);
    }
    state.items = items;
    state.returnFocus = returnFocus || state.returnFocus;
    state.index = 0;
    state.setActive = index => {
      state.items[state.index].tabIndex = -1;
      state.index = (index + state.items.length) % state.items.length;
      state.items[state.index].tabIndex = 0;
      state.items[state.index].focus();
    };
    state.items.forEach((item, index) => { item.tabIndex = index === 0 ? 0 : -1; });
    state.items[0].focus();
  }
  function smartPlace(panel, trigger) {
    const r = trigger.getBoundingClientRect();
    panel.style.minWidth = Math.max(r.width, 260) + 'px';
    panel.classList.remove('drop-up');
    const probe = panel.getBoundingClientRect();
    const below = r.bottom + 8 + Math.max(probe.height, 160);
    const canBelow = below < innerHeight - 8;
    if (!canBelow) panel.classList.add('drop-up');
  }

  // ردیف نیت (منوها + دسته‌گل)
  function createIntentRow(defaultIntent = null) {
    const row = document.createElement('div'); row.className = 'intent-row';
    const defaultIntentData = typeof defaultIntent === 'string' ? resolveIntent(defaultIntent) : defaultIntent;
    const defaultCause = defaultIntentData?.cause || '';
    const defaultLabel = defaultIntentData?.title || '';
    row.dataset.intentCause = defaultCause;
    let rowResizeObserver = null;

    // افزودن/حذف
    const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'icon-btn add-intent'; addBtn.innerHTML = '<img src="images/logo/add.png" alt="+"/>';
    addBtn.addEventListener('click', () => { intentsWrap.appendChild(createIntentRow()); updateRemoveState(); updateTotalAndTitle(); updateScrollMode(); });

    const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'icon-btn remove-intent'; removeBtn.innerHTML = '<img src="images/logo/remove.png" alt="-"/>';
    removeBtn.addEventListener('click', () => {
      if (removeBtn.hasAttribute('disabled')) return;
      const key = getIntentKeyFromRow(row);
      if (key) removeFlowerIfUnused(key, row);
      rowResizeObserver?.disconnect();
      row.remove();
      updateRemoveState(); updateTotalAndTitle(); updateScrollMode();
    });

    // نیت
    const intentBox = document.createElement('div'); intentBox.className = 'intent-select';
    const intentTrigger = document.createElement('button');
    intentTrigger.type = 'button'; intentTrigger.className = 'intent-trigger'; intentTrigger.textContent = defaultLabel || 'نیت را انتخاب کنید';
    intentTrigger.dataset.intentCause = defaultCause;
    intentTrigger.setAttribute('aria-haspopup', 'menu'); intentTrigger.setAttribute('aria-expanded', 'false');

    const intentPanel = document.createElement('div'); intentPanel.className = 'intent-panel'; intentPanel.setAttribute('role', 'menu'); intentPanel.setAttribute('aria-hidden', 'true');
    if (Array.isArray(NIAT_CARDS) && NIAT_CARDS.length) {
      intentPanel.appendChild(buildMenuList(NIAT_CARDS, (picked) => {
        const previousCause = getIntentKeyFromRow(row);
        if (previousCause && previousCause !== picked.cause) {
          removeFlowerIfUnused(previousCause, row);
          resetAmountState();
        }
        intentTrigger.textContent = picked.title;
        intentTrigger.dataset.intentCause = picked.cause;
        row.dataset.intentCause = picked.cause;
        closePanel(intentTrigger, intentPanel, true);
        setAmountsEnabled(true);
        updateTotalAndTitle();
      }));
    }

    function openPanel(trigger, panel) {
      // بستن سایر پنل‌ها
      closeAllPanels();
      panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); trigger.setAttribute('aria-expanded', 'true');
      panelTriggers.set(panel, trigger);
      smartPlace(panel, trigger); setTimeout(() => rovingFocus(panel, trigger), 0);
      const closer = ev => { if (!panel.contains(ev.target) && ev.target !== trigger) closePanel(trigger, panel, true); };
      panelOutsideClosers.set(panel, closer);
      document.addEventListener('pointerdown', closer, true);
    }
    function closePanel(trigger, panel, returnFocus) {
      closePanelElement(panel, returnFocus ? trigger : null);
    }

    intentTrigger.addEventListener('click', (e) => { e.stopPropagation(); intentPanel.classList.contains('open') ? closePanel(intentTrigger, intentPanel, true) : openPanel(intentTrigger, intentPanel); });
    intentTrigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openPanel(intentTrigger, intentPanel); } });
    intentBox.append(intentTrigger, intentPanel);

    // مبلغ
    const amountHolder = document.createElement('div'); amountHolder.className = 'amount-holder';
    const amountWrap = document.createElement('div'); amountWrap.className = 'field-wrapper';
    const amountSel = document.createElement('select'); amountSel.className = 'amount-select visually-hidden'; amountSel.setAttribute('tabindex', '-1');
    amountSel.innerHTML = `
      <option value="">مبلغ را انتخاب کنید</option>
      <option value="50000">۵۰,۰۰۰</option>
      <option value="100000">۱۰۰,۰۰۰</option>
      <option value="200000">۲۰۰,۰۰۰</option>
      <option value="500000">۵۰۰,۰۰۰</option>
      <option value="custom">مبلغ دلخواه...</option>
    `;
    const amountTrigger = document.createElement('button'); amountTrigger.type = 'button'; amountTrigger.className = 'amount-trigger'; amountTrigger.textContent = 'مبلغ را انتخاب کنید';
    amountTrigger.setAttribute('aria-haspopup', 'menu'); amountTrigger.setAttribute('aria-expanded', 'false');

    const amountPanel = document.createElement('div'); amountPanel.className = 'amount-panel'; amountPanel.setAttribute('role', 'menu'); amountPanel.setAttribute('aria-hidden', 'true');
    const amountUL = document.createElement('ul');
    [...amountSel.options].forEach(opt => {
      if (!opt.value) return;
      const li = document.createElement('li');
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'menu-item'; btn.setAttribute('role', 'menuitem');
      btn.dataset.value = opt.value; btn.textContent = opt.textContent;
      btn.addEventListener('click', () => { amountSel.value = btn.dataset.value; amountTrigger.textContent = opt.textContent; handleAmountChange(); closePanel(amountTrigger, amountPanel, true); });
      li.appendChild(btn); amountUL.appendChild(li);
    });
    amountPanel.appendChild(amountUL);

    function openAmount() {
      closeAllPanels();
      amountPanel.classList.add('open'); amountPanel.setAttribute('aria-hidden', 'false'); amountTrigger.setAttribute('aria-expanded', 'true');
      panelTriggers.set(amountPanel, amountTrigger);
      smartPlace(amountPanel, amountTrigger); setTimeout(() => rovingFocus(amountPanel, amountTrigger), 0);
      const closer = ev => { if (!amountPanel.contains(ev.target) && ev.target !== amountTrigger) closePanel(amountTrigger, amountPanel, true); };
      panelOutsideClosers.set(amountPanel, closer);
      document.addEventListener('pointerdown', closer, true);
    }
    amountTrigger.addEventListener('click', (e) => { e.stopPropagation(); amountPanel.classList.contains('open') ? closePanel(amountTrigger, amountPanel, true) : openAmount(); });
    amountTrigger.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openAmount(); } });

    // همگام‌سازی تغییر بومی select مبلغ (سازگاری با autofill و ابزارها)
    amountSel.addEventListener('change', () => {
      const opt = amountSel.selectedOptions[0];
      if (opt && opt.value) { amountTrigger.textContent = opt.textContent; handleAmountChange(); }
    });

    amountWrap.append(amountTrigger, amountSel, amountPanel); amountHolder.appendChild(amountWrap);

    // مبلغ دلخواه
    const customHolder = document.createElement('div'); customHolder.className = 'custom-holder';
    const customWrap = document.createElement('div'); customWrap.className = 'field-wrapper';
    const custom = document.createElement('input'); custom.type = 'text'; custom.inputMode = 'numeric'; custom.className = 'custom-amount'; custom.placeholder = 'مبلغ دلخواه (تومان)';
    customWrap.appendChild(custom); customHolder.appendChild(customWrap);

    const syncCustomSize = () => {
      const h1 = intentTrigger.getBoundingClientRect().height || 56;
      const h2 = amountTrigger.getBoundingClientRect().height || 56;
      const avg = Math.round((h1 + h2) / 2);
      const clamped = Math.max(40, Math.min(avg, 72));
      custom.style.height = clamped + 'px';
    };
    rowResizeObserver = new ResizeObserver(syncCustomSize);
    rowResizeObserver.observe(intentTrigger); rowResizeObserver.observe(amountTrigger);

    function resetAmountState() {
      amountSel.value = '';
      custom.value = '';
      row.classList.remove('custom-visible');
      amountTrigger.textContent = 'مبلغ را انتخاب کنید';
    }

    function setAmountsEnabled(enabled) {
      amountSel.disabled = !enabled; custom.disabled = !enabled;
      if (!enabled) resetAmountState();
    }
    setAmountsEnabled(!!defaultCause);
    function handleAmountChange() {
      const isCustom = amountSel.value === 'custom';
      row.classList.toggle('custom-visible', isCustom);
      if (isCustom) {
        custom.value = '';
        removeFlowerIfUnused(getIntentKeyFromRow(row), row);
        custom.focus();
      } else if (amountSel.value) upsertFlowerForRow(row);
      if (isCustom) syncCustomSize();
      updateTotalAndTitle(); updateScrollMode();
    }
    function maybeFromCustom() {
      const raw = stripMoney(custom.value);
      custom.value = raw ? (faNF.format(parseInt(raw, 10)) + ' تومان') : '';
      updateTotalAndTitle();
      if (raw) upsertFlowerForRow(row);
      else removeFlowerIfUnused(getIntentKeyFromRow(row), row);
      updateScrollMode();
    }
    custom.addEventListener('focus', () => { custom.value = stripMoney(custom.value); });
    custom.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); maybeFromCustom(); custom.blur(); } });
    custom.addEventListener('blur', () => { maybeFromCustom(); });

    // نصب اجزا
    row.append(addBtn, intentBox, amountHolder, customHolder, removeBtn);

    return row;
  }

  function updateRemoveState() {
    const rows = [...intentsWrap.querySelectorAll('.intent-row')];
    rows.forEach(r => { const rm = r.querySelector('.remove-intent'); if (rows.length <= 1) rm.setAttribute('disabled', ''); else rm.removeAttribute('disabled'); });
  }

  // جمع کل و عنوان
  function parseAmount(sel, custom) {
    if (sel.value && sel.value !== 'custom') return parseInt(sel.value) || 0;
    if (sel.value === 'custom' && custom.value) return parseInt(toEnDigits(custom.value).replace(/[^\d]/g, '')) || 0;
    return 0;
  }
  function updateTotalAndTitle() {
    let sum = 0;
    const rows = [...intentsWrap.querySelectorAll('.intent-row')];
    const intents = uniqueInOrder(rows.map(getIntentLabelFromRow));
    rows.forEach(r => { sum += parseAmount(r.querySelector('.amount-select'), r.querySelector('.custom-amount')); });
    grandTotal.textContent = formatIRR(sum);
    if (intents.length === 0) pageTitle.textContent = 'برای انجام ثبت خیرت، اطلاعات را تکمیل کن';
    else if (intents.length === 1) pageTitle.textContent = `ثبت نیت خیر: ${intents}`;
    else pageTitle.textContent = `ثبت همزمان ${intents.length} نیت ارزشمند: ${listFa.format(intents)}`;
  }

  // شروع
  intentsWrap.appendChild(createIntentRow(initialIntent));
  updateRemoveState();
  updateTotalAndTitle();
  positionBouquet();
  layoutBouquet();
  updateScrollMode();
  window.addEventListener('resize', debounce(() => { positionBouquet(); layoutBouquet(); updateScrollMode(); }, 150));

  const ta = document.getElementById('donation-notes');
  const count = document.getElementById('notes-inline-count');
  if (ta && count) {
    const nf = new Intl.NumberFormat('fa-IR');
    const max = ta.maxLength || 313;
    const update = () => {
      if (ta.value.length > max) { ta.value = ta.value.slice(0, max); }
      const len = Math.min(ta.value.length, max);
      count.textContent = nf.format(len) + '/' + nf.format(max);
      count.classList.toggle('warn', len >= 300);
      count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
      ta.style.height = 'auto';
      ta.style.height = Math.max(ta.scrollHeight, 96) + 'px';
    };
    ta.addEventListener('beforeinput', (e) => {
      const sel = ta.selectionEnd - ta.selectionStart;
      const inserting = /insert/i.test(e.inputType);
      if (inserting && (ta.value.length - sel) >= max) e.preventDefault();
    });
    ta.addEventListener('input', update);
    ta.addEventListener('focus', update);
    update();
  }

  const trust = document.querySelector('.trust-footer');
  if (payBtn && trust) {
    const setHalfGap = () => {
      trust.style.marginTop = '';
      const orig = parseFloat(getComputedStyle(trust).marginTop) || 0;
      const pb = payBtn.getBoundingClientRect().bottom;
      const tt = trust.getBoundingClientRect().top;
      const gap = Math.max(0, tt - pb);
      const delta = gap - gap / 2;
      trust.style.marginTop = Math.max(0, orig - delta) + 'px';
    };
    setHalfGap();
    window.addEventListener('resize', debounce(setHalfGap, 150));
  }

  // ارسال
  const fullname = document.getElementById('fullname'), mobile = document.getElementById('mobile');
  const err = (el, msg) => {
    const g = el.closest('.input-group');
    const s = g.querySelector('.error');
    s.textContent = msg || '';
    g.classList.toggle('has-error', !!msg);
  };
  // پاک‌سازی خطا هنگام اصلاح فیلد
  [fullname, mobile, provinceSel, citySel].forEach(el => {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => err(el, ''));
  });

  let paymentRequestInFlight = false;
  function buildPaymentPayload(rows, normalizeMobile) {
    const items = rows.map(row => ({
      cause: getIntentKeyFromRow(row),
      title: getIntentLabelFromRow(row),
      amount: parseAmount(row.querySelector('.amount-select'), row.querySelector('.custom-amount'))
    }));
    const payload = {
      amountUnit: 'toman',
      amount: items.reduce((sum, item) => sum + item.amount, 0),
      customer: {
        fullName: fullname.value.trim(),
        mobile: normalizeMobile,
        province: provinceSel.value,
        city: citySel.value
      },
      intents: items,
      notes: document.getElementById('donation-notes')?.value.trim() || ''
    };
    if (paymentConfig.returnUrl) payload.returnUrl = String(paymentConfig.returnUrl);
    return payload;
  }
  async function createPaymentRequest(payload) {
    const endpointValue = String(paymentConfig.createPaymentUrl || '').trim();
    if (!endpointValue) {
      const error = new Error('gateway-not-configured');
      error.code = 'gateway-not-configured';
      throw error;
    }
    let endpoint;
    try { endpoint = new URL(endpointValue, location.href); } catch {
      const error = new Error('gateway-invalid-endpoint');
      error.code = 'gateway-invalid-endpoint';
      throw error;
    }
    if (!['http:', 'https:'].includes(endpoint.protocol) || (location.protocol === 'https:' && endpoint.protocol !== 'https:')) {
      const error = new Error('gateway-insecure-endpoint');
      error.code = 'gateway-insecure-endpoint';
      throw error;
    }
    const timeoutMs = Math.max(1000, Number(paymentConfig.requestTimeoutMs) || 15000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(endpoint.href, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      const wrapped = new Error(error.name === 'AbortError' ? 'gateway-timeout' : 'gateway-network-error');
      wrapped.code = error.name === 'AbortError' ? 'gateway-timeout' : 'gateway-network-error';
      throw wrapped;
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const error = new Error('gateway-http-error');
      error.code = 'gateway-http-error';
      throw error;
    }
    let result;
    try { result = await response.json(); } catch {
      const error = new Error('gateway-invalid-response');
      error.code = 'gateway-invalid-response';
      throw error;
    }
    let redirect;
    try { redirect = new URL(String(result?.redirectUrl || '')); } catch {
      const error = new Error('gateway-invalid-redirect');
      error.code = 'gateway-invalid-redirect';
      throw error;
    }
    const allowedOrigins = Array.isArray(paymentConfig.allowedRedirectOrigins)
      ? paymentConfig.allowedRedirectOrigins.map(origin => String(origin).replace(/\/$/, ''))
      : [];
    if (!allowedOrigins.includes(redirect.origin) || (location.protocol === 'https:' && redirect.protocol !== 'https:')) {
      const error = new Error('gateway-untrusted-redirect');
      error.code = 'gateway-untrusted-redirect';
      throw error;
    }
    return redirect.href;
  }
  function showPaymentStatus(title, message, actionLabel = 'بستن', action = () => closeThankModal()) {
    if (thankTitle) thankTitle.textContent = title;
    if (thankMessage) thankMessage.textContent = message;
    if (redirectBtn) redirectBtn.textContent = actionLabel;
    modalAction = action;
    openThankModal();
  }
  const paymentErrorMessages = {
    'gateway-not-configured': 'اتصال درگاه بانکی هنوز برای این محیط تنظیم نشده است. پس از ثبت endpoint معتبر سازمان، پرداخت فعال می‌شود.',
    'gateway-invalid-endpoint': 'نشانی سرویس پرداخت معتبر نیست و درخواست ارسال نشد.',
    'gateway-insecure-endpoint': 'سرویس پرداخت در محیط رسمی باید فقط با HTTPS در دسترس باشد.',
    'gateway-timeout': 'پاسخی از سرویس پرداخت دریافت نشد؛ لطفاً دوباره تلاش کنید.',
    'gateway-network-error': 'ارتباط با سرویس پرداخت برقرار نشد؛ لطفاً اتصال شبکه را بررسی کنید.',
    'gateway-http-error': 'سرویس پرداخت درخواست را نپذیرفت؛ لطفاً بعداً دوباره تلاش کنید.',
    'gateway-invalid-response': 'پاسخ سرویس پرداخت قابل پردازش نیست.',
    'gateway-invalid-redirect': 'سرویس پرداخت نشانی بازگشت معتبری ارسال نکرد.',
    'gateway-untrusted-redirect': 'نشانی بازگشت درگاه در allowlist پروژه ثبت نشده است.'
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (paymentRequestInFlight) return;
    let ok = true;
    const mobileRaw = toEnDigits(mobile.value).replace(/[^\d]/g, '');
    const norm = (v) => { let x = v; if (x.startsWith('0098')) x = x.slice(4); else if (x.startsWith('98')) x = x.slice(2); if (!x.startsWith('0')) x = '0' + x; return x; };
    if (fullname.value.trim().length < 3) { err(fullname, 'نام کامل را وارد کنید'); ok = false; }
    if (!/^09\d{9}$/.test(norm(mobileRaw))) { err(mobile, 'شماره موبایل صحیح نیست'); ok = false; }
    if (!provinceSel.value) { err(provinceSel, 'استان را انتخاب کنید'); ok = false; }
    if (!citySel.value) { err(citySel, 'شهر را انتخاب کنید'); ok = false; }

    // اعتبارسنجی نیت و مبلغ هر ردیف — بدون مبلغ، ثبت پرداخت معنا ندارد
    const intentError = document.getElementById('intent-error');
    let intentMsg = '';
    for (const r of intentsWrap.querySelectorAll('.intent-row')) {
      const sel = r.querySelector('.amount-select');
      const cst = r.querySelector('.custom-amount');
      const label = getIntentLabelFromRow(r);
      if (!getIntentKeyFromRow(r) || !label || label === 'نیت را انتخاب کنید') { intentMsg = 'لطفاً ابتدا نیت را انتخاب کنید.'; break; }
      if (!parseAmount(sel, cst)) { intentMsg = `برای نیت «${label}» لطفاً مبلغ را انتخاب کنید.`; break; }
    }
    if (intentMsg) {
      intentError.textContent = intentMsg;
      intentError.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
      ok = false;
    } else {
      intentError.textContent = '';
    }
    if (!ok) return;

    const rows = [...intentsWrap.querySelectorAll('.intent-row')];
    const name = fullname.value.trim();
    if (paymentConfig.mode === 'demo') {
      const intents = uniqueInOrder(rows.map(getIntentLabelFromRow));
      const joined = intents.length ? listFa.format(intents) : 'نیت خیر';
      showPaymentStatus(
        'تست پرداخت با موفقیت انجام شد',
        intents.length <= 1
          ? `${name} عزیز، مسیر آزمایشی نیت «${joined}» ثبت شد؛ برای ادامهٔ تست به صفحهٔ انتخاب نیت‌ها برمی‌گردید.`
          : `${name} نیک‌اندیش، مسیر آزمایشی ${intents.length} نیت (${joined}) ثبت شد؛ برای ادامهٔ تست به صفحهٔ انتخاب نیت‌ها برمی‌گردید.`,
        'بازگشت به انتخاب نیت‌ها',
        () => location.assign('cards-form.html')
      );
      return;
    }
    if (paymentConfig.mode !== 'gateway') {
      showPaymentStatus('حالت پرداخت تنظیم نشده است', 'حالت پرداخت پروژه معتبر نیست؛ برای تست از «demo» و برای انتشار رسمی از «gateway» استفاده کنید.');
      return;
    }
    const normalizedMobile = norm(mobileRaw);
    const payload = buildPaymentPayload(rows, normalizedMobile);
    paymentRequestInFlight = true;
    payBtn.disabled = true;
    payBtn.setAttribute('aria-busy', 'true');
    const originalButtonText = payBtn.textContent;
    payBtn.textContent = 'در حال اتصال به درگاه…';
    try {
      const redirectUrl = await createPaymentRequest(payload);
      if (!prefersReducedMotion) {
        const b = (e.submitter || payBtn).getBoundingClientRect();
        pigeons.burstAt(b.left + b.width / 2, b.top + b.height / 2);
      }
      showPaymentStatus('در حال انتقال به درگاه بانکی', `${name} عزیز، درخواست پرداخت شما آمادهٔ انتقال است.`, 'بستن');
      location.assign(redirectUrl);
    } catch (error) {
      const message = paymentErrorMessages[error.code] || 'اتصال به درگاه انجام نشد؛ لطفاً بعداً دوباره تلاش کنید.';
      showPaymentStatus('اتصال به درگاه انجام نشد', message);
    } finally {
      paymentRequestInFlight = false;
      payBtn.disabled = false;
      payBtn.removeAttribute('aria-busy');
      payBtn.textContent = originalButtonText;
    }
  });

  const pigeons = new PigeonGlide();
});
/* ساخته شده توسط مهدی باغبانپور بروجنی */
