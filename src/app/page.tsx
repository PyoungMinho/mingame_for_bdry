"use client";

import { useState } from "react";
import Link from "next/link";
import { AdUnit } from "@/app/_components/AdUnit";
import { AD_SLOTS } from "@/lib/ads";
import { CircledWord } from "@/app/_components/RedPenCircle";

// ─────────────────────────────────────────────────────────────
// Inline icons (no emoji — SVG, 24x24 viewBox, currentColor)
// ─────────────────────────────────────────────────────────────

type IconProps = { className?: string };

function IconTarget({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}
function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}
function IconLayers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function IconGift({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
  );
}
function IconArrow({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IconPen({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconChevron({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Math / exam visual primitives (수능 문제지 톤)
// ─────────────────────────────────────────────────────────────

/** 수식 변수 — 세리프 이탤릭(교과서 수식 톤) */
function Var({ children }: { children: React.ReactNode }) {
  return <span className="font-serif italic">{children}</span>;
}

/** 좌표평면 + 포물선 모티프(배경 장식) */
function ParabolaMotif({ className }: IconProps) {
  return (
    <svg viewBox="0 0 240 200" fill="none" className={className} aria-hidden="true">
      <line x1="24" y1="170" x2="224" y2="170" stroke="currentColor" strokeWidth="1.5" />
      <line x1="48" y1="20" x2="48" y2="184" stroke="currentColor" strokeWidth="1.5" />
      <path d="M40 36 Q124 232 208 36" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="124" cy="134" r="3.5" fill="currentColor" />
    </svg>
  );
}

/** 빨간 검증 도장 — 시험지 위 채점 인장 느낌 (caller가 absolute+위치+크기를 전달) */
function ScoreStamp({ className }: IconProps) {
  return (
    <div className={className} aria-hidden="true" style={{ mixBlendMode: "multiply" }}>
      <span className="absolute inset-0 rounded-full border-[2.5px] border-red-600/85" />
      <span className="absolute inset-[5px] rounded-full border border-red-600/40" />
      <span className="absolute inset-0 flex flex-col items-center justify-center text-red-600/90">
        <span className="font-serif text-[15px] font-extrabold leading-none">검증</span>
        <span className="mt-[3px] font-mono text-[7px] font-bold tracking-[0.12em]">출제유형</span>
      </span>
    </div>
  );
}

/** OMR 답안 한 줄 — 1~5 마킹 */
function OmrRow({ n, marked }: { n: number; marked: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-5 text-right font-mono text-[12px] tabular-nums text-slate-400">{n}</span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((c) => (
          <span
            key={c}
            className={[
              "flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px] leading-none",
              c === marked
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-300",
            ].join(" ")}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: IconTarget,
    title: "수능 출제유형 그대로",
    desc: "독서 비문학, 빈칸추론, 〈보기〉 합답형, 4점 킬러까지 — 실제 수능 평가원이 내는 결대로 문제를 만듭니다.",
  },
  {
    icon: IconCheck,
    title: "즉시 채점 + 해설",
    desc: "한 문제씩 풀고 바로 정답 확인. 왜 그 답인지 2~4문장 해설이 붙어 혼자서도 막힘없이 공부할 수 있어요.",
  },
  {
    icon: IconLayers,
    title: "5과목 · 난이도 선택",
    desc: "국어·수학·영어·과학·사회, 하/중/상 난이도, 객관식/단답형까지 원하는 대로. 부족한 단원만 골라 집중 연습.",
  },
  {
    icon: IconGift,
    title: "무료 · 회원가입 없음",
    desc: "문제집 살 돈 걱정 없이. 광고로 운영되어 학생은 한 푼도 내지 않습니다. 바로 주제만 넣고 시작하세요.",
  },
];

const STEPS = [
  { num: "01", title: "공부할 주제를 입력", desc: "‘이차방정식 근의 공식’, ‘광합성 명반응’처럼 약한 단원이나 틀린 문제를 그대로 넣으세요." },
  { num: "02", title: "AI가 수능형 문제 생성", desc: "수능 출제유형을 학습한 엔진이 그 주제의 변형 문항을 즉석에서 만들어냅니다." },
  { num: "03", title: "풀고 즉시 채점·해설", desc: "문제집 풀듯 한 문제씩 풀면 바로 채점과 해설. 마지막엔 정답률과 복습 리스트까지." },
];

const SUBJECTS = ["국어", "수학", "영어", "과학", "사회"];

// 무료(학생) vs 강사용 Pro 기능 비교
const COMPARE_ROWS: { label: string; free: boolean; pro: boolean }[] = [
  { label: "수능 출제유형 문제 생성", free: true, pro: true },
  { label: "즉시 채점 · 해설", free: true, pro: true },
  { label: "5과목 · 난이도 선택", free: true, pro: true },
  { label: "내 기출·교재 업로드 → 변형 출제", free: false, pro: true },
  { label: "인쇄용 시험지 + 정답·해설지", free: false, pro: true },
  { label: "학원명 · 시험지 브랜딩", free: false, pro: true },
  { label: "문제은행 저장 · 재사용", free: false, pro: true },
  { label: "대량 일괄 생성", free: false, pro: true },
  { label: "광고 없음", free: false, pro: true },
  { label: "상업적 이용 (영리 배포)", free: false, pro: true },
];

const FAQ_ITEMS = [
  { q: "정말 무료인가요?", a: "네. 학생은 회원가입도 결제도 필요 없이 풀이 기능을 무료로 씁니다. 서비스는 페이지의 광고로 운영됩니다." },
  { q: "수능 기출 문제를 그대로 보여주나요?", a: "기출을 복사해 주는 것이 아니라, 수능 출제유형을 학습한 AI가 입력한 주제로 새 변형 문항을 생성합니다. 저작권 걱정 없이 무한히 연습할 수 있어요." },
  { q: "어떤 과목을 지원하나요?", a: "국어·수학·영어·과학·사회 5과목을 지원하며, 과목마다 실제 수능 출제유형(독서/문학, 빈칸추론, 〈보기〉 합답형 등)을 반영합니다." },
  { q: "선생님인데 시험지를 만들 수 있나요?", a: "강사용 페이지에서 원본 문항(텍스트·이미지)으로 변형 문항을 생성하고, 문제은행에 모아 인쇄용 시험지·해설지로 출력할 수 있습니다." },
];

// ─────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-[#FAFAF7]/85 backdrop-blur-md">
      <nav className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="font-serif text-2xl leading-none text-indigo-600">∑</span>
          <span className="font-bold text-lg tracking-tight text-slate-900">문제팩토리</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/exam"
            className="hidden sm:inline-flex items-center h-10 px-4 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
          >
            강사용
          </Link>
          <Link
            href="/study"
            className="inline-flex items-center h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors duration-200 cursor-pointer"
          >
            무료로 풀기
          </Link>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 px-5">
      {/* 전역 .graph-paper(모눈종이) 배경이 그대로 비침 — 좌상단 포물선만 은은하게 */}
      <ParabolaMotif className="pointer-events-none absolute left-[2%] top-[15%] hidden w-40 text-slate-900/[0.05] lg:block" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8">
        {/* ── 좌: 표지 타이틀 블록 ── */}
        <div className="text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
            무료 · 회원가입 없음 · 광고 후원으로 운영
          </div>

          <h1 className="mb-6 break-keep font-serif text-[34px] font-bold leading-[1.16] tracking-tight text-slate-900 text-balance sm:text-5xl lg:text-[54px]">
            문제집 살 돈 걱정 없이,
            <br />
            <CircledWord className="text-indigo-600">수능형 문제</CircledWord>
            로 공부하세요
          </h1>

          <p className="mx-auto mb-9 max-w-xl break-keep text-base leading-relaxed text-slate-600 lg:mx-0 lg:text-lg">
            공부할 주제만 넣으면 수능 출제유형 그대로 문제를 만들어드려요. 문제집 풀듯 한 문제씩 풀고, 바로 채점과 해설까지.
          </p>

          <div className="mb-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
            <Link
              href="/study"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 text-base font-semibold text-white shadow-sm shadow-indigo-600/20 transition-colors duration-200 hover:bg-indigo-700 cursor-pointer"
            >
              <IconPen className="h-4 w-4" />
              무료로 문제 풀기
            </Link>
            <Link
              href="/exam"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 text-base font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              강사용 변형 시험지
              <IconArrow className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-slate-400">신용카드 불필요 · 지금 바로 시작</p>
        </div>

        {/* ── 우: 책상 위 채점된 시험지 ── */}
        <div className="relative mx-auto w-full max-w-sm sm:max-w-md">
          <ExamSheetHero />
        </div>
      </div>
    </section>
  );
}

/** 책상 위에 비스듬히 놓인 채점된 수능 시험지 — 히어로 센터피스 */
function ExamSheetHero() {
  const choices = [
    { l: "①", t: "1" },
    { l: "②", t: "2" },
    { l: "③", t: "3" },
    { l: "④", t: "4", correct: true },
    { l: "⑤", t: "5" },
  ];
  return (
    <div className="relative">
      {/* 뒤에 깔린 종이 — 스택 깊이 */}
      <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rotate-[3.2deg] rounded-lg bg-slate-200/70" />
      <div aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[1.6deg] rounded-lg bg-slate-100" />

      {/* 앞 시험지 */}
      <div className="relative -rotate-[1.2deg] overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
        {/* 머리말 */}
        <div className="border-b-[2px] border-slate-900 px-5 pb-2.5 pt-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded border border-slate-900 px-2 py-0.5 font-serif text-[12px] font-bold tracking-wide text-slate-900">
              수학 영역
            </span>
            <span className="font-mono text-[10px] text-slate-400">제 3 교시</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="font-serif text-[13px] font-semibold text-slate-700">3월 변형 모의고사</span>
            <span className="font-mono text-[10px] text-slate-400">성명 ______</span>
          </div>
        </div>

        {/* 문항 */}
        <div className="px-5 py-4">
          <div className="flex gap-2">
            <span className="font-serif text-[14px] font-bold leading-relaxed text-slate-900">12.</span>
            <p className="font-serif text-[13.5px] leading-relaxed text-slate-800">
              이차방정식 <Var>x</Var>
              <sup className="text-[0.7em]">2</sup> − 5<Var>x</Var> + <Var>k</Var> = 0 의 두 근의 차가 3일 때, 상수{" "}
              <Var>k</Var>의 값은?
              <span className="ml-1 align-middle font-sans text-[10px] font-semibold text-slate-400">[4점]</span>
            </p>
          </div>
          <ol className="mt-3 space-y-1 pl-7">
            {choices.map((c) => (
              <li
                key={c.l}
                className={[
                  "flex items-center gap-2.5 rounded-md px-2 py-0.5 font-serif text-[13.5px]",
                  c.correct ? "bg-emerald-50 text-emerald-900" : "text-slate-700",
                ].join(" ")}
              >
                <span className={c.correct ? "text-emerald-600" : "text-slate-400"}>{c.l}</span>
                <span>{c.t}</span>
                {c.correct && <IconCheck className="ml-auto h-3.5 w-3.5 text-emerald-500" />}
              </li>
            ))}
          </ol>
        </div>

        {/* OMR 답안 */}
        <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">OMR 답안</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <IconCheck className="h-3 w-3" />
              즉시 채점
            </span>
          </div>
          <div className="space-y-1.5">
            <OmrRow n={12} marked={4} />
            <OmrRow n={13} marked={2} />
          </div>
        </div>
      </div>

      {/* 빨간 검증 도장 — 우하단 코너에 찍힌 인장 */}
      <ScoreStamp className="absolute -bottom-5 -right-4 z-20 h-[70px] w-[70px] -rotate-[14deg]" />
    </div>
  );
}

function AdSlot({ label }: { label: string }) {
  return <AdUnit slot={AD_SLOTS.homeBanner} label={label} className="max-w-5xl mx-auto px-5" />;
}

function Features() {
  return (
    <section id="features" className="py-20 px-5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900 mb-3">왜 문제팩토리인가요?</h2>
          <p className="text-slate-500 text-base">학원·문제집 없이도, 수능 결의 문제를 무한히</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-indigo-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-20 px-5 bg-white border-y border-slate-200">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900 mb-3">3단계면 끝</h2>
          <p className="text-slate-500 text-base">주제만 넣으면 나머지는 AI가</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.num} className="relative">
              <div className="font-serif text-6xl font-bold text-indigo-100 leading-none mb-3 select-none tabular-nums">{s.num}</div>
              <h3 className="font-semibold text-lg text-slate-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-slate-400 mr-1">출제 영역</span>
          {SUBJECTS.map((s) => (
            <span key={s} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-serif text-sm font-semibold tracking-wide text-slate-700">
              {s} 영역
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareCell({ on }: { on: boolean }) {
  if (on) {
    return (
      <span className="inline-flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-indigo-600" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">포함</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-slate-300" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="sr-only">미포함</span>
    </span>
  );
}

function PricingCompare() {
  return (
    <section className="py-20 px-5">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900 mb-3">학생은 무료, 강사는 시험지까지</h2>
          <p className="text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
            공부는 누구나 공짜로. 내 기출로 시험지를 찍어내고 자산으로 쌓는 건 강사용에서.
          </p>
          <div className="mt-6 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-[13px] font-semibold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
              지금은 베타 기간 — 강사용도 무료로 쓸 수 있어요
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">무료 학생 자습과 강사용 Pro 기능 비교표</caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-4 pl-4 pr-2 sm:pl-5 align-bottom">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">기능</span>
                </th>
                <th scope="col" className="w-[72px] sm:w-28 px-1 sm:px-2 py-4 text-center align-bottom">
                  <span className="block text-sm font-bold text-slate-900">무료</span>
                  <span className="block text-[11px] leading-tight text-slate-400">₩0 · 학생</span>
                </th>
                <th scope="col" className="w-[86px] sm:w-36 px-1 sm:px-2 py-4 text-center align-bottom border-l border-indigo-100 bg-indigo-50/50">
                  <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">PRO</span>
                  <span className="mt-1 block text-sm font-bold text-slate-900">강사용</span>
                  <span className="block text-[11px] leading-tight text-indigo-500">₩59,000/월</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="py-3 pl-4 pr-2 sm:pl-5 text-[13px] sm:text-sm font-normal text-slate-700 leading-snug">{row.label}</th>
                  <td className="px-1 sm:px-2 py-3 text-center">
                    <CompareCell on={row.free} />
                  </td>
                  <td className="px-1 sm:px-2 py-3 text-center border-l border-indigo-100 bg-indigo-50/50">
                    <CompareCell on={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
          <Link
            href="/study"
            className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 font-semibold text-sm transition-colors duration-200 cursor-pointer"
          >
            무료로 풀기
            <IconArrow className="w-4 h-4" />
          </Link>
          <Link
            href="/exam"
            className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm transition-colors duration-200 cursor-pointer"
          >
            강사용 시작하기
            <IconArrow className="w-4 h-4" />
          </Link>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400 leading-relaxed">
          라이트 ₩29,000 · 학원 ₩149,000 요금제도 제공 · 강사용은 광고 없이 상업적 이용 가능
        </p>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-20 px-5">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-slate-900">자주 묻는 질문</h2>
        </div>
        <div className="flex flex-col gap-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-slate-800">{item.q}</span>
                <IconChevron
                  className={["w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200", open === i ? "rotate-180" : ""].join(" ")}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABanner() {
  return (
    <section className="py-20 px-5">
      <div className="max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-indigo-600 px-8 py-14 text-center">
          <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 font-serif text-[160px] leading-none text-white/10 select-none">∑</span>
          <div className="relative">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">오늘 약한 단원, 지금 풀어봐요</h2>
            <p className="text-indigo-100 text-base mb-8 max-w-md mx-auto">
              주제 하나만 입력하면 수능형 문제가 바로 만들어집니다. 무료, 회원가입 없이.
            </p>
            <Link
              href="/study"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-base transition-colors duration-200 cursor-pointer"
            >
              무료로 문제 풀기
              <IconArrow className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 py-10 px-5">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="font-serif text-xl leading-none text-indigo-600">∑</span>
          <span className="font-bold text-slate-900">문제팩토리</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/study" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 cursor-pointer">학생 자습</Link>
          <Link href="/exam" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 cursor-pointer">강사용</Link>
          <Link href="/terms" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 cursor-pointer">이용약관</Link>
          <Link href="/privacy" className="text-slate-500 hover:text-slate-900 transition-colors duration-200 cursor-pointer">개인정보처리방침</Link>
        </div>
        <p className="text-xs text-slate-400">© 2026 문제팩토리</p>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="graph-paper min-h-screen font-sans text-slate-800">
      <Navbar />
      <main>
        <Hero />
        <AdSlot label="홈 상단 배너" />
        <Features />
        <HowItWorks />
        <PricingCompare />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
