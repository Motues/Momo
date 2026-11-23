/** 日期格式化工具，入参支持 `YYYY-MM-DD` 字符串或 Date 对象 */
const ensureDate = (input: string | Date): Date => {
  if (input instanceof Date) return input;
  
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const normalizeLocale = (lang: string) => {
  return lang?.replace('_', '-') || 'en-US';
};

function addPanguSpace(text: string): string {
  return text
    // 中英文之间加空格
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
}

/** 返回「月 日」 */
export function formatMonthDay(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return lang.toLowerCase().startsWith('zh') ? addPanguSpace(formatted) : formatted;
}
/** 返回「年 月 日」 */
export function formatFullDate(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(normalizeLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

  return lang.startsWith('zh') ? addPanguSpace(formatted) : formatted;
}