"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  BookMarked,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Plus,
  Printer,
  Sigma,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  SUBJECTS,
  type Difficulty,
  type ExamMode,
  type GenerateResult,
  type QuestionType,
  type Subject,
  type Variant,
} from "@/lib/exam/types";
import { useProblemBank } from "@/lib/exam/useProblemBank";
import UnitPicker from "@/components/exam/UnitPicker";
import { unitPathLabel } from "@/lib/exam/curriculum";
import { CircledWord } from "@/app/_components/RedPenCircle";

const DIFF_LABEL: Record<Difficulty, string> = { easy: "하", medium: "중", hard: "상" };
const DIFF_STYLE: Record<Difficulty, string> = {
  easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  hard: "bg-rose-50 text-rose-700 border-rose-200",
};
const SUBJECT_LABEL: Record<Subject, string> = {
  english: "영어",
  math: "수학",
  korean: "국어",
  science: "과학",
  social: "사회",
};

const PLACEHOLDER: Record<Subject, string> = {
  math: "예) 일차방정식 2x + 3 = 11 을 풀고, x의 값을 구하시오.",
  english: "예) 다음 글의 밑줄 친 부분 중 어법상 틀린 것을 고르시오. (지문 붙여넣기)",
  korean: "예) 다음 글의 중심 내용으로 가장 적절한 것은? (지문 붙여넣기)",
  science: "예) 질량 2kg 물체에 4N의 힘이 작용할 때 가속도를 구하시오.",
  social: "예) 다음 중 기회비용의 사례로 적절한 것을 고르시오.",
};

export default function ExamFactoryPage() {
  const [mode, setMode] = useState<ExamMode | null>(null);

  const [subject, setSubject] = useState<Subject>("math");
  const [unitId, setUnitId] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [qType, setQType] = useState<QuestionType>("multiple_choice");
  const [count, setCount] = useState(4);

  const [inputTab, setInputTab] = useState<"text" | "image">("text");
  const [source, setSource] = useState("");
  const [image, setImage] = useState<
    { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp"; dataUrl: string; name: string } | null
  >(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);

  const [sheet, setSheet] = useState<Variant[]>([]);
  const [bankOpen, setBankOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [examMeta, setExamMeta] = useState({ academy: "○○학원", title: "변형 시험지", minutes: 50 });
  const [toast, setToast] = useState<{ msg: string; kind: "success" | "error" | "info" } | null>(null);

  const bank = useProblemBank();
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, kind: "success" | "error" | "info") => {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 저장 결과(롤백 포함)에 따라 토스트를 분기 — 성공/중복/용량초과
  const saveToBank = useCallback(
    (variants: Variant[]) => {
      const res = bank.add(variants);
      if (!res.ok) {
        notify("저장 공간이 가득 찼어요. 문제은행에서 오래된 문항을 지운 뒤 다시 시도해 주세요.", "error");
      } else if (res.added === 0) {
        notify("이미 문제은행에 저장된 문항이에요.", "info");
      } else {
        notify(`${res.added}문항을 문제은행에 저장했어요.`, "success");
      }
    },
    [bank, notify]
  );

  useEffect(() => {
    fetch("/api/exam/generate")
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => setMode("demo"));
  }, []);

  const inSheet = useCallback((id: string) => sheet.some((s) => s.id === id), [sheet]);
  const toggleSheet = useCallback((v: Variant) => {
    setSheet((prev) => (prev.some((s) => s.id === v.id) ? prev.filter((s) => s.id !== v.id) : [...prev, v]));
  }, []);

  function onPickImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      setError("PNG·JPG·WEBP 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("이미지는 5MB 이하만 가능합니다.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] || "";
      setImage({ base64, mediaType: file.type as "image/png", dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  }

  async function generate() {
    setError(null);
    if (inputTab === "text" && !source.trim()) {
      setError("원본 문항 텍스트를 입력하거나, 이미지 탭에서 사진을 올려주세요.");
      return;
    }
    if (inputTab === "image" && !image) {
      setError("문항 이미지를 업로드해주세요.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const body = {
        source: inputTab === "text" ? source : "",
        imageBase64: inputTab === "image" ? image?.base64 : undefined,
        imageMediaType: inputTab === "image" ? image?.mediaType : undefined,
        subject,
        difficulty,
        count,
        type: qType,
        tier: "pro" as const, // 강사용 — 품질 우선 Sonnet 라우팅
        unitId, // 선택한 교육과정 단원(없으면 undefined → 자유 출제)
      };
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : Object.values(data.error || {}).flat().join(" ") || "생성에 실패했습니다.";
        throw new Error(msg);
      }
      setResult(data as GenerateResult);
      setSheet((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...(data.variants as Variant[]).filter((v) => !ids.has(v.id))];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function doPrint() {
    setPrintOpen(false);
    // 모달 닫힘 반영 후 인쇄
    setTimeout(() => window.print(), 60);
  }

  return (
    <div className="graph-paper min-h-screen font-sans text-slate-800 print:bg-white print:text-black">
      {/* 배경 모티프 — 수식 워터마크 + 부드러운 인디고 워시 */}
      <div aria-hidden className="no-print pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-indigo-200/30 blur-[120px]" />
        <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-sky-200/30 blur-[120px]" />
        <span className="absolute left-[5%] top-[16%] select-none font-serif text-[130px] leading-none text-slate-900/[0.035]">∑</span>
        <span className="absolute right-[9%] top-[26%] select-none font-serif text-[110px] leading-none text-slate-900/[0.04]">π</span>
        <span className="absolute left-[12%] bottom-[12%] select-none font-serif text-[120px] leading-none text-slate-900/[0.03]">√</span>
        <span className="absolute right-[15%] bottom-[18%] select-none font-serif text-[100px] leading-none text-slate-900/[0.035]">∫</span>
      </div>

      {/* Header */}
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-[#FAFAF7]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 shadow-sm shadow-indigo-600/20">
              <Sigma className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="font-serif text-[17px] font-bold text-slate-900">문제팩토리</div>
              <div className="text-[11px] text-slate-500">변형 시험지 자동 생성</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode && (
              <span
                className={`hidden rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
                  mode === "live"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-amber-300 bg-amber-50 text-amber-700"
                }`}
              >
                {mode === "live" ? "실시간 모드" : "데모 모드"}
              </span>
            )}
            <button
              onClick={() => setBankOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <BookMarked className="h-4 w-4" aria-hidden />
              문제은행
              {bank.loaded && bank.items.length > 0 && (
                <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 text-[11px] font-semibold text-indigo-700">
                  {bank.items.length}
                </span>
              )}
            </button>
            <Link
              href="/"
              className="hidden cursor-pointer rounded-lg px-3 py-2 text-[13px] text-slate-500 transition-colors hover:text-slate-900 sm:block"
            >
              팀메이크
            </Link>
          </div>
        </div>
      </header>

      <main className="no-print relative mx-auto max-w-7xl px-5 py-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
          {/* ── 좌: 입력 패널 ── */}
          <section className="lg:sticky lg:top-[88px] lg:h-fit">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-serif text-[16px] font-bold text-slate-900">
                <FileText className="h-4 w-4 text-indigo-600" aria-hidden />
                원본 문항 입력
              </h2>

              {/* 과목 */}
              <label className="mb-1.5 block text-[12px] font-medium text-slate-500">과목</label>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSubject(s.id);
                      setUnitId(undefined); // 과목 변경 시 단원 선택 초기화
                    }}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      subject === s.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* 출제 단원 (해자 2 — 평가원/교육과정 정합성) */}
              <div className="mb-4">
                <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                  출제 단원
                  <span className="rounded bg-indigo-50 px-1.5 py-px text-[10px] font-semibold text-indigo-600">
                    교육과정 정합
                  </span>
                </label>
                <UnitPicker subject={subject} value={unitId} onChange={setUnitId} />
              </div>

              {/* 입력 탭 */}
              <div className="mb-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {([
                  { id: "text", label: "텍스트", icon: FileText },
                  { id: "image", label: "이미지", icon: ImageIcon },
                ] as const).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setInputTab(t.id)}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium transition-colors ${
                        inputTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {inputTab === "text" ? (
                <div className="mb-4">
                  <label htmlFor="source" className="sr-only">
                    원본 문항 텍스트
                  </label>
                  <textarea
                    id="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder={PLACEHOLDER[subject]}
                    rows={6}
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[14px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="mt-1 text-right text-[11px] text-slate-400">{source.length}/8000</div>
                </div>
              ) : (
                <div className="mb-4">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => onPickImage(e.target.files?.[0])}
                  />
                  {image ? (
                    <div className="relative overflow-hidden rounded-xl border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.dataUrl} alt="업로드한 문항" className="max-h-56 w-full bg-slate-100 object-contain" />
                      <button
                        onClick={() => setImage(null)}
                        aria-label="이미지 제거"
                        className="absolute right-2 top-2 cursor-pointer rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm hover:bg-white"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                      <div className="truncate bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">{image.name}</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:bg-slate-100"
                    >
                      <Upload className="h-6 w-6 text-slate-400" aria-hidden />
                      <span className="text-[13px] text-slate-600">문항 사진 업로드</span>
                      <span className="text-[11px] text-slate-400">PNG·JPG·WEBP · 최대 5MB</span>
                    </button>
                  )}
                </div>
              )}

              {/* 옵션 */}
              <div className="mb-2 space-y-3">
                <Segmented
                  label="난이도"
                  options={DIFFICULTIES.map((d) => ({ id: d.id, label: d.label }))}
                  value={difficulty}
                  onChange={(v) => setDifficulty(v as Difficulty)}
                />
                <Segmented
                  label="유형"
                  options={QUESTION_TYPES.map((t) => ({ id: t.id, label: t.label }))}
                  value={qType}
                  onChange={(v) => setQType(v as QuestionType)}
                />
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-500">변형 문항 수</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCount((c) => Math.max(1, c - 1))}
                      aria-label="개수 줄이기"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      −
                    </button>
                    <div className="flex h-9 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white font-mono text-[15px] font-semibold text-slate-900 tabular-nums">
                      {count}
                    </div>
                    <button
                      onClick={() => setCount((c) => Math.min(10, c + 1))}
                      aria-label="개수 늘리기"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={generate}
                disabled={loading}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    출제 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    변형 문항 생성
                  </>
                )}
              </button>
            </div>
          </section>

          {/* ── 우: 결과 패널 ── */}
          <section className="min-w-0">
            {/* 결과 헤더 */}
            {result && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px] text-slate-500">
                  <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden />
                  <span>{result.variants.length}개 변형 생성됨</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAnswers((s) => !s)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    {showAnswers ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                    정답·해설 {showAnswers ? "숨기기" : "보기"}
                  </button>
                  <button
                    onClick={() => saveToBank(result.variants)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-600 shadow-sm hover:bg-slate-50"
                  >
                    <BookMarked className="h-3.5 w-3.5" aria-hidden />
                    전체 은행 저장
                  </button>
                </div>
              </div>
            )}

            {/* 소스 요약 */}
            {result && (
              <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-[13px] leading-relaxed text-indigo-900/80">
                {result.sourceSummary}
              </div>
            )}

            {/* 본문 상태 */}
            {loading ? (
              <LoadingState />
            ) : !result ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {result.variants.map((v, i) => (
                  <VariantCard
                    key={v.id}
                    index={i + 1}
                    variant={v}
                    showAnswer={showAnswers}
                    inSheet={inSheet(v.id)}
                    onToggleSheet={() => toggleSheet(v)}
                    onSave={() => saveToBank([v])}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 슬림 푸터 — 개인정보처리방침 링크 */}
        <footer className="mt-8 border-t border-slate-200 pt-5">
          <div className="flex flex-col items-center justify-between gap-2 text-[12px] text-slate-400 sm:flex-row">
            <span>© 2026 문제팩토리 · 강사용 변형 시험지</span>
            <Link
              href="/privacy"
              className="cursor-pointer text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
            >
              개인정보처리방침
            </Link>
          </div>
        </footer>
      </main>

      {/* 하단 시험지 바 */}
      {sheet.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">
            <div className="flex items-center gap-2 text-[13px] text-slate-700">
              <GraduationCap className="h-4 w-4 text-indigo-600" aria-hidden />
              <span className="font-semibold">시험지 {sheet.length}문항</span>
              <button onClick={() => setSheet([])} className="ml-2 cursor-pointer text-[12px] text-slate-400 hover:text-slate-700">
                비우기
              </button>
            </div>
            <button
              onClick={() => setPrintOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-110"
            >
              <Printer className="h-4 w-4" aria-hidden />
              시험지 만들기
            </button>
          </div>
        </div>
      )}

      {/* 문제은행 드로어 */}
      {bankOpen && (
        <BankDrawer
          items={bank.items}
          onClose={() => setBankOpen(false)}
          onRemove={bank.remove}
          onClear={bank.clear}
          inSheet={inSheet}
          onToggleSheet={toggleSheet}
        />
      )}

      {/* 인쇄 설정 모달 */}
      {printOpen && (
        <PrintModal
          meta={examMeta}
          setMeta={setExamMeta}
          count={sheet.length}
          onClose={() => setPrintOpen(false)}
          onPrint={doPrint}
        />
      )}

      {/* 인쇄 영역 (화면에서는 숨김, 인쇄 시에만 표시) */}
      <PrintSheet meta={examMeta} variants={sheet} />

      {/* 저장 결과 토스트 */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed inset-x-0 z-[60] flex justify-center px-4 ${
            sheet.length > 0 ? "bottom-24" : "bottom-6"
          }`}
        >
          <div
            className={`rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-lg ${
              toast.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : toast.kind === "info"
                  ? "border-slate-200 bg-white text-slate-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 하위 컴포넌트
// ─────────────────────────────────────────────────────────────

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-slate-500">{label}</label>
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 cursor-pointer rounded-md py-1.5 text-[13px] font-medium transition-colors ${
              value === o.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function VariantCard({
  index,
  variant,
  showAnswer,
  inSheet,
  onToggleSheet,
  onSave,
}: {
  index: number;
  variant: Variant;
  showAnswer: boolean;
  inSheet: boolean;
  onToggleSheet: () => void;
  onSave: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 font-mono text-[13px] font-bold text-white">
            {index}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${DIFF_STYLE[variant.difficulty]}`}>
            난이도 {DIFF_LABEL[variant.difficulty]}
          </span>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
            {variant.type === "multiple_choice" ? "객관식" : "단답형"}
          </span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-amber-700">
            {variant.points ?? 3}점
          </span>
          {variant.unitId && unitPathLabel(variant.unitId) && (
            <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
              {unitPathLabel(variant.unitId)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSave}
            aria-label="문제은행에 저장"
            title="문제은행에 저장"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            <BookMarked className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={onToggleSheet}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
              inSheet
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {inSheet ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {inSheet ? "담김" : "시험지"}
          </button>
        </div>
      </div>

      {variant.passage && (
        <div className="mb-3 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-serif text-[14px] leading-relaxed text-slate-700">
          {variant.passage}
        </div>
      )}

      <p className="mb-3 whitespace-pre-wrap font-serif text-[16px] font-medium leading-relaxed text-slate-900">{variant.stem}</p>

      {variant.choices && variant.choices.length > 0 && (
        <ul className="mb-1 space-y-1.5">
          {variant.choices.map((c, i) => (
            <li key={i} className="flex gap-2 font-serif text-[14.5px] leading-relaxed text-slate-700">
              <span className="shrink-0 text-slate-400">{c.label}</span>
              <span className="whitespace-pre-wrap">{c.text}</span>
            </li>
          ))}
        </ul>
      )}

      {showAnswer && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex w-full cursor-pointer items-center justify-between text-[13px] font-medium text-emerald-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4" aria-hidden />
              정답 {variant.answer}
            </span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {open && (
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-600">{variant.explanation}</p>
          )}
        </div>
      )}
    </article>
  );
}

/** 빈 화면 — 실물 시험지 미리보기(정적 데코, 해자 1: 한국형 2단 조판 노출) */
const PREVIEW_QUESTIONS = [
  { n: 1, pt: 3, q: "등차수열 {aₙ}에서 a₂ = 5, a₅ = 14일 때, a₁₀의 값은?", c: ["① 27", "② 29", "③ 31", "④ 33", "⑤ 35"] },
  { n: 2, pt: 2, q: "lim(x→0) (sin 3x)/(2x) 의 값은?", c: ["① 1/2", "② 1", "③ 3/2", "④ 2", "⑤ 3"] },
  { n: 3, pt: 4, q: "함수 f(x) = x³ − 3x² + k의 극솟값이 0일 때, 상수 k의 값은?", c: ["① 2", "② 4", "③ 6", "④ 8", "⑤ 10"] },
  { n: 4, pt: 3, q: "두 사건 A, B가 독립이고 P(A) = 1/3, P(B) = 1/2일 때, P(A∩B)는?", c: ["① 1/6", "② 1/4", "③ 1/3", "④ 1/2", "⑤ 2/3"] },
] as const;

const PREVIEW_BADGES = ["수능형 2단 조판", "문항별 [배점] 표기", "교육과정 단원 자동 태깅", "정답·해설지 별지 출력"] as const;

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 sm:px-8">
      {/* 안내 헤더 */}
      <div className="mb-7 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100">
          <Wand2 className="h-6 w-6 text-indigo-600" aria-hidden />
        </div>
        <h3 className="font-serif text-[19px] font-bold text-slate-900">
          기출 한 장이면, <CircledWord className="text-indigo-600">변형 시험지</CircledWord>가 5분
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-500">
          왼쪽에 문항을 넣고 <span className="font-semibold text-slate-700">생성</span>을 누르면 — 아래 같은{" "}
          <span className="font-semibold text-indigo-600">수능형 2단 시험지</span>가 바로 인쇄·출력됩니다.
        </p>
      </div>

      {/* ── 실물 시험지 미리보기 ── */}
      <div className="relative mx-auto max-w-md select-none" aria-hidden>
        {/* 겹친 종이(겹장 느낌) */}
        <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-[1.2deg] rounded-md bg-slate-200/70" />
        <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-md bg-slate-100" />
        {/* 앞장 */}
        <div className="relative rounded-md border border-slate-300 bg-white px-5 pb-4 pt-4 shadow-xl">
          {/* 머리말 */}
          <div className="mb-3 border-b-[2.5px] border-slate-900 pb-1.5">
            <div className="flex items-end justify-between">
              <span className="font-serif text-[9.5px] tracking-wide text-slate-500">○○수학학원</span>
              <span className="border-[1.5px] border-slate-900 px-2 py-[1px] font-serif text-[9px] font-bold text-slate-900">
                수학 영역
              </span>
            </div>
            <div className="mt-1 font-serif text-[15px] font-bold leading-tight text-slate-900">3월 변형 모의고사</div>
            <div className="mt-0.5 flex justify-between font-serif text-[8.5px] text-slate-500">
              <span>성명 ____________</span>
              <span>총 20문항 · 100점 · 50분</span>
            </div>
          </div>
          {/* 2단 본문 */}
          <div className="[column-count:2] [column-gap:13px] [column-rule:1px_solid_#cbd5e1]">
            {PREVIEW_QUESTIONS.map((s) => (
              <div key={s.n} className="mb-2.5 break-inside-avoid">
                <p className="font-serif text-[9.5px] leading-[1.5] text-slate-800">
                  <span className="font-bold">{s.n}.</span> {s.q}{" "}
                  <span className="whitespace-nowrap font-bold text-slate-900">[{s.pt}점]</span>
                </p>
                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-[1px] pl-2 font-serif text-[9px] leading-relaxed text-slate-600">
                  {s.c.map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* 꼬리말 */}
          <div className="mt-1.5 flex justify-between border-t border-slate-300 pt-1 font-serif text-[7.5px] text-slate-400">
            <span>문제팩토리 · 자동 생성</span>
            <span>1 / 2</span>
          </div>
        </div>
        {/* 별지(정답·해설) — 뒤에 겹친 종이와 맞물려 우하단에 살짝 노출 */}
        <div className="absolute -right-2 bottom-7 rotate-[5deg] rounded-sm border border-slate-300 bg-white px-2 py-1 font-serif text-[8px] font-semibold text-slate-500 shadow-md">
          정답 · 해설지
        </div>
      </div>

      {/* 해자 배지 */}
      <div className="mt-6 flex flex-wrap justify-center gap-1.5">
        {PREVIEW_BADGES.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
          >
            <Check className="h-3 w-3 text-emerald-500" aria-hidden />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-20">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-indigo-600" aria-hidden />
      <div className="font-serif text-[16px] font-semibold text-slate-900">AI 출제위원이 변형 문항을 만드는 중...</div>
      <div className="mt-1 text-[13px] text-slate-500">개념은 유지하고 숫자·보기·지문을 바꾸고 있습니다</div>
    </div>
  );
}

function BankDrawer({
  items,
  onClose,
  onRemove,
  onClear,
  inSheet,
  onToggleSheet,
}: {
  items: import("@/lib/exam/types").BankItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  inSheet: (id: string) => boolean;
  onToggleSheet: (v: Variant) => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="flex items-center gap-2 font-serif text-[16px] font-bold text-slate-900">
            <BookMarked className="h-4 w-4 text-indigo-600" aria-hidden />
            문제은행 <span className="text-slate-400">{items.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button onClick={onClear} className="cursor-pointer text-[12px] text-slate-400 hover:text-rose-600">
                전체 삭제
              </button>
            )}
            <button onClick={onClose} aria-label="닫기" className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
              <BookMarked className="mb-3 h-10 w-10 text-slate-300" aria-hidden />
              <p className="text-[14px]">저장된 문항이 없습니다.</p>
              <p className="mt-1 text-[12px] text-slate-400">생성된 문항을 은행에 저장하면 여기에 모입니다.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((v) => (
                <li key={v.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                        {SUBJECT_LABEL[v.subject]}
                      </span>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] ${DIFF_STYLE[v.difficulty]}`}>
                        {DIFF_LABEL[v.difficulty]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onToggleSheet(v)}
                        className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] ${
                          inSheet(v.id)
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {inSheet(v.id) ? "담김" : "＋ 시험지"}
                      </button>
                      <button
                        onClick={() => onRemove(v.id)}
                        aria-label="삭제"
                        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <p className="line-clamp-2 font-serif text-[13.5px] leading-relaxed text-slate-700">{v.stem}</p>
                  <p className="mt-1 text-[11.5px] text-emerald-700">정답 {v.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintModal({
  meta,
  setMeta,
  count,
  onClose,
  onPrint,
}: {
  meta: { academy: string; title: string; minutes: number };
  setMeta: (m: { academy: string; title: string; minutes: number }) => void;
  count: number;
  onClose: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-1 font-serif text-[18px] font-bold text-slate-900">시험지 만들기</h2>
        <p className="mb-5 text-[13px] text-slate-500">{count}문항이 시험지와 정답·해설지로 출력됩니다.</p>
        <div className="space-y-3">
          <div>
            <label htmlFor="academy" className="mb-1.5 block text-[12px] font-medium text-slate-500">
              학원·기관명
            </label>
            <input
              id="academy"
              value={meta.academy}
              onChange={(e) => setMeta({ ...meta, academy: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="title" className="mb-1.5 block text-[12px] font-medium text-slate-500">
              시험지 제목
            </label>
            <input
              id="title"
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="minutes" className="mb-1.5 block text-[12px] font-medium text-slate-500">
              제한시간 (분)
            </label>
            <input
              id="minutes"
              type="number"
              min={5}
              max={180}
              value={meta.minutes}
              onChange={(e) =>
                setMeta({ ...meta, minutes: Math.max(5, Math.min(180, Number(e.target.value) || 0)) })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[14px] text-slate-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={onPrint}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-110"
          >
            <Printer className="h-4 w-4" aria-hidden />
            인쇄
          </button>
        </div>
      </div>
    </div>
  );
}

// 인쇄 전용 — 화면에서는 .print-area가 display:none (globals.css)
// 수능형 2단 조판 + 배점·시험정보 헤더 + 단원 꼬리표 (해자 1: 한국형 시험지 엔진)
function PrintSheet({
  meta,
  variants,
}: {
  meta: { academy: string; title: string; minutes: number };
  variants: Variant[];
}) {
  const subjectLabel = SUBJECT_LABEL[dominantSubject(variants)];
  const totalPoints = variants.reduce((s, v) => s + (v.points ?? 3), 0);

  return (
    <div className="print-area text-black">
      {/* ── 문제지 ── */}
      <div className="exam-page">
        <div className="exam-head">
          <div className="exam-head-top">
            <span className="exam-academy">{meta.academy}</span>
            <span className="exam-subject-tag">{subjectLabel} 영역</span>
          </div>
          <h1 className="exam-title">{meta.title}</h1>
          <div className="exam-meta-row">
            <span>성명 ____________</span>
            <span>
              총 {variants.length}문항<span className="sep">·</span>
              {totalPoints}점<span className="sep">·</span>
              제한시간 {meta.minutes}분
            </span>
          </div>
        </div>

        <ol className="exam-list">
          {variants.map((v, i) => (
            <li key={v.id} className="exam-item">
              <div className="exam-q">
                <span className="exam-num">{i + 1}.</span>
                <div className="exam-body">
                  {v.passage && <div className="exam-passage">{v.passage}</div>}
                  <div className="exam-stem">
                    {v.stem} <span className="exam-points">[{v.points ?? 3}점]</span>
                  </div>
                  {v.choices && v.choices.length > 0 && (
                    <div className="exam-choices">
                      {v.choices.map((c, ci) => (
                        <span key={ci} className="exam-choice">
                          {c.label} {c.text}
                        </span>
                      ))}
                    </div>
                  )}
                  {v.type === "short_answer" && (
                    <div className="exam-answer-line">답: ____________________</div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="exam-foot">
          <span>
            {meta.academy} · {meta.title}
          </span>
          <span>문제팩토리로 출제</span>
        </div>
      </div>

      {/* ── 정답 및 해설 ── */}
      <div className="exam-page" style={{ breakBefore: "page" }}>
        <div className="exam-sol-head">정답 및 해설</div>

        <div className="exam-quickans">
          <b>빠른 정답</b>
          {"   "}
          {variants.map((v, i) => (
            <span key={v.id} className="mr-3 inline-block">
              {i + 1}) {v.answer}
            </span>
          ))}
        </div>

        <ol className="exam-list exam-sol-list">
          {variants.map((v, i) => {
            const unit = v.unitId ? unitPathLabel(v.unitId) : undefined;
            return (
              <li key={v.id} className="exam-sol">
                <span className="exam-num">{i + 1}.</span>
                <div className="exam-body">
                  <div className="exam-sol-answer">
                    정답: {v.answer}
                    <span className="exam-points"> · {v.points ?? 3}점</span>
                    {unit && <span className="exam-unit-tag">{unit}</span>}
                  </div>
                  <div className="exam-sol-exp">{v.explanation}</div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="exam-foot">
          <span>{meta.title} · 정답 및 해설</span>
          <span>문제팩토리로 출제</span>
        </div>
      </div>
    </div>
  );
}

/** 시험지 대표 과목 — 변형 문항들 중 최빈 과목(머리말 영역 표기용) */
function dominantSubject(variants: Variant[]): Subject {
  const freq = new Map<Subject, number>();
  for (const v of variants) freq.set(v.subject, (freq.get(v.subject) ?? 0) + 1);
  let best: Subject = "math";
  let max = -1;
  for (const [s, n] of freq) {
    if (n > max) {
      max = n;
      best = s;
    }
  }
  return best;
}
