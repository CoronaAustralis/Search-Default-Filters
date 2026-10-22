import { defaults, LISTS, TIMES, steps } from './model.js';
import { t, localizeDocument } from './i18n.js';
localizeDocument(document);
const form = document.querySelector('form');
const status = document.querySelector('#status');
let engineId = location.hash === '#bing' ? 'bing' : 'google';
const drafts = {};
const field = name => form.elements.namedItem(name);
function message(text, error = false) { status.textContent = text; status.classList.toggle('error', error); if (error) status.focus(); }
function addRow(key, row = { value: '', enabled: true }) {
  const container = document.querySelector(`[data-list="${key}"]`);
  const wrapper = document.createElement('div'); wrapper.className = 'row';
  const label = document.createElement('label');
  const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = row.enabled; enabled.name = `${key}-enabled`;
  label.append(enabled, t('enabled'));
  const input = document.createElement('input'); input.type = 'text'; input.name = `${key}-value`; input.value = row.value; input.maxLength = 2000; input.setAttribute('aria-label', t(key));
  if (key.toLowerCase().includes('sites')) { input.spellcheck = false; input.autocapitalize = 'off'; input.setAttribute('autocorrect', 'off'); }
  const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = t('delete'); remove.setAttribute('aria-label', t('deleteItem', t(key)));
  remove.addEventListener('click', () => { wrapper.remove(); updatePreview(); });
  wrapper.append(label, input, remove); container.append(wrapper);
  return input;
}
for (const key of LISTS) {
  const section = document.createElement('section'); section.className = 'list';
  const heading = document.createElement('h3'); heading.textContent = t(key);
  const rows = document.createElement('div'); rows.dataset.list = key;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'add'; button.textContent = t('addItem', t(key));
  button.addEventListener('click', () => addRow(key).focus());
  section.append(heading, rows, button);
  document.querySelector(key.toLowerCase().includes('sites') ? '#website-lists' : '#content-lists').append(section);
}
function read() {
  const config = defaults(engineId);
  config.enabled = field('enabled').checked;
  for (const key of LISTS) config[key] = [...document.querySelectorAll(`[data-list="${key}"] .row`)].map(row => ({ value: row.querySelector('[type="text"]').value, enabled: row.querySelector('[type="checkbox"]').checked })).filter(row => row.value.trim());
  for (const key of ['time', ...(engineId === 'google' ? ['startDate', 'endDate'] : [])]) config[key] = field(key).value;
  if (engineId === 'google') config.verbatim = field('verbatim').checked;
  return config;
}
function choices(name, values, value) {
  const select = field(name); select.replaceChildren();
  for (const [code, label] of Object.entries(values)) { const option = document.createElement('option'); option.value = code; option.textContent = t(label); select.append(option); }
  select.value = value;
}
function render() {
  const config = drafts[engineId];
  document.querySelector('#engine-name').textContent = engineId === 'google' ? 'Google' : 'Bing';
  document.querySelectorAll('[data-engine]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.engine === engineId)));
  for (const key of LISTS) { document.querySelector(`[data-list="${key}"]`).replaceChildren(); for (const row of config[key]) addRow(key, row); }
  field('enabled').checked = config.enabled;
  choices('time', TIMES[engineId], config.time);
  const google = engineId === 'google';
  document.querySelector('#verbatim-label').hidden = !google;
  document.querySelector('#verbatim-hint').hidden = !google;
  if (google) { field('verbatim').checked = config.verbatim; field('startDate').value = config.startDate; field('endDate').value = config.endDate; }
  updatePreview();
}
function updatePreview() {
  const config = read();
  document.querySelector('#dates').hidden = engineId !== 'google' || config.time !== 'custom';
  for (const key of ['startDate', 'endDate']) field(key).required = engineId === 'google' && config.time === 'custom';
  let operations = [];
  if (config.enabled && !(config.time === 'custom' && (!config.startDate || !config.endDate))) operations = steps(engineId, config);
  document.querySelector('#preview').textContent = [t('sampleQuery'), ...operations.filter(op => op.kind === 'query').map(op => op.text)].join(' ');
  const params = new Map();
  for (const op of operations.filter(op => op.kind === 'param')) params.set(op.key, [params.get(op.key), op.value].filter(Boolean).join(op.key === 'filters' ? ' ' : ','));
  document.querySelector('#preview-params').textContent = [...params].map(([key, value]) => `${key}=${value}`).join(' · ') || t('none');
}
async function save(engine) {
  const savingEngine = engineId;
  form.querySelector('[type="submit"]').disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'save', engineId: savingEngine, engine });
    if (!response.ok) throw new Error(response.error);
    drafts[savingEngine] = response.engine; if (engineId === savingEngine) render(); message(t('saved'));
  } catch (error) { message(t('saveFailed', error.message), true); }
  finally { form.querySelector('[type="submit"]').disabled = false; }
}
form.addEventListener('submit', async event => { event.preventDefault(); await save(read()); });
form.addEventListener('input', () => { message(''); updatePreview(); });
form.addEventListener('change', updatePreview);
document.querySelectorAll('[data-engine]').forEach(button => button.addEventListener('click', () => { drafts[engineId] = read(); engineId = button.dataset.engine; location.hash = engineId; render(); message(''); }));
document.querySelector('#reset').addEventListener('click', async () => { await save(defaults(engineId)); });
try {
  const response = await chrome.runtime.sendMessage({ type: 'get' });
  if (!response.ok) throw new Error(response.error);
  Object.assign(drafts, response.config.engines); render(); if (response.installError) message(response.installError, true);
} catch (error) { message(t('readFailed', error.message), true); }
