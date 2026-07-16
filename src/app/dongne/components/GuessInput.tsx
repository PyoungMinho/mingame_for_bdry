"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import type { Region } from "@/lib/dongne/types";

export interface GuessInputProps {
  /** 자동완성 후보 전체 목록 — manifest.json 250개를 그대로 전달(필터링은 내부 담당) */
  regions: Region[];
  /** 이미 추측한 지역 코드 — 옵션에 노출은 하되 흐리게 + "이미 추측함" 캡션(강제 차단 아님, §4-4) */
  excludedCodes?: string[];
  /** 진행 종료(정답/실패) 등으로 입력 자체를 잠글 때 */
  disabled?: boolean;
  placeholder?: string;
  /** 2탭(선택→[추측하기])이 완료된 순간 호출. 호출 직후 컴포넌트는 자체적으로 입력값을 리셋한다. */
  onSubmit: (region: Region) => void;
  className?: string;
}

const MAX_OPTIONS = 6;
const UP_SPACE_THRESHOLD = 180;
const DEBOUNCE_MS = 150;

/** 매칭 구간을 강조하기 위한 3분할(단순 substring 매칭 전용, 정규식 특수문자 이슈 없음) */
function splitMatch(text: string, query: string): [string, string, string] | null {
  if (!query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return null;
  return [text.slice(0, idx), text.slice(idx, idx + query.length), text.slice(idx + query.length)];
}

function matchesQuery(region: Region, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (region.name.toLowerCase().includes(q)) return true;
  return region.aliases.some((a) => a.toLowerCase().includes(q));
}

/**
 * 자동완성 인풋 + 드롭다운 + [추측하기] 버튼 (design-final §4-4·§4-5, F1·F2 확정).
 *
 * - **2탭 제출**: 드롭다운에서 지역 선택(1탭 — 입력창에 확정 채움, 제출 아님) →
 *   [추측하기] 탭(2탭 — 실제 제출). 자유 텍스트로는 제출 불가 — `selected`가 없으면
 *   버튼은 항상 비활성(pointer-events는 유지하되 no-op, design-final §4-5).
 * - **드롭다운 방향**: 입력창 위로 여는 게 기본. 포커스 시 입력창 위 가용 공간을 측정해서
 *   180px 미만이면 아래로 폴백한다(F2). 최대 6개 결과만 노출.
 * - 정답 판정은 페이지가 코드로 하므로 이 컴포넌트는 무엇이 "정답"인지 전혀 모른다
 *   (순수 표시/선택 UI — 방향서 §2 "안티치트 완화: 오늘 실루엣만 fetch" 원칙과 별개로,
 *   이 컴포넌트 자체는 정답 후보를 filtering만 할 뿐 비교하지 않는다).
 */
export default function GuessInput({
  regions,
  excludedCodes = [],
  disabled = false,
  placeholder = "동네 이름을 입력하세요 (예: 해운대구)",
  onSubmit,
  className = "",
}: GuessInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [selected, setSelected] = useState<Region | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const excludedSet = useMemo(() => new Set(excludedCodes), [excludedCodes]);

  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return regions.filter((r) => matchesQuery(r, debouncedQuery)).slice(0, MAX_OPTIONS);
  }, [regions, debouncedQuery]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function measureDirection() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDirection(rect.top < UP_SPACE_THRESHOLD ? "down" : "up");
  }

  function handleFocus() {
    if (disabled || selected) return; // 이미 확정된 선택 상태 — 재편집하려면 지우거나 타이핑해야 함
    measureDirection();
    setOpen(true);
  }

  function handleChange(value: string) {
    setQuery(value);
    setSelected(null);
    setActiveIndex(-1);
    setOpen(true);
  }

  function commitSelection(region: Region) {
    setSelected(region);
    setQuery(region.nameWithSido);
    setDebouncedQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleClear() {
    setQuery("");
    setDebouncedQuery("");
    setSelected(null);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleSubmit() {
    if (!selected || disabled) return;
    onSubmit(selected);
    // 제출 성공 시 인풋+버튼은 다음 시도용으로 초기화 (design-final §4-5)
    setQuery("");
    setDebouncedQuery("");
    setSelected(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        commitSelection(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && debouncedQuery.trim().length > 0 && !disabled;

  return (
    <div className={`dn-guess-input ${className}`.trim()} ref={wrapRef}>
      <div className="dn-guess-input-field-wrap">
        <span className="dn-guess-input-icon" aria-hidden="true">
          <Search size={18} />
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="dn-guess-listbox"
          className="dn-guess-input-field"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={handleFocus}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="dn-guess-input-clear touch-target"
            onClick={handleClear}
            aria-label="입력 지우기"
          >
            <X size={16} />
          </button>
        ) : null}

        {showDropdown ? (
          <ul id="dn-guess-listbox" role="listbox" className="dn-guess-dropdown" data-direction={direction}>
            {filtered.length === 0 ? (
              <li className="dn-guess-empty" role="presentation">
                일치하는 동네가 없어요
              </li>
            ) : (
              filtered.map((region, i) => {
                const match = splitMatch(region.name, debouncedQuery);
                const isDup = excludedSet.has(region.code);
                const showSidoBadge = region.nameWithSido !== region.name;
                return (
                  <li key={region.code} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === activeIndex}
                      className={`dn-guess-option touch-target${i === activeIndex ? " is-active-key" : ""}${
                        isDup ? " is-duplicate" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commitSelection(region)}
                    >
                      <span className="dn-guess-option-name">
                        {match ? (
                          <>
                            {match[0]}
                            <mark>{match[1]}</mark>
                            {match[2]}
                          </>
                        ) : (
                          region.name
                        )}
                      </span>
                      <span className="dn-guess-option-right">
                        {isDup ? <span className="dn-guess-option-dup-caption">이미 추측함</span> : null}
                        {showSidoBadge ? <span className="dn-guess-option-sido">({region.sido})</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      <button
        type="button"
        className={`dn-guess-submit touch-target${selected ? " is-active" : ""}`}
        disabled={disabled}
        onClick={handleSubmit}
      >
        추측하기
      </button>
    </div>
  );
}
