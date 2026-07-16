import type { Metadata } from 'next';
import Link from 'next/link';
import DongneHeader from '../lib/Header';

export const metadata: Metadata = {
  title: '소개',
  description: '동네고수는 매일 대한민국 시·군·구 실루엣 1곳을 6번 안에 맞히는 무료 데일리 퀴즈입니다.',
  robots: { index: true, follow: true },
};

/** 정적 소개 페이지 (design-final §5-9 공통 템플릿). 애드센스 대비 정적 3종 중 하나. */
export default function DongneAboutPage() {
  return (
    <main className="dn-container dn-static-page">
      <DongneHeader backHref="/dongne" />
      <h1 className="dn-text-h1" style={{ margin: '16px 0' }}>
        동네고수 소개
      </h1>

      <div className="dn-static-body">
        <p className="dn-text-body">
          동네고수는 매일 자정, 대한민국 시·군·구 250곳 중 하나의 실루엣을 출제하는 무료 데일리
          퀴즈입니다. 실루엣만 보고 6번 안에 동네 이름을 맞혀 보세요.
        </p>
        <p className="dn-text-body">
          정답을 맞히지 못해도 걱정 마세요. 오답마다 정답 지역까지의 거리(km)·방향(8방위
          화살표)·근접도(%)를 알려드려서, 시도할수록 점점 정답에 가까워집니다.
        </p>
        <p className="dn-text-body">
          회원가입도, 앱 설치도 필요 없습니다. 브라우저에서 바로 오늘의 동네를 맞혀 보세요.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 24 }}>
          어떻게 작동하나요?
        </h2>
        <ul className="dn-static-list">
          <li className="dn-text-body">① 매일 자정(한국시간), 새로운 동네 실루엣 1개가 공개됩니다.</li>
          <li className="dn-text-body">② 자동완성으로 지역을 선택하고 [추측하기]를 누르면 시도가 기록됩니다.</li>
          <li className="dn-text-body">③ 오답이면 거리·방향·근접도 힌트가 남고, 6번 안에 정답을 맞히면 성공입니다.</li>
        </ul>

        <h2 className="dn-text-h2" style={{ marginTop: 24 }}>
          기록은 어디에 저장되나요?
        </h2>
        <p className="dn-text-body">
          플레이 스트릭·통계는 이용자의 브라우저(localStorage)에만 저장되며, 서버로 전송되지
          않습니다. 자세한 내용은{' '}
          <Link href="/dongne/privacy" className="dn-link">
            개인정보처리방침
          </Link>
          을 참고하세요.
        </p>

        <h2 className="dn-text-h2" style={{ marginTop: 24 }}>
          지난 정답이 궁금하다면
        </h2>
        <p className="dn-text-body">
          <Link href="/dongne/archive" className="dn-link">
            아카이브
          </Link>
          에서 어제까지의 정답과 지역 이야기를 확인할 수 있습니다.
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
