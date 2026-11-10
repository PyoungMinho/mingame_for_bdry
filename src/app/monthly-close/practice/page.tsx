import { PracticeApp } from '../_screens/PracticeApp';

/**
 * 박대리 연습(/monthly-close/practice). 서버·지표 없음.
 * 미리보기(G0-5 눈테스트용 정지 판): ?mock=playing|ended&i=0|1|2  — 셀 상태 8종이 보이는 고정 화면. 가짜 데이터뿐이다.
 */
export default function PracticePage({ searchParams }: { searchParams?: { mock?: string; i?: string } }) {
  const mock = searchParams?.mock === 'playing' || searchParams?.mock === 'ended' ? searchParams.mock : null;
  const i = Number(searchParams?.i);
  const industry = i === 1 || i === 2 ? i : 0;
  return <PracticeApp mock={mock} industry={industry} />;
}
