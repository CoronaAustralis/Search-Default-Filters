import { countConditions } from './model.js';
import { t, localizeDocument } from './i18n.js';
localizeDocument(document);
const status = document.querySelector('#status');
try {
  const response = await chrome.runtime.sendMessage({ type: 'get' });
  if (!response.ok) throw new Error(response.error);
  for (const engineId of ['google', 'bing']) {
    let config = response.config.engines[engineId];
    const section = document.createElement('section'); section.className = 'engine-card';
    const label = document.createElement('label');
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = config.enabled;
    label.append(toggle, engineId === 'google' ? 'Google' : 'Bing');
    const count = document.createElement('p'); count.className = 'hint'; count.textContent = t('conditionCount', countConditions(engineId, config)) + (config.enabled ? '' : t('disabledSuffix'));
    const link = document.createElement('a'); link.href = chrome.runtime.getURL(`options.html#${engineId}`); link.target = '_blank'; link.textContent = t('configure');
    toggle.addEventListener('change', async () => {
      toggle.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'save', engineId, engine: { ...config, enabled: toggle.checked } });
        if (!result.ok) throw new Error(result.error);
        config = result.engine; count.textContent = t('conditionCount', countConditions(engineId, config)) + (config.enabled ? '' : t('disabledSuffix')); status.textContent = t('toggleSaved');
      } catch (error) { toggle.checked = config.enabled; status.textContent = t('toggleFailed', error.message); }
      finally { toggle.disabled = false; }
    });
    section.append(label, count, link); document.querySelector('#engines').append(section);
  }
  status.textContent = response.installError;
} catch (error) { status.textContent = t('readFailed', error.message); }
