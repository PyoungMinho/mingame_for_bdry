// src/lib/cloudcheck/parse/digest.ts — 입력 원본 바이트의 SHA-256 (STEP 5 N1)
// 쓰임: buildInput이 '같은 수집 실행(runKey)'·'같은 종류 + 같은 기준 시각' 동률을 입력 위치가 아니라 내용으로 깰 때 쓰는 지문이다.
//   같은 바이트 ⇒ 같은 지문, 다른 바이트 ⇒ 사실상 다른 지문. 보안 용도가 아니라 '순서와 무관한 전순서'가 필요할 뿐이다.
// 동기 순수 구현이다: WebCrypto(crypto.subtle)는 비동기라 buildInput(동기)에서 쓸 수 없고, node:crypto는 lib 5폴더에서 금지다.
// 표준 SHA-256(FIPS 180-4) 그대로라 어느 환경에서나 같은 값이 나온다(digest.test.ts가 node:crypto와 대조한다).

const K = Uint32Array.of(
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
);

/** 64바이트 블록 하나를 해시 상태 h에 섞는다. w는 메시지 스케줄 작업 공간(64칸) */
function compress(h: Uint32Array, w: Uint32Array, v: DataView, off: number): void {
  for (let i = 0; i < 16; i++) w[i] = v.getUint32(off + i * 4);
  for (let i = 16; i < 64; i++) {
    const x = w[i - 15], y = w[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[i] = w[i - 16] + s0 + w[i - 7] + s1;   // Uint32Array에 넣으면 2^32로 나눈 나머지만 남는다
  }
  let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], q = h[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (q + S1 + ch + K[i] + w[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    q = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += q;
}

/** 바이트열의 SHA-256을 소문자 16진수 64자로 */
export function sha256Hex(data: Uint8Array): string {
  const h = Uint32Array.of(0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19);
  const w = new Uint32Array(64);
  const len = data.length;
  const full = len - (len % 64);
  if (full > 0) {
    const view = new DataView(data.buffer, data.byteOffset, full);
    for (let off = 0; off < full; off += 64) compress(h, w, view, off);
  }
  // 꼬리: 남은 바이트 + 0x80 + 0 채움 + 비트 길이(64비트, 큰 쪽 바이트가 앞). 남은 바이트가 56개 이상이면 블록이 2개가 된다
  const rest = len - full;
  const tailLen = rest < 56 ? 64 : 128;
  const tail = new Uint8Array(tailLen);
  tail.set(data.subarray(full), 0);
  tail[rest] = 0x80;
  const tv = new DataView(tail.buffer);
  tv.setUint32(tailLen - 8, Math.floor(len / 0x20000000));
  tv.setUint32(tailLen - 4, (len * 8) % 0x100000000);
  compress(h, w, tv, 0);
  if (tailLen === 128) compress(h, w, tv, 64);
  let hex = "";
  for (let i = 0; i < 8; i++) hex += h[i].toString(16).padStart(8, "0");
  return hex;
}
