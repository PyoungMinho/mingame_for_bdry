"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Map,
  Share2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MoiraShell } from "@/components/moira/MoiraShell";
import { Button } from "@/components/moira/Button";
import { FairnessBars } from "@/components/moira/FairnessBars";
import { StickyBottomBar } from "@/components/moira/StickyBottomBar";
import { FairnessComputing } from "@/components/moira/States";
import { useReducedMotion } from "@/components/moira/motion";
// ── 디자인시스템 컴포넌트 (5종) — §2 계약 ──────────────────────────────────────
import { RouteMapCanvas } from "@/components/moira/RouteMapCanvas";
import { MemberRouteChip } from "@/components/moira/MemberRouteChip";
import { TransportBadge } from "@/components/moira/TransportBadge";
import { FairnessScoreBadge } from "@/components/moira/FairnessScoreBadge";
import { PlaceEditSheet } from "@/components/moira/PlaceEditSheet";
// ── 단일 타입 정의점 — §4 ──────────────────────────────────────────────────────
import type { PlaceCandidate, RoutePlace } from "@/lib/moira/route";
// ── 데이터 단일 소스 — ROUTE_PLACES(nogari/gwangjang/ddp) ──────────────────────
import { MEMBERS, ROUTE_PLACES } from "@/lib/moira/mock";
import { fairLevel, gapOf, FAIR_STYLE } from "@/lib/moira/fairness";

// ── 장소 후보 A/B/C — ROUTE_PLACES 3곳을 PlaceEditSheet 계약(rank)으로 매핑 ──
const RANKS = ["A", "B", "C"] as const;
const PLACE_CANDIDATES: PlaceCandidate[] = ROUTE_PLACES.map((p, i) => ({
  id: p.id,
  name: p.name,
  destinationLatLng: p.destinationLatLng,
  fairScore: p.fairScore,
  rank: RANKS[i] ?? "C",
}));

// ── 드래그업 패널 ─────────────────────────────────────────────────────────────
type PanelSnap = "peek" | "default" | "full";

const SNAP_MAP: Record<PanelSnap, string> = {
  peek: "translate-y-[calc(100%_-_60px)]", // 핸들+한 줄만 노출 (지도 95%)
  default: "translate-y-0", // 지도 62vh
  full: "translate-y-[calc(120px_-_62vh)]", // 위로 올림 = -(62vh-120px), 지도 30% 노출
};

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function MoiraRoutesPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  // 진입 로딩 (≤1초, 데이터 즉시 준비 — §6-D)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  // 선택된 장소 (RoutePlace 전체 — memberRoutes/곡선 polyline 포함)
  const [selectedPlace, setSelectedPlace] = useState<RoutePlace>(ROUTE_PLACES[0]);
  const [prevScore, setPrevScore] = useState(ROUTE_PLACES[0].fairScore);

  // 활성 멤버 (5명↓ → 전체 ON = 빈배열, §1-2 스파게티 방지)
  const allMemberCount = selectedPlace.memberRoutes.length;
  const [activeMembers, setActiveMembers] = useState<string[]>([]);

  // 6인 캡 토스트
  const [capToast, setCapToast] = useState(false);

  // 드래그업 패널
  const [panelSnap, setPanelSnap] = useState<PanelSnap>("default");
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartSnap = useRef<PanelSnap>("default");

  // PlaceEditSheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // 공평성 격차 — gapOf(times) 기반 (단일 소스)
  const gap = useMemo(
    () =>
      gapOf(
        selectedPlace.memberRoutes.map((r) => ({
          name: r.name,
          minutes: r.minutes,
          transfers: r.transfers,
        })),
      ),
    [selectedPlace],
  );
  const fairStyle = FAIR_STYLE[fairLevel(gap)];

  // 손해 주체 카피 — 최장 이동시간 멤버
  const maxMember = useMemo(() => {
    const routes = selectedPlace.memberRoutes;
    if (!routes.length) return null;
    return routes.reduce((a, b) => (a.minutes > b.minutes ? a : b)).name;
  }, [selectedPlace]);

  // 멤버 탭 토글 (5↓: 전체 ON 기본, 토글로 단일 강조 / 7+: OFF 기본)
  const toggleMember = useCallback(
    (id: string) => {
      setActiveMembers((prev) => {
        if (allMemberCount <= 5) {
          if (prev.length === 0) return [id]; // 전체→단일 선택
          const next = prev.includes(id)
            ? prev.filter((m) => m !== id)
            : [...prev, id];
          return next.length === allMemberCount ? [] : next; // 전부 켜지면 전체로
        }
        // 7명+ : OFF 기본
        return prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      });
    },
    [allMemberCount],
  );

  // 6인 캡 초대 시도 — P0 데모는 실제 초대 플로우가 없어 항상 캡 안내 토스트로 피드백(B2B 넛지 겸용)
  const handleAddMember = () => {
    setCapToast(true);
    setTimeout(() => setCapToast(false), 3000);
  };

  // 장소 선택 → 점수 실시간 갱신 (PlaceEditSheet · 상단 칩 공용)
  const handlePlaceSelect = useCallback(
    (c: PlaceCandidate) => {
      const place = ROUTE_PLACES.find((p) => p.id === c.id);
      if (!place) return;
      setPrevScore(selectedPlace.fairScore);
      setSelectedPlace(place);
    },
    [selectedPlace],
  );

  // 핀 드래그 → 장소 수정 시트 열기(§1-3 핀 드래그 → 점수 재계산 진입점)
  const handlePinDrag = useCallback(() => {
    setSheetOpen(true);
  }, []);

  // 직접 핀 찍기 (P0: 시트 닫기만 — 별도 핀 모드 P1)
  const handleCustomPin = useCallback(() => {
    setSheetOpen(false);
  }, []);

  // 패널 드래그
  const onPanelTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartSnap.current = panelSnap;
  };
  const onPanelTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    if (dy < -40) {
      setPanelSnap(dragStartSnap.current === "peek" ? "default" : "full");
    } else if (dy > 40) {
      setPanelSnap(dragStartSnap.current === "full" ? "default" : "peek");
    }
  };

  if (!ready) return <FairnessComputing members={MEMBERS} />;

  return (
    <MoiraShell
      step={2}
      headerRight={
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-moira-body transition-colors hover:bg-moira-surface min-h-[44px] min-w-[44px]"
          aria-label="공유하기"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).catch(() => {});
          }}
        >
          <Share2 size={18} strokeWidth={2.25} />
        </button>
      }
      bottomBar={
        !sheetOpen ? (
          <StickyBottomBar>
            <Button
              variant="outline"
              block={false}
              size="lg"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setSheetOpen(true)}
            >
              <Map size={18} strokeWidth={2.25} className="mr-1.5" />
              장소 바꿔보기
            </Button>
            <Button
              block={false}
              className="flex-1 whitespace-nowrap"
              onClick={() => router.push("/moira/vote")}
              rightIcon={<ArrowRight size={18} strokeWidth={2.5} />}
            >
              이 장소로 투표
            </Button>
          </StickyBottomBar>
        ) : null
      }
    >
      {/* 콘텐츠는 MoiraShell main 패딩 없이 전체 화면 구성 */}
      <div className="-mx-5 -mt-5">
        {/* 지도 영역 62vh */}
        <div className="relative">
          <RouteMapCanvas
            members={selectedPlace.memberRoutes}
            destination={selectedPlace.destinationLatLng}
            activeMembers={activeMembers}
            fairGap={gap}
            animateOnMount={!reduced}
            draggablePin
            onPinDrag={handlePinDrag}
            className="h-[62vh]"
          />

          {/* 상단 오버레이 — 장소 A/B/C 칩 */}
          <div className="absolute left-3 right-3 top-3 z-30 flex gap-2 overflow-x-auto no-scrollbar">
            {PLACE_CANDIDATES.map((c) => {
              const isSelected = selectedPlace.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handlePlaceSelect(c)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-md transition-all min-h-[44px]",
                    isSelected
                      ? "bg-moira-brand text-white"
                      : "bg-white/92 text-moira-ink backdrop-blur ring-1 ring-moira-border",
                  )}
                >
                  <span className="font-extrabold">{c.rank}</span>
                  <span className="max-w-[80px] truncate">{c.name}</span>
                </button>
              );
            })}
          </div>

          {/* 하단 오버레이 — FairnessScoreBadge (점수 실시간 변동) */}
          <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2">
            <FairnessScoreBadge
              prev={prevScore}
              current={selectedPlace.fairScore}
              animated={!reduced}
              className="shadow-md"
            />
          </div>
        </div>

        {/* MemberRouteChip 탭바 (최대 6칩 + [+]) */}
        <div className="flex items-center gap-2 overflow-x-auto bg-white px-4 py-2.5 no-scrollbar z-30 relative border-b border-moira-border/50">
          {selectedPlace.memberRoutes.slice(0, 6).map((m) => {
            const isActive =
              activeMembers.length === 0 || activeMembers.includes(m.id);
            return (
              <MemberRouteChip
                key={m.id}
                memberId={m.id}
                name={m.name}
                avatar={m.avatar}
                minutes={m.minutes}
                mode={m.mode}
                active={isActive}
                onToggle={toggleMember}
              />
            );
          })}

          {/* [+] 멤버 추가 (6인 캡) */}
          <button
            type="button"
            onClick={handleAddMember}
            className="flex h-10 w-10 shrink-0 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
            aria-label="멤버 추가"
          >
            <UserPlus size={16} strokeWidth={2.25} />
          </button>
        </div>

        {/* 6인 캡 토스트 */}
        {capToast && (
          <div
            role="alert"
            className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-moira-ink/90 px-4 py-3 text-center text-[13px] font-bold text-white shadow-xl"
          >
            소그룹(6명)까지 무료
            <br />
            더 큰 모임은 팀 플랜
          </div>
        )}

        {/* 드래그업 패널 */}
        <div
          ref={panelRef}
          className={cn(
            "relative z-40 bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(15,23,42,.10)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
            SNAP_MAP[panelSnap],
          )}
          onTouchStart={onPanelTouchStart}
          onTouchEnd={onPanelTouchEnd}
        >
          {/* 핸들 */}
          <div
            className="flex cursor-grab items-center justify-center py-3"
            onClick={() => {
              setPanelSnap((s) =>
                s === "peek" ? "default" : s === "default" ? "full" : "peek",
              );
            }}
          >
            <span className="h-1 w-10 rounded-full bg-slate-200" />
          </div>

          <div className="px-5 pb-8">
            {/* FairnessBars */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[14px] font-extrabold text-moira-ink">이동시간 공평성</h3>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                    fairStyle.chipBg,
                    fairStyle.chipText,
                  )}
                >
                  격차 {gap}분 · {fairStyle.label}
                </span>
              </div>
              <FairnessBars
                members={selectedPlace.memberRoutes.map((r) => ({
                  name: r.name,
                  minutes: r.minutes,
                  transfers: r.transfers,
                }))}
                animate={panelSnap !== "peek"}
              />
            </div>

            {/* 손해 주체 카피 */}
            {maxMember && gap > 0 && (
              <p
                className={cn("mb-4 text-[13px] font-semibold", fairStyle.text)}
                aria-live="assertive"
              >
                {maxMember}님이 {gap}분 더 이동해요
              </p>
            )}

            {/* MemberRouteDetail — segments를 TransportBadge 조합으로 렌더 (§2-보조) */}
            <div className="space-y-4">
              <h3 className="text-[14px] font-extrabold text-moira-ink">경로 상세</h3>
              {selectedPlace.memberRoutes.map((m) => {
                const isVisible =
                  activeMembers.length === 0 || activeMembers.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl bg-moira-surface p-3.5 ring-1 ring-moira-border transition-opacity duration-200",
                      !isVisible && "opacity-30",
                    )}
                  >
                    <div className="mb-2.5 flex items-center gap-2">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                        style={{ backgroundColor: m.avatar }}
                      >
                        {m.name[0]}
                      </span>
                      <span className="text-[13px] font-bold text-moira-ink">{m.name}</span>
                      <span className="ml-auto text-[13px] font-extrabold tabular-nums text-moira-ink">
                        {m.minutes}분
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.segments.map((seg, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          {idx > 0 && (
                            <span className="text-[11px] text-slate-300">›</span>
                          )}
                          <TransportBadge mode={seg.mode} line={seg.line} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PlaceEditSheet */}
      <PlaceEditSheet
        candidates={PLACE_CANDIDATES}
        currentScore={selectedPlace.fairScore}
        onSelect={handlePlaceSelect}
        onCustomPin={handleCustomPin}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </MoiraShell>
  );
}
