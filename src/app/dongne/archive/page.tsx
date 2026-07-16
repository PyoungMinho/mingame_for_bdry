import type { Metadata } from 'next';
import Link from 'next/link';
import { getDateForGame, getRegionCodeForGame, getTodayGameNo } from '@/lib/dongne/queue';
import { getRegionByCode } from '../lib/manifest';
import DongneHeader from '../lib/Header';

// "오늘" 경계는 요청 시각 기준으로 자연스럽게 재검증돼야 한다(자정마다 목록이 1행씩 늘어난다).
// force-dynamic 대신 짧은 ISR로 캐시 이점은 유지하면서 최대 5분 이내로 신선도를 보장한다.
export const revalidate = 300;

export const metadata: Metadata = {
  title: '아카이브',
  description: '동네고수 지난 회차 목록 — 어제까지의 정답을 확인하고 오늘의 동네도 풀어보세요.',
  robots: { index: true, follow: true },
};

function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 아카이브 목록 (design-final §5-6). 오늘 회차는 스포 방지로 목록에서 제외하고 어제까지만
 * 보여준다. queue.ts 단일 소스로 회차→코드를 계산하고 manifest.json에서 이름만 조회한다
 * (정답 판정 로직은 여기 없음 — 이미 지나간 회차의 "정답"을 그냥 보여줄 뿐).
 */
export default function DongneArchivePage() {
  const todayGameNo = getTodayGameNo();
  const lastGameNo = todayGameNo - 1; // 오늘 회차 제외

  const rows = [];
  for (let gameNo = lastGameNo; gameNo >= 1; gameNo--) {
    const code = getRegionCodeForGame(gameNo);
    const region = getRegionByCode(code);
    rows.push({ gameNo, date: getDateForGame(gameNo), name: region?.nameWithSido ?? code });
  }

  return (
    <main className="dn-container dn-archive">
      <DongneHeader backHref="/dongne" />
      <h1 className="dn-text-h1" style={{ margin: '16px 0' }}>
        아카이브
      </h1>

      {rows.length === 0 ? (
        <p className="dn-text-body-sm">아직 지난 회차가 없어요. 오늘의 문제부터 풀어보세요!</p>
      ) : (
        <ul className="dn-archive-list">
          {rows.map((row) => (
            <li key={row.gameNo} className="dn-archive-row">
              <Link href={`/dongne/archive/${row.gameNo}`} className="dn-archive-row-link">
                <span className="dn-archive-row-no dn-text-mono-num">{`#${row.gameNo}`}</span>
                <span className="dn-archive-row-date dn-text-body-sm dn-text-mono-num">{formatMonthDay(row.date)}</span>
                <span className="dn-archive-row-name dn-text-guess-name">{row.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/dongne" className="dn-cta-card" style={{ marginTop: 24 }}>
        {`오늘(#${todayGameNo >= 1 ? todayGameNo : 1}) 문제 풀러 가기 →`}
      </Link>

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
