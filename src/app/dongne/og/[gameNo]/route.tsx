import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { getRegionCodeForGame, getTodayGameNo } from '@/lib/dongne/queue';
import type { Silhouette } from '@/lib/dongne/types';

export const runtime = 'edge';
// getTodayGameNo()가 요청 시각(new Date())에 의존하므로 정적 프리렌더로 굳어지면 안 된다
// (§9-3 가드와 동일한 이유 — "오늘" 판정은 항상 요청 시점 기준이어야 한다).
export const dynamic = 'force-dynamic';

// dongne-design-final.md §3-1 토큰 원값을 그대로 하드코딩(ImageResponse/satori는 CSS 파일을
// import할 수 없어 색은 항상 리터럴로 박아야 한다 — office-archetype og route 선례와 동일).
const BG_START = '#F6EFDF';
const BG_END = '#EFE5CE';
const INK = '#2B2419';
const MUTED = '#8A7C5E';
const BODY = '#4E4433';
const PRIMARY = '#BF4C2C';
const PRIMARY_INK = '#FFFFFF';
const PRIMARY_SOFT = '#F6DDD1';

const SITE = 'project-orsrw.vercel.app/dongne';

/**
 * OG 이미지 라우트 (design-final §7, 방향서 C1 — office-archetype 스택 이식).
 * 1200×630 고정, 스포일러-프리 티저: manifest.json의 name/centroid는 **절대 읽지 않는다**
 * (queue.ts는 지역 "코드"만 알고 있어 이 라우트가 import해도 정답 유출 표면이 없다).
 * 실루엣은 채움 없이 stroke-only 윤곽선 + 거대 "?" 오버레이로만 렌더한다.
 */
export async function GET(_request: NextRequest, { params }: { params: { gameNo: string } }) {
  const gameNo = Number(params.gameNo);
  if (!Number.isInteger(gameNo) || gameNo < 1) {
    return new Response('Not found', { status: 404 });
  }

  // 미래 회차는 실루엣 형태조차 노출 금지(방향서 §2 안티치트 완화 ①·② 원칙의 연장) —
  // EPOCH 이전(getTodayGameNo()<1) 빌드/배포 초기에도 동일하게 차단한다.
  const todayGameNo = getTodayGameNo();
  if (todayGameNo < 1 || gameNo > todayGameNo) {
    return new Response('Not found', { status: 404 });
  }

  const code = getRegionCodeForGame(gameNo);

  let outlineDataUri: string | null = null;
  try {
    const mod = await import(`../../data/silhouettes/${code}.json`);
    const silhouette = (mod.default ?? mod) as Silhouette;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${silhouette.viewBox}">` +
      `<path d="${silhouette.d}" fill="none" stroke="rgba(43,36,25,0.3)" stroke-width="3" stroke-dasharray="6 4" />` +
      `</svg>`;
    outlineDataUri = `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch {
    outlineDataUri = null; // 실루엣 로드 실패해도 카드 자체는 계속 렌더(non-blocking)
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: `linear-gradient(135deg, ${BG_START}, ${BG_END})`,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Eyebrow (§7 레이아웃: 64,72) */}
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 72,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            color: MUTED,
            display: 'flex',
          }}
        >
          매일 만나는 대한민국 동네 실루엣 퀴즈
        </div>

        {/* 워드마크 + 회차 배지 (64,130) */}
        <div style={{ position: 'absolute', left: 64, top: 130, display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{ fontSize: 80, fontWeight: 800, color: INK, display: 'flex' }}>동네고수</span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: PRIMARY_INK,
              background: PRIMARY,
              borderRadius: 9999,
              padding: '8px 20px',
              display: 'flex',
            }}
          >
            {`#${gameNo}`}
          </span>
        </div>

        {/* 태그라인 (64,250, w620) */}
        <div
          style={{
            position: 'absolute',
            left: 64,
            top: 250,
            width: 620,
            fontSize: 34,
            fontWeight: 500,
            color: BODY,
            display: 'flex',
          }}
        >
          6번 안에 대한민국 동네 실루엣 맞히기
        </div>

        {/* 실루엣 티저 — center(900,310) 360×360, stroke-only(-4deg) */}
        {outlineDataUri ? (
          <img
            src={outlineDataUri}
            width={360}
            height={360}
            style={{ position: 'absolute', left: 720, top: 130, transform: 'rotate(-4deg)' }}
          />
        ) : null}

        {/* "?" 오버레이 — 실루엣 중앙 */}
        <div
          style={{
            position: 'absolute',
            left: 790,
            top: 190,
            width: 220,
            height: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 220,
            fontWeight: 800,
            color: PRIMARY_SOFT,
            opacity: 0.55,
          }}
        >
          ?
        </div>

        {/* 하단 CTA 바 (0,538,1200,92) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 538,
            width: 1200,
            height: 92,
            background: PRIMARY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: PRIMARY_INK,
          }}
        >
          {`6번 안에 맞혀보세요 → ${SITE}`}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
