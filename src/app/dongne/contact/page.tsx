import type { Metadata } from 'next';
import Link from 'next/link';
import DongneHeader from '../lib/Header';

const CONTACT_EMAIL = 'yuki000503@gmail.com';

export const metadata: Metadata = {
  title: '문의',
  description: '동네고수에 대한 제보·문의·오류 신고는 이메일로 받고 있습니다.',
  robots: { index: true, follow: true },
};

/** 정적 문의 페이지 (design-final §5-9). */
export default function DongneContactPage() {
  return (
    <main className="dn-container dn-static-page">
      <DongneHeader backHref="/dongne" />
      <h1 className="dn-text-h1" style={{ margin: '16px 0' }}>
        문의
      </h1>

      <div className="dn-static-body">
        <p className="dn-text-body">
          정답 오류, 지역 표기 오탈자, 실루엣이 이상하게 보이는 문제, 기타 제안이나 버그 제보는
          아래 이메일로 보내주세요. 가능한 한 빠르게 확인하겠습니다.
        </p>

        <div className="dn-static-contact-box" style={{ marginTop: 16 }}>
          <p className="dn-text-body-sm">
            문의 이메일:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="dn-link">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <p className="dn-text-body" style={{ marginTop: 16 }}>
          제보 시 회차 번호(예: #123)와 어떤 화면에서 어떤 문제가 있었는지 함께 적어주시면 원인
          파악에 큰 도움이 됩니다.
        </p>
      </div>

      <Link href="/dongne" className="dn-cta-card" style={{ marginTop: 32, display: 'block' }}>
        오늘 문제 풀러 가기 →
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
