import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section, Bullets } from "@/app/_components/ContentPage";

export const metadata: Metadata = {
  title: "사용 가이드",
  description:
    "문제팩토리 200% 활용법 — 시작하는 3단계부터 오답 정복·연속 학습·과목별 활용, 강사용 변형 시험지 만들기까지.",
  robots: { index: true, follow: true },
};

export default function GuidePage() {
  return (
    <ContentPage
      title="문제팩토리 200% 활용 가이드"
      subtitle="처음이라면 3분이면 충분해요. 더 효과적으로 쓰는 법까지 정리했습니다."
    >
      <div className="space-y-8">
        <Section title="3단계로 시작하기">
          <Bullets
            items={[
              <>
                <b>① 과목·단원 고르기</b> — 국어·수학·영어·과학·사회 중 하나를 고르고, 필요하면 교육과정 단원을
                지정합니다.
              </>,
              <>
                <b>② 주제·개념 입력</b> — “이차방정식 근의 공식”, “광합성 명반응과 암반응”, “빈칸 추론 연습”처럼
                공부할 내용을 적습니다.
              </>,
              <>
                <b>③ 난이도·유형·문항 수 선택 후 풀기</b> — 하/중/상 난이도와 객관식·단답형을 고르고 시작하면, 한
                문제씩 풀며 즉시 채점됩니다.
              </>,
            ]}
          />
        </Section>

        <Section title="더 효과적으로 쓰는 팁">
          <Bullets
            items={[
              <>
                <b>틀린 문제부터</b> — 오늘 틀린 개념을 주제로 넣어 비슷한 문제를 반복하면 약점이 빨리 메워집니다.
              </>,
              <>
                <b>매일 한 세트</b> — 하루 한 세트씩 풀면 연속 학습일이 이어집니다. 짧아도 매일이 중요합니다.
              </>,
              <>
                <b>단원 지정</b> — 시험 범위가 정해져 있으면 단원을 지정해 그 범위만 집중적으로 풀 수 있습니다.
              </>,
              <>
                <b>난이도 점진 상승</b> — 중 → 상 순으로 올리면 개념 확인 후 실전 감각까지 잡을 수 있습니다.
              </>,
            ]}
          />
        </Section>

        <Section title="과목별 활용법">
          <Bullets
            items={[
              <>
                <b>국어</b> — 빈칸 추론·문법 개념을 주제로 넣어 독해·어법 감각을 다집니다.
              </>,
              <>
                <b>수학</b> — 개념명(예: 등차수열, 극한)을 넣어 유형 문제를 반복 연습합니다.
              </>,
              <>
                <b>영어</b> — 어법 포인트나 독해 주제로 문제를 만들어 약한 유형을 집중 공략합니다.
              </>,
              <>
                <b>과학·사회</b> — 단원 개념을 주제로 넣어 헷갈리는 부분을 확인 문제로 점검합니다.
              </>,
            ]}
          />
        </Section>

        <Section title="강사·선생님이라면">
          <p>
            <Link href="/exam" className="font-medium text-indigo-600 hover:underline">
              강사용 변형 시험지
            </Link>{" "}
            화면에서는 기출 한 장(텍스트 또는 이미지)을 넣으면 수능형 변형 시험지를 몇 분 만에 만들 수 있습니다.
          </p>
          <Bullets
            items={[
              "수능형 2단 조판과 문항별 배점 표기",
              "교육과정 단원 자동 태깅",
              "정답·해설지 별지 출력(문제지만 / 해설 포함 선택)",
              "만든 문항은 문제은행에 저장해 재사용",
            ]}
          />
          <p className="text-[13px] text-slate-500">
            베타 기간에는 강사용 기능도 무료로 사용할 수 있습니다.
          </p>
        </Section>

        <Section title="알아두면 좋은 점">
          <Bullets
            items={[
              "생성된 문제가 어색하면 다시 생성하면 됩니다. AI가 만든 연습용 변형 문제라 실제 기출과 동일하지는 않습니다.",
              "학습 기록은 사용하는 브라우저에만 저장됩니다. 기기나 브라우저를 바꾸면 기록은 새로 시작됩니다.",
            ]}
          />
        </Section>
      </div>
    </ContentPage>
  );
}
