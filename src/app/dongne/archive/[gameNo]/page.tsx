import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDateForGame, getRegionCodeForGame, getTodayGameNo } from '@/lib/dongne/queue';
import type { Silhouette } from '@/lib/dongne/types';
import { getRegionByCode } from '../../lib/manifest';
import { loadEditorial } from '../../lib/editorial';
import DongneHeader from '../../lib/Header';

interface PageParams {
  params: { gameNo: string };
}

// "오늘" 경계가 요청 시각에 의존 — 정적 생성분 밖(예: 어제 막 지난 회차)도 5분 이내로
// on-demand 재검증되도록 짧은 ISR을 건다(force-dynamic보다 캐시 이점 유지).
export const revalidate = 300;

/**
 * 오늘 미만 회차만 빌드타임 정적 생성(방향서 §1 IN-6). `dynamicParams`는 기본값(true)을
 * 유지한다 — 배포 이후 새로 지나간 회차(생성 목록엔 없지만 이미 과거가 된 gameNo)도
 * on-demand로 정상 렌더되고 이후 캐시된다(재배포 없이도 아카이브가 매일 자연 증가).
 */
export function generateStaticParams() {
  const todayGameNo = getTodayGameNo();
  const last = todayGameNo - 1;
  if (last < 1) return [];
  return Array.from({ length: last }, (_, i) => ({ gameNo: String(i + 1) }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const gameNo = Number(params.gameNo);
  if (!Number.isInteger(gameNo) || gameNo < 1) return {};

  const todayGameNo = getTodayGameNo();
  if (todayGameNo < 1 || gameNo >= todayGameNo) {
    return { title: '아직 공개되지 않은 회차', robots: { index: false, follow: true } };
  }

  const code = getRegionCodeForGame(gameNo);
  const region = getRegionByCode(code);
  const name = region?.nameWithSido ?? code;
  const title = `${name}는 어떤 동네였을까?`;
  const description = `동네고수 #${gameNo}(${getDateForGame(gameNo)}) 정답 ${name} 해설 — 인구·면적·특산물·지명 유래.`;
  const ogImageUrl = `/dongne/og/${gameNo}`;

  return {
    title: { absolute: `${title} | 동네고수` },
    description,
    openGraph: { title, description, type: 'article', images: [{ url: ogImageUrl, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
    robots: { index: true, follow: true },
  };
}

/**
 * '어제의 동네' 해설 (design-final §5-7·§5-8). SSG 대상 밖(오늘·미래 회차, C6 결정에 따라
 * sitemap.ts는 v1에서 미배선)이면 일반 404 대신 §5-8의 친화적 차단 화면을 200으로 보여준다.
 * 잘못된 형식/음수 gameNo는 진짜 존재하지 않는 라우트이므로 notFound()로 표준 404 처리한다.
 */
export default async function DongneArchiveDetailPage({ params }: PageParams) {
  const gameNo = Number(params.gameNo);

  if (!Number.isInteger(gameNo) || gameNo < 1) {
    notFound();
  }

  const todayGameNo = getTodayGameNo();
  const isBlocked = todayGameNo < 1 || gameNo >= todayGameNo;

  if (isBlocked) {
    return (
      <main className="dn-container dn-archive-detail">
        <DongneHeader backHref="/dongne/archive" backLabel="아카이브" />
        <div className="dn-cta-card" style={{ marginTop: 40 }}>
          <p className="dn-text-h2">아직 공개되지 않은 회차예요</p>
          {todayGameNo >= 1 && gameNo === todayGameNo ? (
            <p className="dn-text-body-sm">오늘 문제는 아직 진행 중이에요!</p>
          ) : null}
        </div>
        <Link href="/dongne" className="dn-btn-primary" style={{ marginTop: 16, display: 'flex' }}>
          오늘 문제 풀러 가기 →
        </Link>
      </main>
    );
  }

  const code = getRegionCodeForGame(gameNo);
  const region = getRegionByCode(code);
  const name = region?.nameWithSido ?? code;
  const dateStr = getDateForGame(gameNo);
  const editorial = await loadEditorial(code);

  let heroSvg: Silhouette | null = null;
  try {
    const mod = await import(`../../data/silhouettes/${code}.json`);
    heroSvg = (mod.default ?? mod) as Silhouette;
  } catch {
    heroSvg = null;
  }

  // 이미 지나간(정답 확정된) 회차라 지역명 노출은 스포일러가 아니다 — JSON-LD도 안전.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${name}는 어떤 동네였을까?`,
    datePublished: dateStr,
    description: `동네고수 #${gameNo} 정답 ${name} 해설`,
    about: region ? { '@type': 'Place', name: region.nameWithSido, containedInPlace: region.sidoFull } : undefined,
    mainEntityOfPage: `https://project-orsrw.vercel.app/dongne/archive/${gameNo}`,
  };

  const prevGameNo = gameNo - 1;
  const nextGameNo = gameNo + 1;
  const nextAvailable = nextGameNo < todayGameNo;
  const nextIsToday = nextGameNo === todayGameNo;

  return (
    <main className="dn-container dn-archive-detail">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <DongneHeader backHref="/dongne/archive" backLabel="아카이브" />

      <nav className="dn-breadcrumb dn-text-body-sm" aria-label="이동 경로">
        <Link href="/dongne" className="dn-link">
          동네고수
        </Link>{' '}
        ›{' '}
        <Link href="/dongne/archive" className="dn-link">
          아카이브
        </Link>{' '}
        › {`#${gameNo}`}
      </nav>

      <p className="dn-text-label" style={{ marginTop: 16 }}>
        어제의 동네
      </p>
      <h1 className="dn-text-h1">{`${name}는 어떤 동네였을까?`}</h1>
      <p className="dn-text-body-sm">{`#${gameNo} · ${dateStr} · ${name}`}</p>

      {heroSvg ? (
        <div className="dn-archive-hero" aria-hidden="true">
          <svg viewBox={heroSvg.viewBox} className="dn-archive-hero-svg">
            <path d={heroSvg.d} fillRule="evenodd" />
          </svg>
        </div>
      ) : null}

      <div className="dn-archive-stats">
        {editorial?.facts
          ? Object.entries(editorial.facts).map(([label, value]) => (
              <div className="dn-archive-stat" key={label}>
                <span className="dn-text-label">{label}</span>
                <span className="dn-text-mono-num">{value}</span>
              </div>
            ))
          : null}
        <div className="dn-archive-stat">
          <span className="dn-text-label">소속</span>
          <span className="dn-text-mono-num">{region?.sidoFull ?? '-'}</span>
        </div>
        <div className="dn-archive-stat">
          <span className="dn-text-label">회차</span>
          <span className="dn-text-mono-num">{`#${gameNo}`}</span>
        </div>
      </div>

      <article className="dn-archive-body">
        {editorial && (editorial.intro || (editorial.body && editorial.body.length > 0)) ? (
          <>
            {editorial.intro ? (
              <p className="dn-text-body dn-archive-intro">{editorial.intro}</p>
            ) : null}
            {(editorial.body ?? []).map((p, j) => (
              <p className="dn-text-body" key={j}>
                {p}
              </p>
            ))}
          </>
        ) : (
          <p className="dn-text-body">
            {`${name}에 대한 자세한 해설은 아직 준비 중이에요. 인구·면적·특산물·지명 유래 같은 이야기가 곧 업데이트될 예정입니다.`}
          </p>
        )}
      </article>

      <Link href="/dongne" className="dn-cta-card" style={{ margin: '24px 0', display: 'block' }}>
        오늘의 문제 풀러가기 →
      </Link>

      <nav className="dn-archive-pagination" aria-label="회차 이동">
        {prevGameNo >= 1 ? (
          <Link href={`/dongne/archive/${prevGameNo}`} className="dn-link">{`‹ #${prevGameNo}`}</Link>
        ) : (
          <span />
        )}
        {nextAvailable ? (
          <Link href={`/dongne/archive/${nextGameNo}`} className="dn-link">{`#${nextGameNo} ›`}</Link>
        ) : (
          <span className="dn-text-body-sm">{nextIsToday ? '아직 공개 전' : ''}</span>
        )}
      </nav>

      <footer className="dn-footer-links" style={{ marginTop: 32 }}>
        <Link href="/dongne/about" className="dn-link">
          소개
        </Link>
        <Link href="/dongne/privacy" className="dn-link">
          개인정보
        </Link>
        <Link href="/dongne/contact" className="dn-link">
          문의
        </Link>
      </footer>
    </main>
  );
}
