/**
 * 纯 JS SHA-256（字节输入）
 *
 * 用途：HashWX 的函数种子派生 —— seed = SHA256(c(32B) ‖ u8le(index) ‖ u64le(block))。
 * 每个 block（默认 65536 个 nonce）只需一次，因此同步的纯 JS 实现完全够用；
 * 这里也不能用 crypto.subtle —— 它是异步的，会打断同步解题循环。
 *
 * 摘要口径必须与三端后端完全一致。
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const W = new Uint32Array(64);
const DIGEST = new Uint32Array(8);
const encoder = new TextEncoder();

/** 对字节序列做 SHA-256，返回 32 字节摘要 */
export function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;

  // 填充：原文 + 1 字节 0x80 + 补零 + 8 字节比特长度（大端），总长为 64 的整数倍
  const total = (Math.floor((len + 8) / 64) + 1) * 64;
  const padded = new Uint8Array(total);
  padded.set(data);
  padded[len] = 0x80;

  const dv = new DataView(padded.buffer);
  dv.setUint32(total - 8, Math.floor((len * 8) / 0x100000000), false);
  dv.setUint32(total - 4, (len * 8) >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      W[i] = (padded[j] << 24) | (padded[j + 1] << 16) | (padded[j + 2] << 8) | padded[j + 3];
    }
    for (let i = 16; i < 64; i++) {
      const w15 = W[i - 15];
      const w2 = W[i - 2];
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e;
      e = (d + temp1) | 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  DIGEST[0] = h0; DIGEST[1] = h1; DIGEST[2] = h2; DIGEST[3] = h3;
  DIGEST[4] = h4; DIGEST[5] = h5; DIGEST[6] = h6; DIGEST[7] = h7;

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (DIGEST[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (DIGEST[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (DIGEST[i] >>> 8) & 0xff;
    out[i * 4 + 3] = DIGEST[i] & 0xff;
  }
  return out;
}

/** 字符串按 UTF-8 编码后求摘要 */
export function sha256Text(text: string): Uint8Array {
  return sha256(encoder.encode(text));
}

/** 转成小写十六进制 */
export function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** 字符串按 UTF-8 编码后的十六进制摘要 */
export function sha256Hex(text: string): string {
  return toHex(sha256Text(text));
}
