// src/app/cloudcheck/_client/components/FixSteps.tsx — 고치는 법(V4)의 3단계(FixSteps)와 대상 계정 확인 상자(AccountCheck). 디자인 최종안 §5-2·UX §4-5.
//  - 3단계(① 먼저 확인 ② 바꾸기 ③ 되돌리기)를 **모두 펼친 채** 보여 준다(마법사 아님). 쓰기 명령은 이 화면에만 나온다(G-D13). commands가 비면 명령 블록 없이 문구만.
//  - ②·③의 명령은 쓰기 CliBlock(되돌리기도 쓰기다), ①의 명령은 읽기 CliBlock. 체험이면 쓰기 블록 위에 체험 안내(CliBlock demo).
//  - 번호 상자(.cc-steps)가 CSS 카운터로 1·2·3을 그리므로 단계 제목 글자 앞의 ①②③은 지운다(번호가 겹쳐 보이지 않게 — stripStepMark).
//  - 단계 제목은 h2다(V4는 h1 바로 아래 — STEP 5 QA CC-QA-21 제목 수준 건너뜀). 모양은 전과 같은 h3 크기(.cc-fixstep__h).
//  - AccountCheck: 계정 혼동 4겹 방어의 4번째 — 대상 계정(별칭 ••••끝4자리) + 셸 계정 확인 문장 + 읽기 명령 한 줄. 모든 V4에 있다.
import type { ReactElement } from "react";
import type { CliTemplate, FixGuide, IdentityBlock } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { AccountLabel } from "./AccountLabel";
import { CliBlock } from "./CliBlock";
import { DocLink } from "./DocLink";
import { CLOUD_NAME } from "./names";
import { S_KEY } from "./s-keys";
import { T } from "./T";
import "./steps.css";
import "./FixSteps.css";

export interface FixStepsProps {
  readonly fix: FixGuide;
  readonly demo: boolean;
}

/** 단계 제목 앞의 동그라미 숫자(① 등)를 지운다 — 번호 상자와 겹치지 않게 */
export function stripStepMark(text: string): string {
  return text.replace(/^[①-⑳]\s*/, "");
}

export function FixSteps({ fix, demo }: FixStepsProps): ReactElement {
  return (
    <ol className="cc-steps" role="list">
      <li>
        <h2 className="cc-fixstep__h">{stripStepMark(t(S_KEY.fixStepObserve))}</h2>
        <div className="cc-stack cc-gap-2">
          <p>{t(fix.observe.textKey)}</p>
          {fix.observe.doc === null ? null : (
            <p>
              <DocLink link={fix.observe.doc} labelKey={S_KEY.fixDoc} />
            </p>
          )}
          {fix.observe.commands.map((cmd, i) => (
            <CliBlock key={i} cmd={cmd} demo={demo} />
          ))}
        </div>
      </li>
      <li>
        <h2 className="cc-fixstep__h">{stripStepMark(t(S_KEY.fixStepChange))}</h2>
        <div className="cc-stack cc-gap-2">
          <p className="cc-fix__meta">
            <span>{t(S_KEY.fixProperty, { property: fix.change.property })}</span>
            <DocLink link={fix.change.doc} labelKey={S_KEY.fixDoc} />
          </p>
          <p>{t(fix.change.textKey)}</p>
          {fix.change.commands.map((cmd, i) => (
            <CliBlock key={i} cmd={cmd} demo={demo} />
          ))}
        </div>
      </li>
      <li>
        <h2 className="cc-fixstep__h">{stripStepMark(t(S_KEY.fixStepRevert))}</h2>
        <div className="cc-stack cc-gap-2">
          <p>{t(fix.revert.textKey)}</p>
          {fix.revert.commands.map((cmd, i) => (
            <CliBlock key={i} cmd={cmd} demo={demo} />
          ))}
        </div>
      </li>
    </ol>
  );
}

export interface AccountCheckProps {
  readonly identity: IdentityBlock;
  /** 셸에서 계정을 보는 읽기 명령(AWS: aws sts get-caller-identity / Azure: az account show — config.ts ACCOUNT_CHECK) */
  readonly cmd: CliTemplate<"read">;
  readonly demo: boolean;
}

export function AccountCheck({ identity, cmd, demo }: AccountCheckProps): ReactElement {
  const azure = identity.cloud === "azure";
  return (
    <section className="cc-fix__acct cc-stack cc-gap-2">
      <p>
        <T k={S_KEY.fixAccount} p={{ account: <AccountLabel alias={identity.alias} last4={identity.accountLast4} /> }} /> · {CLOUD_NAME[identity.cloud]}
      </p>
      <p>{demo ? t(S_KEY.fixAccountDemo) : t(azure ? S_KEY.fixAccountCheckAzure : S_KEY.fixAccountCheck, { last4: identity.accountLast4 })}</p>
      <CliBlock cmd={cmd} />
    </section>
  );
}
