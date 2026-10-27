// src/app/cloudcheck/_client/components/PathChooser.tsx — 결과를 만드는 방법 고르기(V1 B1): 라디오 카드 2장(① 파일 하나만 내려받기 / ② 수집기로 한 번에 읽기). 디자인 최종안 §5-2.
//  - <fieldset> + <label class="cc-card cc-card--radio [cc-card--on]> 안에 **보이는** 네이티브 라디오(숨기지 않는다 — :has() 의존 제거). 화살표 키는 같은 name의 라디오가 기본으로 준다.
//  - 선택해도 화면이 이동하지 않는다(WCAG 3.2.2). 카드마다 '이 방법으로 볼 수 있는 곳'(DoorCollectionRow compact: 판정이 아니라 수집 상태).
//  - 카드 문구는 S 카탈로그(cc.prep.path1·path2.*, s-keys.ts). 권장 칩은 C 키(cc.c.path.recommended). 경로별 문 범위는 방향서 §5-3 상수.
import { useId, type ReactElement } from "react";
import type { Cloud, DoorId } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Chip } from "./Chip";
import { cx } from "./cx";
import { DoorCollectionRow, type DoorCollectionRowItem } from "./DoorCollectionRow";
import { PATH_KEYS, S_KEY } from "./s-keys";
import "./cards.css";

export type CollectPath = "csv" | "collector";

export interface PathChooserProps {
  readonly cloud: Cloud;
  readonly value: CollectPath;
  readonly onChange: (v: CollectPath) => void;
}

const ALL: readonly DoorId[] = ["mfa", "key", "net", "sto", "log"];

/** 경로별 문 수집 상태(상수): ① AWS = mfa·key / Azure = key·net 수집, sto 일부 / ② = 다섯 곳 모두 */
export function pathDoors(cloud: Cloud, path: CollectPath): readonly DoorCollectionRowItem[] {
  if (path === "collector") return ALL.map((door) => ({ door, status: "collected" as const }));
  return ALL.map((door): DoorCollectionRowItem => {
    if (cloud === "aws") return { door, status: door === "mfa" || door === "key" ? "collected" : "not-collected" };
    if (door === "key" || door === "net") return { door, status: "collected" };
    if (door === "sto") return { door, status: "partial" };
    return { door, status: "not-collected" };
  });
}

function Card({ path, cloud, checked, name, onChange }: { readonly path: CollectPath; readonly cloud: Cloud; readonly checked: boolean; readonly name: string; readonly onChange: (v: CollectPath) => void }): ReactElement {
  const k = PATH_KEYS[path];
  const uid = useId();
  const titleId = `${uid}-t`;
  const bodyId = `${uid}-b`;
  const limit = k.limit[cloud];
  const needs = k.needs === null ? null : k.needs[cloud];
  return (
    <label className={cx("cc-card", "cc-card--radio", checked && "cc-card--on")}>
      <span className="cc-card__pick">
        {/* 접근 이름은 카드 제목만(카드 전체 글자가 이름이 되지 않게). 나머지는 설명으로 */}
        <input type="radio" name={name} value={path} checked={checked} onChange={() => onChange(path)} aria-labelledby={titleId} aria-describedby={bodyId} />
        <span id={titleId} className="cc-card__t">
          {t(k.title)}
        </span>
        {k.tag === null ? <Chip variant="inv">{t("cc.c.path.recommended")}</Chip> : <Chip>{t(k.tag)}</Chip>}
      </span>
      <span id={bodyId} className="cc-card__body">
        {t(k.summary[cloud])}
      </span>
      <span className="cc-card__body">{t(k.covers[cloud])}</span>
      {needs === null ? null : <span className="cc-card__body">{t(needs)}</span>}
      {limit === undefined ? null : <span className="cc-card__body">{t(limit)}</span>}
      <span className="cc-card__body">
        <span className="cc-small cc-muted">{t(S_KEY.pathDoorsLabel)}</span>
        <DoorCollectionRow rows={pathDoors(cloud, path)} compact />
      </span>
    </label>
  );
}

export function PathChooser({ cloud, value, onChange }: PathChooserProps): ReactElement {
  const name = useId();
  return (
    <fieldset>
      <legend className="cc-lab">{t(S_KEY.pathsHeading)}</legend>
      <div className="cc-cards">
        <Card path="csv" cloud={cloud} checked={value === "csv"} name={name} onChange={onChange} />
        <Card path="collector" cloud={cloud} checked={value === "collector"} name={name} onChange={onChange} />
      </div>
    </fieldset>
  );
}
