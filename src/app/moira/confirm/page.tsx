"use client";

import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Check,
  MapPin,
  Navigation,
  Plus,
  Receipt,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { MoiraShell } from "@/components/moira/MoiraShell";
import { Button } from "@/components/moira/Button";
import { StickyBottomBar } from "@/components/moira/StickyBottomBar";
import { AvatarStack } from "@/components/moira/MemberChip";
import { APPOINTMENT, MEMBERS, PLACES, RECOMMENDED_STATION } from "@/lib/moira/mock";
import { avgOf, fairLevel, gapOf, FAIR_STYLE } from "@/lib/moira/fairness";

function DeepLink({
  icon: Icon,
  label,
  sub,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  tint: string;
}) {
  return (
    <button
      type="button"
      className="flex cursor-pointer flex-col items-start gap-2 rounded-2xl bg-moira-surface p-4 text-left ring-1 ring-moira-border transition-all duration-200 hover:ring-slate-300 active:scale-[.98]"
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: tint }}
      >
        <Icon size={18} strokeWidth={2.5} className="text-white" />
      </span>
      <span>
        <span className="block text-[14px] font-extrabold text-moira-ink">{label}</span>
        <span className="block text-[12px] text-moira-muted">{sub}</span>
      </span>
    </button>
  );
}

export default function MoiraConfirmPage() {
  const router = useRouter();
  const place = PLACES.find((p) => p.id === APPOINTMENT.placeId) ?? PLACES[0];
  const gap = gapOf(place.times);
  const avg = avgOf(place.times);
  const style = FAIR_STYLE[fairLevel(gap)];

  return (
    <MoiraShell
      step={4}
      bottomBar={
        <StickyBottomBar>
          <Button
            variant="outline"
            block={false}
            size="lg"
            className="w-[52px] shrink-0 px-0"
            aria-label="새 약속 만들기"
            onClick={() => router.push("/moira")}
          >
            <Plus size={20} />
          </Button>
          <Button variant="kakao" leftIcon={<Share2 size={18} strokeWidth={2.5} />}>
            약속 카드 공유하기
          </Button>
        </StickyBottomBar>
      }
    >
      {/* 확정 헤더 */}
      <header className="flex flex-col items-center pb-2 pt-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-moira-fair-good">
            <Check size={22} strokeWidth={3.5} className="text-white" />
          </span>
        </span>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-[-0.02em] text-moira-ink">
          약속이 확정됐어요!
        </h1>
        <p className="mt-1 text-[14px] font-medium text-moira-body">
          투표 결과 가장 많은 표를 받은 장소예요
        </p>
      </header>

      {/* 약속 카드 */}
      <section className="mt-3 overflow-hidden rounded-2xl bg-moira-surface ring-1 ring-moira-border shadow-[0_10px_30px_rgba(15,23,42,.08)]">
        {/* 미니맵 스트립 */}
        <div className="relative h-28 bg-gradient-to-br from-indigo-100 via-slate-100 to-emerald-100">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(79,70,229,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(79,70,229,.10) 1px,transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-moira-brand text-white shadow-[0_6px_16px_rgba(79,70,229,.4)]">
              <MapPin size={20} strokeWidth={2.5} />
            </span>
          </span>
          <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-moira-body backdrop-blur">
            {RECOMMENDED_STATION.name} 도보 {place.walkMin}분
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-extrabold text-moira-ink">{place.name}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-bold text-moira-body">
              {place.category}
            </span>
          </div>

          <dl className="mt-3 space-y-2 text-[14px]">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="shrink-0 text-moira-muted" />
              <dt className="sr-only">일시</dt>
              <dd className="font-bold text-moira-ink">
                {APPOINTMENT.date} · {APPOINTMENT.time}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="shrink-0 text-moira-muted" />
              <dt className="sr-only">주소</dt>
              <dd className="text-moira-body">{APPOINTMENT.address}</dd>
            </div>
          </dl>

          {/* 공평성 closure + 참석자 */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <AvatarStack members={MEMBERS} size={26} />
              <span className="text-[13px] font-bold text-moira-body">{MEMBERS.length}명 모두 참석</span>
            </div>
            <span
              className={cnTag(style.chipBg, style.chipText)}
              title={`멤버 간 최대 격차 ${gap}분 · 평균 ${avg}분`}
            >
              격차 {gap}분 · {style.label}
            </span>
          </div>
        </div>
      </section>

      {/* 딥링크 액션 */}
      <h3 className="mb-2.5 mt-6 text-[13px] font-bold text-moira-muted">바로 이어서 하기</h3>
      <div className="grid grid-cols-2 gap-2.5">
        <DeepLink icon={Navigation} label="길찾기" sub="카카오맵으로 이동" tint="#4F46E5" />
        <DeepLink icon={CalendarCheck} label="예약하기" sub="캐치테이블 연동" tint="#F97316" />
        <DeepLink icon={Receipt} label="1/n 정산" sub="토스로 나눠 내기" tint="#0EA5E9" />
        <DeepLink icon={Share2} label="약속 공유" sub="카톡으로 카드 전송" tint="#10B981" />
      </div>
    </MoiraShell>
  );
}

// 작은 태그 클래스 헬퍼 (인라인 가독성용)
function cnTag(bg: string, text: string) {
  return `rounded-full px-2.5 py-1 text-[12px] font-extrabold ${bg} ${text}`;
}
