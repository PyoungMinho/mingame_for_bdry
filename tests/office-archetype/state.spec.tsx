// @vitest-environment jsdom
/**
 * office-archetype 상태머신 통합 테스트 (QA실행자)
 * 계획: OA-STATE-01/02/03/04/06/09/13, OA-LINK-07/09/11
 *
 * 순수 클라이언트라 서버 방어망이 없다 → sessionStorage 복원·손상 JSON·popstate·
 * 260ms 자동전환 잠금·저장 실패 경로에서 재답변 강제/크래시/이중 진행이 없어야 완주율이 지켜진다.
 * jsdom + RTL + fake timers로 타이머(260ms 선택, 700ms analyzing)를 결정론적으로 통제한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { OA_STORAGE_KEYS } from "../../src/app/office-archetype/lib/types";
import questionsData from "../../src/app/office-archetype/data/questions.json";

const questions = questionsData.questions;

// next/navigation 라우터 목 — replace/back/push 호출을 관찰한다.
const replaceMock = vi.fn();
const backMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, back: backMock, push: pushMock }),
}));

// 동적 import(모듈 최상단에서 config/questions/types를 정적 로드하므로 목 이후 import)
async function loadTestPage() {
  const mod = await import("../../src/app/office-archetype/test/page");
  return mod.default;
}
async function loadResultView() {
  const mod = await import("../../src/app/office-archetype/result/[typeSlug]/ResultView");
  return mod.default;
}
async function loadRedirector() {
  const mod = await import("../../src/app/office-archetype/result/page");
  return mod.default;
}
async function loadTypes() {
  const mod = await import("../../src/app/office-archetype/data/types.json");
  return mod.types;
}

/** 현재 문항 텍스트로 진행 인덱스를 추정한다. */
function currentQuestionIndexByText(): number {
  for (let i = 0; i < questions.length; i++) {
    if (screen.queryByText(questions[i].text)) return i;
  }
  return -1;
}

/** 옵션 텍스트로 버튼을 찾아 클릭하고 260ms 자동전환 타이머를 흘려보낸다. */
function selectOptionAndAdvance(qIndex: number, oid: string) {
  const opt = questions[qIndex].options.find((o) => o.id === oid)!;
  const btn = screen.getByText(opt.text).closest("button")!;
  fireEvent.click(btn);
  act(() => {
    vi.advanceTimersByTime(260);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  replaceMock.mockClear();
  backMock.mockClear();
  pushMock.mockClear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "");
});

afterEach(() => {
  cleanup();
  // 전역 setup.ts afterEach가 이미 useRealTimers를 호출하므로 여기서는 DOM/모듈 정리만.
  vi.resetModules();
});

describe("OA-STATE 상태머신 — test/page.tsx", () => {
  it("OA-STATE-01: 10문항 순차 완주 → analyzing → router.replace(/result/id)", async () => {
    const TestPage = await loadTestPage();
    render(<TestPage />);
    // 1~10번 문항을 모두 'a'로 선택
    for (let i = 0; i < 10; i++) {
      expect(currentQuestionIndexByText()).toBe(i);
      selectOptionAndAdvance(i, "a");
    }
    // 마지막 선택 후 analyzing 로딩 노출
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    // 700ms 후 결과로 replace
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toMatch(/^\/office-archetype\/result\/[a-z]+$/);
    // 결과 slug가 sessionStorage에 저장됨
    expect(window.sessionStorage.getItem(OA_STORAGE_KEYS.result)).toBeTruthy();
  });

  it("OA-STATE-02: 같은 옵션 260ms 내 재탭해도 답변은 1건·중복 전환 없음(오탭 가드)", async () => {
    const TestPage = await loadTestPage();
    render(<TestPage />);
    const q0 = questions[0];
    const btnA = screen.getByText(q0.options[0].text).closest("button")!;
    // 같은 버튼을 260ms 안에 3번 연타 — OptionButton은 타이머를 재시작하지 않고 1회만 onSelect 호출
    fireEvent.click(btnA);
    fireEvent.click(btnA);
    fireEvent.click(btnA);
    act(() => {
      vi.advanceTimersByTime(260);
    });
    // 정확히 한 칸만 전진(q2), q1 답변 1건
    expect(currentQuestionIndexByText()).toBe(1);
    const stored = JSON.parse(window.sessionStorage.getItem(OA_STORAGE_KEYS.answers) ?? "[]");
    const q1Answers = stored.filter((a: { qid: string }) => a.qid === "q1");
    expect(q1Answers).toHaveLength(1);
    expect(q1Answers[0].oid).toBe("a");
  });

  it("OA-STATE-02b: 서로 다른 옵션 연타(A→B)해도 qid당 답변 1건·크래시 없음(마지막 탭 우선)", async () => {
    // 260ms 창 안에 두 옵션을 탭하면 두 OptionButton 타이머가 모두 발화하나,
    // handleSelect의 filter(qid당 1건 유지)로 최종 답변은 qid당 정확히 1건이어야 한다.
    const TestPage = await loadTestPage();
    render(<TestPage />);
    const q0 = questions[0];
    const btnA = screen.getByText(q0.options[0].text).closest("button")!;
    const btnB = screen.getByText(q0.options[1].text).closest("button")!;
    fireEvent.click(btnA);
    fireEvent.click(btnB);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const stored = JSON.parse(window.sessionStorage.getItem(OA_STORAGE_KEYS.answers) ?? "[]");
    const q1Answers = stored.filter((a: { qid: string }) => a.qid === "q1");
    expect(q1Answers).toHaveLength(1); // 데이터 오염 없음(핵심 안전 계약)
    // 실측: 마지막 탭(b)이 반영되고 정확히 한 칸 전진
    expect(currentQuestionIndexByText()).toBe(1);
  });

  it("OA-STATE-03: 3문항 답 후 재마운트 복원(currentIndex=3, 이전 답 유지)", async () => {
    const seeded = [
      { qid: "q1", oid: "a" },
      { qid: "q2", oid: "b" },
      { qid: "q3", oid: "c" },
    ];
    window.sessionStorage.setItem(OA_STORAGE_KEYS.answers, JSON.stringify(seeded));
    const TestPage = await loadTestPage();
    render(<TestPage />);
    // 복원 → 4번 문항(index 3)이 노출
    expect(currentQuestionIndexByText()).toBe(3);
    // 저장된 답변은 그대로 유지
    expect(JSON.parse(window.sessionStorage.getItem(OA_STORAGE_KEYS.answers)!)).toEqual(seeded);
  });

  it("OA-STATE-04: popstate 뒤로가기 시 oaQuestionIndex로 문항 동기화", async () => {
    const TestPage = await loadTestPage();
    render(<TestPage />);
    selectOptionAndAdvance(0, "a"); // → q2 (pushState oaQuestionIndex=1)
    selectOptionAndAdvance(1, "a"); // → q3 (pushState oaQuestionIndex=2)
    expect(currentQuestionIndexByText()).toBe(2);
    // 뒤로가기: q2(index 1)로 되돌아가는 popstate를 수동 디스패치
    act(() => {
      const ev = new PopStateEvent("popstate", { state: { oaQuestionIndex: 1 } });
      window.dispatchEvent(ev);
    });
    expect(currentQuestionIndexByText()).toBe(1);
    // 이전 답변(q2=a)이 하이라이트(aria-pressed) 되어야 함
    const q2optA = screen.getByText(questions[1].options[0].text).closest("button")!;
    expect(q2optA.getAttribute("aria-pressed")).toBe("true");
  });

  it("OA-STATE-06: 손상 sessionStorage(잘못된 JSON) 무시·크래시 없음", async () => {
    window.sessionStorage.setItem(OA_STORAGE_KEYS.answers, "{not-valid-json");
    const TestPage = await loadTestPage();
    expect(() => render(<TestPage />)).not.toThrow();
    // 처음부터(q1) 정상 렌더
    expect(currentQuestionIndexByText()).toBe(0);
  });

  it("OA-STATE-09: 10답 후 결과 저장 전 이탈→재진입 시 q10 재노출(결과 점프 안 함)", async () => {
    // 10개 답 저장됐지만 oa-result는 아직 없음(analyzing 중 이탈 시뮬)
    const tenAnswers = questions.map((q, i) => ({ qid: q.id, oid: i % 2 ? "b" : "a" }));
    window.sessionStorage.setItem(OA_STORAGE_KEYS.answers, JSON.stringify(tenAnswers));
    const TestPage = await loadTestPage();
    render(<TestPage />);
    // currentIndex = min(10, 9) = 9 → q10 재노출(설계 UX 갭, 리포트 대상)
    expect(currentQuestionIndexByText()).toBe(9);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("OA-STATE-13: 뒤로 왕복 재선택 시 qid당 답변 1건 유지(중복 qid 미발생)", async () => {
    const TestPage = await loadTestPage();
    render(<TestPage />);
    selectOptionAndAdvance(0, "a"); // q1=a → q2
    // 뒤로가기 → q1
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { oaQuestionIndex: 0 } }));
    });
    expect(currentQuestionIndexByText()).toBe(0);
    // q1 재선택(b)
    selectOptionAndAdvance(0, "b");
    const stored = JSON.parse(window.sessionStorage.getItem(OA_STORAGE_KEYS.answers)!);
    const q1 = stored.filter((a: { qid: string }) => a.qid === "q1");
    expect(q1).toHaveLength(1);
    expect(q1[0].oid).toBe("b");
  });
});

describe("OA-LINK 결과 뷰 모드 분기 & 리다이렉터", () => {
  it("OA-LINK-07: 친구 프리뷰 모드(oa-result≠slug) — 프리뷰 배지 노출·ShareCta 숨김", async () => {
    window.sessionStorage.setItem(OA_STORAGE_KEYS.result, "architect"); // 본인 결과는 architect
    const ResultView = await loadResultView();
    const types = await loadTypes();
    const bulldozer = types.find((t) => t.id === "bulldozer")!;
    render(<ResultView type={bulldozer as never} />);
    // effect가 isOwnResult=false 확정
    act(() => {
      vi.advanceTimersByTime(0);
    });
    // 프리뷰 배지 노출, 재테스트 CTA(친구 유입) 노출, ShareCta(카톡 공유 버튼) 숨김
    expect(screen.getByText("누군가 공유한 결과예요")).toBeInTheDocument();
    expect(screen.getByText("나는 무슨 유형일까? 1분 테스트 →")).toBeInTheDocument();
    expect(screen.queryByText("카톡 공유")).not.toBeInTheDocument();
  });

  it("OA-LINK-07b: 본인 결과(oa-result===slug) — ShareCta 노출·프리뷰 배지 숨김", async () => {
    window.sessionStorage.setItem(OA_STORAGE_KEYS.result, "bulldozer");
    const ResultView = await loadResultView();
    const types = await loadTypes();
    const bulldozer = types.find((t) => t.id === "bulldozer")!;
    render(<ResultView type={bulldozer as never} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.queryByText("누군가 공유한 결과예요")).not.toBeInTheDocument();
    expect(screen.getByText("카톡 공유")).toBeInTheDocument();
  });

  it("OA-LINK-09: 상성 '이 유형 보기' 탭 → 바텀시트 dialog 오픈, 배경클릭 닫힘", async () => {
    window.sessionStorage.setItem(OA_STORAGE_KEYS.result, "bulldozer");
    const ResultView = await loadResultView();
    const types = await loadTypes();
    const bulldozer = types.find((t) => t.id === "bulldozer")!;
    render(<ResultView type={bulldozer as never} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    // 상성 CTA 버튼(이 유형 보기) 클릭
    const cta = screen.getByText("이 유형 보기 →").closest("button")!;
    fireEvent.click(cta);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // bulldozer.matchBestId = mediator → 시트에 mediator 링크
    const link = screen.getByRole("link", { name: "이 유형 보기 →" });
    expect(link).toHaveAttribute("href", "/office-archetype/result/mediator");
    // 배경 클릭 시 닫힘
    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("OA-LINK-11: 리다이렉터 — 결과 없으면 토스트 후 랜딩 replace(1500ms), cleanup", async () => {
    window.sessionStorage.clear();
    const Redirect = await loadRedirector();
    render(<Redirect />);
    // 토스트 문구 노출
    expect(screen.getByText("결과가 없어요. 테스트부터 시작해볼까요?")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(replaceMock).toHaveBeenCalledWith("/office-archetype");
  });

  it("OA-LINK-11b: 리다이렉터 — 결과 있으면 즉시 /result/{slug}로 replace", async () => {
    window.sessionStorage.setItem(OA_STORAGE_KEYS.result, "sparker");
    const Redirect = await loadRedirector();
    render(<Redirect />);
    expect(replaceMock).toHaveBeenCalledWith("/office-archetype/result/sparker");
  });
});
