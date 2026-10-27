// 포트 범위 산술 — 구간 계산이 정확해야 NET 룰이 "열려 있음 / 막힘"을 틀리지 않는다.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAIL_PORTS, RISKY_PORTS, WEB_PORTS } from "./params";
import { classifyPorts, hasPort, parsePortSpec, portList, subtract } from "./ports";
import type { Interval } from "./ports";

describe("parsePortSpec", () => {
  it("단일 · 구간 · 쉼표 · 별표", () => {
    expect(parsePortSpec(["22"])).toEqual({ ok: true, intervals: [[22, 22]] });
    expect(parsePortSpec(["1000-2000"])).toEqual({ ok: true, intervals: [[1000, 2000]] });
    expect(parsePortSpec(["80, 443"]).intervals).toEqual([[80, 80], [443, 443]]);
    expect(parsePortSpec(["*"]).intervals).toEqual([[0, 65535]]);
    expect(parsePortSpec(["22", "23"]).intervals).toEqual([[22, 23]]);      // 이웃 구간은 합쳐진다
    expect(parsePortSpec(["10 - 20"]).intervals).toEqual([[10, 20]]);
  });
  it("해석하지 못하는 조각이 있으면 ok = false (fail-closed로 쓴다)", () => {
    for (const bad of ["abc", "22-", "-22", "70000", "30-20", "22/tcp", "1-2-3"]) expect(parsePortSpec([bad]).ok, bad).toBe(false);
    expect(parsePortSpec(["22", "xx"])).toMatchObject({ ok: false, intervals: [[22, 22]] });
  });
  it("빈 조각이나 빈 목록은 해석 불가다 — 포트 칸이 비었다고 '열린 포트 없음'으로 읽지 않는다 (읽은 조각은 남는다)", () => {
    expect(parsePortSpec(["", " ,"])).toEqual({ ok: false, intervals: [] });
    expect(parsePortSpec([])).toEqual({ ok: false, intervals: [] });
    expect(parsePortSpec(["22", ""])).toEqual({ ok: false, intervals: [[22, 22]] });
    expect(parsePortSpec(["80,"])).toMatchObject({ ok: false, intervals: [[80, 80]] });
  });
});

describe("subtract", () => {
  it("가운데를 빼면 둘로 갈린다", () => {
    expect(subtract([[1, 100]], [[40, 60]])).toEqual([[1, 39], [61, 100]]);
  });
  it("겹치지 않으면 그대로 · 모두 덮으면 빈 목록", () => {
    expect(subtract([[1, 10]], [[20, 30]])).toEqual([[1, 10]]);
    expect(subtract([[5, 9]], [[1, 100]])).toEqual([]);
  });
  it("여러 구간에서 여러 구간을 뺀다", () => {
    expect(subtract([[0, 65535]], [[0, 21], [23, 65535]])).toEqual([[22, 22]]);
  });
  it("속성: 결과는 a의 부분집합이고 b와 겹치지 않으며 a의 나머지를 모두 담는다", () => {
    const iv = fc.array(fc.tuple(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 })).map(([x, y]): Interval => (x <= y ? [x, y] : [y, x])), { maxLength: 5 });
    fc.assert(fc.property(iv, iv, (a, b) => {
      const r = subtract(a, b);
      for (let p = 0; p <= 200; p++) expect(hasPort(r, p)).toBe(hasPort(a, p) && !hasPort(b, p));
    }));
  });
});

describe("classifyPorts", () => {
  it("SSH 한 포트는 위험", () => {
    expect(classifyPorts([[22, 22]])).toEqual({ risky: [22], mail: [], other: false, all: false });
  });
  it("웹 포트(80·443)만 열면 위험도 기타도 아니다", () => {
    expect(classifyPorts([[80, 80], [443, 443]])).toEqual({ risky: [], mail: [], other: false, all: false });
  });
  it("메일 포트는 메일로만 센다", () => {
    expect(classifyPorts([[25, 25]])).toEqual({ risky: [], mail: [25], other: false, all: false });
    expect(classifyPorts([[24, 26]]).mail).toEqual([25]);
  });
  it("위험 목록 밖의 포트는 기타", () => {
    expect(classifyPorts([[9000, 9100]])).toEqual({ risky: [], mail: [], other: true, all: false });
  });
  it("전체 포트(1~65535, 별표)는 all이다. 0번 포트 하나만 빠져도 all이 맞고 한 포트라도 빠지면 아니다", () => {
    expect(classifyPorts([[0, 65535]]).all).toBe(true);
    expect(classifyPorts([[1, 65535]]).all).toBe(true);
    expect(classifyPorts([[0, 21], [23, 65535]]).all).toBe(false);
  });
  it("구간 안에 든 위험 포트를 빠짐없이 센다", () => {
    expect(classifyPorts([[3300, 3400]]).risky).toEqual([3306, 3389]);
  });
  it("33개 위험 포트와 메일 · 웹 포트는 서로 겹치지 않는다", () => {
    expect(RISKY_PORTS).toHaveLength(33);
    const all = [...RISKY_PORTS, ...MAIL_PORTS, ...WEB_PORTS];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("portList", () => {
  it("쉼표 나열", () => expect(portList([22, 3389])).toBe("22, 3389"));
});
