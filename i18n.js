// Chrome's UI language is the only preference: all Chinese variants use Simplified Chinese.
export function languageFor(uiLanguage = '') {
  return uiLanguage.toLowerCase().replace('_', '-').split('-')[0] === 'zh' ? 'zh-CN' : 'en';
}

export function uiLanguage() {
  return languageFor(globalThis.chrome?.i18n?.getUILanguage() ?? globalThis.navigator?.language ?? 'en');
}

// [English, Simplified Chinese]. Keep user-entered queries and configuration values untranslated.
const messages = {
  appName: ['Search Default Filters', '搜索默认筛选'],
  optionsTitle: ['Settings · Search Default Filters', '设置 · 搜索默认筛选'],
  heading: ['Start every search with your preferences', '让搜索从你的偏好开始'],
  intro: ['Configure Google and Bing separately. Choices made on the search page take priority.', 'Google 与 Bing 独立配置。页面上明确选择的条件优先于默认筛选。'],
  engines: ['Search engines', '搜索引擎'],
  enableDefaults: ['Enable default filters', '启用默认筛选'],
  enabled: ['Enabled', '启用'],
  websites: ['Websites', '网站'],
  websiteHint: ['Enter a domain, without patterns or wildcards. csdn.net includes its subdomains; blog.csdn.net limits the search to that branch. No www is added. Full URLs are also accepted and converted to domains.', '直接填写域名，无需正则或通配符。例如 csdn.net 包含该站及其子域名；blog.csdn.net 只限定该子域范围。不自动添加 www。也支持从完整网址提取域名。'],
  sites: ['Allowed websites', '限定网站'],
  excludedSites: ['Excluded websites', '排除网站'],
  words: ['Required words', '必须包含词'],
  excludedWords: ['Excluded words or phrases', '排除词或短语'],
  phrases: ['Exact phrases', '完整短语'],
  addItem: ['＋ Add: {0}', '＋ 添加{0}'],
  delete: ['Delete', '删除'],
  deleteItem: ['Delete item: {0}', '删除{0}条目'],
  content: ['Search content', '搜索内容'],
  contentHint: ['Use required words for single words and exact phrases for consecutive text. Search engines may relax matching conditions.', '必须包含词用于单个词语；连续文字请用完整短语。搜索引擎可能放宽匹配条件。'],
  timeAndOther: ['Time and other options', '时间及其他'],
  timeRange: ['Time range', '时间范围'],
  anyTime: ['Any time', '不限'],
  pastHour: ['Past hour', '过去一小时'],
  pastDay: ['Past day', '过去一天'],
  past24Hours: ['Past 24 hours', '过去 24 小时'],
  pastWeek: ['Past week', '过去一周'],
  pastMonth: ['Past month', '过去一个月'],
  pastYear: ['Past year', '过去一年'],
  customDates: ['Custom dates', '自定义日期'],
  startDate: ['Start date', '开始日期'],
  endDate: ['End date', '结束日期'],
  verbatim: ['Verbatim', '逐字匹配'],
  verbatimHint: ['Choose either verbatim or a time filter; Google currently cannot apply both.', '与时间筛选二选一，Google 当前无法同时执行。'],
  example: ['Search example', '搜索示例'],
  exampleHint: ['This preview uses “climate research” and your current edits. Explicit page filters may change what is sent.', '示例原文固定为“气候研究”，预览当前编辑内容。页面显式条件可改变最终发送内容。'],
  sampleQuery: ['climate research', '气候研究'],
  originalQuery: ['Original query', '用户原文'],
  sentQuery: ['Query sent', '实际发送内容'],
  parameters: ['Filter parameters', '筛选参数'],
  none: ['None', '无'],
  saveEngine: ['Save this engine', '保存此引擎'],
  resetEngine: ['Reset this engine', '恢复此引擎默认'],
  saveHint: ['Changes apply to new searches only. Existing results will not refresh.', '保存仅影响后续新搜索，当前结果页不会刷新。'],
  saved: ['Saved. URLs have been converted to domains. Changes apply to new searches only.', '已保存。网址已转换为主机名；仅对后续新搜索生效。'],
  saveFailed: ['Not saved. Your previous valid settings are unchanged.\n{0}', '未保存，上一份有效配置保持不变。\n{0}'],
  readFailed: ['Could not read settings: {0}', '无法读取配置：{0}'],
  popupIntro: ['Two engines, separate settings.', '两个引擎，分别设置。'],
  conditionCount: ['{0} active conditions', '{0} 个有效条件'],
  disabledSuffix: [' · Disabled', ' · 已停用'],
  configure: ['Configure filters →', '配置筛选 →'],
  toggleSaved: ['Saved. Applies to new searches.', '已保存，对后续新搜索生效。'],
  toggleFailed: ['Not saved: {0}', '未保存：{0}'],
  invalidSite: ['Enter a valid domain or HTTP(S) URL, without wildcards or regular expressions.', '请输入有效域名或 HTTP(S) 网址，不需要通配符或正则'],
  unknownEngine: ['Unknown search engine', '未知搜索引擎'],
  invalidEnabled: ['Invalid enabled state', '启停状态无效'],
  invalidList: ['Invalid list: {0}', '{0}列表无效'],
  invalidItem: ['Invalid item: {0}', '{0}条目无效'],
  invalidText: ['{0}: use 1–120 characters without double quotes, line breaks or control characters.', '{0}：内容须为 1–120 字，不能含双引号、换行或控制字符'],
  wordHasSpaces: ['Required words cannot contain spaces. Use exact phrases instead.', '必须包含词不支持空格，请改用完整短语'],
  conflict: ['“{0}” is both included and excluded. Remove the conflicting item.', '“{0}”同时被包含和排除，请删除冲突条目'],
  invalidTime: ['Invalid time option', '时间选项无效'],
  invalidVerbatim: ['Invalid verbatim state', '逐字匹配状态无效'],
  incompatibleModes: ['Google cannot apply verbatim and a time filter together. Choose one.', '当前 Google 的逐字匹配与时间筛选不能同时生效，请二选一'],
  invalidDate: ['Invalid custom date', '自定义日期无效'],
  invalidDateRange: ['Choose both dates. The start date must not be later than the end date.', '请选择完整日期，且开始日期不能晚于结束日期'],
  unsupportedRegex: ['Chrome does not support this request rule ({0}).', 'Chrome 不支持此请求规则（{0}）。'],
  ruleMismatch: ['Installed rules do not match the expected rules.', '规则安装读回结果不一致'],
  ruleRollback: ['Rule verification failed; previous rules were restored: {0}', '规则安装校验失败，已恢复原规则：{0}'],
  unsupportedVersion: ['Unsupported settings version. Reset to defaults.', '配置版本不受支持，请恢复默认'],
  reconcileFailed: ['Search filter rule verification failed', '搜索筛选规则校验失败']
};

export function t(key, ...values) {
  const pair = messages[key];
  if (!pair) throw new Error(`Missing translation: ${key}`);
  return pair[uiLanguage() === 'zh-CN' ? 1 : 0].replace(/\{(\d+)\}/gu, (_, index) => String(values[Number(index)]));
}

export function localizeDocument(document) {
  document.documentElement.lang = uiLanguage();
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-aria-label]')) node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
}
