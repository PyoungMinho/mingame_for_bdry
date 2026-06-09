// REDLINE: 타인 비교/외모 점수 UI 금지
import type { Metadata } from "next";
import Link from "next/link";

// ---------------------------------------------------------------------------
// 이용약관 (서비스 제공 조건 · AI 생성물 한계 고지 · 책임 한계)
// 문의처/시행일은 아래 상수만 바꾸면 됩니다.
// ---------------------------------------------------------------------------

const CONTACT_EMAIL = "yuki000503@gmail.com";
const EFFECTIVE_DATE = "2026년 6월 9일";
const SERVICE_NAME = "문제팩토리";

export const metadata: Metadata = {
  title: "이용약관",
  description:
    "문제팩토리 이용약관 — 서비스 이용 조건, AI 생성 문항의 한계와 이용자 책임, 광고·면책에 관한 안내입니다.",
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

export default function TermsPage() {
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
            이용약관
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
              회원가입 없이 누구나 이용할 수 있으며, 학생용 학습 기능은 무료입니다.
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              문제·해설은 AI가 생성하므로 오류가 있을 수 있습니다. 중요한 용도라면 반드시 이용자가 직접
              검토·확인해야 합니다.
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              자동화된 대량 요청·크롤링·무단 재판매는 금지됩니다.
            </li>
          </ul>
        </div>

        <div className="space-y-8">
          <Section n={1} title="목적">
            <p>
              본 약관은 {SERVICE_NAME}(이하 “서비스”)가 제공하는 AI 기반 문항 생성·학습 기능의 이용 조건과
              절차, 서비스와 이용자의 권리·의무 및 책임 사항을 정하는 것을 목적으로 합니다.
            </p>
          </Section>

          <Section n={2} title="용어의 정의">
            <Bullets
              items={[
                <>
                  <span className="font-medium text-slate-800">“서비스”</span>란 이용자가 입력한 주제나
                  원본 문항을 바탕으로 변형·연습 문항과 해설을 생성·채점하는 기능 일체를 말합니다.
                </>,
                <>
                  <span className="font-medium text-slate-800">“이용자”</span>란 본 약관에 따라 서비스를
                  이용하는 모든 사람을 말합니다(별도의 회원가입 절차는 없습니다).
                </>,
                <>
                  <span className="font-medium text-slate-800">“생성물”</span>이란 서비스가 AI를 통해
                  생성한 문항·선택지·정답·해설 등 산출물을 말합니다.
                </>,
              ]}
            />
          </Section>

          <Section n={3} title="약관의 게시와 개정">
            <p>
              서비스는 본 약관의 내용을 이용자가 확인할 수 있도록 서비스 화면에 게시합니다. 관련 법령을
              위배하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 변경 내용과 시행일을 본 페이지를 통해
              공지합니다. 변경된 약관은 공지된 시행일부터 효력이 발생합니다.
            </p>
          </Section>

          <Section n={4} title="서비스의 제공 및 변경">
            <Bullets
              items={[
                "서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검·교체, 통신 장애, 외부 AI 제공자의 사정 등 운영상·기술상 필요에 따라 일시 중단되거나 변경될 수 있습니다.",
                "서비스는 제공 기능의 전부 또는 일부를 사전 공지 후 변경·중단할 수 있으며, 무료로 제공되는 기능에 대해서는 별도의 보상 없이 이를 수정·중단할 수 있습니다.",
              ]}
            />
          </Section>

          <Section n={5} title="서비스의 이용">
            <Bullets
              items={[
                "이용자는 회원가입 없이 서비스를 이용할 수 있으며, 학생용 학습 기능은 무료로 제공됩니다.",
                "만 14세 미만 아동은 법정대리인(부모 등)의 동의와 지도 아래에서만 서비스를 이용할 수 있습니다. 서비스는 회원가입 절차를 두지 않으며, 만 14세 미만 아동의 개인정보를 별도로 수집하지 않습니다.",
                "이용자가 생성·저장한 문제와 풀이 기록 등은 서버가 아니라 이용자 브라우저의 로컬 저장소에 보관됩니다(개인정보처리방침 참조). 브라우저 기록 삭제 시 함께 사라질 수 있으므로, 필요한 자료는 이용자가 별도로 보관해야 합니다.",
                "서비스 이용과 관련한 개인정보의 처리는 별도의 개인정보처리방침을 따릅니다.",
              ]}
            />
          </Section>

          <Section n={6} title="AI 생성 콘텐츠의 한계와 검토 책임">
            <p>
              서비스의 문항·정답·해설은 인공지능(AI)에 의해 자동 생성됩니다. AI 생성물은 그 특성상 사실과
              다르거나 부정확한 내용, 오답, 부적절한 표현을 포함할 수 있습니다.
            </p>
            <Bullets
              items={[
                "서비스는 생성물의 정확성·완전성·특정 목적에의 적합성을 보증하지 않습니다.",
                "이용자가 생성물을 시험 출제, 교육·평가, 그 밖에 중요한 의사결정에 사용하는 경우, 사용 전에 반드시 이용자 본인이 내용을 검토·검증할 책임이 있습니다.",
                "생성물을 검토 없이 사용함으로써 발생한 결과에 대한 책임은 이용자에게 있습니다.",
              ]}
            />
          </Section>

          <Section n={7} title="이용자의 의무">
            <p>이용자는 서비스를 이용함에 있어 다음 행위를 하여서는 안 됩니다.</p>
            <Bullets
              items={[
                "정상적인 이용 범위를 벗어난 자동화된 대량 요청, 스크립트·봇을 이용한 호출, 크롤링·스크래핑 등으로 서비스에 과도한 부하를 주는 행위",
                "서비스의 안정적 운영을 방해하거나, 비정상적인 방법으로 시스템·서버에 접근·간섭하려는 행위",
                "타인의 권리(지식재산권·초상권·명예 등)를 침해하는 내용이나 법령에 위반되는 내용을 입력·생성·배포하는 행위",
                "서비스 또는 생성물을 서비스의 사전 동의 없이 상업적으로 무단 재판매·재배포하는 행위",
                "타인을 외모·성적(成績) 등으로 비교·평가·서열화하는 콘텐츠를 생성·게시하는 행위",
              ]}
            />
            <p className="text-sm text-slate-500">
              서비스는 위 의무 위반으로 인한 남용을 방지하기 위해 요청 빈도 제한(레이트리밋) 등 기술적 조치를
              적용할 수 있으며, 위반이 확인되면 해당 이용을 제한할 수 있습니다.
            </p>
          </Section>

          <Section n={8} title="지식재산권">
            <Bullets
              items={[
                "이용자가 서비스에 입력한 원본 텍스트·이미지 등에 대한 권리는 해당 이용자(또는 정당한 권리자)에게 있습니다. 이용자는 자신이 적법한 권리를 가지거나 사용 권한이 있는 자료만 입력해야 합니다.",
                "서비스의 화면 구성, 로고, 디자인, 소프트웨어 등 서비스 자체에 관한 지식재산권은 서비스에 귀속됩니다.",
                "AI 생성물의 이용과 관련해서는, 이용자가 학습·교육 등 본래 목적 범위에서 이를 활용할 수 있되, 제6조의 검토 책임과 제7조의 금지 의무가 함께 적용됩니다.",
              ]}
            />
          </Section>

          <Section n={9} title="광고의 게재">
            <p>
              서비스의 무료 학습 기능은 광고 수익으로 운영될 수 있으며, 이용자는 서비스 이용 과정에서 노출되는
              광고 게재에 동의한 것으로 봅니다. 광고와 관련한 쿠키 등의 처리는 개인정보처리방침에 따릅니다.
              광고를 통해 연결되는 제3자 사이트·재화·서비스에 대해서는 서비스가 책임을 지지 않습니다.
            </p>
          </Section>

          <Section n={10} title="책임의 한계(면책)">
            <Bullets
              items={[
                "서비스는 무료로 제공되는 기능과 AI 생성물을 “있는 그대로(as-is)” 제공하며, 천재지변·통신 장애·외부 AI 제공자의 장애 등 서비스가 통제할 수 없는 사유로 인한 손해에 대해 책임을 지지 않습니다.",
                "서비스는 생성물의 오류 또는 이용자가 생성물을 검토 없이 사용함으로써 발생한 손해에 대하여, 관련 법령이 허용하는 최대한의 범위에서 책임을 지지 않습니다.",
                "이용자가 본 약관 또는 관련 법령을 위반하여 발생한 손해에 대한 책임은 해당 이용자에게 있습니다.",
              ]}
            />
          </Section>

          <Section n={11} title="유료 서비스 및 결제(향후 도입)">
            <p>
              현재 학생용 학습 기능은 무료로 제공됩니다. 향후 강사용 기능 등 일부에 대해 유료 서비스가 도입될
              수 있으며, 이 경우 요금·결제 수단·환불 기준·세금계산서 발행 등 거래 조건을 결제 화면 또는 별도
              안내를 통해 사전에 고지합니다. 유료 서비스의 청약철회 및 환불은 「콘텐츠산업 진흥법」, 「전자상거래
              등에서의 소비자보호에 관한 법률」 등 관련 법령과 별도 고지하는 정책에 따릅니다.
            </p>
          </Section>

          <Section n={12} title="분쟁의 해결 및 준거법">
            <p>
              본 약관은 대한민국 법령에 따라 해석·적용됩니다. 서비스 이용과 관련하여 서비스와 이용자 사이에
              분쟁이 발생한 경우 당사자는 신의에 따라 성실히 협의하여 해결하며, 협의가 이루어지지 않을 경우
              「민사소송법」에 따른 관할 법원에 소를 제기할 수 있습니다.
            </p>
          </Section>

          <Section n={13} title="문의처">
            <p>본 약관 또는 서비스 이용에 관한 문의는 아래 연락처로 접수할 수 있습니다.</p>
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
          </Section>

          <Section n={14} title="부칙">
            <p>본 약관은 {EFFECTIVE_DATE}부터 시행합니다.</p>
            <p className="pt-1 text-sm text-slate-500">
              관련 안내: {" "}
              <Link
                href="/privacy"
                className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 cursor-pointer"
              >
                개인정보처리방침
              </Link>
            </p>
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
