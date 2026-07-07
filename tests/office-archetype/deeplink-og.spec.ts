/**
 * office-archetype 딥링크 / OG 라우트 테스트 (QA실행자)
 * 계획: OA-LINK-01/02/04, OA-OG-01/02/04, OA-OG-08
 *
 * 친구 공유 URL·OG 카드가 바이럴 재유입 핵심. 죽은 슬러그가 200/빈페이지로 새면 안 되고,
 * 8유형 × 2비율 OG는 전량 정상 이미지여야 한다. next/og(edge)는 node 환경에서
 * ImageResponse 인스턴스화까지만 검증(픽셀 렌더는 통합 범위 밖) + 404 계약을 못 박는다.
 */
import { describe, it, expect, vi } from "vitest";
import questionsData from "../../src/app/office-archetype/data/questions.json";
import typesData from "../../src/app/office-archetype/data/types.json";
import type { OaType } from "../../src/app/office-archetype/lib/types";

const types = typesData.types as unknown as OaType[];
void questionsData;

// notFound()는 실제로 throw하는 sentinel — 목으로 호출을 관찰한다.
const notFoundMock = vi.fn(() => {
  throw new Error("__NEXT_NOT_FOUND__");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

describe("OA-LINK 딥링크 라우팅 계약 (result/[typeSlug])", () => {
  it("OA-LINK-01: generateStaticParams 정확히 8종 = 8유형 id", async () => {
    const mod = await import("../../src/app/office-archetype/result/[typeSlug]/page");
    const params = mod.generateStaticParams();
    expect(params).toHaveLength(8);
    const slugs = params.map((p: { typeSlug: string }) => p.typeSlug).sort();
    expect(slugs).toEqual(types.map((t) => t.id).sort());
  });

  it("OA-LINK-04: 유형별 OG 메타 정확(title/og.images 1200x1200/twitter summary_large_image)", async () => {
    const mod = await import("../../src/app/office-archetype/result/[typeSlug]/page");
    for (const t of types) {
      const meta = mod.generateMetadata({ params: { typeSlug: t.id } });
      // title.absolute에 유형명·alias 포함
      const title = (meta.title as { absolute: string }).absolute;
      expect(title).toContain(t.name);
      expect(title).toContain(t.alias);
      // og.images url = /office-archetype/og/{id}, 1200x1200
      const img = (meta.openGraph!.images as { url: string; width: number; height: number }[])[0];
      expect(img.url).toBe(`/office-archetype/og/${t.id}`);
      expect(img.width).toBe(1200);
      expect(img.height).toBe(1200);
      expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
    }
  });

  it("OA-LINK-04b: 잘못된 슬러그 메타는 빈 객체 반환(폴백)", async () => {
    const mod = await import("../../src/app/office-archetype/result/[typeSlug]/page");
    expect(mod.generateMetadata({ params: { typeSlug: "no-such-type" } })).toEqual({});
  });

  it("OA-LINK-02: 잘못된 슬러그 페이지는 notFound() 호출(404)", async () => {
    notFoundMock.mockClear();
    const mod = await import("../../src/app/office-archetype/result/[typeSlug]/page");
    expect(() => mod.default({ params: { typeSlug: "ghost-slug" } })).toThrow(
      "__NEXT_NOT_FOUND__",
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("OA-LINK-02b: 유효한 슬러그는 notFound를 호출하지 않고 ResultView를 렌더한다", async () => {
    notFoundMock.mockClear();
    const mod = await import("../../src/app/office-archetype/result/[typeSlug]/page");
    expect(() => mod.default({ params: { typeSlug: types[0].id } })).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

describe("OA-OG 공유 카드 라우트 (og/[typeSlug]/route)", () => {
  it("OA-OG-04: 잘못된 슬러그는 404 Response('Not found')", async () => {
    const mod = await import("../../src/app/office-archetype/og/[typeSlug]/route");
    const req = new Request("https://x.test/og/ghost");
    const res = mod.GET(req as never, { params: { typeSlug: "ghost" } });
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(404);
    expect(await (res as Response).text()).toBe("Not found");
  });

  it("OA-OG-01/02: 8유형 × 2비율(1x1·9x16) 전량 ImageResponse 생성(throw 없음)", async () => {
    const mod = await import("../../src/app/office-archetype/og/[typeSlug]/route");
    for (const t of types) {
      for (const ratio of ["1x1", "9x16"]) {
        const url = `https://x.test/og/${t.id}?ratio=${ratio}`;
        const res = mod.GET(new Request(url) as never, { params: { typeSlug: t.id } });
        expect(res, `${t.id} ratio=${ratio}`).toBeInstanceOf(Response);
        // ImageResponse는 200. Content-Type이 image/*
        expect((res as Response).status).toBe(200);
        expect((res as Response).headers.get("content-type")).toMatch(/image\//);
      }
    }
  });

  it("OA-OG-08: route는 ?ratio= 파라미터를 읽는다(기본 1x1, 알 수 없는 값도 1x1 폴백)", async () => {
    const mod = await import("../../src/app/office-archetype/og/[typeSlug]/route");
    const id = types[0].id;
    // 파라미터 없음 → 200(기본 1x1)
    const noParam = mod.GET(new Request(`https://x.test/og/${id}`) as never, {
      params: { typeSlug: id },
    });
    expect((noParam as Response).status).toBe(200);
    // 이상값 → 200(1x1 폴백). variant= 는 route가 읽지 않음(주석 드리프트, 리포트 대상)
    const bogus = mod.GET(new Request(`https://x.test/og/${id}?ratio=zzz&variant=story`) as never, {
      params: { typeSlug: id },
    });
    expect((bogus as Response).status).toBe(200);
  });
});
