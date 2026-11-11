/* به نام خداوند بخشنده مهربان */
/* Copyright © 2026 Mahdi Baghbanpour. Proprietary project; see LICENSE.md. */

/*
 * ویجت درج نیت‌های خیر در صفحهٔ سازمان.
 *
 * استفادهٔ حداقلی در صفحهٔ میزبان:
 * <button type="button" data-basij-intents>نمایش نیات خیر</button>
 * <script src="https://mahdi-arts.github.io/Basij-Tamin/intent-widget.js" defer></script>
 *
 * مسیر پرداخت را می‌توان با data-payment-url روی script تغییر داد.
 */
(function (window, document) {
  'use strict';

  const currentScript = document.currentScript;
  const scriptBase = currentScript?.src
    ? new URL('./', currentScript.src).href
    : new URL('./', document.baseURI).href;
  const baseUrl = ensureTrailingSlash(currentScript?.dataset.baseUrl || scriptBase);
  const dataVersion = currentScript?.dataset.dataVersion || '7.0.1';
  const defaultPaymentUrl = currentScript?.dataset.paymentUrl || 'payment-form.html';
  const shared = {
    cssLoaded: false,
    dataPromise: null,
    instanceCount: 0
  };

  function ensureTrailingSlash(value) {
    return String(value || '').endsWith('/') ? String(value) : `${value}/`;
  }

  function assetUrl(path) {
    return new URL(path, baseUrl).href;
  }

  function loadStyles() {
    if (shared.cssLoaded || document.querySelector('link[data-basij-intent-widget]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = assetUrl(`intent-widget.css?v=${encodeURIComponent(dataVersion)}`);
    link.dataset.basijIntentWidget = 'true';
    document.head.appendChild(link);
    shared.cssLoaded = true;
  }

  function loadScriptOnce(src, marker) {
    const existing = document.querySelector(`script[data-basij-source="${marker}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.basijSource = marker;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`بارگذاری ${marker} انجام نشد.`));
      document.head.appendChild(script);
    });
  }

  function ensureIntentData() {
    if (Array.isArray(window.NIAT_CARDS)) return Promise.resolve(window.NIAT_CARDS);
    if (!shared.dataPromise) {
      shared.dataPromise = loadScriptOnce(assetUrl(`src/js/utils.js?v=${encodeURIComponent(dataVersion)}`), 'utils')
        .then(() => loadScriptOnce(assetUrl(`src/js/data.js?v=${encodeURIComponent(dataVersion)}`), 'data'))
        .then(() => {
          if (!Array.isArray(window.NIAT_CARDS)) {
            throw new Error('منبع canonical نیت‌ها در دسترس نیست.');
          }
          return window.NIAT_CARDS;
        });
    }
    return shared.dataPromise;
  }

  function getChildren(item) {
    if (Array.isArray(item?.menu)) return item.menu;
    if (Array.isArray(item?.submenu)) return item.submenu;
    return [];
  }

  function visibleMenuItems(list) {
    return [...list.children]
      .map((item) => item.querySelector(':scope > [role="menuitem"]'))
      .filter(Boolean);
  }

  class IntentWidget {
    constructor(trigger, index) {
      this.trigger = trigger;
      this.index = index;
      this.isOpen = false;
      this.isRendered = false;
      this.menu = null;
      this.activeCard = null;
      this.transitionId = 0;

      this.trigger.type = 'button';
      this.trigger.classList.add('bt-intent-trigger');
      this.trigger.setAttribute('aria-expanded', 'false');

      const panelId = this.trigger.getAttribute('aria-controls') || `basij-intents-panel-${index + 1}`;
      this.trigger.setAttribute('aria-controls', panelId);
      this.panel = document.createElement('section');
      this.panel.id = panelId;
      this.panel.className = 'bt-intent-widget';
      this.panel.hidden = true;
      this.panel.inert = true;
      this.panel.setAttribute('aria-hidden', 'true');
      this.panel.setAttribute('aria-label', 'فهرست نیت‌های خیر');
      this.panel.innerHTML = `
        <div class="bt-intent-widget__inner">
          <p class="bt-intent-widget__status" role="status" aria-live="polite">در حال آماده‌سازی نیت‌ها…</p>
          <div class="bt-intent-widget__cards" hidden></div>
          <div class="bt-intent-widget__menu" hidden></div>
        </div>`;
      this.trigger.insertAdjacentElement('afterend', this.panel);
      this.status = this.panel.querySelector('.bt-intent-widget__status');
      this.cards = this.panel.querySelector('.bt-intent-widget__cards');
      this.menuRegion = this.panel.querySelector('.bt-intent-widget__menu');

      this.trigger.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.toggle(true);
        }
      });
      this.trigger.addEventListener('click', () => this.toggle(false));
      this.panel.addEventListener('keydown', (event) => this.handlePanelKeydown(event));
    }

    toggle(focusFirst) {
      if (this.isOpen) {
        this.close(true);
      } else {
        this.open(focusFirst);
      }
    }

    open(focusFirst = false) {
      this.isOpen = true;
      this.transitionId += 1;
      const transitionId = this.transitionId;
      this.trigger.setAttribute('aria-expanded', 'true');
      this.panel.hidden = false;
      this.panel.inert = false;
      this.panel.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        if (this.isOpen && transitionId === this.transitionId) this.panel.classList.add('is-open');
      });

      this.render().then(() => {
        if (focusFirst && this.isOpen) this.cards.querySelector('.bt-intent-card')?.focus();
      });
    }

    close(returnFocus = false) {
      this.isOpen = false;
      this.transitionId += 1;
      this.closeMenu(false);
      this.trigger.setAttribute('aria-expanded', 'false');
      this.panel.setAttribute('aria-hidden', 'true');
      this.panel.inert = true;
      this.panel.classList.remove('is-open');
      const transitionId = this.transitionId;
      window.setTimeout(() => {
        if (!this.isOpen && transitionId === this.transitionId) this.panel.hidden = true;
      }, 280);
      if (returnFocus) this.trigger.focus();
    }

    async render() {
      if (this.isRendered) return;
      try {
        const catalog = await ensureIntentData();
        const topLevel = catalog.filter((item) => item.id);
        this.cards.replaceChildren(...topLevel.map((item, index) => this.createCard(item, index)));
        this.status.hidden = true;
        this.cards.hidden = false;
        this.isRendered = true;
      } catch (error) {
        this.status.textContent = 'بارگذاری فهرست نیت‌ها انجام نشد. لطفاً دوباره تلاش کنید.';
        this.status.classList.add('is-error');
        this.status.setAttribute('role', 'alert');
        console.error('[Basij Intent Widget]', error);
      }
    }

    createCard(intent, index) {
      const card = document.createElement('button');
      const children = getChildren(intent);
      card.type = 'button';
      card.className = 'bt-intent-card';
      card.dataset.intentId = intent.id;
      card.setAttribute('aria-label', intent.title);
      if (children.length) {
        card.setAttribute('aria-haspopup', 'menu');
        card.setAttribute('aria-expanded', 'false');
      }

      const image = document.createElement('img');
      image.src = assetUrl(`images/cards/card-${String(index + 1).padStart(2, '0')}.webp`);
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        image.onerror = null;
        image.src = assetUrl('images/cards/fallback.webp');
      });
      const label = document.createElement('span');
      label.className = 'bt-intent-card__label';
      label.textContent = intent.title;
      card.append(image, label);

      card.addEventListener('click', (event) => {
        if (children.length) {
          this.openMenu(intent, card, event.detail === 0);
        } else {
          this.navigate(intent);
        }
      });
      card.addEventListener('keydown', (event) => this.handleCardKeydown(event, card));
      return card;
    }

    handleCardKeydown(event, card) {
      const cards = [...this.cards.querySelectorAll('.bt-intent-card')];
      const index = cards.indexOf(card);
      if (index < 0) return;
      let targetIndex = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = Math.min(cards.length - 1, index + 1);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = Math.max(0, index - 1);
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = cards.length - 1;
      if (targetIndex !== null) {
        event.preventDefault();
        cards[targetIndex].focus();
      }
    }

    buildMenu(items) {
      const list = document.createElement('ul');
      list.className = 'bt-intent-menu__list';
      list.setAttribute('role', 'menu');
      items.forEach((item) => {
        const children = getChildren(item);
        const li = document.createElement('li');
        li.className = 'bt-intent-menu__item';
        if (children.length) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'bt-intent-menu__option';
          button.setAttribute('role', 'menuitem');
          button.setAttribute('aria-haspopup', 'menu');
          button.setAttribute('aria-expanded', 'false');
          button.textContent = item.title;
          const childList = this.buildMenu(children);
          childList.hidden = true;
          childList.classList.add('is-submenu');
          button.addEventListener('click', (event) => {
            const opening = button.getAttribute('aria-expanded') !== 'true';
            this.closeSiblingMenus(list, li);
            button.setAttribute('aria-expanded', String(opening));
            childList.hidden = !opening;
            li.classList.toggle('is-expanded', opening);
            if (opening && event.detail === 0) childList.querySelector('[role="menuitem"]')?.focus();
          });
          li.append(button, childList);
        } else {
          const link = document.createElement('a');
          link.className = 'bt-intent-menu__option';
          link.setAttribute('role', 'menuitem');
          link.href = this.paymentUrl(item);
          link.textContent = item.title;
          li.appendChild(link);
        }
        list.appendChild(li);
      });
      return list;
    }

    closeSiblingMenus(list, excluded) {
      [...list.children].forEach((item) => {
        if (item === excluded) return;
        const button = item.children[0];
        const childList = item.children[1];
        if (button?.getAttribute('role') === 'menuitem' && childList?.getAttribute('role') === 'menu') {
          button.setAttribute('aria-expanded', 'false');
          childList.hidden = true;
          item.classList.remove('is-expanded');
        }
      });
    }

    openMenu(intent, card, focusFirst = false) {
      this.closeMenu(false);
      const menu = document.createElement('div');
      menu.className = 'bt-intent-menu';
      menu.setAttribute('role', 'region');
      menu.setAttribute('aria-label', `گزینه‌های ${intent.title}`);

      const heading = document.createElement('div');
      heading.className = 'bt-intent-menu__heading';
      heading.textContent = `انتخاب از ${intent.title}`;
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'bt-intent-menu__back';
      back.textContent = 'بازگشت به کارت‌ها';
      back.addEventListener('click', () => this.closeMenu(true));
      menu.append(heading, back, this.buildMenu(getChildren(intent)));
      this.menuRegion.replaceChildren(menu);
      this.menuRegion.hidden = false;
      this.menu = menu;
      this.activeCard = card;
      card.setAttribute('aria-expanded', 'true');
      if (focusFirst) menu.querySelector('[role="menuitem"]')?.focus();
    }

    handlePanelKeydown(event) {
      if (event.key === 'Escape') {
        if (this.menu) {
          event.preventDefault();
          this.closeMenu(true);
        } else if (this.isOpen) {
          event.preventDefault();
          this.close(true);
        }
        return;
      }
      const option = event.target.closest?.('[role="menuitem"]');
      if (!option || !this.menu) return;
      const list = option.parentElement?.parentElement;
      if (!list || list.getAttribute('role') !== 'menu') return;
      const options = visibleMenuItems(list);
      const index = options.indexOf(option);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = event.key === 'ArrowDown'
          ? (index + 1) % options.length
          : (index - 1 + options.length) % options.length;
        options[next]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
      } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && option.tagName === 'BUTTON') {
        event.preventDefault();
        if (event.key === 'ArrowRight' && option.getAttribute('aria-expanded') !== 'true') {
          option.click();
        } else if (event.key === 'ArrowLeft' && option.getAttribute('aria-expanded') === 'true') {
          option.click();
        } else if (event.key === 'ArrowLeft' && list.classList.contains('is-submenu')) {
          const parentItem = list.parentElement;
          const parentOption = parentItem?.children[0];
          parentOption?.setAttribute('aria-expanded', 'false');
          list.hidden = true;
          parentItem?.classList.remove('is-expanded');
          parentOption?.focus();
        }
      }
    }

    closeMenu(returnFocus = false) {
      if (!this.menu) return;
      const card = this.activeCard;
      card?.setAttribute('aria-expanded', 'false');
      this.menu.remove();
      this.menu = null;
      this.activeCard = null;
      this.menuRegion.hidden = true;
      if (returnFocus) card?.focus();
    }

    paymentUrl(intent) {
      const url = new URL(defaultPaymentUrl, baseUrl);
      url.searchParams.set('cause', intent.cause);
      return url.href;
    }

    navigate(intent) {
      window.location.assign(this.paymentUrl(intent));
    }
  }

  function init() {
    loadStyles();
    document.querySelectorAll('[data-basij-intents]').forEach((trigger, index) => {
      if (!trigger.__basijIntentWidget) {
        shared.instanceCount += 1;
        trigger.__basijIntentWidget = new IntentWidget(trigger, shared.instanceCount || index + 1);
      }
    });
  }

  window.BasijIntentWidget = Object.freeze({ init });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);

/* ساخته شده توسط مهدی باغبانپور بروجنی */
