import { WitnessApp } from './screens/WitnessApp';

/**
 * 서버 컴포넌트 — 클라이언트 앱을 렌더한다. SSR 은 타이틀 스켈레톤만(저장은 마운트 뒤 effect 에서 읽는다).
 * 서버 컴포넌트 우선 원칙: 이 게임은 전부 클라이언트 상태(localStorage)라 데이터 페칭이 없다.
 */
export default function WitnessPage() {
  return <WitnessApp />;
}
