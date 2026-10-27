// src/app/cloudcheck/_client/components/ConfirmDialog.tsx — 리포트 닫기 확인(앱 전체에서 하나). 디자인 최종안 §5-2·UX §4-10.
//  - <dialog>.showModal(): 처음 포커스는 [리포트로 돌아가기](되돌릴 수 있는 쪽), Esc = 돌아가기, 닫히면 브라우저가 호출한 버튼으로 포커스를 돌려준다.
//  - 파괴적 버튼도 주 버튼 모양을 쓰지 않는다(외곽선). 빨강은 '위험' 판정 전용이라 쓰지 않는다.
//  - <dialog>를 지원하지 않으면 같은 문구의 인라인 패널로 바꾼다(Esc 키로 돌아가기).
//  - 글자는 S 카탈로그의 cc.app.dlg.close-report.*(s-keys.ts). 트리거는 T1~T4·T11 중 '실제 리포트가 있을 때'만 — 호출하는 쪽이 정한다.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactElement, type SyntheticEvent } from "react";
import { t } from "../i18n/index";
import { S_KEY } from "./s-keys";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onStay: () => void;
  readonly onGo: () => void;
}

function supportsDialog(): boolean {
  return typeof HTMLDialogElement !== "undefined" && typeof HTMLDialogElement.prototype.showModal === "function";
}

export function ConfirmDialog({ open, onStay, onGo }: ConfirmDialogProps): ReactElement | null {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const native = supportsDialog();

  useEffect(() => {
    const d = dialogRef.current;
    if (native && d !== null) {
      if (open && !d.open) d.showModal();
      if (!open && d.open) d.close();
    }
    if (open && stayRef.current !== null) stayRef.current.focus();
  }, [open, native]);

  const content = (
    <>
      <h2 id={titleId}>{t(S_KEY.dlgTitle)}</h2>
      <p id={bodyId}>{t(S_KEY.dlgBody)}</p>
      <div className="cc-dlg__act">
        <button ref={stayRef} type="button" className="cc-btn cc-btn--primary" onClick={onStay}>
          {t(S_KEY.dlgStay)}
        </button>
        <button type="button" className="cc-btn" onClick={onGo}>
          {t(S_KEY.dlgGo)}
        </button>
      </div>
    </>
  );

  if (!native) {
    if (!open) return null;
    return (
      <section
        className="cc-banner"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onStay();
          }
        }}
      >
        {content}
      </section>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e: SyntheticEvent<HTMLDialogElement>) => {
        // Esc = 돌아가기(대화상자는 우리가 닫는다 — open prop이 단일 원천)
        e.preventDefault();
        onStay();
      }}
    >
      {content}
    </dialog>
  );
}
