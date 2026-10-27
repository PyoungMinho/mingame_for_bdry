// 출발지 해석(rules/sources.ts) — 기대값은 결정 D-1 · D-3 · D-4(docs/planning/cloudcheck-qa-decisions.md §2)와 주소 산술에서 손으로 계산했다.
import { describe, expect, it } from "vitest";
import {
  classifyAwsSources, classifyAzureSources, coversAll4, coversAll6, isBroad4, isBroad6, parseV4, parseV6, text4, text6, withinReserved4,
} from "./sources";
import type { Range4, Range6 } from "./sources";

const v4 = (t: string, bare = false) => parseV4(t, bare);
const v6 = (t: string, bare = false) => parseV6(t, bare);
const must = <T,>(x: T | null): T => { if (x === null) throw new Error("해석되어야 한다"); return x; };
/** 첫 옥텟 a에서 시작하는 IPv4 /prefix 범위를 숫자로 만든다(공인 대역 모양의 값을 소스에 글자로 적지 않으려고 — 누출 스캔은 표본 밖 주소 글자를 막는다) */
const r4 = (a: number, prefix: number): Range4 => { const lo = a * 2 ** 24; return { lo, hi: lo + 2 ** (32 - prefix) - 1, prefix }; };
/** 첫 그룹 g에서 시작하고 나머지가 0인 IPv6 /prefix 범위 */
const r6 = (g: number, prefix: number): Range6 => { const lo = BigInt(g) << BigInt(112); return { lo, hi: lo + (BigInt(1) << BigInt(128 - prefix)) - BigInt(1), prefix }; };

describe("parseV4", () => {
  it("전체 · 사설 · 문서용 대역의 양 끝", () => {
    expect(v4("0.0.0.0/0")).toEqual({ lo: 0, hi: 4_294_967_295, prefix: 0 });
    expect(v4("10.0.0.0/8")).toEqual({ lo: 167_772_160, hi: 184_549_375, prefix: 8 });
    expect(v4("203.0.113.0/24")).toEqual({ lo: 3_405_803_776, hi: 3_405_804_031, prefix: 24 });
    expect(v4("203.0.113.9/32")).toEqual({ lo: 3_405_803_785, hi: 3_405_803_785, prefix: 32 });
  });
  it("앞뒤 공백은 trim한다(D-1a)", () => {
    expect(v4(" 0.0.0.0/0 ")).toEqual(v4("0.0.0.0/0"));
    expect(v4("\t10.0.0.0/8\n")).toEqual(v4("10.0.0.0/8"));
  });
  it("호스트 비트가 켜진 값은 네트워크 주소로 맞춘다", () => {
    expect(v4("10.1.2.3/8")).toEqual(v4("10.0.0.0/8"));
    expect(v4("10.0.0.0/0")).toEqual(v4("0.0.0.0/0"));
    expect(v4("203.0.113.77/24")).toEqual(v4("203.0.113.0/24"));
  });
  it("접두가 없는 단일 주소는 allowBare일 때만 /32로 받는다", () => {
    expect(v4("203.0.113.9")).toBeNull();
    expect(v4("203.0.113.9", true)).toEqual(v4("203.0.113.9/32"));
  });
  it("모르는 모양은 null", () => {
    for (const t of ["", "zzz", "256.0.0.0/8", "203.0.113/8", "203.0.113.4/33", "203.0.113.4/-1", "203.0.113.4/", "0.0.0.0/0 x", "::/0", "203.0.113.4.5/8", "203.0.113.4/8/8", "a.b.c.d/8"]) expect(v4(t, true), JSON.stringify(t)).toBeNull();
  });
});

describe("parseV6", () => {
  it("전체 · 공인 · 문서용 대역", () => {
    const all = must(v6("::/0"));
    expect([all.lo, all.hi, all.prefix]).toEqual([BigInt(0), (BigInt(1) << BigInt(128)) - BigInt(1), 0]);
    const gua = must(v6("2000::/3"));
    expect(gua.lo).toBe(BigInt("0x20000000000000000000000000000000"));
    expect(gua.hi).toBe(BigInt("0x3fffffffffffffffffffffffffffffff"));
    const doc = must(v6("2001:db8::/32"));
    expect(doc.lo).toBe(BigInt("0x20010db8000000000000000000000000"));
    expect(doc.hi).toBe(BigInt("0x20010db8ffffffffffffffffffffffff"));
  });
  it("압축 · 전개 · IPv4 꼬리 표기를 같은 값으로 읽는다", () => {
    expect(v6("2001:db8:0:0:0:0:0:0/32")).toEqual(v6("2001:db8::/32"));
    expect(v6("2001:DB8::/32")).toEqual(v6("2001:db8::/32"));
    const tail = must(v6("2001:db8::203.0.113.4/128"));                     // 끝 32비트를 점 표기로 적은 꼴(203.0.113.4 = cb00 7104)
    expect(tail.lo).toBe(BigInt("0x20010db80000000000000000cb007104"));
  });
  it("trim, 호스트 비트 맞춤, 접두 없는 단일 주소(allowBare)", () => {
    expect(v6(" ::/0 ")).toEqual(v6("::/0"));
    expect(v6("2001:db8::1/32")).toEqual(v6("2001:db8::/32"));
    expect(v6("2001:db8::1")).toBeNull();
    expect(must(v6("2001:db8::1", true)).prefix).toBe(128);
  });
  it("모르는 모양은 null", () => {
    for (const t of ["", ":::/0", "1:2:3:4:5:6:7:8:9/64", "g::/8", "::/129", "::1/abc", "1::2::3/64", ":1::2/64", "1::2:/64", "203.0.113.4/8", "::/", "12345::/16", "2001:db8:0:0:0:0:203.0.113.4:5/64"]) expect(v6(t, true), JSON.stringify(t)).toBeNull();
  });
});

describe("합집합이 전체를 덮는가", () => {
  const rs = (...t: string[]) => t.map((x) => must(v4(x)));
  it("IPv4: 절반 둘 · 1/4 둘 + 절반 · 8등분은 전체, 빈틈이 있으면 아니다", () => {
    expect(coversAll4(rs("0.0.0.0/0"))).toBe(true);
    expect(coversAll4(rs("0.0.0.0/1", "128.0.0.0/1"))).toBe(true);
    expect(coversAll4(rs("128.0.0.0/1", "0.0.0.0/1"))).toBe(true);
    expect(coversAll4(rs("0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"))).toBe(true);
    expect(coversAll4(rs("0.0.0.0/3", "32.0.0.0/3", "64.0.0.0/3", "96.0.0.0/3", "128.0.0.0/3", "160.0.0.0/3", "192.0.0.0/3", "224.0.0.0/3"))).toBe(true);
    expect(coversAll4(rs("0.0.0.0/1", "128.0.0.0/2"))).toBe(false);          // 마지막 1/4가 빈다
    expect(coversAll4(rs("0.0.0.0/1"))).toBe(false);
    expect(coversAll4([])).toBe(false);
  });
  it("겹치거나 중복돼도 계산이 맞다", () => {
    expect(coversAll4(rs("0.0.0.0/1", "0.0.0.0/1", "64.0.0.0/2", "128.0.0.0/1"))).toBe(true);
    expect(coversAll4(rs("10.0.0.0/8", "0.0.0.0/0"))).toBe(true);
    expect(coversAll4(rs("0.0.0.0/1", "10.0.0.0/8"))).toBe(false);
  });
  it("IPv6", () => {
    const six = (...t: string[]) => t.map((x) => must(v6(x)));
    expect(coversAll6(six("::/0"))).toBe(true);
    expect(coversAll6(six("::/1", "8000::/1"))).toBe(true);
    expect(coversAll6(six("::/1"))).toBe(false);
    expect(coversAll6(six("::/2", "4000::/2", "8000::/1"))).toBe(true);
    expect(coversAll6(six("::/2", "8000::/1"))).toBe(false);
  });
});

describe("넓은 공인 대역(D-1b)", () => {
  const b4 = (t: string): boolean => isBroad4(must(v4(t)));
  const b6 = (t: string): boolean => isBroad6(must(v6(t)));
  it("IPv4: 접두 /8 이하이고 사설·예약 안에 다 들어가지 않으면 넓다", () => {
    for (const t of ["0.0.0.0/1", "128.0.0.0/1", "64.0.0.0/2", "192.0.0.0/2", "12.0.0.0/8", "11.0.0.0/8", "0.0.0.0/7", "8.0.0.0/5"]) expect(b4(t), t).toBe(true);
  });
  it("IPv4: 사설·예약 대역은 넓어도 뺀다(10/8, 0/8, 224/4, 240/4, 127/8)", () => {
    for (const t of ["10.0.0.0/8", "0.0.0.0/8", "224.0.0.0/4", "240.0.0.0/4", "127.0.0.0/8", "10.1.2.3/8"]) expect(b4(t), t).toBe(false);
  });
  it("IPv4: 접두가 /9 이상이면 좁다(172.16/12 · 100.64/10 · 203.0.113.0/24 포함) — /8과 /9의 경계는 숫자 범위로 본다", () => {
    for (const t of ["172.16.0.0/12", "100.64.0.0/10", "192.168.0.0/16", "203.0.113.0/24"]) expect(b4(t), t).toBe(false);
    for (const a of [9, 12, 13, 52, 203]) {
      expect(isBroad4(r4(a, 8)), `${a}/8`).toBe(true);
      expect(isBroad4(r4(a, 9)), `${a}/9`).toBe(false);
      expect(isBroad4(r4(a, 24)), `${a}/24`).toBe(false);
    }
    expect(isBroad4(r4(8, 5))).toBe(true);
  });
  it("사설·예약 대역 판정은 9개 대역의 합집합 안에 통째로 들어가는가로 본다", () => {
    expect(withinReserved4(must(v4("224.0.0.0/4")))).toBe(true);
    expect(withinReserved4(must(v4("192.0.0.0/2")))).toBe(false);           // 뒤쪽 4분의 1: 예약 대역(224/4 이상)과 공인 대역이 섞여 있다
    expect(withinReserved4(must(v4("172.16.0.0/12")))).toBe(true);
    expect(withinReserved4(must(v4("172.0.0.0/8")))).toBe(false);
  });
  it("IPv6: 접두 /16 이하이고 2000::/3과 겹치면 넓다", () => {
    for (const t of ["::/0", "::/1", "2000::/3", "2001::/16", "2400::/12", "3000::/4"]) expect(b6(t), t).toBe(true);
  });
  it("IPv6: 공인 대역과 겹치지 않거나 접두가 /17 이상이면 좁다", () => {
    for (const t of ["8000::/1", "fc00::/7", "fe80::/10", "ff00::/8", "2001:db8::/32"]) expect(b6(t), t).toBe(false);
    // /16과 /17의 경계는 숫자 범위로 본다
    expect(isBroad6(r6(0x2001, 16))).toBe(true);
    expect(isBroad6(r6(0x2001, 17))).toBe(false);
    expect(isBroad6(r6(0x2400, 12))).toBe(true);
    expect(isBroad6(r6(0xfc00, 7))).toBe(false);
  });
});

describe("표시 문자열", () => {
  it("IPv4는 정규형(네트워크 주소/접두)", () => {
    expect(text4(must(v4("0.0.0.0/1")))).toBe("0.0.0.0/1");
    expect(text4(must(v4("128.0.0.0/1")))).toBe("128.0.0.0/1");
    expect(text4(must(v4("203.0.113.77/24")))).toBe("203.0.113.0/24");
    expect(text4(must(v4(" 12.0.0.0/8 ")))).toBe("12.0.0.0/8");
    expect(text4(must(v4("203.0.113.0/24")))).toBe("203.0.113.0/24");
  });
  it("IPv6는 접두 /16 이하만 쓰고 `<그룹>::/n` 꼴", () => {
    expect(text6(must(v6("::/0")))).toBe("::/0");
    expect(text6(must(v6("2000::/3")))).toBe("2000::/3");
    expect(text6(must(v6("2400::/12")))).toBe("2400::/12");
    expect(text6(must(v6("2001::/16")))).toBe("2001::/16");
  });
});

const aws = (o: Partial<Parameters<typeof classifyAwsSources>[0]>) => classifyAwsSources({ cidrs: [], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0, ...o });

describe("classifyAwsSources", () => {
  it("0.0.0.0/0 와 ::/0 는 전체이고 사실 줄 값은 그대로다", () => {
    const r = aws({ cidrs: ["0.0.0.0/0"], ipv6Cidrs: ["::/0"] });
    expect([r.whole4, r.whole6, r.wholeText4, r.wholeText6, r.broad, r.prefixLists, r.unrecognized]).toEqual([true, true, ["0.0.0.0/0"], ["::/0"], [], [], false]);
  });
  it("합쳐서 전체인 출발지(D-1a): 앞뒤 공백 포함, 사실 줄에는 /8 이하 조각을 최대 3개", () => {
    const half = aws({ cidrs: ["0.0.0.0/1", "128.0.0.0/1"] });
    expect([half.whole4, half.wholeText4, half.broad]).toEqual([true, ["0.0.0.0/1", "128.0.0.0/1"], []]);
    const spaced = aws({ cidrs: [" 0.0.0.0/1", "128.0.0.0/1 "] });
    expect(spaced.whole4).toBe(true);
    const three = aws({ cidrs: ["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"] });
    expect(three.wholeText4).toEqual(["0.0.0.0/2", "64.0.0.0/2", "128.0.0.0/1"]);
    const eight = aws({ cidrs: ["0.0.0.0/3", "32.0.0.0/3", "64.0.0.0/3", "96.0.0.0/3", "128.0.0.0/3", "160.0.0.0/3", "192.0.0.0/3", "224.0.0.0/3"] });
    expect([eight.whole4, eight.wholeText4.length]).toEqual([true, 3]);
  });
  it("'/9' 조각 512개로 전체를 이루면 /8 이하 조각이 없어 사실 줄에는 0.0.0.0/0 을 적는다", () => {
    const nines: string[] = [];
    for (let a = 0; a < 256; a++) nines.push(`${a}.0.0.0/9`, `${a}.128.0.0/9`);
    const r = aws({ cidrs: nines });
    expect([r.whole4, r.wholeText4, r.broad]).toEqual([true, ["0.0.0.0/0"], []]);
    expect(aws({ cidrs: nines.slice(1) }).whole4).toBe(false);                   // 한 조각만 빠져도 전체가 아니다
    // /8 256개를 모두 나열하면 전체이고 /8 이하 조각이 있으므로 최대 3개를 적는다
    const eights = Array.from({ length: 256 }, (_, i) => `${i}.0.0.0/8`);
    const e = aws({ cidrs: eights });
    expect([e.whole4, e.wholeText4]).toEqual([true, ["0.0.0.0/8", "1.0.0.0/8", "2.0.0.0/8"]]);
  });
  it("넓은 공인 대역은 전체가 아닐 때만 broad에 든다", () => {
    expect(aws({ cidrs: ["12.0.0.0/8"] })).toMatchObject({ whole4: false, broad: ["12.0.0.0/8"], unrecognized: false });
    expect(aws({ cidrs: ["0.0.0.0/1", "10.0.0.0/8"] })).toMatchObject({ whole4: false, broad: ["0.0.0.0/1"] });
    expect(aws({ cidrs: ["0.0.0.0/0", "12.0.0.0/8"] })).toMatchObject({ whole4: true, broad: [] });
    expect(aws({ ipv6Cidrs: ["2000::/3"] })).toMatchObject({ whole6: false, broad: ["2000::/3"] });
    expect(aws({ cidrs: ["12.0.0.0/8"], ipv6Cidrs: ["::/0"] })).toMatchObject({ whole4: false, whole6: true, broad: ["12.0.0.0/8"] });
  });
  it("사설·예약 대역과 좁은 대역은 넓어도 · 좁아도 broad가 아니다", () => {
    for (const c of ["10.0.0.0/8", "10.1.2.3/8", "172.16.0.0/12", "192.168.0.0/16", "203.0.113.0/24", "0.0.0.0/8", "224.0.0.0/4"]) {
      expect(aws({ cidrs: [c] }), c).toMatchObject({ whole4: false, broad: [], unrecognized: false });
    }
    expect(aws({ ipv6Cidrs: ["fc00::/7", "2001:db8::/32", "fe80::/10"] })).toMatchObject({ whole6: false, broad: [], unrecognized: false });
  });
  it("프리픽스 리스트는 ID만 모으고 내용은 읽지 않는다", () => {
    const r = aws({ prefixListIds: ["pl-0abc0001", " pl-0abc0002 ", "pl-0abc0001"] });
    expect(r).toMatchObject({ whole4: false, whole6: false, broad: [], prefixLists: ["pl-0abc0001", "pl-0abc0002"], unrecognized: false });
  });
  it("보안 그룹 참조만 있는 규칙은 내부다(해석 불가가 아니다)", () => {
    expect(aws({ sgRefCount: 2 })).toMatchObject({ whole4: false, broad: [], prefixLists: [], unrecognized: false });
  });
  it("출발지가 하나도 없는 규칙은 해석 불가", () => {
    expect(aws({}).unrecognized).toBe(true);
  });
  it("모르는 모양이 섞이면 해석 불가 플래그가 서고, 알아본 전체 · 넓은 대역은 그대로 남는다(INV-4)", () => {
    expect(aws({ cidrs: ["zzz"] })).toMatchObject({ unrecognized: true, whole4: false });
    expect(aws({ cidrs: ["0.0.0.0/0", "zzz"] })).toMatchObject({ unrecognized: true, whole4: true });
    expect(aws({ cidrs: ["::/0"] }).unrecognized).toBe(true);                      // 반대쪽 목록의 모양
    expect(aws({ ipv6Cidrs: ["0.0.0.0/0"] }).unrecognized).toBe(true);
    expect(aws({ cidrs: ["203.0.113.4"] }).unrecognized).toBe(true);                // AWS 출발지에는 항상 접두가 있다
    expect(aws({ prefixListIds: [" "] }).unrecognized).toBe(true);
    expect(aws({ cidrs: ["0.0.0.0/0 "] })).toMatchObject({ whole4: true, unrecognized: false });   // trim 뒤 읽는다
  });
});

describe("classifyAzureSources", () => {
  it("*·Internet·Any 는 대소문자와 공백을 가리지 않고 전체다", () => {
    for (const p of ["*", "Internet", "internet", " ANY ", "any"]) expect(classifyAzureSources([p], 0), p).toMatchObject({ whole: true, wholeText: ["*"], broad: [], tags: [], unrecognized: false });
  });
  it("CIDR 합집합이 전체이면 전체 · 사실 줄에는 /8 이하 조각", () => {
    expect(classifyAzureSources(["0.0.0.0/1", "128.0.0.0/1"], 0)).toMatchObject({ whole: true, wholeText: ["0.0.0.0/1", "128.0.0.0/1"] });
    expect(classifyAzureSources(["0.0.0.0/0"], 0)).toMatchObject({ whole: true, wholeText: ["0.0.0.0/0"] });
    expect(classifyAzureSources(["::/0"], 0)).toMatchObject({ whole: true, wholeText: ["::/0"] });
    expect(classifyAzureSources(["Internet", "0.0.0.0/1"], 0).wholeText).toEqual(["*"]);
  });
  it("VirtualNetwork · AzureLoadBalancer · ASG · 좁은 CIDR · 단일 IP는 내부(판정 제외)", () => {
    for (const p of ["VirtualNetwork", "azureloadbalancer", "10.0.0.0/8", "203.0.113.0/24", "203.0.113.9", "2001:db8::1"]) {
      expect(classifyAzureSources([p], 0), p).toMatchObject({ whole: false, broad: [], tags: [], unrecognized: false });
    }
    expect(classifyAzureSources([], 2)).toMatchObject({ whole: false, tags: [], unrecognized: false });
  });
  it("서비스 태그는 쓴 그대로의 이름을 모은다(내부 태그 제외)", () => {
    expect(classifyAzureSources(["AzureCloud", "Storage.KoreaCentral", "VirtualNetwork", "AzureCloud"], 0)).toMatchObject({ tags: ["AzureCloud", "Storage.KoreaCentral"], whole: false, unrecognized: false });
    expect(classifyAzureSources(["GatewayManager"], 0).tags).toEqual(["GatewayManager"]);
  });
  it("넓은 공인 대역", () => {
    expect(classifyAzureSources(["12.0.0.0/8"], 0).broad).toEqual(["12.0.0.0/8"]);
    expect(classifyAzureSources(["2000::/3"], 0).broad).toEqual(["2000::/3"]);
    expect(classifyAzureSources(["0.0.0.0/1", "10.0.0.0/8"], 0).broad).toEqual(["0.0.0.0/1"]);
  });
  it("출발지가 없는 규칙(접두 0개 + ASG 0개 또는 모름)은 해석 불가", () => {
    expect(classifyAzureSources([], 0).unrecognized).toBe(true);
    expect(classifyAzureSources([], null).unrecognized).toBe(true);
    expect(classifyAzureSources([], 1).unrecognized).toBe(false);
  });
  it("태그 · CIDR · IP 모양이 아닌 값은 해석 불가이고, 알아본 전체는 그대로 남는다(INV-4)", () => {
    for (const p of ["zzz!", "203.0.113.4/33", "10 .0.0.0/8", "", "-tag", "9tag", "tag name"]) expect(classifyAzureSources([p], 0).unrecognized, JSON.stringify(p)).toBe(true);
    expect(classifyAzureSources(["*", "zzz!"], 0)).toMatchObject({ whole: true, unrecognized: true });
  });
});

/* ───────── 구조로 만든 시험: 계산 방식이 다른 독립된 방법으로 같은 답이 나오는가 ───────── */
/** 시드가 고정된 난수(mulberry32) — 현재 시각 · Math.random을 쓰지 않는다 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
/** 공간 전체를 이진 트리로 쪼갠 분할(리프 = 서로 겹치지 않고 빈틈이 없는 조각들). depth 한도 안에서 무작위로 더 쪼갠다 */
function partition4(rand: () => number, maxDepth: number): Range4[] {
  const out: Range4[] = [];
  const split = (lo: number, prefix: number): void => {
    if (prefix >= maxDepth || (prefix > 0 && rand() < 0.35)) { out.push({ lo, hi: lo + 2 ** (32 - prefix) - 1, prefix }); return; }
    split(lo, prefix + 1);
    split(lo + 2 ** (32 - prefix - 1), prefix + 1);
  };
  split(0, 0);
  return out;
}
function partition6(rand: () => number, maxDepth: number): Range6[] {
  const out: Range6[] = [];
  const split = (lo: bigint, prefix: number): void => {
    if (prefix >= maxDepth || (prefix > 0 && rand() < 0.35)) { out.push({ lo, hi: lo + (BigInt(1) << BigInt(128 - prefix)) - BigInt(1), prefix }); return; }
    split(lo, prefix + 1);
    split(lo + (BigInt(1) << BigInt(127 - prefix)), prefix + 1);
  };
  split(BigInt(0), 0);
  return out;
}
const shuffle = <T,>(xs: readonly T[], rand: () => number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

describe("합집합 계산을 분할 트리로 확인한다 (구간 병합과 다른 방법)", () => {
  it("IPv4: 어떤 순서로 늘어놓은 분할이든 전체이고, 조각 하나만 빼면 전체가 아니다(겹침 · 중복을 섞어도 같다)", () => {
    const rand = rng(20261020);
    for (let n = 0; n < 200; n++) {
      const parts = partition4(rand, 12);
      const shuffled = shuffle(parts, rand);
      expect(coversAll4(shuffled), `분할 ${n}`).toBe(true);
      const dup = [...shuffled, shuffled[0], ...shuffled.slice(0, 2)];
      expect(coversAll4(dup), `중복 ${n}`).toBe(true);
      if (parts.length > 1) {
        const k = Math.floor(rand() * parts.length);
        expect(coversAll4(parts.filter((_, i) => i !== k)), `하나 빠짐 ${n}`).toBe(false);
      }
    }
  });
  it("IPv6", () => {
    const rand = rng(20261021);
    for (let n = 0; n < 120; n++) {
      const parts = partition6(rand, 10);
      expect(coversAll6(shuffle(parts, rand)), `분할 ${n}`).toBe(true);
      if (parts.length > 1) {
        const k = Math.floor(rand() * parts.length);
        expect(coversAll6(parts.filter((_, i) => i !== k)), `하나 빠짐 ${n}`).toBe(false);
      }
    }
  });
  it("분류기 종단: 문자열로 적은 분할도 trim 뒤 전체이고, 한 조각을 빼면 전체가 아니다", () => {
    const rand = rng(20261022);
    for (let n = 0; n < 60; n++) {
      const parts = partition4(rand, 10);
      const texts = shuffle(parts, rand).map((r, i) => (i % 3 === 0 ? ` ${text4(r)} ` : text4(r)));
      expect(aws({ cidrs: texts }).whole4, `AWS ${n}`).toBe(true);
      expect(classifyAzureSources(texts, 0).whole, `Azure ${n}`).toBe(true);
      if (parts.length > 1) {
        const rest = texts.slice(1);
        expect(aws({ cidrs: rest }).whole4, `AWS 하나 빠짐 ${n}`).toBe(false);
      }
    }
  });
});

describe("넓은 공인 대역 판정을 접두 0~8 전수와 손으로 쓴 규칙으로 맞춰 본다", () => {
  it("IPv4 접두 ≤ /8 전수(511개): 넓지 않은 것은 0/8 · 10/8 · 127/8과 224 이상 구간(224/4 · 240/4 포함)뿐이다", () => {
    let total = 0;
    let narrow = 0;
    for (let prefix = 0; prefix <= 8; prefix++) {
      for (let k = 0; k < 2 ** prefix; k++) {
        const r = { lo: k * 2 ** (32 - prefix), hi: (k + 1) * 2 ** (32 - prefix) - 1, prefix };
        const first = Math.floor(r.lo / 2 ** 24);
        const inReserved = (prefix === 8 && (first === 0 || first === 10 || first === 127)) || first >= 224;
        expect(isBroad4(r), `${first}.x/${prefix}`).toBe(!inReserved);
        total++;
        if (inReserved) narrow++;
      }
    }
    expect(total).toBe(511);
    // 넓지 않은 것: /8 세 개(0 · 10 · 127) + 224~255 안에 통째로 든 블록(접두 /3 하나, /4 둘, /5 넷, /6 여덟, /7 열여섯, /8 서른둘 = 63개)
    expect(narrow).toBe(3 + (1 + 2 + 4 + 8 + 16 + 32));
  });
  it("IPv6 접두 ≤ /16: 첫 16비트 구간이 2000~3fff와 겹치면 넓다", () => {
    const rand = rng(20261023);
    for (let n = 0; n < 400; n++) {
      const prefix = Math.floor(rand() * 17);
      const g0 = Math.floor(rand() * 65536);
      const span = 2 ** (16 - prefix);
      const first = Math.floor(g0 / span) * span;
      const overlaps = first <= 0x3fff && first + span - 1 >= 0x2000;
      expect(isBroad6(r6(first, prefix)), `${first.toString(16)}/${prefix}`).toBe(overlaps);
    }
  });
});
