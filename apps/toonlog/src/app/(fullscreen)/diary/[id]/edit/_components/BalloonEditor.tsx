/**
 * BalloonEditor — react-konva 기반 말풍선 에디터.
 * react-konva SSR 불가 → dynamic import ssr:false.
 * design-final §6.3 말풍선 메타 + §10 충돌해소 #2 (48px 핸들).
 * 잉크 & 리소 에디션 — 헤더/탭/팔레트 크롬만. 에디터 로직 무변경.
 *
 * 의존:
 *   - react-konva (dynamic import)
 *   - useDiary 훅
 *   - KONVA_HANDLE_SIZE = 48px
 */
"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Skeleton, Toast, Chip } from "@/components";
import { ROUTES, BALLOON_CHAR_LIMITS, KONVA_HANDLE_SIZE } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useDiary } from "@/hooks/useDiary";
import type { BalloonMeta, BalloonType, TailDirection } from "@/lib/contract";

/** react-konva SSR 불가: dynamic ssr:false */
const Stage = dynamic(
  () => import("react-konva").then((m) => m.Stage),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-lg" /> }
);
const Layer = dynamic(
  () => import("react-konva").then((m) => m.Layer),
  { ssr: false }
);
const Image = dynamic(
  () => import("react-konva").then((m) => m.Image),
  { ssr: false }
);
const Text = dynamic(
  () => import("react-konva").then((m) => m.Text),
  { ssr: false }
);
const Transformer = dynamic(
  () => import("react-konva").then((m) => m.Transformer),
  { ssr: false }
);

const BALLOON_TYPES: { type: BalloonType; label: string; emoji: string }[] = [
  { type: "speech", label: "대사형", emoji: "💬" },
  { type: "thought", label: "생각형", emoji: "💭" },
  { type: "shout", label: "외침형", emoji: "💥" },
  { type: "whisper", label: "속삭임형", emoji: "🗯" },
];

interface EditableBalloon extends BalloonMeta {
  text: string;
  panelIndex: number;
}

interface Props {
  diaryId: string;
}

export function BalloonEditor({ diaryId }: Props) {
  const router = useRouter();
  const { data: diary, isLoading } = useDiary(diaryId);

  const [activePanelIndex, setActivePanelIndex] = useState(1);
  const [balloons, setBalloons] = useState<EditableBalloon[]>([]);
  const [selectedBalloonId, setSelectedBalloonId] = useState<string | null>(null);
  const [editingBalloon, setEditingBalloon] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 캔버스 크기 (모바일 430px 기준 여백 제외)
  const CANVAS_SIZE = 380;

  function addBalloon(type: BalloonType) {
    const maxLen = BALLOON_CHAR_LIMITS[type];
    const newBalloon: EditableBalloon = {
      id: `b-${Date.now()}`,
      type,
      tail: "SW" as TailDirection,
      x: 0.3,
      y: 0.1,
      w: 0.35,
      h: 0.18,
      text: "",
      panelIndex: activePanelIndex,
      suggested_text: "",
    };
    setBalloons((prev) => [...prev, newBalloon]);
    setSelectedBalloonId(newBalloon.id);
    setEditingBalloon(newBalloon.id);
    setEditText("");
    void maxLen; // 사용 표시
  }

  function commitEdit() {
    if (!editingBalloon) return;
    const balloon = balloons.find((b) => b.id === editingBalloon);
    if (!balloon) return;
    const maxLen = BALLOON_CHAR_LIMITS[balloon.type];
    const trimmed = editText.slice(0, maxLen);
    setBalloons((prev) =>
      prev.map((b) => (b.id === editingBalloon ? { ...b, text: trimmed } : b))
    );
    setEditingBalloon(null);
  }

  function deleteBalloon(id: string) {
    setBalloons((prev) => prev.filter((b) => b.id !== id));
    setSelectedBalloonId(null);
  }

  function handleDone() {
    // 편집 완료 — 결과 화면으로 복귀
    // 실제 저장은 PATCH /api/diary/:id/balloons (백엔드 의존)
    router.push(ROUTES.diary(diaryId));
  }

  const activePanel = diary?.panels.find((p) => p.index === activePanelIndex);
  const panelBalloons = balloons.filter((b) => b.panelIndex === activePanelIndex);

  if (isLoading && !diary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-80 w-80 rounded-lg" />
      </div>
    );
  }

  if (!diary) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-balloon text-lg text-[var(--color-text-muted)]">{COPY.error.notFound}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-base)]">

      {/* 헤더 — 잉크 라인 하단 구분 + font-heading */}
      <header className="flex items-center gap-3 border-b-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] px-5 py-3">
        <button
          onClick={() => router.back()}
          aria-label="취소"
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-bg-subtle)] font-english text-lg text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        >
          ←
        </button>
        <h1 className="flex-1 font-heading text-base text-[var(--color-text-primary)]">
          말풍선 편집
        </h1>
        <Button variant="primary" size="sm" onClick={handleDone}>
          완료
        </Button>
      </header>

      {/* 컷 탭 선택 — Chip 리소 스타일 */}
      <div className="flex gap-2 px-5 pb-2 pt-3" role="tablist">
        {diary.panels.map((panel) => (
          <Chip
            key={panel.index}
            selected={activePanelIndex === panel.index}
            onClick={() => setActivePanelIndex(panel.index)}
            role="tab"
            aria-selected={activePanelIndex === panel.index}
            size="sm"
            className="flex-1 justify-center"
          >
            <span className="font-english">{panel.index}</span>컷
          </Chip>
        ))}
      </div>

      {/* 캔버스 — 테두리/크롬만 리소. 내부 konva 로직 무변경 */}
      <div className="flex flex-1 flex-col items-center px-5 py-2">
        <div
          className="relative overflow-hidden rounded-lg border-[3px] border-[var(--color-line)] shadow-[var(--shadow-pop-lg)]"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          aria-label={`${activePanelIndex}컷 편집 캔버스`}
        >
          {activePanel ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePanel.previewUrl ?? activePanel.imageUrl}
                alt={activePanel.caption ?? `${activePanelIndex}컷`}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* react-konva 오버레이 레이어 — 절대 변경 금지 */}
              <Stage
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="absolute inset-0"
                onClick={(e) => {
                  if (e.target === e.target.getStage()) {
                    setSelectedBalloonId(null);
                    if (editingBalloon) commitEdit();
                  }
                }}
              >
                <Layer>
                  {panelBalloons.map((b) => {
                    const bx = b.x * CANVAS_SIZE;
                    const by = b.y * CANVAS_SIZE;
                    const bw = b.w * CANVAS_SIZE;
                    const bh = b.h * CANVAS_SIZE;
                    const isSelected = selectedBalloonId === b.id;

                    return (
                      <Text
                        key={b.id}
                        x={bx}
                        y={by}
                        width={bw}
                        height={bh}
                        text={b.text || `${b.type === "speech" ? "대사" : b.type === "thought" ? "생각" : b.type === "shout" ? "외침" : "속삭임"}...`}
                        fontSize={14}
                        fontFamily="'Cafe24Danjunghae', cursive"
                        fill={isSelected ? "#FF6B6B" : "#1A1A1A"}
                        align="center"
                        verticalAlign="middle"
                        padding={8}
                        draggable
                        // 48px 핸들 (design-final §10 충돌해소 #2)
                        hitStrokeWidth={KONVA_HANDLE_SIZE / 2}
                        onClick={() => {
                          setSelectedBalloonId(b.id);
                        }}
                        onDblClick={() => {
                          setSelectedBalloonId(b.id);
                          setEditingBalloon(b.id);
                          setEditText(b.text);
                        }}
                        onDragEnd={(e) => {
                          const newX = e.target.x() / CANVAS_SIZE;
                          const newY = e.target.y() / CANVAS_SIZE;
                          setBalloons((prev) =>
                            prev.map((bl) =>
                              bl.id === b.id
                                ? { ...bl, x: Math.max(0, Math.min(1 - b.w, newX)), y: Math.max(0, Math.min(1 - b.h, newY)) }
                                : bl
                            )
                          );
                        }}
                      />
                    );
                  })}
                </Layer>
              </Stage>
            </>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>

        {/* 텍스트 편집 인라인 */}
        {editingBalloon && (
          <div className="mt-3 w-full">
            {(() => {
              const balloon = balloons.find((b) => b.id === editingBalloon);
              const maxLen = balloon ? BALLOON_CHAR_LIMITS[balloon.type] : 50;
              return (
                <>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value.slice(0, maxLen))}
                    maxLength={maxLen}
                    rows={2}
                    aria-label="말풍선 텍스트"
                    placeholder={`최대 ${maxLen}자`}
                    className="w-full rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2 font-balloon text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-pop-sm)] outline-none resize-none transition-[box-shadow] duration-150 focus-visible:shadow-[var(--shadow-focus)]"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-english text-xs text-[var(--color-text-muted)]">
                      {editText.length}/{maxLen}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingBalloon(null)}>
                        취소
                      </Button>
                      <Button size="sm" variant="primary" onClick={commitEdit}>
                        확인
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* 선택된 말풍선 삭제 */}
        {selectedBalloonId && !editingBalloon && (
          <Button
            size="sm"
            variant="danger"
            className="mt-2"
            onClick={() => deleteBalloon(selectedBalloonId)}
          >
            말풍선 삭제
          </Button>
        )}
      </div>

      {/* 말풍선 팔레트 — 잉크 탑 라인 + 리소 카드 버튼 */}
      <div className="border-t-2 border-[var(--color-line)] bg-[var(--color-surface-raised)] px-5 pb-safe py-3">
        <p className="mb-2 font-heading text-xs text-[var(--color-text-muted)]">
          말풍선 추가
        </p>
        <div className="flex gap-2">
          {BALLOON_TYPES.map((bt) => (
            <button
              key={bt.type}
              onClick={() => addBalloon(bt.type)}
              className="flex flex-1 flex-col items-center gap-1 rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-bg-subtle)] py-2 font-heading text-xs text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-sm)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              aria-label={`${bt.label} 추가`}
            >
              <span className="text-xl" aria-hidden>{bt.emoji}</span>
              <span>{bt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {toastMsg && (
        <Toast message={toastMsg} variant="info" onDismiss={() => setToastMsg(null)} />
      )}
    </div>
  );
}
