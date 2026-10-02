'use client';

/**
 * 방장·플레이어 화면이 같이 쓰는 조각(개선 묶음 1).
 *  - R3 공용 단서 접힘 블록(지난 공용 단서 / 공용 단서 전체 / 이번 조사 공용 단서) — 목록은 인원·이 폰의 단계로만 정해진다.
 *  - R6 최종 변론 3칸 틀 — 무대·플레이어 같은 문자열(입력칸 없음).
 *  - R7 보너스 문항 참조 카드(플레이어, 지목 확정 뒤에만).
 * 역할을 받지 않는다(불변 1).
 */
import { GUIDE, type BonusQuestion, type VisibleCard } from '@/lib/gung';

/** 공용 카드(PB)·추가 증언 목록 — 조사 번호를 머리에 붙인다 */
export function PublicCardList({ cards, npcHeading }: { cards: VisibleCard[]; npcHeading: string }) {
  const pub = cards.filter((x) => x.kind === 'public');
  const npc = cards.filter((x) => x.kind === 'npc');
  return (
    <div className="gu-publicclue gu-publicclue--fold">
      {pub.map((card) => (
        <div key={card.id} className="gu-publicclue-card">
          <p className="gu-publicclue-round">조사 {card.round}</p>
          <p className="gu-publicclue-title gu-display">{card.title}</p>
          <p className="gu-publicclue-body">{card.body}</p>
        </div>
      ))}
      {npc.length > 0 && <p className="gu-publicclue-label">{npcHeading}</p>}
      {npc.map((card) => (
        <div key={card.id} className="gu-publicclue-card">
          <p className="gu-publicclue-round">조사 {card.round}</p>
          <p className="gu-publicclue-title gu-display">{card.title}</p>
          <p className="gu-publicclue-body">{card.body}</p>
        </div>
      ))}
    </div>
  );
}

/** 접힘 블록 — summary 문구는 스펙 원문(끝의 ▸ 포함). 닫혀 있어도 DOM 엔 있다 — 그래서 목록 자체가 라운드 게이팅을 지켜야 한다 */
export function PublicFold({ summary, cards, npcHeading, className }: { summary: string; cards: VisibleCard[]; npcHeading: string; className?: string }) {
  if (!cards.length) return null;
  return (
    <details className={['gu-fold', className ?? ''].filter(Boolean).join(' ')}>
      <summary className="gu-fold-summary">{summary}</summary>
      <PublicCardList cards={cards} npcHeading={npcHeading} />
    </details>
  );
}

/** R3 시각 어림 한 줄 */
export function TimeHintLine({ text }: { text: string }) {
  return <p className="gu-timehint">{text}</p>;
}

/** R6 최종 변론 3칸 틀 — 무대·플레이어 공통 */
export function DefenseFrame() {
  return (
    <ol className="gu-defframe" aria-label="변론 틀">
      {GUIDE.defenseFrame.map((line, i) => (
        <li key={i} className="gu-defframe-item">
          <span className="gu-defframe-num gu-num" aria-hidden>
            {i + 1}
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ol>
  );
}

/** R7 플레이어 보너스 문항 참조 카드 — 상태 저장 없음(화면을 들어 보이거나 손가락으로 답하는 용도) */
export function BonusReference({ questions }: { questions: readonly BonusQuestion[] }) {
  if (!questions.length) return null;
  return (
    <section className="gu-bonusref" aria-label={GUIDE.bonusPlayerHead}>
      <p className="gu-h3">{GUIDE.bonusPlayerHead}</p>
      {questions.map((q, qi) => (
        <div key={q.id} className="gu-bonusref-q">
          <p className="gu-bonus-prompt gu-display">
            <span className="gu-num">Q{qi + 1}</span> {q.prompt}
          </p>
          <ol className="gu-bonus-legend">
            {q.options.map((o, i) => (
              <li key={i}>
                <span className="gu-num">{i + 1}</span> {o}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
