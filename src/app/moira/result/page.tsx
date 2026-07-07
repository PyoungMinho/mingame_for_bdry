"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Route, SlidersHorizontal } from "lucide-react";
import { MoiraShell } from "@/components/moira/MoiraShell";
import { Button } from "@/components/moira/Button";
import { StationHero } from "@/components/moira/StationHero";
import { PlaceCard } from "@/components/moira/PlaceCard";
import { StickyBottomBar } from "@/components/moira/StickyBottomBar";
import { FairnessComputing, ErrorState } from "@/components/moira/States";
import { avgOf, gapOf } from "@/lib/moira/fairness";
import { buildScenario, DEFAULT_ORIGIN_ID, type Scenario } from "@/lib/moira/scenario";
import { MEMBERS } from "@/lib/moira/mock";
import { fetchLiveScenario } from "@/lib/moira/liveClient";

type View = "loading" | "ready" | "error";

export default function MoiraResultPage() {
  const router = useRouter();

  const [originId, setOriginId] = useState(DEFAULT_ORIGIN_ID);
  const [live, setLive] = useState<Scenario | null>(null);
  const [view, setView] = useState<View>("loading");

  // 진입 시 공평성 계산 연출 → 결과 공개.
  // ?from=<preset> 시드 시나리오 · ?addr=<주소> 라이브 실계산(키 있으면) · ?view= 상태 고정.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    if (from) setOriginId(from);
    // 라이브 실계산 시도 — 키 없으면 null 반환 → 시드로 폴백(현 동작 유지)
    const addr = params.get("addr");
    if (addr) {
      const members = [
        { id: MEMBERS[0].id, name: MEMBERS[0].name, avatar: MEMBERS[0].avatar, address: addr },
        ...MEMBERS.slice(1).map((m) => ({
          id: m.id, name: m.name, avatar: m.avatar,
          lat: m.originLatLng?.lat, lng: m.originLatLng?.lng,
        })),
      ];
      fetchLiveScenario(members).then((s) => { if (s) setLive(s); });
    }
    const forced = params.get("view");
    if (forced === "ready" || forced === "error" || forced === "loading") {
      setView(forced as View);
      return;
    }
    const t = window.setTimeout(() => setView("ready"), 1800);
    return () => window.clearTimeout(t);
  }, []);

  // 라이브(실계산) 있으면 우선, 없으면 시드 엔진(0원 근사)
  const seed = useMemo(() => buildScenario(originId), [originId]);
  const scenario = live ?? seed;
  const members = scenario.members;
  const station = scenario.station;

  // 공평한 순(격차 오름차순) 정렬
  const ranked = useMemo(
    () => [...scenario.places].sort((a, b) => gapOf(a.times) - gapOf(b.times)),
    [scenario],
  );
  const fairest = ranked[0];
  const [selectedId, setSelectedId] = useState(fairest.id);
  // 출발지 바뀌면 선택을 가장 공평한 곳으로 초기화
  useEffect(() => setSelectedId(fairest.id), [fairest.id]);

  const recompute = () => {
    setView("loading");
    window.setTimeout(() => setView("ready"), 1600);
  };

  if (view === "loading") return <FairnessComputing members={members} />;

  if (view === "error") {
    return (
      <MoiraShell step={2}>
        <ErrorState
          title="중간지점을 찾지 못했어요"
          desc="출발지가 너무 멀리 떨어져 있거나 대중교통 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
          onRetry={recompute}
          retryLabel="다시 계산하기"
          secondaryLabel="출발지 다시 입력"
          onSecondary={() => router.push("/moira")}
        />
      </MoiraShell>
    );
  }

  return (
    <MoiraShell
      step={2}
      bottomBar={
        <StickyBottomBar>
          <Button
            variant="outline"
            block={false}
            size="lg"
            className="shrink-0 whitespace-nowrap"
            leftIcon={<Route size={18} strokeWidth={2.25} />}
            onClick={() => {
              const addr = new URLSearchParams(window.location.search).get("addr");
              router.push(`/moira/routes?from=${originId}${addr ? `&addr=${encodeURIComponent(addr)}` : ""}`);
            }}
          >
            경로 보기
          </Button>
          <Button
            block={false}
            className="flex-1 whitespace-nowrap"
            onClick={() => router.push("/moira/vote")}
            rightIcon={<ArrowRight size={18} strokeWidth={2.5} />}
          >
            투표 시작
          </Button>
        </StickyBottomBar>
      }
    >
      <StationHero
        station={station.name}
        lines={station.lines}
        reason={station.reason}
        gap={gapOf(fairest.times)}
        avg={avgOf(fairest.times)}
        members={members}
      />

      <div className="mb-2.5 mt-6 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold text-moira-ink">
          장소 후보 <span className="text-moira-brand">{ranked.length}</span>
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-moira-surface px-2.5 py-1 text-[12px] font-bold text-moira-body ring-1 ring-moira-border">
          <SlidersHorizontal size={13} />
          공평한 순
        </span>
      </div>

      <div className="space-y-3">
        {ranked.map((place, i) => (
          <PlaceCard
            key={place.id}
            place={place}
            rank={i + 1}
            best={i === 0}
            selected={selectedId === place.id}
            onSelect={() => setSelectedId(place.id)}
            animate
          />
        ))}
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-moira-muted">
        이동시간은 대중교통 기준 추정치예요.
        <br />
        색과 막대는 <b className="font-bold text-moira-body">멤버 간 격차</b>가 작을수록 공평함을 뜻해요.
      </p>
    </MoiraShell>
  );
}
