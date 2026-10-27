// src/lib/cloudcheck/parse/digest.test.ts — 순수 SHA-256이 표준과 같은 값을 내는가 (STEP 5 N1: 동률을 내용으로 깨는 지문)
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "./digest";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const ref = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");
/** 고정 시드 의사 난수 바이트(시험이 매번 같은 입력을 쓰게) */
function bytes(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out[i] = x >>> 24; }
  return out;
}

describe("sha256Hex — 표준 시험 벡터(FIPS 180-4)", () => {
  it("빈 입력 · abc · 두 블록 입력 · 100만 개의 a", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(enc("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(enc("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    expect(sha256Hex(enc("a".repeat(1_000_000)))).toBe("cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
  });
});

describe("sha256Hex — node:crypto와 대조", () => {
  it("길이 0~300 전부(패딩 경계 55·56·63·64·119·120 포함)", () => {
    for (let n = 0; n <= 300; n++) {
      const b = bytes(n, n + 1);
      expect(sha256Hex(b), `길이 ${n}`).toBe(ref(b));
    }
  });
  it("큰 입력(1 MiB + 17바이트, 한글 UTF-8 본문)", () => {
    const b = bytes(1_048_576 + 17, 99);
    expect(sha256Hex(b)).toBe(ref(b));
    const t = enc("문단속 5 — 보안 점검 결과 ".repeat(5000));
    expect(sha256Hex(t)).toBe(ref(t));
  });
  it("더 큰 버퍼의 일부(byteOffset이 0이 아닌 view)도 그 부분만 해시한다", () => {
    const whole = bytes(1000, 7);
    const part = whole.subarray(13, 777);
    expect(sha256Hex(part)).toBe(ref(part));
    expect(sha256Hex(part)).not.toBe(ref(whole));
  });
  it("입력을 바꾸지 않는다", () => {
    const b = bytes(200, 3);
    const copy = b.slice();
    sha256Hex(b);
    expect(b).toEqual(copy);
  });
  it("한 바이트만 달라도 다른 지문이다", () => {
    const a = bytes(500, 11);
    const b = a.slice();
    b[250] ^= 1;
    expect(sha256Hex(a)).not.toBe(sha256Hex(b));
  });
});
