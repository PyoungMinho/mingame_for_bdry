import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section, Bullets } from "@/app/_components/ContentPage";

export const metadata: Metadata = {
  title: "소개",
  description:
    "문제팩토리는 공부할 주제만 넣으면 수능 출제유형 그대로 문제를 만들어 즉시 채점·해설해주는 무료 AI 학습 도구입니다. 회원가입 없이 무료로 쓰세요.",
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <ContentPage
      title="문제팩토리 소개"
      subtitle="문제집 살 돈 걱정 없이, 수능 출제유형 그대로 공부하는 무료 AI 학습 도구입니다."
    >
      <div className="space-y-8">
        <Section title="문제팩토리는 무엇인가요?">
          <p>
            문제팩토리는 공부하고 싶은 <b>주제·개념·틀린 문제</b>를 입력하면, 수능 출제유형 그대로 새 문제를
            만들어 한 문제씩 풀게 하고, 즉시 채점과 해설까지 보여주는 무료 학습 도구입니다.
          </p>
          <p>회원가입도, 결제도, 앱 설치도 필요 없습니다. 브라우저에서 주제만 넣으면 바로 시작됩니다.</p>
        </Section>

        <Section title="왜 만들었나요?">
          <p>
            “풀 문제가 부족해서” 공부를 멈추는 일이 없도록 만들었습니다. 문제집이나 인강 비용 부담 없이,
            필요한 유형의 문제를 원하는 만큼 만들어 반복해서 풀 수 있습니다.
          </p>
          <p>
            특히 <b>틀린 개념만 골라</b> 비슷한 문제를 계속 연습할 수 있어, 약한 부분을 집중적으로 메우는 데
            효과적입니다.
          </p>
        </Section>

        <Section title="어떻게 작동하나요?">
          <Bullets
            items={[
              <>
                <b>① 입력</b> — 과목(국어·수학·영어·과학·사회)과 단원·주제, 난이도를 고릅니다.
              </>,
              <>
                <b>② 생성</b> — AI가 수능 출제유형에 맞춰 새 문제를 만듭니다.
              </>,
              <>
                <b>③ 풀이·채점</b> — 문제집을 풀듯 한 문제씩 풀면, 즉시 정답을 채점하고 해설을 보여줍니다.
              </>,
            ]}
          />
          <p>
            푼 문제는 문제은행에 모아둘 수 있고, 수능 D-day와 오늘 푼 문제 수·연속 학습일도 함께 확인할 수
            있습니다.
          </p>
        </Section>

        <Section title="누구를 위한 서비스인가요?">
          <p>
            <b>학생</b>은 무료 자습 도구로 사용합니다. 개념을 확인하거나, 틀린 문제를 다시 연습하거나, 시험
            범위를 집중적으로 풀 때 좋습니다.
          </p>
          <p>
            <b>강사·선생님</b>은{" "}
            <Link href="/exam" className="font-medium text-indigo-600 hover:underline">
              강사용 변형 시험지
            </Link>{" "}
            기능으로, 기출 한 장을 넣으면 배점·단원 태깅·정답 해설지까지 갖춘 인쇄용 시험지를 몇 분 만에 만들 수
            있습니다.
          </p>
        </Section>

        <Section title="무료 운영과 개인정보 원칙">
          <Bullets
            items={[
              "학생용 학습 페이지는 완전 무료이며, Google AdSense 광고로 운영됩니다.",
              "회원가입이 없어 이름·전화번호 같은 개인정보를 수집하지 않습니다.",
              <>
                학습 기록은 서버가 아니라 이용자 브라우저 안에만 저장됩니다. 자세한 내용은{" "}
                <Link href="/privacy" className="font-medium text-indigo-600 hover:underline">
                  개인정보처리방침
                </Link>
                을 참고하세요.
              </>,
            ]}
          />
        </Section>

        <Section title="지금 시작하기">
          <p>
            준비물은 공부할 주제 하나뿐입니다.{" "}
            <Link href="/study" className="font-medium text-indigo-600 hover:underline">
              무료로 문제 풀기
            </Link>
            에서 바로 시작하거나,{" "}
            <Link href="/guide" className="font-medium text-indigo-600 hover:underline">
              사용 가이드
            </Link>
            에서 활용법을 먼저 살펴보세요.
          </p>
        </Section>
      </div>
    </ContentPage>
  );
}
