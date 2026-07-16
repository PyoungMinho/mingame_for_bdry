import type { Metadata } from 'next';
import Link from 'next/link';
import DongneHeader from '../lib/Header';

const CONTACT_EMAIL = 'yuki000503@gmail.com';
const EFFECTIVE_DATE = '2026년 7월 18일';
const SERVICE_NAME = '동네고수';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '동네고수 개인정보처리방침 — 회원가입 없이 운영되며, 기록은 브라우저에만 저장됩니다.',
  robots: { index: true, follow: true },
};

/** 정적 개인정보처리방침 (design-final §5-9, 애드센스 승인 요건 대비). */
export default function DongnePrivacyPage() {
  return (
    <main className="dn-container dn-static-page">
      <DongneHeader backHref="/dongne" />
      <h1 className="dn-text-h1" style={{ margin: '16px 0' }}>
        개인정보처리방침
      </h1>
      <p className="dn-text-body-sm">
        시행일: {EFFECTIVE_DATE} · {SERVICE_NAME}(이하 &ldquo;서비스&rdquo;)
      </p>

      <div className="dn-static-body" style={{ marginTop: 16 }}>
        <h2 className="dn-text-h2">1. 총칙</h2>
        <p className="dn-text-body">
          서비스는 회원가입·로그인 절차 없이 누구나 무료로 이용할 수 있습니다. 이에 따라 이름·
          연락처 등 개인을 식별할 수 있는 정보를 서버에 수집·보관하지 않는 것을 원칙으로 합니다.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          2. 이용자 브라우저에만 저장되는 정보
        </h2>
        <ul className="dn-static-list">
          <li className="dn-text-body">
            플레이 스트릭, 총 플레이 수·승률, 시도 분포(1~6회/실패) 등 게임 기록은 이용자 브라우저의
            localStorage에만 저장되며 서버로 전송되지 않습니다. 브라우저 저장소를 지우면 함께
            사라집니다.
          </li>
          <li className="dn-text-body">
            &ldquo;우리 동네&rdquo; 설정(사용자가 직접 고른 지역 코드)도 동일하게 브라우저에만
            저장됩니다.
          </li>
        </ul>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          3. 서버가 수집하는 최소 정보 — 방문자 수 집계
        </h2>
        <p className="dn-text-body">
          서비스가 얼마나 이용되는지 가늠하기 위해, 오늘의 게임 화면에 처음 들어와 상호작용할 때
          브라우저가 무작위로 생성한 익명 식별자(anon_id, 이름·기기 정보 아님) 1개와 날짜(한국시간
          기준)만 서버로 1일 1회 전송됩니다. 이 식별자는 다른 어떤 개인정보와도 연결되지 않으며,
          방문자 수를 집계하는 용도로만 사용됩니다.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          4. 광고
        </h2>
        <p className="dn-text-body">
          현재 서비스는 광고를 게재하지 않습니다. 추후 광고(Google AdSense 등)를 도입하는 경우,
          쿠키 사용을 포함한 관련 내용을 이 페이지에 미리 고지한 뒤 시행합니다.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          5. 만 14세 미만 아동의 개인정보
        </h2>
        <p className="dn-text-body">
          서비스는 개인정보를 수집하지 않아 별도의 법정대리인 동의 절차를 두고 있지 않습니다. 만약
          아동의 개인정보가 수집된 사실이 확인되면 지체 없이 파기합니다.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          6. 보유 및 파기
        </h2>
        <p className="dn-text-body">
          서버에는 개인을 식별할 수 있는 정보가 없으므로 별도로 보유·파기할 개인정보가 없습니다.
          브라우저에 저장된 게임 기록은 이용자가 언제든 직접 삭제할 수 있습니다.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          7. 문의처
        </h2>
        <p className="dn-text-body">개인정보 처리에 관한 문의는 아래 이메일로 접수할 수 있습니다.</p>
        <div className="dn-static-contact-box">
          <p className="dn-text-body-sm">
            서비스명: {SERVICE_NAME}
            <br />
            문의 이메일:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="dn-link">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <h2 className="dn-text-h2" style={{ marginTop: 20 }}>
          8. 고지의 의무 및 변경
        </h2>
        <p className="dn-text-body">
          본 방침의 내용이 변경되면 이 페이지를 통해 공지합니다.
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
