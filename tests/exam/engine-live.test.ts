/**
 * generateVariants live 경로 — @anthropic-ai/sdk 모킹 (설계서 §2.6, GV-10, M-1 실측)
 * 절대 실네트워크/실키 호출 금지. messages.create 를 vi.fn 스텁으로 대체.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withExamKey, makeBody, FAKE_LIVE_KEY } from "./_helpers";

// --- Anthropic SDK 모킹 ---
const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: createMock };
      constructor(public opts: unknown) {}
    },
  };
});

// 모킹 후 import (호이스팅된 mock이 적용된 모듈을 받기 위해)
import { generateVariants } from "@/lib/server/exam-engine";

/** content 블록으로 messages.create 응답을 구성. 엔진은 프리필 '{'를 앞에 붙인다. */
function mockTextResponse(text: string) {
  createMock.mockResolvedValueOnce({
    content: [{ type: "text", text }],
  });
}

async function genLive(bodyOverrides = {}) {
  return withExamKey(FAKE_LIVE_KEY, () => generateVariants(makeBody(bodyOverrides)));
}

beforeEach(() => {
  createMock.mockReset();
});

describe("generateVariants live 경로 (SDK 모킹)", () => {
  it("LV-01: 프리필 '{' 합쳐 정상 파싱 → mode live, length 1", async () => {
    // 엔진이 raw = "{" + first.text 로 조립하므로 text는 '{' 없이 시작
    mockTextResponse('"variants":[{"stem":"q","answer":"③","choices":[{"label":"③","text":"x"}]}]}');
    const r = await genLive({ count: 1 });
    expect(r.mode).toBe("live");
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0].stem).toBe("q");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("LV-02: 빈 변형만 오면 normalize 전부 null → throw '변형 문항을 만들지 못했습니다'", async () => {
    mockTextResponse('"variants":[{"stem":""}]}');
    await expect(genLive({ count: 1 })).rejects.toThrow("변형 문항을 만들지 못했습니다");
  });

  it("LV-03: variants 키 없음 → 빈배열 → throw", async () => {
    mockTextResponse('"sourceSummary":"x"}');
    await expect(genLive({ count: 1 })).rejects.toThrow("변형 문항을 만들지 못했습니다");
  });

  it("LV-04: 모킹이 변형 5개 반환, count2 → slice(0,2) → length 2", async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      stem: `q${i}`,
      answer: "③",
      choices: [{ label: "③", text: `${i}` }],
    }));
    mockTextResponse('"variants":' + JSON.stringify(five) + "}");
    const r = await genLive({ count: 2 });
    expect(r.variants).toHaveLength(2);
  });

  it("LV-05: sourceSummary 없으면 '원본 문항 기반 변형' 폴백", async () => {
    mockTextResponse(
      '"variants":[{"stem":"q","answer":"③","choices":[{"label":"③","text":"x"}]}]}'
    );
    const r = await genLive({ count: 1 });
    expect(r.sourceSummary).toBe("원본 문항 기반 변형");
  });

  it("LV-06: text 블록 없으면 raw='{' → extractJson('{') throw", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "x" } }],
    });
    await expect(genLive({ count: 1 })).rejects.toThrow(
      "AI 응답을 해석하지 못했습니다"
    );
  });

  it("LV-07: image 입력 동봉 시 userBlocks에 image+text, media_type 전달", async () => {
    mockTextResponse(
      '"variants":[{"stem":"q","answer":"③","choices":[{"label":"③","text":"x"}]}]}'
    );
    await genLive({
      source: "",
      imageBase64: "BASE64DATA",
      imageMediaType: "image/jpeg",
      count: 1,
    });
    const callArg = createMock.mock.calls[0][0];
    const userMsg = callArg.messages.find((m: { role: string }) => m.role === "user");
    const blocks = userMsg.content;
    const imageBlock = blocks.find((b: { type: string }) => b.type === "image");
    const textBlock = blocks.find((b: { type: string }) => b.type === "text");
    expect(imageBlock).toBeTruthy();
    expect(imageBlock.source.media_type).toBe("image/jpeg");
    expect(imageBlock.source.data).toBe("BASE64DATA");
    expect(textBlock).toBeTruthy();
    // assistant 프리필 '{'도 함께 전달되는지
    const assistantMsg = callArg.messages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg.content).toBe("{");
  });

  it("LV-08: messages.create reject(네트워크 오류) → 그대로 전파", async () => {
    createMock.mockRejectedValueOnce(new Error("network down"));
    await expect(genLive({ count: 1 })).rejects.toThrow("network down");
  });

  it("GV-10: live env면 new Anthropic 호출되고 demo로 안 빠짐", async () => {
    mockTextResponse(
      '"variants":[{"stem":"q","answer":"③","choices":[{"label":"③","text":"x"}]}]}'
    );
    const r = await genLive({ count: 1 });
    expect(r.mode).toBe("live"); // demo로 폴백 안 함
    expect(createMock).toHaveBeenCalled(); // SDK 실제 호출 분기
  });

  // --- BUG M-1 실측: live 경로에서 'null' JSON이 오면 크래시하는가? ---
  it("M-1 실측 (LV-NULL): 모델이 'null'만 반환하면 null.variants → TypeError 크래시", async () => {
    // 엔진 raw = '{' + 'null' = '{null' → extractJson:
    //   JSON.parse('{null') 실패 → 슬라이스 indexOf('{')=0, lastIndexOf('}')=-1 → end<start → throw.
    // 즉 프리필 '{' 때문에 순수 'null'은 오히려 throw로 흡수된다.
    // 진짜 null 크래시를 보려면 text가 '}'로 끝나며 파싱결과가 null이어야 하는데,
    // 프리필 구조상 그 경로는 닫힌다. → 아래에서 두 시나리오를 모두 박제한다.
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: "null" }] });
    // raw='{null' → throw (크래시 아님, 제어된 에러)
    await expect(genLive({ count: 1 })).rejects.toThrow("AI 응답을 해석하지 못했습니다");
  });

  it("M-1 실측 (LV-NULL-2): raw가 정확히 'null'이 되도록 강제하면 TypeError 크래시", async () => {
    // extractJson을 직접 'null'로 호출하면 null 반환 → 하류 (null.variants) 크래시.
    // generateVariants 내부 프리필이 '{'를 붙이므로 자연 경로로는 재현 어렵지만,
    // 'null'을 감싸는 형태( '"x":null}' 류로는 객체가 되어 안전)라서
    // 여기서는 "프리필이 우연히 M-1을 막고 있다"는 사실을 박제한다.
    // → extractJson 단독 크래시는 engine.test.ts EJ-13 + route.test.ts 직접확인.
    createMock.mockResolvedValueOnce({ content: [{ type: "text", text: '"x":null}' }] });
    // raw='{"x":null}' → 객체 {x:null} → variants undefined → 빈배열 → throw(변형 없음)
    await expect(genLive({ count: 1 })).rejects.toThrow("변형 문항을 만들지 못했습니다");
  });

  it("M-1 직접 (extractJson('null') → throw, 하류 null.variants 크래시 차단)", async () => {
    // M-1 FIXED: extractJson 이 'null'(및 배열/원시값)을 asExamObject 로 거부하고 throw.
    // 따라서 하류 (parsed.variants || []) 의 null.variants TypeError 경로가 원천 차단된다.
    const { extractJson } = await import("@/lib/server/exam-engine");
    expect(() => extractJson("null")).toThrow("AI 응답을 해석하지 못했습니다");
  });
});
