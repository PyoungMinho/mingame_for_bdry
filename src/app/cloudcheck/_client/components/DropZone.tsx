// src/app/cloudcheck/_client/components/DropZone.tsx — 파일 놓기/고르기 영역(DropZone)과 입력 탭(InputTabs). 디자인 최종안 §5-2·UX §6-5.
//  - [파일 고르기] 버튼이 항상 보인다(모바일에는 드래그가 없다 — 키보드·모바일의 유일한 길). 숨은 <input type="file" multiple accept=".json,.csv">를 버튼이 연다. 읽는 중이면 aria-busy.
//  - 끌어 놓는 중에는 .cc-drop--over(실선 잉크 + 놓으면 읽습니다). 영역 안에 놓은 파일은 여기서 읽고 창 전체 드롭 처리(state/drop.ts)로 번지지 않게 전파를 멈춘다.
//  - 폴더는 읽지 않는다 — 폴더가 섞여 있으면 onFolder로 알리고(안내 문구는 페이지의 cc.input.folder) 폴더는 files에서 뺀다.
//  - InputTabs: role=tablist(앱에서 하나), 화살표 키·Home·End로 이동(선택이 곧 이동이 아니라 같은 화면 안 전환). 패널은 페이지가 DOM_ID.inputPanel로 id를 붙여 그린다.
import { useId, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement } from "react";
import { t } from "../i18n/index";
import { cx } from "./cx";
import { DOM_ID } from "./dom-ids";
import { Icon } from "./Icon";
import { S_KEY } from "./s-keys";
import "./DropZone.css";

export interface DropZoneProps {
  readonly onFiles: (files: readonly File[]) => void;
  readonly busy: boolean;
  /** 폴더를 놓았을 때(폴더는 읽지 않는다) */
  readonly onFolder?: () => void;
}

/** 놓은 항목에서 파일과 폴더를 가른다(webkitGetAsEntry가 없으면 dataTransfer.files 전부를 파일로) */
export function filesFromDrop(dt: DataTransfer): { readonly files: readonly File[]; readonly folders: number } {
  const items = Array.from(dt.items ?? []);
  const canTellFolders = items.length > 0 && items.every((it) => typeof it.webkitGetAsEntry === "function");
  if (!canTellFolders) return { files: Array.from(dt.files ?? []), folders: 0 };
  const files: File[] = [];
  let folders = 0;
  for (const it of items) {
    if (it.kind !== "file") continue;
    const entry = it.webkitGetAsEntry();
    if (entry !== null && entry.isDirectory) {
      folders += 1;
      continue;
    }
    const f = it.getAsFile();
    if (f !== null) files.push(f);
  }
  return { files, folders };
}

export function DropZone({ onFiles, busy, onFolder }: DropZoneProps): ReactElement {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  return (
    <div
      className={cx("cc-drop", over && "cc-drop--over")}
      aria-busy={busy}
      onDragEnter={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e: DragEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const { files, folders } = filesFromDrop(e.dataTransfer);
        if (folders > 0 && onFolder !== undefined) onFolder();
        if (files.length > 0) onFiles(files);
      }}
    >
      <Icon name="file" size={24} />
      <p id={hintId} className="cc-drop__hint">
        {over ? t("cc.c.drop.over") : t("cc.c.drop.label")}
      </p>
      <button type="button" className="cc-btn cc-btn--primary" aria-describedby={hintId} onClick={() => inputRef.current?.click()}>
        {t("cc.c.drop.button")}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".json,.csv"
        className="cc-vh"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = ""; // 같은 파일을 다시 골라도 change가 나도록
          if (picked.length > 0) onFiles(picked);
        }}
      />
      <p className="cc-small cc-muted">{t("cc.c.drop.accept")}</p>
      <p className="cc-small cc-muted">{t("cc.c.drop.limit")}</p>
    </div>
  );
}

export type InputTab = "file" | "paste";

export interface InputTabsProps {
  readonly value: InputTab;
  readonly onChange: (v: InputTab) => void;
}

const TABS: readonly InputTab[] = ["file", "paste"];

export function InputTabs({ value, onChange }: InputTabsProps): ReactElement {
  const refs = useRef<Partial<Record<InputTab, HTMLButtonElement | null>>>({});
  const move = (to: InputTab): void => {
    onChange(to);
    refs.current[to]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, tab: InputTab): void => {
    const i = TABS.indexOf(tab);
    if (e.key === "ArrowRight") move(TABS[(i + 1) % TABS.length] as InputTab);
    else if (e.key === "ArrowLeft") move(TABS[(i + TABS.length - 1) % TABS.length] as InputTab);
    else if (e.key === "Home") move(TABS[0] as InputTab);
    else if (e.key === "End") move(TABS[TABS.length - 1] as InputTab);
    else return;
    e.preventDefault();
  };
  return (
    <div role="tablist" className="cc-tabs">
      {TABS.map((tab) => (
        <button
          key={tab}
          ref={(el) => {
            refs.current[tab] = el;
          }}
          type="button"
          role="tab"
          id={DOM_ID.inputTab(tab)}
          className="cc-tab"
          aria-selected={value === tab}
          aria-controls={DOM_ID.inputPanel(tab)}
          tabIndex={value === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(e) => onKey(e, tab)}
        >
          {t(tab === "file" ? S_KEY.tabFile : S_KEY.tabPaste)}
        </button>
      ))}
    </div>
  );
}
