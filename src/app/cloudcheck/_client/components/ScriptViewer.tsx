// src/app/cloudcheck/_client/components/ScriptViewer.tsx — 수집기 원문 뷰어(V1). 문별 <details>(V1이라 허용) + 줄마다 <span class="cc-sv__l">. 디자인 최종안 §5-2.
//  - 줄 번호는 CSS 카운터(::before, user-select:none)라 복사에 섞이지 않는다(섹션마다 1부터). 주석 줄은 한 단계 흐리게만 구분하고 구문 강조 색은 쓰지 않는다. 인쇄 숨김.
//  - 문별 구간 표식: sectionRe에 맞는 줄이 새 구간을 연다. 첫 캡처 그룹이 문 ID(mfa·key·net·sto·log)이면 그 문의 구간, 아니면 '신원·범위' 구간. 표식을 못 찾으면 전체가 한 덩어리.
//  - 원문은 항상 그대로 보인다(요약·가공 없음). translate="no".
import type { ReactElement } from "react";
import { DOORS, type DoorId } from "../../../../lib/cloudcheck/model/report";
import { fmtNum, t } from "../i18n/index";
import { Icon } from "./Icon";
import "./ScriptViewer.css";

export interface ScriptViewerProps {
  readonly fileName: string;
  readonly source: string;
  /** 구간 표식 줄을 찾는 정규식(config.ts SCRIPT_SECTION_RE). 첫 캡처 그룹 = 문 ID */
  readonly sectionRe: RegExp;
}

interface Section {
  /** null = 신원·범위(공통) */
  readonly door: DoorId | null;
  readonly lines: readonly string[];
}

const isDoor = (s: string): s is DoorId => (DOORS as readonly string[]).includes(s);

/** 줄 단위로 구간을 나눈다(순수 함수 — 테스트 대상) */
export function splitSections(source: string, sectionRe: RegExp): readonly Section[] {
  const lines = source.split("\n");
  // 끝의 빈 줄 하나는 줄 수에서 뺀다(파일 끝 개행)
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const re = new RegExp(sectionRe.source, sectionRe.flags.replace(/[gy]/g, ""));
  const sections: { door: DoorId | null; lines: string[] }[] = [];
  let cur: { door: DoorId | null; lines: string[] } = { door: null, lines: [] };
  sections.push(cur);
  let found = false;
  for (const line of lines) {
    const m = re.exec(line);
    if (m !== null) {
      found = true;
      const id = (m[1] ?? "").toLowerCase();
      cur = { door: isDoor(id) ? id : null, lines: [line] };
      sections.push(cur);
    } else {
      cur.lines.push(line);
    }
  }
  const kept = sections.filter((s) => s.lines.length > 0);
  return found ? kept : [{ door: null, lines }];
}

export function ScriptViewer({ fileName, source, sectionRe }: ScriptViewerProps): ReactElement {
  const sections = splitSections(source, sectionRe);
  return (
    <figure className="cc-sv" translate="no">
      <figcaption className="cc-sv__bar">
        <Icon name="file" size={20} />
        <code>{fileName}</code>
      </figcaption>
      <p className="cc-hint">{t("cc.c.script.readonly")}</p>
      {sections.map((s, i) => {
        const doorLabel = s.door === null ? null : `${t(`cc.door.${s.door}.name`)}(${t(`cc.door.${s.door}.term`)})`;
        return (
          <details key={i} className="cc-sv__d">
            <summary>{doorLabel === null ? t("cc.c.script.section-common", { n: fmtNum(s.lines.length) }) : t("cc.c.script.section", { door: doorLabel, n: fmtNum(s.lines.length) })}</summary>
            <pre className="cc-sv__code" tabIndex={0} aria-label={doorLabel === null ? undefined : t("cc.c.script.region-aria", { door: doorLabel })}>
              <code>
                {s.lines.map((line, j) => (
                  <span key={j} className={line.trimStart().startsWith("#") ? "cc-sv__l cc-sv__l--c" : "cc-sv__l"}>
                    {line === "" ? " " : line}
                  </span>
                ))}
              </code>
            </pre>
          </details>
        );
      })}
    </figure>
  );
}
