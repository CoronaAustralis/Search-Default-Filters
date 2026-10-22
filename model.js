// Pure configuration and engine compilers; shared by the worker, settings and tests.
import { t } from './i18n.js';
export const LISTS = ['sites', 'excludedSites', 'words', 'excludedWords', 'phrases'];
export const TIMES = {
  google: { '': 'anyTime', h: 'pastHour', d: 'pastDay', w: 'pastWeek', m: 'pastMonth', y: 'pastYear', custom: 'customDates' },
  bing: { '': 'anyTime', d: 'past24Hours', w: 'pastWeek', m: 'pastMonth' }
};
export function defaults(engineId) {
  return { enabled: false, sites: [], excludedSites: [], words: [], excludedWords: [], phrases: [], time: '', ...(engineId === 'google' ? { verbatim: false, startDate: '', endDate: '' } : {}) };
}
export function defaultConfig() { return { schemaVersion: 1, engines: { google: defaults('google'), bing: defaults('bing') } }; }
export function normalizeSite(value) {
  let url;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { throw new Error(t('invalidSite')); }
  const hostname = url.hostname.endsWith('.') ? url.hostname.slice(0, -1) : url.hostname;
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !hostname.includes('.') || hostname.includes('*') || hostname.split('.').some(part => !part)) throw new Error(t('invalidSite'));
  return hostname;
}
const active = rows => rows.filter(row => row.enabled).map(row => row.value);
export function validateEngine(engineId, input) {
  if (!Object.hasOwn(TIMES, engineId)) throw new Error(t('unknownEngine'));
  const result = defaults(engineId);
  if (typeof input?.enabled !== 'boolean') throw new Error(t('invalidEnabled'));
  result.enabled = input.enabled;
  for (const key of LISTS) {
    const label = t(key);
    if (!Array.isArray(input[key])) throw new Error(t('invalidList', label));
    const seen = new Map();
    for (const row of input[key]) {
      if (typeof row?.value !== 'string' || typeof row.enabled !== 'boolean') throw new Error(t('invalidItem', label));
      const value = key === 'sites' || key === 'excludedSites' ? normalizeSite(row.value.trim()) : row.value.trim();
      if (!value || value.length > 120 || /["\r\n\u0000-\u001f]/u.test(value)) throw new Error(t('invalidText', label));
      if (key === 'words' && /\s/u.test(value)) throw new Error(t('wordHasSpaces'));
      const previous = seen.get(value);
      seen.set(value, { value, enabled: row.enabled || !!previous?.enabled });
    }
    result[key] = [...seen.values()];
  }
  for (const [include, exclude] of [['sites', 'excludedSites'], ['words', 'excludedWords'], ['phrases', 'excludedWords']]) {
    // Conflicts are rejected even for temporarily disabled entries.
    const excluded = new Set(result[exclude].map(row => row.value));
    const conflict = result[include].find(row => excluded.has(row.value));
    if (conflict) throw new Error(t('conflict', conflict.value));
  }
  if (!Object.hasOwn(TIMES[engineId], input.time)) throw new Error(t('invalidTime'));
  result.time = input.time;
  if (engineId === 'google') {
    if (typeof input.verbatim !== 'boolean') throw new Error(t('invalidVerbatim'));
    result.verbatim = input.verbatim;
    if (result.verbatim && result.time) throw new Error(t('incompatibleModes'));
    for (const key of ['startDate', 'endDate']) {
      const value = input[key];
      if (typeof value !== 'string' || (value && (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value))) throw new Error(t('invalidDate'));
      result[key] = value;
    }
    if (result.time === 'custom' && (!result.startDate || !result.endDate || result.startDate > result.endDate)) throw new Error(t('invalidDateRange'));
  }
  return result;
}
export function countConditions(engineId, config) {
  return LISTS.reduce((sum, key) => sum + active(config[key]).length, 0) + Number(!!config.time) + Number(engineId === 'google' && config.verbatim);
}
function union(values) { return values.length > 1 ? `(${values.join(' OR ')})` : values[0]; }
export function steps(engineId, config) {
  const result = [];
  const content = [];
  const sites = active(config.sites);
  if (sites.length) content.push(union(sites.map(site => `site:${site}`)));
  for (const site of active(config.excludedSites)) content.push(`-site:${site}`);
  for (const word of new Set([...active(config.words), ...active(config.phrases)])) content.push(`"${word}"`);
  for (const word of active(config.excludedWords)) content.push(`-"${word}"`);
  if (content.length) result.push({ kind: 'query', text: content.join(' ') });
  const param = (key, value, component) => result.push({ kind: 'param', key, value, component });
  if (engineId === 'google') {
    if (config.time) {
      const date = value => { const [year, month, day] = value.split('-'); return `${Number(month)}/${Number(day)}/${year}`; };
      param('tbs', config.time === 'custom' ? `cdr:1,cd_min:${date(config.startDate)},cd_max:${date(config.endDate)}` : `qdr:${config.time}`, 'time');
    }
    if (config.verbatim) param('tbs', 'li:1', 'verbatim');
  } else {
    if (config.time) param('filters', `ex1:"ez${{ d: 1, w: 2, m: 3 }[config.time]}"`, 'time');
  }
  return result;
}
export const HOSTS = { google: '(?:www\\.)?google\\.com', bing: '(?:(?:www|cn)\\.)?bing\\.com' };
export const encode = value => encodeURIComponent(value).replace(/[!'()*]/gu, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
export function compileRules(engineId, config) {
  const base = engineId === 'google' ? 1000 : 2000;
  const root = `https://${HOSTS[engineId]}/search\\?`;
  const rules = [];
  const add = (priority, regexFilter, action) => rules.push({ id: base + rules.length, priority, action, condition: { regexFilter, isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'], requestMethods: ['get'] } });
  // Only the completed phase is allowed. Intermediate phases must keep redirecting.
  add(10000, `^${root}(?:[^#]*&)?_sf_s=${engineId}Done(?:&|$)`, { type: 'allow' });
  const nonWeb = engineId === 'google' ? '(?:tbm=[^&#]+|udm=(?:[^1&#][^&#]*|1(?:[^4&#][^&#]*)?|14[^&#]+)(?:&|$))' : '(?:scope=(?:images|video|news|chat)|showconv=1)(?:&|$)';
  add(11000, `^${root}(?:[^#]*&)?${nonWeb}`, { type: 'allow' });
  if (!config.enabled || !countConditions(engineId, config)) return rules;
  const operations = steps(engineId, config);
  const phase = index => `${engineId}${index === operations.length ? 'Done' : index}`;
  add(1, `^(${root}(?:[^&#]*&)*q=)([^&]+)([^#]*)$`, { type: 'redirect', redirect: { regexSubstitution: `\\1\\2\\3&_sf_q=\\2&_sf_s=${phase(0)}` } });
  for (const [index, op] of operations.entries()) {
    const ending = `&_sf_s=${phase(index)}$`;
    const all = `^(${root}[^#]*)${ending}`;
    const next = `&_sf_s=${phase(index + 1)}`;
    const redirect = regexSubstitution => ({ type: 'redirect', redirect: { regexSubstitution } });
    const advance = `\\1${next}`;
    if (op.kind === 'query') {
      add(100, `^(${root}(?:[^&#]*&)*q=)([^&]*)([^#]*)${ending}`, redirect(`\\1\\2%20${encode(op.text)}\\3&_sf_c=${encode(op.text)}${next}`));
    } else {
      const record = `&_sf_p_${op.key}=${encode(op.value)}`;
      add(100, all, redirect(`\\1&${op.key}=${encode(op.value)}${record}${next}`));
      const separator = op.key === 'filters' ? ' ' : ',';
      // Merge into the existing composite parameter, retaining unrelated subconditions.
      add(150, `^(${root}(?:[^&#]*&)*${op.key}=)([^&]*)([^#]*)${ending}`, redirect(`\\1\\2${encode(separator + op.value)}\\3${record}${next}`));
      // Google currently treats time and verbatim as mutually exclusive modes.
      // A mode explicitly selected on the page wins over either extension default.
      const conflict = op.key === 'filters' ? 'ex1(?::|%3A)' : '(?:qdr|cdr|li)(?::|%3A)';
      add(200, `^(${root}(?:[^&#]*&)*${op.key}=[^&]*${conflict}[^#]*)${ending}`, redirect(advance));
      add(200, `^(${root}(?:[^#]*&)?_sf_skip=[^&]*${op.component}[^#]*)${ending}`, redirect(advance));
    }
  }
  return rules;
}
export function isWebSearch(url, engineId) {
  if (url.protocol !== 'https:' || !new RegExp(`^${HOSTS[engineId]}$`, 'u').test(url.hostname) || url.pathname !== '/search' || !url.searchParams.has('q')) return false;
  return engineId === 'google' ? !url.searchParams.get('tbm') && (!url.searchParams.get('udm') || url.searchParams.get('udm') === '14') : !['images', 'video', 'news', 'chat'].includes(url.searchParams.get('scope')) && url.searchParams.get('showconv') !== '1';
}
export function sourceRecord(url, engineId) {
  const p = url.searchParams;
  if (p.get('_sf_s') !== `${engineId}Done` || !p.has('_sf_q')) return null;
  const original = p.get('_sf_q');
  const added = p.getAll('_sf_c');
  if (p.get('q') !== [original, ...added].join(' ')) return null;
  const params = {};
  for (const [key, value] of p) if (key.startsWith('_sf_p_')) (params[key.slice(6)] ??= []).push(value);
  return { engineId, original, added, params };
}
