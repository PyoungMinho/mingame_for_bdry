// src/app/cloudcheck/_client/screens/Input.tsx — V2 결과 파일 넣기. 디자인 최종안 §6-3(C1~C7), UX §4-3·§5-2 B.
//  - 오류는 이 화면 안에서(토스트·모달 없음). 파일 전체를 읽지 못하면 리포트를 만들지 않는다: 행 아래 확인 불가 톤 패널(도형 없음)에 이유 + 다음 행동.
//  - 계정 혼동 방지 2겹: 목록의 계정·수집 시각 + 버튼 문구 '이 계정으로'. 다른 계정·클라우드가 섞이면 버튼을 막고(aria-disabled + 이유 글자) 두 신원을 나란히 보인다.
//  - 비교 모드(재수집 뒤): 끝 4자리가 이전 리포트와 다르면 [비교 보기]를 막는다(5겹 사전 차단).
//  - 실제 점검을 열지 않은 클라우드(config CLOUD_AVAILABILITY — 지금 Azure '준비 중')의 실제 입력이면 버튼을 막고, 그 자리에 V0과 같은 안내
//    (cc.start.azure-soon.note + [Azure 체험 보기])를 보인다. STEP 5 기획팀장 결정(cloudcheck-qa-decisions.md §8-A). actions.build()도 한 번 더 막는다.
//  - 붙여 넣은 CSV(기준 시각 없음)는 그 줄 아래에 안내 한 줄(디자인 D-6, cc.input.paste-no-asof).
//  - 붙여넣기는 입력칸에 남기지 않고 바로 읽는다(PasteBox). 읽는 중에는 '읽는 중입니다'를 먼저 그린 뒤 파싱을 시작한다(액션이 두 프레임을 기다린다).
import { useId, useMemo, useRef, type ReactElement } from "react";
import type { BuildInputResult } from "../state/deps";
import type { InputRecognition } from "../../../../lib/cloudcheck/model/report";
import { AccountLabel } from "../components/AccountLabel";
import { Banner } from "../components/Banner";
import { DoorCollectionRow, type DoorCollectionRowItem } from "../components/DoorCollectionRow";
import { DOM_ID } from "../components/dom-ids";
import { DropZone, InputTabs } from "../components/DropZone";
import { FileRecognitionList } from "../components/FileRecognitionList";
import { PasteBox } from "../components/PasteBox";
import { PromiseBlock } from "../components/PromiseBlock";
import { T } from "../components/T";
import { UnknownTone } from "../components/UnknownTone";
import { DOORS } from "../../../../lib/cloudcheck/model/report";
import { MAX_FILES } from "../config";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { identityOf, pastedCsvWithoutAsOf, uncollectableCloud } from "../state/pipeline";
import { BackButton } from "./shared";

const NONE: BuildInputResult = { ok: false, recognitions: [] };

export function InputScreen(): ReactElement {
  const { state, actions, deps, availability } = useApp();
  const base = state.compareBase;
  const compare = base !== null;
  const listRef = useRef<HTMLDivElement>(null);
  const pasteHintId = useId();

  /* buildInput이 superseded·계정/클라우드 불일치를 반영한 목록을 준다. 원본은 reducer가 들고 있어 빼면 다시 계산된다 */
  const raws = useMemo(() => state.recs.map((r) => r.rec), [state.recs]);
  const built = useMemo<BuildInputResult>(() => (raws.length === 0 ? NONE : deps.buildInput(raws)), [deps, raws]);
  const shown: readonly InputRecognition[] = built.recognitions.length === raws.length ? built.recognitions : raws;

  const ok = shown.filter((r) => r.status === "ok");
  const { preview } = identityOf(shown);
  const mixed = shown.some((r) => r.status === "account-mismatch" || r.status === "cloud-mismatch");
  const compareMismatch = compare && preview !== null && (preview.accountLast4 !== base.identity.accountLast4 || preview.cloud !== base.identity.cloud);
  const building = state.busy === "building";
  const reading = state.busy === "reading";
  /** 공개 전 클라우드의 실제 입력(지금은 Azure만 해당 — 안내 문구도 Azure용 기존 키) */
  const soonCloud = uncollectableCloud(ok, availability);
  const blocked = !built.ok || mixed || compareMismatch || building || soonCloud !== null;
  const reason: string | null = building
    ? t("cc.input.building")
    : !built.ok
      ? t("cc.input.cta-disabled")
      : mixed
        ? t("cc.input.mixed")
        : compareMismatch
          ? t("cc.input.compare-mismatch")
          : soonCloud !== null
            ? t("cc.start.azure-soon.note")
            : null;
  const reasonId = useId();
  const soonNote = soonCloud !== null && !building && built.ok && !mixed && !compareMismatch;

  /* C5 이 파일들로 볼 수 있는 곳: ok 결과의 문 합집합, 나머지는 수집 안 함 */
  const doorRows: DoorCollectionRowItem[] = DOORS.map((door) => ({ door, status: ok.some((r) => r.doors.includes(door)) ? "collected" : "not-collected" }));

  const noticeText =
    state.notice === "too-many" ? t("cc.input.too-many", { max: MAX_FILES }) : state.notice === "folder" ? t("cc.input.folder") : state.notice === "paste-not-text" ? t("cc.input.paste-not-text") : null;

  return (
    <>
      <BackButton labelKey="cc.prep.back" onClick={() => actions.show("start")} />
      {/* C1 비교 모드 */}
      {compare ? <Banner variant="info" title={<T k="cc.input.compare.banner" p={{ account: <AccountLabel alias={base.identity.alias} last4={base.identity.accountLast4} /> }} />} /> : null}

      <h1 tabIndex={-1}>{t("cc.input.title")}</h1>
      <p>{t("cc.input.sub")}</p>
      {state.cloud === "azure" ? <p className="cc-small cc-muted">{t("cc.input.slots.azure")}</p> : null}

      {/* C2 입력: 파일 놓기 | 붙여넣기 */}
      <div className="cc-stack cc-gap-2">
        <InputTabs value={state.view.tab} onChange={actions.setTab} />
        <div role="tabpanel" id={DOM_ID.inputPanel("file")} aria-labelledby={DOM_ID.inputTab("file")} hidden={state.view.tab !== "file"}>
          <DropZone onFiles={(files) => void actions.onFiles(files)} onFolder={actions.onFolder} busy={reading} />
        </div>
        <div role="tabpanel" id={DOM_ID.inputPanel("paste")} aria-labelledby={DOM_ID.inputTab("paste")} hidden={state.view.tab !== "paste"} className="cc-stack cc-gap-2">
          <p id={pasteHintId}>{t("cc.input.paste.when")}</p>
          <PasteBox onText={(text) => void actions.onPasteText(text)} onNonText={actions.onPasteNonText} describedBy={pasteHintId} />
        </div>
        {reading ? (
          <p className="cc-hint" aria-busy="true">
            {t("cc.input.reading")}
          </p>
        ) : null}
        {noticeText === null ? null : (
          <p className="cc-hint" role="note">
            {noticeText}
          </p>
        )}
      </div>

      {/* C3 약속: 드롭존 바로 아래 */}
      <PromiseBlock variant="short" onVerify={() => actions.navMenu("about")} />

      {/* C4 읽은 파일 */}
      <div ref={listRef} tabIndex={-1} className="cc-input__list">
        <FileRecognitionList
          recs={shown}
          compareLast4={compare ? base.identity.accountLast4 : null}
          rowNote={(rec) => (pastedCsvWithoutAsOf(rec) ? t("cc.input.paste-no-asof") : null)}
          onRemove={(index) => {
            const item = state.recs[index];
            if (item !== undefined) actions.removeRec(item.key);
            listRef.current?.focus();
          }}
        />
      </div>

      {ok.length === 0 ? null : (
        <>
          {/* C5 볼 수 있는 곳 */}
          <section aria-labelledby="cc-input-doors-h" className="cc-stack cc-gap-2">
            <h2 id="cc-input-doors-h">{t("cc.input.doors-label")}</h2>
            <DoorCollectionRow rows={doorRows} />
          </section>

          {/* C6 계정 확인 */}
          {preview === null ? null : (
            <section className="cc-stack cc-gap-2">
              <p>
                <strong>
                  <T k="cc.input.identity" p={{ n: ok.length, cloud: t(preview.cloud === "aws" ? "cc.app.cloud.aws" : "cc.app.cloud.azure"), account: <AccountLabel alias={preview.alias} last4={preview.accountLast4} /> }} />
                </strong>
              </p>
              <p>{t("cc.input.confirm")}</p>
              {mixed ? <UnknownTone as="p">{t("cc.input.mixed")}</UnknownTone> : null}
            </section>
          )}
        </>
      )}

      {/* C7 CTA — aria-disabled + 이유 글자(안 보이는 이유를 글자로) */}
      <div className="cc-stack cc-gap-2">
        <div className="cc-actions">
          <button
            type="button"
            className="cc-btn cc-btn--primary"
            aria-disabled={blocked}
            aria-describedby={reason === null ? undefined : reasonId}
            aria-busy={building}
            onClick={() => {
              if (!blocked) void actions.build();
            }}
          >
            {compare ? t("cc.input.compare.cta") : t("cc.input.cta")}
          </button>
          <button type="button" className="cc-btn" onClick={actions.clearRecs}>
            {t("cc.input.clear")}
          </button>
        </div>
        {reason === null ? null : soonNote ? (
          // V0의 Azure 준비 중 안내와 같은 모양·문구(새 키 없음). 이유 글자 = 버튼의 aria-describedby 대상
          <Banner
            variant="demo"
            title={<span id={reasonId}>{reason}</span>}
            body={
              <button type="button" className="cc-btn" onClick={actions.azureDemo}>
                {t("cc.start.azure-soon.demo")}
              </button>
            }
          />
        ) : (
          <p id={reasonId} className="cc-hint">
            {reason}
          </p>
        )}
      </div>
    </>
  );
}
