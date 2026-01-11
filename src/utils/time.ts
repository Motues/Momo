/**
 * 格式化日期函数，支持字符串和 Date 对象
 */
const ensureDate = (input: string | Date): Date => {
  if (input instanceof Date) return input;
  
  // 如果是字符串 YYYY-MM-DD
  const [year, month, day] = input.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const normalizeLocale = (lang: string) => {
  return lang?.replace('_', '-') || 'en-US';
};

function addPanguSpace(text: string): string {
  return text
    // 在中文字符和数字/英文之间加空格
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, '$1 $2')
    // 在数字/英文和中文字符之间加空格
    .replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
}

/**
 * 函数 1：返回 “月 日”
 */
export function formatMonthDay(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
  }).format(date);

  return lang.toLowerCase().startsWith('zh') ? addPanguSpace(formatted) : formatted;
}
/**
 * 函数 2：返回 “年 月 日”
 */
export function formatFullDate(dateInput: string | Date, lang: string = 'zh-CN'): string {
  const date = ensureDate(dateInput);
  const formatted = new Intl.DateTimeFormat(normalizeLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);

  return lang.startsWith('zh') ? addPanguSpace(formatted) : formatted;
}