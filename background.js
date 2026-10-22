import { defaultConfig, validateEngine, compileRules } from './model.js';
import { t } from './i18n.js';

async function checkedRules(engineId, engine) {
  const rules = compileRules(engineId, engine);
  for (const rule of rules) {
    const result = await chrome.declarativeNetRequest.isRegexSupported({ regex: rule.condition.regexFilter, isCaseSensitive: false, requireCapturing: rule.action.type === 'redirect' });
    if (!result.isSupported) throw new Error(t('unsupportedRegex', result.reason));
  }
  return rules;
}
const inRange = (id, engineId) => id >= (engineId === 'google' ? 1000 : 2000) && id < (engineId === 'google' ? 2000 : 3000);
async function install(engineId, engine) {
  const addRules = await checkedRules(engineId, engine);
  const old = (await chrome.declarativeNetRequest.getDynamicRules()).filter(rule => inRange(rule.id, engineId));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(rule => rule.id), addRules });
  try {
    const installed = (await chrome.declarativeNetRequest.getDynamicRules()).filter(rule => inRange(rule.id, engineId));
    const comparable = items => items.sort((a, b) => a.id - b.id).map(rule => [rule.id, rule.priority, rule.action.type, rule.action.redirect?.regexSubstitution, rule.condition.regexFilter, rule.condition.isUrlFilterCaseSensitive, rule.condition.resourceTypes, rule.condition.requestMethods]);
    if (JSON.stringify(comparable(installed)) !== JSON.stringify(comparable(addRules))) throw new Error(t('ruleMismatch'));
  } catch (error) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: addRules.map(rule => rule.id), addRules: old });
    throw new Error(t('ruleRollback', error.message));
  }
  return old;
}
export async function saveEngine(engineId, input) {
  const engine = validateEngine(engineId, input);
  return navigator.locks.request('search-filter-settings', async () => {
    const { config = defaultConfig() } = await chrome.storage.local.get('config');
    const previous = await install(engineId, engine);
    const next = { ...config, engines: { ...config.engines, [engineId]: engine } };
    try {
      await chrome.storage.local.set({ config: next, installError: '' });
    } catch (error) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: compileRules(engineId, engine).map(rule => rule.id), addRules: previous });
      throw error;
    }
    return engine;
  });
}
async function reconcile() {
  await navigator.locks.request('search-filter-settings', async () => {
    try {
      const { config = defaultConfig() } = await chrome.storage.local.get('config');
      if (config.schemaVersion !== 1) throw new Error(t('unsupportedVersion'));
      for (const engineId of ['google', 'bing']) {
        config.engines[engineId] = validateEngine(engineId, config.engines[engineId]);
        await install(engineId, config.engines[engineId]);
      }
      await chrome.storage.local.set({ config, installError: '' });
    } catch (error) {
      await chrome.storage.local.set({ installError: error.message });
      console.error(t('reconcileFailed'), error);
    }
  });
}
chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.url?.startsWith(chrome.runtime.getURL('')) || !['save', 'get'].includes(message?.type)) return;
  (async () => {
    try {
      if (message.type === 'get') {
        const { config = defaultConfig(), installError = '' } = await chrome.storage.local.get(['config', 'installError']);
        respond({ ok: true, config, installError });
      } else respond({ ok: true, engine: await saveEngine(message.engineId, message.engine) });
    } catch (error) { respond({ ok: false, error: error.message }); }
  })();
  return true;
});
