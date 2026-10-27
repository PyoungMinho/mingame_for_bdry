// src/app/cloudcheck/_client/components/ExceptionForm.tsx — 예외 표시 인라인 폼(위험·주의 대상 행 바로 아래). 상태는 바뀌지 않는다(INV-8) — 라벨만 붙는다. 디자인 최종안 §5-2.
//  - 사유 1~500자(필수) + 만료일(필수, 내일 ~ 오늘+EXCEPTION_MAX_DAYS일, 기본 30일 뒤). 사유 입력칸은 PasteBox와 같은 맞춤법·자동완성 차단 7속성(G-D10).
//  - 오류는 빨강 없이: 2px 잉크 테두리(aria-invalid) + 굵은 잉크 문장 + aria-describedby + 첫 오류 필드로 포커스. Esc = 취소.
//  - 날짜 계산은 입력 문자열 산술뿐이다(현재 시각은 읽지 않는다 — 오늘은 state/clock.ts가 today로 넘긴다).
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactElement } from "react";
import { EXCEPTION_MAX_DAYS } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { DisplayValue, IsoDate } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { T } from "./T";
import "./actions.css";
import "./ExceptionForm.css";

export interface ExceptionFormProps {
  /** 표시할 대상의 이름(화면 제목에 MaskedValue로) */
  readonly target: DisplayValue;
  /** 오늘(KST 로컬 날짜) — 최소·최대 만료일의 기준 */
  readonly today: IsoDate;
  readonly onSave: (v: { reason: string; until: IsoDate }) => void;
  readonly onCancel: () => void;
}

/** 폼 기본 만료일(오늘 + 30일). 상한은 EXCEPTION_MAX_DAYS */
export const EXCEPTION_DEFAULT_DAYS = 30;
const MAX_REASON = 500;
const DAY_MS = 86_400_000;

/** YYYY-MM-DD에 일수를 더한다(UTC 산술 — 시간대에 영향받지 않는다) */
export function addDays(date: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ExceptionForm({ target, today, onSave, onCancel }: ExceptionFormProps): ReactElement {
  const base = useId();
  const titleId = `${base}-title`;
  const reasonId = `${base}-reason`;
  const untilId = `${base}-until`;
  const reasonErrId = `${base}-reason-err`;
  const untilErrId = `${base}-until-err`;
  const min = addDays(today, 1);
  const max = addDays(today, EXCEPTION_MAX_DAYS);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState(addDays(today, EXCEPTION_DEFAULT_DAYS));
  const [reasonBad, setReasonBad] = useState(false);
  const [untilBad, setUntilBad] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const untilRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const trimmed = reason.trim();
    const badReason = trimmed.length < 1 || trimmed.length > MAX_REASON;
    const badUntil = !DATE_RE.test(until) || until < min || until > max;
    setReasonBad(badReason);
    setUntilBad(badUntil);
    if (badReason) reasonRef.current?.focus();
    else if (badUntil) untilRef.current?.focus();
    else onSave({ reason: trimmed, until: until as IsoDate });
  };

  return (
    <form
      className="cc-xf"
      noValidate
      aria-labelledby={titleId}
      onSubmit={submit}
      onKeyDown={(e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <h4 className="cc-xf__h" id={titleId}>
        <T k="cc.c.exc.title" p={{ target: { v: target } }} />
      </h4>
      <div>
        <label className="cc-lab" htmlFor={reasonId}>
          {t("cc.c.exc.reason")}
        </label>
        <textarea
          ref={reasonRef}
          id={reasonId}
          className="cc-in"
          rows={3}
          maxLength={MAX_REASON}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          aria-invalid={reasonBad ? "true" : undefined}
          aria-describedby={reasonBad ? reasonErrId : undefined}
        />
        <p className="cc-hint">{t("cc.c.exc.max-chars")}</p>
        {reasonBad ? (
          <p id={reasonErrId} className="cc-err">
            {t("cc.c.exc.err.reason")}
          </p>
        ) : null}
      </div>
      <div>
        <label className="cc-lab" htmlFor={untilId}>
          {t("cc.c.exc.until")}
        </label>
        <input
          ref={untilRef}
          id={untilId}
          type="date"
          className="cc-in"
          min={min}
          max={max}
          value={until}
          onChange={(e) => setUntil(e.target.value)}
          aria-invalid={untilBad ? "true" : undefined}
          aria-describedby={untilBad ? untilErrId : undefined}
        />
        <p className="cc-hint">{t("cc.c.exc.until-help")}</p>
        {untilBad ? (
          <p id={untilErrId} className="cc-err">
            {t("cc.c.exc.err.until")}
          </p>
        ) : null}
      </div>
      <p className="cc-hint">{t("cc.c.exc.state-note")}</p>
      <div className="cc-actions">
        <button type="submit" className="cc-btn cc-btn--primary">
          {t("cc.c.exc.save")}
        </button>
        <button type="button" className="cc-btn cc-btn--ghost" onClick={onCancel}>
          {t("cc.c.exc.cancel")}
        </button>
      </div>
    </form>
  );
}
