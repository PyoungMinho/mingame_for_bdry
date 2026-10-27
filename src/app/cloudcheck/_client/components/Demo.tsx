// src/app/cloudcheck/_client/components/Demo.tsx — 체험 고르기(V6): 클라우드 라디오(CloudRadio)와 회사 카드 4장(DemoCards). 디자인 최종안 §5-2·UX §4-7.
//  - 카드 순서 C → D → A → B, 세트 글자(A~D)는 화면에 쓰지 않는다. 카드 = 회사 이름(h2 — V6 h1 바로 아래, STEP 5 axe heading-order. 크기는 .cc-card__t) + 가르치는 것 + 이야기 + 고른 클라우드의 한 줄 + 보조 버튼(주 버튼 없음 — 4장이 동등한 선택).
//  - 버튼의 접근 이름 = '이 회사 리포트 보기' + 회사 이름(aria-labelledby). CloudRadio는 선택해도 이동하지 않는다(WCAG 3.2.2).
//  - 문구는 S 카탈로그(cc.demo.*, s-keys.ts).
import { useId, type ReactElement } from "react";
import type { Cloud, DemoSetId } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { CLOUD_NAME } from "./names";
import { DEMO_CARD_ORDER, DEMO_SET_KEYS, S_KEY } from "./s-keys";
import "./actions.css";
import "./cards.css";

export interface DemoCardsProps {
  readonly cloud: Cloud;
  readonly onOpen: (set: DemoSetId) => void;
}

export function DemoCards({ cloud, onOpen }: DemoCardsProps): ReactElement {
  const base = useId();
  return (
    <div className="cc-cards cc-cards--4">
      {DEMO_CARD_ORDER.map((set, i) => {
        const k = DEMO_SET_KEYS[set];
        const nameId = `${base}-n${i}`;
        const btnId = `${base}-b${i}`;
        return (
          <article key={set} className="cc-card">
            <h2 id={nameId} className="cc-card__t">
              {t(k.name)}
            </h2>
            <p>
              <strong>{t(k.teach)}</strong>
            </p>
            <p>{t(k.story)}</p>
            <p className="cc-small">
              {CLOUD_NAME[cloud]}: {t(cloud === "aws" ? k.aws : k.azure)}
            </p>
            <button type="button" id={btnId} className="cc-btn" aria-labelledby={`${btnId} ${nameId}`} onClick={() => onOpen(set)}>
              {t(S_KEY.demoOpen)}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export interface CloudRadioProps {
  readonly value: Cloud;
  readonly onChange: (v: Cloud) => void;
}

const CLOUDS: readonly Cloud[] = ["aws", "azure"];

export function CloudRadio({ value, onChange }: CloudRadioProps): ReactElement {
  const name = useId();
  return (
    <fieldset>
      <legend className="cc-lab">{t(S_KEY.demoCloudLegend)}</legend>
      <div className="cc-actions">
        {CLOUDS.map((c) => (
          <label key={c} className="cc-opt">
            <input type="radio" name={name} value={c} checked={value === c} onChange={() => onChange(c)} />
            {CLOUD_NAME[c]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
