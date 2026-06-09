// REDLINE: 타인 비교/외모 점수 UI 금지
import type { Metadata } from "next";
import Link from "next/link";

// ---------------------------------------------------------------------------
// 개인정보처리방침 (Google AdSense 승인 요건 + 한국 정보통신망법 고지)
// 문의처/시행일은 아래 상수만 바꾸면 됩니다.
// ---------------------------------------------------------------------------

const CONTACT_EMAIL = "yuki000503@gmail.com";
const EFFECTIVE_DATE = "2026년 6월 5일";
const SERVICE_NAME = "문제팩토리";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "문제팩토리 개인정보처리방침 — 회원가입 없이 운영되며, 광고(Google AdSense) 쿠키와 브라우저 로컬 저장만 사용합니다.",
  robots: { index: true, follow: true },
};

// ── 본문 블록 프리미티브 ──────────────────────────────────────────

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-8 first:border-0 first:pt-0">
      <h2 className="mb-3 flex items-baseline gap-3 font-serif text-xl font-bold text-slate-900 md:text-2xl">
        <span className="font-mono text-base font-semibold text-indigo-500 tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <div className="graph-paper min-h-screen font-sans text-slate-800">
      {/* 상단 바 — 홈으로 */}
      <header className="border-b border-slate-200/80 bg-[#FAFAF7]/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex cursor-pointer items-center gap-2">
            <span className="font-serif text-2xl leading-none text-indigo-600">∑</span>
            <span className="text-lg font-bold tracking-tight text-slate-900">{SERVICE_NAME}</span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            홈으로
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        {/* 제목 */}
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            개인정보처리방침
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            시행일: {EFFECTIVE_DATE} · {SERVICE_NAME}(이하 “서비스”)
          </p>
        </div>

        {/* 요약 카드 */}
        <div className="mb-12 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6">
          <p className="text-sm font-semibold text-indigo-900">한눈에 보기</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              회원가입이 없으며, 이름·전화번호·주소 같은 개인정보를 서버에 수집·저장하지 않습니다.
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              학습 기록(문제은행·풀이 통계)은 서버가 아니라 이용자 브라우저 안(localStorage)에만 저장됩니다.
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              무료 학습 페이지는 Google AdSense 광고로 운영되며, 광고 제공을 위해 쿠키가 사용될 수 있습니다.
            </li>
          </ul>
        </div>

        <div className="space-y-8">
          <Section n={1} title="총칙">
            <p>
              서비스는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호
              등에 관한 법률」 등 관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 어떻게 다루는지, 그리고
              광고를 위해 사용되는 쿠키를 이용자가 어떻게 관리할 수 있는지 안내합니다.
            </p>
            <p>
              서비스는 별도의 회원가입·로그인 절차 없이 누구나 무료로 이용할 수 있도록 설계되었습니다. 이에 따라
              서버에서 식별 가능한 개인정보를 수집·보관하지 않는 것을 원칙으로 합니다.
            </p>
          </Section>

          <Section n={2} title="수집하는 정보와 수집하지 않는 정보">
            <p className="font-medium text-slate-800">서버에서 수집하지 않는 정보</p>
            <Bullets
              items={[
                "이름, 생년월일, 연락처, 주소 등 직접적인 개인 식별 정보",
                "계정 정보(아이디·비밀번호) — 회원가입 자체가 없습니다",
                "결제 정보 — 학생용 학습 기능은 전액 무료이며 결제 절차가 없습니다",
              ]}
            />
            <p className="pt-2 font-medium text-slate-800">이용자 기기(브라우저)에만 저장되는 정보</p>
            <Bullets
              items={[
                "생성·저장한 문제(문제은행), 풀이 기록과 정답률 등 학습 통계",
                "위 정보는 이용자 브라우저의 로컬 저장소(localStorage)에만 보관되며 서버로 전송되지 않습니다. 브라우저 기록을 삭제하면 함께 사라집니다.",
              ]}
            />
            <p className="pt-2 font-medium text-slate-800">문제 생성 시 처리되는 정보</p>
            <Bullets
              items={[
                "이용자가 입력한 ‘공부할 주제’ 텍스트는 문제 생성을 위해 AI 처리 목적으로만 사용되며, 별도의 개인 프로필과 연결해 저장하지 않습니다. 개인을 식별할 수 있는 민감정보는 입력하지 않도록 권장합니다.",
              ]}
            />
          </Section>

          <Section n={3} title="쿠키와 광고">
            <p>
              서비스의 무료 학습 페이지는 광고 수익으로 운영됩니다. 광고는 Google이 제공하는 AdSense를 통해
              게재되며, 이 과정에서 다음과 같은 쿠키가 사용될 수 있습니다.
            </p>
            <Bullets
              items={[
                <>
                  <span className="font-medium text-slate-800">제3자 쿠키(Google):</span> Google을 포함한 제3자
                  광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록 등을 바탕으로 광고를 제공할 수 있습니다.
                </>,
                <>
                  <span className="font-medium text-slate-800">DoubleClick 쿠키:</span> Google은 광고 게재를 위해
                  DoubleClick 쿠키를 사용할 수 있습니다. 이는 이용자가 서비스 및 다른 웹사이트를 방문한 정보를
                  바탕으로 맞춤형 광고를 제공하기 위한 것입니다.
                </>,
                <>
                  서비스 자체는 쿠키에 담긴 정보를 수집·열람하지 않으며, 광고 쿠키의 처리는 Google의{" "}
                  <a
                    href="https://policies.google.com/technologies/ads?hl=ko"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
                  >
                    광고 관련 개인정보처리방침
                  </a>
                  을 따릅니다.
                </>,
              ]}
            />
          </Section>

          <Section n={4} title="맞춤 광고 쿠키 거부(옵트아웃) 방법">
            <p>이용자는 다음 방법으로 맞춤형 광고를 위한 쿠키 사용을 거부하거나 관리할 수 있습니다.</p>
            <Bullets
              items={[
                <>
                  Google 계정의{" "}
                  <a
                    href="https://adssettings.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
                  >
                    광고 설정
                  </a>
                  에서 맞춤 광고를 끌 수 있습니다.
                </>,
                <>
                  <a
                    href="https://www.aboutads.info/choices/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
                  >
                    aboutads.info
                  </a>{" "}
                  또는{" "}
                  <a
                    href="https://www.youronlinechoices.eu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
                  >
                    youronlinechoices.eu
                  </a>
                  에서 제3자 광고 사업자의 쿠키를 일괄 거부할 수 있습니다.
                </>,
                "이용 중인 웹브라우저의 설정에서 쿠키 저장을 차단하거나 삭제할 수 있습니다. 다만 쿠키를 차단해도 광고 자체는 표시될 수 있으며, 일부 기능 이용에 불편이 있을 수 있습니다.",
              ]}
            />
          </Section>

          <Section n={5} title="만 14세 미만 아동의 개인정보">
            <p>
              서비스는 회원가입과 개인정보 수집 없이 이용할 수 있어 별도의 법정대리인 동의 절차를 두고 있지
              않습니다. 다만 서비스에는 제3자 광고가 표시되므로, 만 14세 미만 아동이 이용하는 경우 보호자의 지도
              아래 이용할 것을 권장합니다. 만약 아동의 개인정보가 수집된 사실이 확인되면 지체 없이 해당 정보를
              파기합니다.
            </p>
          </Section>

          <Section n={6} title="개인정보의 보유 및 파기">
            <p>
              서비스는 서버에 개인정보를 저장하지 않으므로 별도로 보유·파기하는 개인정보가 없습니다. 이용자
              기기에 저장된 학습 기록은 이용자가 브라우저의 저장소 또는 방문 기록을 삭제함으로써 언제든지 직접
              제거할 수 있습니다.
            </p>
          </Section>

          <Section n={7} title="이용자의 권리">
            <p>
              이용자는 자신의 정보에 대해 열람·정정·삭제를 요청할 권리가 있습니다. 서비스는 서버에 개인정보를
              보관하지 않으므로, 학습 기록은 이용자가 본인 기기에서 직접 관리·삭제할 수 있습니다. 광고 쿠키와
              관련한 권리 행사는 위 4항의 방법을 따릅니다.
            </p>
          </Section>

          <Section n={8} title="개인정보 보호책임자 및 문의처">
            <p>
              개인정보 처리에 관한 문의, 불만, 피해 구제 등은 아래 연락처로 접수할 수 있으며, 신속하고 충분한
              답변을 드리겠습니다.
            </p>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 font-medium text-slate-500">서비스명</dt>
                  <dd className="text-slate-800">{SERVICE_NAME}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 font-medium text-slate-500">문의 이메일</dt>
                  <dd>
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
                    >
                      {CONTACT_EMAIL}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-sm text-slate-500">
              개인정보 침해에 대한 신고·상담이 필요하면 개인정보침해신고센터(privacy.kisa.or.kr / 국번 없이
              118), 대검찰청 사이버수사과(국번 없이 1301) 등에 문의할 수 있습니다.
            </p>
          </Section>

          <Section n={9} title="고지의 의무 및 변경">
            <p>
              본 개인정보처리방침의 내용 추가·삭제·수정이 있을 경우, 변경 사항을 본 페이지를 통해 공지합니다.
              법령이나 서비스 정책의 변경에 따라 개정될 수 있습니다.
            </p>
            <p className="pt-1 text-sm font-medium text-slate-500">시행일: {EFFECTIVE_DATE}</p>
          </Section>
        </div>

        {/* 하단 — 홈으로 돌아가기 */}
        <div className="mt-14 border-t border-slate-200 pt-8 text-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
          >
            <span className="font-serif text-base leading-none text-indigo-600">∑</span>
            {SERVICE_NAME} 홈으로
          </Link>
          <p className="mt-6 text-xs text-slate-400">© 2026 {SERVICE_NAME}</p>
        </div>
      </main>
    </div>
  );
}
