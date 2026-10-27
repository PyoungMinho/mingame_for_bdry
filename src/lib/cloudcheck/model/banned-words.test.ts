// src/lib/cloudcheck/model/banned-words.test.ts — G0 스모크: 금지어 모듈(방향서 §4-9 '금지어' 케이스 + §7-3). 작성: 프론트팀장.
// 이 모듈 하나(findBanned)를 카탈로그 정적 검사와 체험 리포트 렌더 검사가 함께 쓴다(구현 두 벌 금지 — 방향서 §2-4).
import { describe, expect, it } from "vitest";
import { ALLOWED_CONTEXT_KO, ALLOWED_KEYS, BANNED_KO, findBanned } from "./banned-words";

const labels = (text: string): string[] => [...new Set(findBanned(text).map((h) => h.label))].sort();
const sorted = (...xs: string[]): string[] => [...xs].sort();

describe("방향서 §4-9 금지어 케이스(G0 통과 조건)", () => {
  it.each([
    ["다단계 인증"],
    ["Entra ID 인증 방법"],
    ["서명 인증서"],
  ])("기술 용어 '인증'은 문맥 허용: %s → 0건", (text) => {
    expect(findBanned(text)).toEqual([]);
  });
  it("'보안 인증을 받은' → 인증", () => {
    expect(labels("보안 인증을 받은")).toEqual(["인증·보증·보장"]);
  });
  it("'문단속 끝! 안전합니다' → 완료·안전", () => {
    expect(labels("문단속 끝! 안전합니다")).toEqual(sorted("완료·완벽", "안전"));
  });
  it("'5분이면 점검 완료' → 시간 약속·완료", () => {
    expect(labels("5분이면 점검 완료")).toEqual(sorted("시간 약속", "완료·완벽"));
  });
  it("'24시간 초과 · 7일 초과' → 0건(경과 표기는 시간·일)", () => {
    expect(findBanned("24시간 초과 · 7일 초과")).toEqual([]);
  });
  it("분포 문장 → 0건", () => {
    expect(findBanned("점검 10개 — 위험 1 · 주의 2 · 확인 불가 3 · 이상 없음 3 · 해당 없음 1")).toEqual([]);
  });
  it("'네트워크 통과' → 통과", () => {
    expect(labels("네트워크 통과")).toEqual(["통과·합격"]);
  });
  it("'어디에도 전송되지 않았습니다' → 무전송 과장", () => {
    expect(labels("어디에도 전송되지 않았습니다")).toEqual(["무전송 과장"]);
  });
  it("'OK' → OK", () => {
    expect(labels("OK")).toEqual(["OK·PASS·✓"]);
  });
});

describe("규칙 11종 각각이 잡는다(§7-3)", () => {
  it.each([
    ["안전합니다", "안전"],
    ["문제없음", "문제없음·양호"], ["문제 없음", "문제없음·양호"], ["양호", "문제없음·양호"],
    ["합격", "통과·합격"], ["불합격", "통과·합격"],
    ["적합", "적합·준수"], ["부적합", "적합·준수"], ["준수", "적합·준수"], ["미준수", "적합·준수"],
    ["보증합니다", "인증·보증·보장"], ["보장합니다", "인증·보증·보장"],
    ["점수", "점수·등급·비율"], ["등급", "점수·등급·비율"], ["우선순위", "점수·등급·비율"], ["평균", "점수·등급·비율"], ["퍼센트", "점수·등급·비율"], ["80%", "점수·등급·비율"],
    ["완벽", "완료·완벽"], ["문단속끝", "완료·완벽"],
    ["PASS", "OK·PASS·✓"], ["✓", "OK·PASS·✓"],
    ["30초", "시간 약속"], ["5 분", "시간 약속"],
    ["해킹 차단", "방어 약속"], ["방어", "방어 약속"], ["침해 예방", "방어 약속"],
    ["외부 요청 0건", "무전송 과장"], ["쓰기 0건", "무전송 과장"], ["서버 없음", "무전송 과장"],
  ])("%s → %s", (text, label) => {
    expect(labels(text)).toContain(label);
  });
  it("'100% 로컬'은 비율과 무전송 과장 둘 다", () => {
    expect(labels("100% 로컬")).toEqual(sorted("점수·등급·비율", "무전송 과장"));
  });
  it("영단어 경계: 'OKAY'·'BOOK'·'PASSWORD'는 걸리지 않는다", () => {
    expect(findBanned("OKAY BOOK PASSWORD")).toEqual([]);
  });
});

describe("문맥 허용과 결과 모양", () => {
  it.each(["다중 인증", "2단계 인증", "Entra 인증", "공유 키 인증", "인증 앱", "인증 수단", "인증 모드", "인증서 만료"])("허용 문맥: %s → 0건", (text) => {
    expect(findBanned(text)).toEqual([]);
  });
  it("허용 문맥 옆의 금지어는 그대로 잡는다", () => {
    expect(labels("다단계 인증을 쓰면 안전합니다")).toEqual(["안전"]);
  });
  it("히트는 위치 순, index는 원문 기준 위치", () => {
    const text = "완료 후 안전";
    const hits = findBanned(text);
    expect(hits.map((h) => h.match)).toEqual(["완료", "안전"]);
    for (const h of hits) expect(text.slice(h.index, h.index + h.match.length)).toBe(h.match);
  });
  it("같은 금지어가 여러 번 나오면 모두 잡는다", () => {
    expect(findBanned("안전 안전 안전")).toHaveLength(3);
  });
});

describe("모듈 위생", () => {
  it("모든 정규식이 g 플래그(matchAll·replace가 전부를 본다)", () => {
    for (const r of BANNED_KO) expect(r.re.global, r.label).toBe(true);
    for (const re of ALLOWED_CONTEXT_KO) expect(re.global, String(re)).toBe(true);
  });
  it("규칙 11종, 각 규칙에 대체 표현(instead)이 있다", () => {
    expect(BANNED_KO).toHaveLength(11);
    for (const r of BANNED_KO) expect(r.instead.length, r.label).toBeGreaterThan(0);
  });
  it("두 번 불러도 결과가 같다(g 정규식의 lastIndex에 상태가 남지 않음)", () => {
    const text = "안전 · 완료 · OK";
    expect(findBanned(text)).toEqual(findBanned(text));
  });
  it("키 단위 허용은 2개뿐(면책·인증 아님 설명 — 추가는 기획팀장 확인)", () => {
    expect(Object.keys(ALLOWED_KEYS).sort()).toEqual(["cc.about.not-certification", "cc.disclaimer.body"]);
  });
  it("확정 면책문(방향서 §7-2)은 허용 키 사유대로 보증·인증·준수에만 걸린다", () => {
    const disclaimer =
      "이 리포트는 올린 파일에 담긴 범위만, 그 파일의 수집 시각 기준으로 보여 줍니다. 보안을 보증하거나 규정 준수를 인증하지 않습니다. " +
      "'확인 불가' 항목과 '이 도구가 보지 못하는 것'은 직접 확인해야 합니다. 판정은 이 브라우저 안에서만 이루어졌고, " +
      "이 페이지는 올린 파일을 어디로도 보내거나 저장하지 않았습니다(브라우저 확장·자동 번역 같은 브라우저 기능은 이 페이지가 막을 수 없습니다).";
    expect(labels(disclaimer)).toEqual(sorted("인증·보증·보장", "적합·준수"));
  });
  it("확정 약속·고지 문구(방향서 §7-2)는 0건", () => {
    for (const text of [
      "열쇠는 맡기지 않습니다. 읽기는 당신의 셸에서, 판정은 당신의 브라우저에서. 어디까지 봤고 무엇을 못 봤는지도 그대로 말합니다.",
      "이 페이지는 올린 파일을 어디로도 보내지 않습니다. 판정은 이 브라우저 안에서만 합니다. 이 페이지가 외부로 요청을 보내지 못하도록 브라우저 설정(응답 헤더)을 걸어 두었습니다. 직접 확인하는 방법 3가지 →",
      "다만 브라우저 확장 프로그램, 자동 번역, 향상된 맞춤법 검사 같은 브라우저 자체 기능은 이 페이지가 막을 수 없습니다. 확장을 끈 창이나 오프라인판(파일로 열기)을 권합니다.",
    ]) expect(findBanned(text), text).toEqual([]);
  });
});
