(() => {
  'use strict';
  const engineId = location.hostname.endsWith('google.com') ? 'google' : 'bing';
  const current = new URL(location.href);
  const p = current.searchParams;
  const original = p.get('_sf_q');
  const added = p.getAll('_sf_c');
  // A source is usable only when the entire sent query is explained by it.
  const trusted = original !== null && p.get('_sf_s') === `${engineId}Done` && p.get('q') === [original, ...added].join(' ');
  const selector = engineId === 'google' ? 'textarea[name="q"],input[name="q"]' : 'input[name="q"],#sb_form_q';
  const bound = new WeakSet();
  let composing = false;
  const isWeb = url => url.protocol === 'https:' && url.pathname === '/search' && (engineId === 'google' ? /^(www\.)?google\.com$/u.test(url.hostname) && !url.searchParams.get('tbm') && (!url.searchParams.get('udm') || url.searchParams.get('udm') === '14') : /^(www\.|cn\.)?bing\.com$/u.test(url.hostname) && !['images', 'video', 'news', 'chat'].includes(url.searchParams.get('scope')) && url.searchParams.get('showconv') !== '1');
  const strip = url => { for (const key of [...url.searchParams.keys()]) if (key.startsWith('_sf_')) url.searchParams.delete(key); };
  function removeAutomatic(url) {
    for (const key of ['tbs', 'filters']) {
      const values = p.getAll(`_sf_p_${key}`);
      if (!values.length || !url.searchParams.has(key)) continue;
      let value = url.searchParams.get(key);
      const separator = key === 'tbs' ? ',' : ' ';
      for (const automatic of [...values].reverse()) {
        // Remove only known whole subconditions, never arbitrary text matches.
        if (value === automatic) value = '';
        else if (value.endsWith(separator + automatic)) value = value.slice(0, -(automatic.length + 1));
        else if (value.startsWith(automatic + separator)) value = value.slice(automatic.length + 1);
        else value = value.replace(separator + automatic + separator, separator);
      }
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
  }
  function newSearch(text, target = current) {
    const url = new URL(target);
    url.pathname = '/search';
    url.hash = '';
    if (trusted) removeAutomatic(url);
    strip(url);
    url.searchParams.set('q', text);
    for (const key of ['start', 'first', 'sxsrf', 'gs_lcrp', 'form', 'FORM']) url.searchParams.delete(key);
    return url;
  }
  function carry(target) {
    const url = new URL(target);
    if (!trusted || !isWeb(url)) return url;
    const query = url.searchParams.get('q');
    if (query !== p.get('q') && query !== original) return newSearch(query ?? '', url);
    strip(url);
    url.searchParams.set('q', p.get('q'));
    for (const [key, value] of p) if (key.startsWith('_sf_') && !key.startsWith('_sf_p_') && key !== '_sf_skip') url.searchParams.append(key, value);
    const skips = new Set((p.get('_sf_skip') ?? '').split(',').filter(Boolean));
    for (const key of ['tbs', 'filters']) {
      const before = p.get(key) ?? '';
      const after = url.searchParams.get(key) ?? '';
      if (before === after) {
        for (const value of p.getAll(`_sf_p_${key}`)) url.searchParams.append(`_sf_p_${key}`, value);
      } else {
        const separator = key === 'tbs' ? ',' : ' ';
        for (const value of p.getAll(`_sf_p_${key}`)) if ((separator + after + separator).includes(separator + value + separator)) url.searchParams.append(`_sf_p_${key}`, value);
      }
      if (key === 'tbs') {
        if (/(?:^|,)(?:qdr|cdr):/u.test(before) && !/(?:^|,)(?:qdr|cdr):/u.test(after)) skips.add('time');
        if (/(?:^|,)li:/u.test(before) && !/(?:^|,)li:/u.test(after)) skips.add('verbatim');
      } else if (key === 'filters' && /ex1:/iu.test(before) && !/ex1:/iu.test(after)) skips.add('time');
    }
    if (skips.size) url.searchParams.set('_sf_skip', [...skips].join(','));
    return url;
  }
  function submit(input, event) {
    if (composing || event.isComposing || !input?.value.trim()) return;
    const target = newSearch(input.value);
    if (!isWeb(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target.href);
  }
  function suggestionText(option) {
    if (!option) return '';
    return option.getAttribute('data-query') || option.querySelector('[data-query]')?.getAttribute('data-query') || option.querySelector(engineId === 'google' ? '.wM6W7d' : '.sa_tm')?.textContent?.trim() || '';
  }
  document.addEventListener('compositionstart', () => { composing = true; }, true);
  document.addEventListener('compositionend', () => { composing = false; }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || !event.target.matches?.(selector) || composing || event.isComposing) return;
    const selected = document.getElementById(event.target.getAttribute('aria-activedescendant'));
    const suggestion = suggestionText(selected);
    if (suggestion) submit({ value: suggestion }, event);
    else if (!selected) submit(event.target, event);
  }, true);
  document.addEventListener('submit', event => {
    const input = event.target.querySelector(selector);
    if (input) submit(input, event);
  }, true);
  document.addEventListener('click', event => {
    if (!composing && (event.button ?? 0) === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      const suggestion = suggestionText(event.target.closest?.('[role="option"],.sa_sg'));
      if (suggestion) { submit({ value: suggestion }, event); return; }
    }
    const button = event.target.closest?.('button[type="submit"],input[type="submit"],#sb_form_go');
    if (button) { const input = button.form?.querySelector(selector) ?? document.querySelector(selector); if (input) submit(input, event); return; }
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    // Menu-opening anchors use the current URL plus #; let the engine open its menu.
    if (url.hash || link.getAttribute('href')?.endsWith('#')) return;
    if (isWeb(url)) {
      link.href = carry(url).href;
      if ((event.button ?? 0) === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && (!link.target || link.target === '_self')) {
        event.preventDefault(); event.stopImmediatePropagation(); location.assign(link.href);
      }
    }
  }, true);
  for (const name of ['contextmenu', 'auxclick']) document.addEventListener(name, event => {
    const link = event.target.closest?.('a[href]');
    if (link && isWeb(new URL(link.href, location.href))) link.href = carry(link.href).href;
  }, true);
  function bind(input) {
    // Parameter-only searches and fully handwritten conditions need no input patch.
    if (!trusted || !added.length) return;
    function restore() {
      if (trusted && document.activeElement !== input && input.value === p.get('q')) input.value = original;
    }
    restore();
    if (bound.has(input)) return;
    bound.add(input);
    // Engines often set .value during hydration without a DOM attribute mutation.
    const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    Object.defineProperty(input, 'value', { configurable: true, get() { return descriptor.get.call(this); }, set(value) { descriptor.set.call(this, trusted && document.activeElement !== this && value === p.get('q') ? original : value); } });
    const observer = new MutationObserver(restore);
    observer.observe(input, { attributes: true, attributeFilter: ['value'], childList: true });
    // Observe only the immediate search-box container for replacement.
    if (input.parentElement) new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) scan(node); }).observe(input.parentElement, { childList: true });
  }
  function scan(root) {
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.matches?.(selector)) bind(root);
    for (const input of root.querySelectorAll(selector)) bind(input);
  }
  // Early observer stops at DOM ready; no permanent observation of search results.
  const early = new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) scan(node); });
  early.observe(document, { subtree: true, childList: true });
  document.addEventListener('DOMContentLoaded', () => { scan(document); early.disconnect(); }, { once: true });
  window.addEventListener('pageshow', () => scan(document));
})();
