// src/lib/cloudcheck/model/banned-words.ts — 표현 기준(R-04, §9) 단일 원천
// G0 동결. 소유: 프론트팀장 + 백엔드팀장 공동, 목록 변경은 기획팀장 확인.
// 쓰는 곳: ① UI 카탈로그(_client/i18n/ko/*)와 룰 문구(rules/i18n/ko.ts) 정적 검사
//          ② 체험 리포트 A~D를 렌더한 뒤 body 텍스트 검사(실행 중 조합되는 문구까지)
// 내부 식별자(영수증 결과 ok 등)는 검사 대상이 아니다. 화면 표시는 카탈로그를 거치므로 '성공' 같은 말로 바뀐다.
import type { CatalogKey } from "./report";

export interface BannedRule { readonly re: RegExp; readonly label: string; readonly instead: string }

export const BANNED_KO: readonly BannedRule[] = [
  { re: /안전/g, label: "안전", instead: "이상 없음(확인한 범위·기준 시각)" },
  { re: /문제\s?없|양호/g, label: "문제없음·양호", instead: "분포 표기(점검 N개 — 위험 a · 주의 b …)" },
  { re: /불?합격|통과/g, label: "통과·합격", instead: "일치 / 허용 / 기준과 다름" },
  { re: /부?적합|미?준수/g, label: "적합·준수", instead: "참고 대응표(비인증) / 기준과 다름" },
  { re: /인증|보증|보장/g, label: "인증·보증·보장", instead: "(쓰지 않음. 기술 용어는 문맥 허용 목록)" },
  { re: /점수|등급|순위|평균|퍼센트|%/g, label: "점수·등급·비율", instead: "(쓰지 않음)" },
  { re: /완료|완벽|문단속\s?끝/g, label: "완료·완벽", instead: "파일을 읽었습니다 / 리포트를 만들었습니다" },
  { re: /\bOK\b|\bPASS\b|✓/g, label: "OK·PASS·✓", instead: "상태 글자 전체" },
  { re: /\d+\s?(분|초)/g, label: "시간 약속", instead: "(시간 약속 없음)" },
  { re: /해킹\s?차단|방어|침해\s?예방/g, label: "방어 약속", instead: "위험 신호를 찾습니다" },
  { re: /100%\s?로컬|외부\s?요청\s?0|쓰기\s?0건|서버\s?없음|어디에도\s?전송되지/g, label: "무전송 과장", instead: "이 페이지는 올린 파일을 어디로도 보내지 않습니다(+ 브라우저 기능 고지)" },
];

/** 기술 용어로서의 '인증'(authentication)은 허용한다. 검사 전에 이 문맥을 가린다 */
export const ALLOWED_CONTEXT_KO: readonly RegExp[] = [
  /다단계\s?인증/g, /다중\s?인증/g, /2단계\s?인증/g, /Entra(\s?ID)?\s?인증/g, /공유\s?키\s?인증/g,
  /인증\s?(방법|앱|수단|모드)/g, /인증서/g,
];

/** 금지어가 부정문으로 꼭 들어가야 하는 문구(키 단위). 항목마다 사유를 적고, 추가는 기획팀장 확인 */
export const ALLOWED_KEYS: Readonly<Partial<Record<CatalogKey, string>>> = {
  "cc.disclaimer.body": "§9-2 면책: '보안을 보증하거나 규정 준수를 인증하지 않습니다'(부정문)",
  "cc.about.not-certification": "V8: 이 도구가 인증·감사 증적이 아니라는 설명(부정문)",
};

export interface BannedHit { readonly label: string; readonly match: string; readonly index: number }

export function findBanned(text: string): BannedHit[] {
  let masked = text;
  for (const re of ALLOWED_CONTEXT_KO) masked = masked.replace(re, (m) => "□".repeat(m.length));
  const hits: BannedHit[] = [];
  for (const rule of BANNED_KO) {
    for (const m of masked.matchAll(rule.re)) hits.push({ label: rule.label, match: m[0], index: m.index ?? 0 });
  }
  return hits.sort((a, b) => a.index - b.index);
}
