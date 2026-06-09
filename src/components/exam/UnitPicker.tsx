// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

/**
 * UnitPicker — 교육과정 단원 선택 콤보박스 (해자 2의 사용자 접점).
 *
 * 범용 LLM은 "고3 수학Ⅰ 수열의 4점 빈출 유형"을 단원 단위로 고를 수 없다.
 * 이 컴포넌트는 현행 수능 출제범위(curriculum.ts)를 과목→과정→단원으로 펼쳐
 * 강사/학생이 단원을 '찍어서' 출제하도록 한다. 선택값(unitId)은 엔진 프롬프트에 주입된다.
 *
 * exam(강사)·study(학생) 양쪽에서 import. size로 패딩/타이포만 조절한다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Search, X } from "lucide-react";
import type { Subject } from "@/lib/exam/types";
import { coursesBySubject, findUnit } from "@/lib/exam/curriculum";

export interface UnitPickerProps {
  subject: Subject;
  /** 선택된 단원 id (없으면 '자유 출제') */
  value?: string;
  onChange: (unitId: string | undefined) => void;
  /** compact: 학생 페이지용 작은 버전 */
  size?: "default" | "compact";
}

export default function UnitPicker({ subject, value, onChange, size = "default" }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const courses = useMemo(() => coursesBySubject(subject), [subject]);

  /** 검색 필터가 적용된 (과정 → 단원) 그룹 */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = courses.map((c) => ({ course: c, units: c.units }));
    if (!q) return base;
    return base
      .map(({ course }) => ({
        course,
        units: course.units.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            course.name.toLowerCase().includes(q) ||
            u.topics.some((t) => t.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.units.length > 0);
  }, [courses, query]);

  /** 키보드 내비게이션용 평면 리스트 (index 0 = '단원 지정 없음') */
  const flat = useMemo<(string | undefined)[]>(() => {
    const rows: (string | undefined)[] = [undefined];
    for (const g of groups) for (const u of g.units) rows.push(u.id);
    return rows;
  }, [groups]);

  const selected = value ? findUnit(value) : undefined;

  // 열릴 때 검색창 포커스 + active 리셋, 닫힐 때 검색어 초기화
  useEffect(() => {
    if (open) {
      setActive(0);
      const id = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    setQuery("");
  }, [open]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // active 항목 스크롤 인투 뷰
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(unitId: string | undefined) {
    onChange(unitId);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[active]);
    }
  }

  const compact = size === "compact";
  const triggerPad = compact ? "px-3 py-2" : "px-3.5 py-2.5";
  const triggerText = compact ? "text-[13px]" : "text-[14px]";

  // 평면 인덱스 누적용 (렌더 중 단원마다 +1)
  let cursor = 0;

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      {/* 트리거 */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border bg-white ${triggerPad} ${triggerText} text-left transition-colors ${
          open
            ? "border-indigo-500 ring-2 ring-indigo-100"
            : selected
              ? "border-indigo-300 hover:border-indigo-400"
              : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <BookOpen
          className={`h-4 w-4 shrink-0 ${selected ? "text-indigo-600" : "text-slate-400"}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <>
              <span className="text-slate-500">{selected.course.name}</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="font-medium text-slate-900">{selected.unit.name}</span>
            </>
          ) : (
            <span className="text-slate-400">단원 지정 없음 · 자유 출제</span>
          )}
        </span>
        {selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="단원 선택 해제"
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onChange(undefined);
              }
            }}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          {/* 검색 */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="단원·키워드 검색 (예: 수열, 빈칸, 유전)"
              className="w-full bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
              aria-label="단원 검색"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="검색어 지우기"
                className="cursor-pointer rounded text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {/* 단원 지정 없음 */}
            {(() => {
              const idx = cursor++; // 0
              const isSel = !value;
              const isActive = active === idx;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  data-idx={idx}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => pick(undefined)}
                  className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-[13px] transition-colors ${
                    isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                >
                  <span className={isSel ? "font-medium text-indigo-700" : "text-slate-600"}>
                    단원 지정 없음 · 자유 출제
                  </span>
                  {isSel && <Check className="h-4 w-4 text-indigo-600" aria-hidden />}
                </button>
              );
            })()}

            {groups.length === 0 ? (
              <div className="px-3 py-6 text-center text-[13px] text-slate-400">
                검색 결과가 없습니다
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.course.id}>
                  <div className="sticky top-0 flex items-center gap-2 bg-slate-50/95 px-3 py-1.5 text-[11px] font-semibold text-slate-500 backdrop-blur">
                    {g.course.name}
                    <span
                      className={`rounded px-1.5 py-px text-[10px] font-medium ${
                        g.course.common
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {g.course.common ? "공통" : "선택"}
                    </span>
                  </div>
                  {g.units.map((u) => {
                    const idx = cursor++;
                    const isSel = value === u.id;
                    const isActive = active === idx;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="option"
                        aria-selected={isSel}
                        data-idx={idx}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => pick(u.id)}
                        className={`flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors ${
                          isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-[13px] ${
                                isSel ? "font-semibold text-indigo-700" : "font-medium text-slate-800"
                              }`}
                            >
                              {u.name}
                            </span>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] tabular-nums text-slate-500">
                              {u.points.join("·")}점
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                            {u.topics.slice(0, 3).join(" · ")}
                          </span>
                        </span>
                        {isSel && <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10.5px] text-slate-400">
            단원을 지정하면 해당 단원의 평가원 빈출유형·배점으로 출제됩니다
          </div>
        </div>
      )}
    </div>
  );
}
