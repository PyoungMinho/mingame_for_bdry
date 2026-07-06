import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, QA } from "@/app/_components/ContentPage";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description:
    "문제팩토리 FAQ — 정말 무료인지, 회원가입이 필요한지, 문제는 어떻게 만들어지는지, 학습 데이터는 어디 저장되는지 등 자주 묻는 질문을 모았습니다.",
  robots: { index: true, follow: true },
};

export default function FaqPage() {
  return (
    <ContentPage title="자주 묻는 질문" subtitle="문제팩토리를 쓰기 전 궁금한 점을 모았습니다.">
      <div className="space-y-8">
        <QA q="정말 무료인가요?">
          <p>
            네. 학생용 자습 페이지는 완전 무료입니다. 결제나 유료 전환 없이 원하는 만큼 문제를 만들어 풀 수 있고,
            운영은 광고로 이루어집니다.
          </p>
        </QA>

        <QA q="회원가입이 필요한가요?">
          <p>아니요. 회원가입·로그인 없이 바로 사용할 수 있습니다. 이름이나 이메일 같은 정보를 입력하지 않습니다.</p>
        </QA>

        <QA q="문제는 어떻게 만들어지나요? 정확한가요?">
          <p>
            입력한 과목·단원·주제를 바탕으로 AI가 수능 출제유형에 맞춰 <b>연습용 변형 문제</b>를 생성합니다. 실제
            수능·모의고사 기출과 동일하지는 않으며, 학습과 연습을 돕기 위한 것입니다.
          </p>
          <p>
            드물게 어색한 문제가 나오면 다시 생성해 주세요. 채점과 해설도 함께 제공되어 풀이 과정을 확인하며 학습할
            수 있습니다.
          </p>
        </QA>

        <QA q="제 학습 기록은 어디에 저장되나요?">
          <p>
            문제은행·풀이 통계 같은 기록은 서버가 아니라 <b>이용자 브라우저 안(localStorage)</b>에만 저장됩니다.
            서버로 수집하지 않습니다. 브라우저 데이터를 지우거나 기기를 바꾸면 기록은 초기화됩니다. 자세한 내용은{" "}
            <Link href="/privacy" className="font-medium text-indigo-600 hover:underline">
              개인정보처리방침
            </Link>
            을 참고하세요.
          </p>
        </QA>

        <QA q="광고는 왜 나오나요?">
          <p>
            무료 학습 페이지를 유지하기 위해 Google AdSense 광고로 운영합니다. 강사용 화면에는 광고가 표시되지
            않습니다.
          </p>
        </QA>

        <QA q="강사용은 무엇이 다른가요?">
          <p>
            <Link href="/exam" className="font-medium text-indigo-600 hover:underline">
              강사용
            </Link>
            은 기출 한 장으로 수능형 변형 시험지를 만들어 인쇄까지 할 수 있는 기능입니다. 2단 조판·배점 표기·단원
            태깅·정답 해설지 별지 출력을 지원합니다. 베타 기간에는 무료로 사용할 수 있습니다.
          </p>
        </QA>

        <QA q="수능 말고 내신에도 쓸 수 있나요?">
          <p>
            네. 개념·단원 기반으로 문제를 만들기 때문에 내신 대비 자습에도 활용할 수 있습니다. 시험 범위 단원을
            지정해 그 부분만 집중적으로 연습해 보세요.
          </p>
        </QA>

        <QA q="인쇄해서 풀 수 있나요?">
          <p>
            강사용 변형 시험지는 인쇄용 조판(문제지 + 정답·해설지)을 제공합니다. 학생용 자습은 화면에서 한 문제씩
            풀고 즉시 채점받는 방식입니다.
          </p>
        </QA>
      </div>
    </ContentPage>
  );
}
