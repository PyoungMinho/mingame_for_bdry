// src/app/cloudcheck/_client/components/PasteBox.tsx — 관문 ⑤: 붙여넣기 입력칸. 값을 보관하지 않는다. 디자인 최종안 §5-1.
//  - onPaste: preventDefault → clipboardData의 text/plain이 있으면 onText, 없으면 onNonText. 글자를 끌어다 놓은 경우도 같다.
//  - 값은 언제나 빈 문자열(입력칸에 남지 않는다 → 키 파일 거부 때 '입력칸을 비웠습니다'가 사실이 된다). 25MB 문자열을 <textarea>에 넣지 않는다.
//  - onChange는 아무것도 하지 않는 함수(제어 컴포넌트 경고 방지). readOnly는 쓰지 않는다(붙여넣기 자체가 막힐 수 있다).
//  - 맞춤법·자동완성·문법 확장 7속성 고정(방향서 §2-4, 가드 G-D10).
import { useId, type ClipboardEvent, type DragEvent, type ReactElement } from "react";
import { t } from "../i18n/index";
import { cx } from "./cx";
import "./PasteBox.css";

export interface PasteBoxProps {
  readonly onText: (text: string) => void;
  readonly onNonText: () => void;
  /** 입력칸 설명을 더하는 다른 요소 id(예: 무전송 약속 문구) */
  readonly describedBy?: string;
}

function ignoreChange(): void {
  /* 입력칸은 값을 보관하지 않는다 */
}

export function PasteBox({ onText, onNonText, describedBy }: PasteBoxProps): ReactElement {
  const id = useId();
  const hintId = `${id}-hint`;
  const deliver = (text: string): void => {
    if (text.length > 0) onText(text);
    else onNonText();
  };
  return (
    <div>
      <label className="cc-lab" htmlFor={id}>
        {t("cc.c.paste.label")}
      </label>
      <textarea
        id={id}
        className={cx("cc-ta", "cc-paste")}
        value=""
        onChange={ignoreChange}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        aria-describedby={describedBy === undefined ? hintId : `${hintId} ${describedBy}`}
        onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
          e.preventDefault();
          deliver(e.clipboardData.getData("text/plain"));
        }}
        onDrop={(e: DragEvent<HTMLTextAreaElement>) => {
          // 파일을 놓은 경우는 창 전체 드롭 처리(state/drop.ts)가 맡는다 — 여기서는 글자 드래그만 읽는다
          if (e.dataTransfer.files.length > 0) return;
          e.preventDefault();
          deliver(e.dataTransfer.getData("text/plain"));
        }}
      />
      <p id={hintId} className="cc-hint">
        {t("cc.c.paste.hint")}
      </p>
    </div>
  );
}
