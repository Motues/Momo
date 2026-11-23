/**
 * 从图片头部字节解析宽高（拼图插件 rehype-image-collage.ts 专用）。
 * 网络图片构建期只抓头部；超时 / 失败 / 格式不支持返回 null，由调用方兜底。
 */
import sharp from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface RemoteSizeOptions {
  /** 单个请求的超时（毫秒） */
  timeout?: number;
  /** 最多读取多少字节 */
  maxBytes?: number;
  userAgent?: string;
}

/** 远端请求的最大并发数 */
const MAX_CONCURRENT = 6;

export const REMOTE_DEFAULTS = {
  timeout: 5000,
  maxBytes: 512 * 1024,
  userAgent: 'momo-image-size',
};

// URL -> Promise<宽高 | null>：同一个地址只抓一次
const remoteCache = new Map<string, Promise<ImageDimensions | null>>();

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24) return null;
  for (let i = 0; i < 8; i++) if (buf[i] !== PNG_SIGNATURE[i]) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1; // 容错：跳过填充或脏字节
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // 无长度字段的标记：SOI、RSTn、TEM
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // EOI 或进入压缩数据：SOF 本该已经出现过
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 4 > buf.length) return null;
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 9 > buf.length) return null;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}

function gifSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 10) return null;
  const signature = buf.toString('latin1', 0, 6);
  if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return width > 0 && height > 0 ? { width, height } : null;
}

function webpSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 30) return null;
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP')
    return null;
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8X') {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  if (chunk === 'VP8 ') {
    // 关键帧起始码，后面紧跟 14 位宽高
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function bmpSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 26 || buf[0] !== 0x42 || buf[1] !== 0x4d) return null;
  const width = buf.readInt32LE(18);
  const height = Math.abs(buf.readInt32LE(22));
  return width > 0 && height > 0 ? { width, height } : null;
}

/** AVIF / HEIF：从 ISO-BMFF 的 ispe（图像空间范围）盒子取主图宽高 */
function avifSize(buf: Buffer): ImageDimensions | null {
  if (buf.length < 32 || buf.toString('latin1', 4, 8) !== 'ftyp') return null;
  const brand = buf.toString('latin1', 8, 12);
  if (!/^(avif|avis|heic|heix|hevc|mif1|msf1|jpeg)$/.test(brand)) return null;
  // ispe: [size 4]['ispe' 4][version+flags 4][width 4][height 4]
  const at = buf.indexOf('ispe', 0, 'latin1');
  if (at < 0 || at + 16 > buf.length) return null;
  const width = buf.readUInt32BE(at + 8);
  const height = buf.readUInt32BE(at + 12);
  return width > 0 && height > 0 ? { width, height } : null;
}

function svgSize(buf: Buffer): ImageDimensions | null {
  const head = buf.toString('utf8', 0, Math.min(buf.length, 4096));
  const tag = /<svg[^>]*>/i.exec(head)?.[0];
  if (!tag) return null;

  const attr = (name: string, source = tag): number | null => {
    const value = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(source)?.[1];
    if (!value || value.includes('%')) return null; // 百分比取不到实际像素
    const number = Number.parseFloat(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };

  const width = attr('width');
  const height = attr('height');
  if (width && height) return { width, height };

  const viewBox = /viewBox\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
  const parts = (viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return { width: parts[2], height: parts[3] };
  return null;
}

/** 从（可能只读到一部分的）字节里解析宽高；返回 null 表示解析不出，由调用方兜底 */
export function parseImageSize(buffer: Buffer): ImageDimensions | null {
  if (!buffer || buffer.length < 16) return null;
  return (
    pngSize(buffer) ??
    jpegSize(buffer) ??
    gifSize(buffer) ??
    webpSize(buffer) ??
    bmpSize(buffer) ??
    avifSize(buffer) ??
    svgSize(buffer) ??
    null
  );
}

/** 兜底：交给 sharp 再试一次（截断的字节有时也能读出头部信息） */
async function sharpSize(buffer: Buffer): Promise<ImageDimensions | null> {
  try {
    const { width, height } = await sharp(buffer).metadata();
    return typeof width === 'number' &&
      typeof height === 'number' &&
      width > 0 &&
      height > 0
      ? { width, height }
      : null;
  } catch {
    return null;
  }
}

/** 抓取网络图片的头部并解析宽高；超时 / 失败返回 null */
export async function fetchRemoteImageSize(
  url: string,
  options: RemoteSizeOptions = {},
): Promise<ImageDimensions | null> {
  const { timeout, maxBytes, userAgent } = { ...REMOTE_DEFAULTS, ...options };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        // 只取头部这一段；服务器不支持 Range 时会返回整图，但解析出尺寸就立刻断开
        Range: `bytes=0-${maxBytes - 1}`,
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': userAgent,
      },
    });
    if (!response.ok) return null;

    if (!response.body) {
      const buffer = Buffer.from(await response.arrayBuffer()).subarray(0, maxBytes);
      return parseImageSize(buffer) ?? (await sharpSize(buffer));
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
        total += value.length;
        const size = parseImageSize(Buffer.concat(chunks));
        if (size) return size; // 尺寸到手，剩下的字节不再下载
        if (total >= maxBytes) break;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }

    const buffer = Buffer.concat(chunks);
    return parseImageSize(buffer) ?? (await sharpSize(buffer));
  } catch {
    return null; // 超时、DNS/网络错误、被中断：按未知处理
  } finally {
    clearTimeout(timer);
  }
}

let running = 0;
const waiting: Array<() => void> = [];

function schedule(task: () => Promise<ImageDimensions | null>): Promise<ImageDimensions | null> {
  return new Promise((resolve) => {
    const run = () => {
      running += 1;
      task()
        .then(resolve, () => resolve(null))
        .finally(() => {
          running -= 1;
          const next = waiting.shift();
          if (next) next();
        });
    };
    if (running < MAX_CONCURRENT) run();
    else waiting.push(run);
  });
}

/** 带缓存与并发限流：同一 URL 只抓一次（失败结果也缓存），并发中共享同一个 Promise */
export function remoteImageSize(
  url: string,
  options: RemoteSizeOptions = {},
): Promise<ImageDimensions | null> {
  const cached = remoteCache.get(url);
  if (cached) return cached;

  const promise = schedule(() => fetchRemoteImageSize(url, options));
  remoteCache.set(url, promise);
  return promise;
}

/** 清空缓存（测试用） */
export function clearRemoteCache(): void {
  remoteCache.clear();
}
