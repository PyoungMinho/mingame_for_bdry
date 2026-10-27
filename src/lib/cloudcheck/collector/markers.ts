// src/lib/cloudcheck/collector/markers.ts — 수집기 원문의 표식(주석) 규약 (디자인 X16, 방향서 C-11)
// 수집기 주석은 한국어로 쓰고 표식 ID를 붙인다. 일본어 설명은 페이지가 표식을 기준으로 덮어 보여 주므로(v1.1) 수집기 해시가 바뀌지 않는다.
//  - 구간 표식: `# @cc:section <구간 ID> — <설명>`  → 페이지가 원문을 구간별로 접어 보여 줄 때 쓴다(표식을 못 찾으면 전체를 한 덩어리로 보인다)
//  - 호출 표식: `# @cc:<문>.<이름> <한국어 설명>`    → 호출 줄 바로 위 1~2줄 안에 둔다(린터가 강제, 원문 안에서 고유)
// 이 모듈은 순수 상수와 함수뿐이다(프론트 config.ts가 같은 정규식을 쓰도록 문자열도 내보낸다).

/** 구간 시작 줄: 줄 전체가 이 정규식에 맞는다. 캡처 1 = 구간 ID */
export const SECTION_MARKER_RE = /^# @cc:section ([a-z]+(?:-[a-z]+)*) — (.+)$/;
/** 같은 정규식의 소스 문자열(프론트 config.ts의 SCRIPT_SECTION_RE가 그대로 쓸 수 있다. m 플래그 필요) */
export const SECTION_MARKER_SOURCE = "^# @cc:section ([a-z]+(?:-[a-z]+)*) — (.+)$";
/** 호출 표식 줄. 캡처 1 = 문 이름, 캡처 2 = 이름 */
export const CALL_MARKER_RE = /^\s*# @cc:([a-z]+)\.([a-z0-9]+(?:-[a-z0-9]+)*) /;

export const SECTION_IDS = ["common", "prepare", "identity", "scope", "mfa-key", "storage", "net", "sto", "log", "assemble"] as const;

export interface ScriptSection { readonly id: string; readonly title: string; readonly startLine: number; readonly endLine: number }

/** 원문을 구간으로 나눈다. 표식이 하나도 없으면 빈 배열(= 전체를 한 덩어리로 본다) */
export function splitSections(script: string): ScriptSection[] {
  const lines = script.split("\n");
  const marks: { id: string; title: string; line: number }[] = [];
  lines.forEach((l, i) => { const m = SECTION_MARKER_RE.exec(l); if (m) marks.push({ id: m[1], title: m[2], line: i + 1 }); });
  return marks.map((m, k) => ({ id: m.id, title: m.title, startLine: m.line, endLine: (marks[k + 1]?.line ?? lines.length + 1) - 1 }));
}
