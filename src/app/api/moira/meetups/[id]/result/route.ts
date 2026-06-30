/**
 * GET /api/moira/meetups/[id]/result — 추천역 + 후보 장소 + 멤버별 이동시간
 *
 * compute가 완료되지 않았으면 409 E_NOT_READY.
 * demo 모드: src/lib/moira/mock.ts의 PLACES, RECOMMENDED_STATION 반환.
 * live 모드: DB에서 compute 결과 조회 후 반환. (TODO: DB 연결 후 활성화)
 *
 * 인증 불필요 (공개 조회).
 */

import { type NextRequest } from "next/server";
import { PLACES, RECOMMENDED_STATION } from "@/lib/moira/mock";
import { gapOf, avgOf, fairLevel } from "@/lib/moira/fairness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOIRA_SCORE_ALPHA = Number(process.env.MOIRA_SCORE_ALPHA ?? 0.4);
const MOIRA_SCORE_BETA  = Number(process.env.MOIRA_SCORE_BETA  ?? 0.4);
const MOIRA_SCORE_GAMMA = Number(process.env.MOIRA_SCORE_GAMMA ?? 0.2);

function detectMode(): "live" | "demo" {
  return process.env.ODSAY_API_KEY && process.env.KAKAO_REST_KEY ? "live" : "demo";
}

function stddev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function calcScore(minutes: number[]): number {
  // 빈 배열 방어: avg=0/0=NaN, Math.max(...[])=-Infinity 로 fairScore가 오염되어
  // 정렬(a-b)이 불안정해진다(가장 공평 1위 선정 실패). fairness.ts의 gapOf/avgOf와
  // 동일하게 0으로 방어한다(코드리뷰 m-2). demo(항상 4명)에선 도달 불가하나
  // live·compute 결과(0~1명)가 들어올 때를 위한 하드닝.
  if (minutes.length === 0) return 0;
  const avg  = minutes.reduce((s, x) => s + x, 0) / minutes.length;
  const max  = Math.max(...minutes);
  const sd   = stddev(minutes);
  return MOIRA_SCORE_ALPHA * avg + MOIRA_SCORE_BETA * max + MOIRA_SCORE_GAMMA * sd;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const meetupId = params.id;
  const mode = detectMode();

  // TODO: DB에서 meetup 존재 여부 + computed 여부 확인
  // const meetup = await db.meetups.findById(meetupId)
  // if (!meetup) return notFound()
  // if (!meetup.computed_at) return notReady()

  // demo 모드: mock.ts 데이터를 공평성 점수로 보강해서 반환
  if (mode === "demo") {
    const enriched = PLACES.map((place) => {
      const minutes = place.times.map((t) => t.minutes);
      const gap   = gapOf(place.times);
      const avg   = avgOf(place.times);
      const score = calcScore(minutes);
      return {
        id:        place.id,
        name:      place.name,
        category:  place.category,
        walkMin:   place.walkMin,
        blurb:     place.blurb,
        times:     place.times,
        fairGap:   gap,
        fairAvg:   avg,
        fairScore: Math.round(score * 10) / 10,
        fairLevel: fairLevel(gap),
        votes:     place.votes,
      };
    });

    // 공평한 순 정렬 (score 오름차순)
    enriched.sort((a, b) => a.fairScore - b.fairScore);

    return Response.json({
      success: true,
      data: {
        recommendedStation: RECOMMENDED_STATION,
        places: enriched,
      },
      meta: {
        mode: "demo" as const,
        version: 1,
        meetupId,
      },
    });
  }

  // live 모드: DB에서 조회 (TODO: 구현)
  // const result = await db.result.findByMeetupId(meetupId)
  // ...

  // live 미구현 중 임시 fallback (demo 동일)
  return Response.json({
    success: false,
    error: { code: "E_NOT_READY", message: "결과를 아직 계산 중입니다. 잠시 후 다시 시도해 주세요." },
  }, { status: 409 });
}
