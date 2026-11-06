'use client';

import { useEffect, useRef, useState } from 'react';
import { charName, ENDINGS } from '@/lib/liar/content';
import {
  applyChoice,
  applyHearing,
  applyRecall,
  applyReview,
  currentEvent,
  hearingQuestions,
  isGameState,
  LEDGER_COST,
  ledgerLocked,
  newGame,
  nextThreshold,
  openLedger,
  RANK_LABEL,
  resultTitle,
  shareText,
} from '@/lib/liar/engine';
import type { Applied, ChoiceKind, GameEvent, GameState, Line } from '@/lib/liar/types';
import { Person } from './art/Person';
import { SceneArt } from './art/SceneArt';

const SAVE_KEY = 'liar.save.v2';
const ENDINGS_KEY = 'liar.endings.v1';
const ENDING_TOTAL = Object.keys(ENDINGS).length;

const KIND: Record<ChoiceKind, string> = {
  exaggerate: '과장',
  excuse: '변명',
  frame: '모함',
  honest: '솔직',
  tact: '눈치',
};

function readSave(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) && !parsed.ending ? parsed : null;
  } catch {
    return null;
  }
}

function writeSave(s: GameState | null) {
  try {
    if (s && !s.ending) window.localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* 저장이 막힌 환경에서도 게임은 그대로 진행한다 */
  }
}

function readEndings(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ENDINGS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function recordEnding(id: string): string[] {
  const list = readEndings();
  if (list.includes(id)) return list;
  const next = [...list, id];
  try {
    window.localStorage.setItem(ENDINGS_KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막혀도 엔딩 화면은 그대로 보여 준다 */
  }
  return next;
}

type View =
  | { stage: 'lines'; ev: GameEvent; i: number }
  | { stage: 'choose'; ev: GameEvent }
  | { stage: 'reply'; ev: GameEvent; i: number; applied: Applied };

export function Game() {
  const [game, setGame] = useState<GameState | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);
  const [ledger, setLedger] = useState<{ charged: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSaved(readSave());
    setFound(readEndings());
  }, []);

  useEffect(() => {
    if (!ledger) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLedger(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ledger]);

  const stageKey = view ? `${view.ev.id}:${view.stage}:${'i' in view ? view.i : 0}` : '';
  useEffect(() => {
    if (view && view.stage !== 'choose' && !ledger) nextRef.current?.focus({ preventScroll: true });
  }, [stageKey, ledger, view]);

  function begin(s: GameState) {
    const ev = currentEvent(s);
    setGame(s);
    writeSave(s);
    // 이사회 도중이면 도입 대사를 반복하지 않고 다음 질문으로 간다
    if (ev?.type === 'hearing' && s.hearingStep > 0) setView({ stage: 'choose', ev });
    else setView(ev ? { stage: 'lines', ev, i: 0 } : null);
  }

  function commit(applied: Applied, ev: GameEvent) {
    setGame(applied.state);
    writeSave(applied.state);
    setView({ stage: 'reply', ev, i: 0, applied });
  }

  function advance() {
    if (!view || !game) return;
    if (view.stage === 'lines') {
      if (view.i < view.ev.lines.length - 1) setView({ ...view, i: view.i + 1 });
      else if (view.ev.type === 'review') commit(applyReview(game), view.ev);
      else if (view.ev.type === 'hearing' && hearingQuestions(game).length === 0) commit(applyHearing(game, null), view.ev);
      else setView({ stage: 'choose', ev: view.ev });
      return;
    }
    if (view.stage === 'reply') {
      if (view.i < view.applied.reply.length - 1) setView({ ...view, i: view.i + 1 });
      else if (game.ending) finish(game);
      else begin(game);
    }
  }

  function finish(s: GameState) {
    if (s.ending) setFound(recordEnding(s.ending));
    setView(null);
  }

  function viewLedger() {
    if (!game) return;
    const { state, charged } = openLedger(game);
    setGame(state);
    writeSave(state);
    setLedger({ charged });
  }

  function closeLedger() {
    setLedger(null);
    if (game?.ending) finish(game);
  }

  async function share() {
    if (!game) return;
    const text = shareText(game, `${window.location.origin}/liar`);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* 공유 창을 닫은 경우는 그냥 둔다 */
    }
  }

  function restart() {
    setCopied(false);
    setSaved(null);
    begin(newGame());
  }

  if (!game) {
    return (
      <main className="lr-stage lr-title">
        <div className="lr-art lr-art-title">
          <SceneArt id="office" />
        </div>
        <div className="lr-title-body">
          <p className="lr-kicker">㈜무궁상사 신입사원 김정직</p>
          <h1>거짓말로 대표까지</h1>
          <p className="lr-lead">
            오늘 한 거짓말은 몇 년 뒤 반드시 돌아옵니다. 그때 뭐라고 했는지 기억해야 살아남아요.
          </p>
          <ul className="lr-rules">
            <li>
              <b>실적</b>이 모자라면 승진에서 떨어져요.
            </li>
            <li>
              <b>의심도</b>가 끝까지 차면 들통나요.
            </li>
            <li>
              <b>거짓말 장부</b>를 몰래 열면 의심도가 올라가요.
            </li>
          </ul>
          <button className="lr-btn lr-btn-main" onClick={restart}>
            {saved ? '처음부터 입사하기' : '입사하기'}
          </button>
          {saved ? (
            <button className="lr-btn" onClick={() => begin(saved)}>
              이어서 출근하기 ({RANK_LABEL[saved.rank]} {saved.year}년 차)
            </button>
          ) : null}
          <p className="lr-note">
            인턴부터 대표까지 · 약 15분{found.length ? ` · 엔딩 ${found.length}/${ENDING_TOTAL} 발견` : ''}
          </p>
        </div>
      </main>
    );
  }

  if (!view) {
    const ending = game.ending ? ENDINGS[game.ending] : null;
    if (!ending) return null;
    return (
      <main className="lr-stage lr-ending">
        <div className="lr-art">
          <SceneArt id={ending.art} />
          <div className="lr-stamp lr-stamp-big">{ending.stamp}</div>
        </div>
        <div className="lr-ending-body">
          <p className="lr-kicker">
            {RANK_LABEL[game.rank]} · 입사 {game.year}년 차
          </p>
          <h2>{ending.title}</h2>
          <p>{ending.body}</p>
          <div className="lr-card">
            <div className="lr-card-head">
              <span>인사 기록 카드</span>
              <strong>{resultTitle(game)}</strong>
            </div>
            <dl className="lr-stats">
              <div>
                <dt>거짓말</dt>
                <dd>{game.lies.length}개</dd>
              </div>
              <div>
                <dt>들통날 뻔</dt>
                <dd>{game.nearMisses}번</dd>
              </div>
              <div>
                <dt>장부 훔쳐봄</dt>
                <dd>{game.ledgerOpens}번</dd>
              </div>
              <div>
                <dt>떠나보낸 할머니</dt>
                <dd>{game.grandma}분</dd>
              </div>
            </dl>
            {game.lies.length ? (
              <>
                <h3>회사가 아는 나</h3>
                <ul>
                  {game.lies.map((l) => (
                    <li key={l.id}>{l.claim}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="lr-empty">회사가 아는 나: 이상할 만큼 아는 게 없음</p>
            )}
          </div>
          <p className="lr-collected">
            엔딩 {found.length}/{ENDING_TOTAL} 발견
          </p>
          <button className="lr-btn lr-btn-main" onClick={restart}>
            다시 입사하기
          </button>
          <button className="lr-btn" onClick={share}>
            {copied ? '복사했어요. 카톡에 붙여넣기' : '결과 공유하기'}
          </button>
        </div>
      </main>
    );
  }

  const line: Line | null =
    view.stage === 'lines'
      ? view.ev.lines[view.i]
      : view.stage === 'reply'
        ? view.applied.reply[view.i]
        : view.ev.lines[view.ev.lines.length - 1];
  const threshold = nextThreshold(game);
  const speaker = line && line.who !== 'narr' && line.who !== 'me' ? line.who : null;
  const lastSpeaker = [...view.ev.lines].reverse().find((l) => l.who !== 'narr' && l.who !== 'me');
  const shownWho = speaker ?? (lastSpeaker?.who as Exclude<Line['who'], 'me' | 'narr'> | undefined);
  const recall = view.ev.type === 'recall' ? view.ev : null;
  const applied = view.stage === 'reply' ? view.applied : null;
  const firstReply = view.stage === 'reply' && view.i === 0;
  const danger = game.sus >= 70;
  const locked = ledgerLocked(game);
  const ledgerPaid = locked || game.ledgerPaidAt === game.eventIndex || game.lies.length === 0;
  const hearing = view.ev.type === 'hearing' ? view.ev : null;
  const questions = hearing ? hearingQuestions(game) : [];
  const question = hearing ? questions[game.hearingStep] : undefined;

  return (
    <main
      className={`lr-stage${(recall || hearing) && view.stage === 'choose' ? ' lr-grill' : ''}${
        applied?.recall === 'wrong' && firstReply ? ' lr-shake' : ''
      }`}
      style={{ ['--sus' as string]: game.sus / 100 }}
    >
      <header className="lr-hud" aria-label="상태창">
        <div className="lr-hud-top">
          <span className="lr-badge">{RANK_LABEL[game.rank]}</span>
          <span className="lr-name">김정직</span>
          <span className="lr-year">{game.year}년 차</span>
          <button
            className="lr-ledger-btn"
            onClick={viewLedger}
            disabled={locked}
            aria-label={locked ? '거짓말 장부 압수됨' : `거짓말 장부 ${game.lies.length}개 보기`}
          >
            거짓말 장부 <b>{game.lies.length}</b>
            {locked ? <em>압수됨</em> : null}
            {!ledgerPaid ? <em>열면 의심 +{LEDGER_COST}</em> : null}
          </button>
        </div>
        <div className="lr-gauge">
          <span>실적</span>
          <div className="lr-bar" role="progressbar" aria-label="실적" aria-valuenow={game.perf} aria-valuemin={0} aria-valuemax={100}>
            <i className="lr-fill-perf" style={{ width: `${game.perf}%` }} />
            {threshold !== null ? <u style={{ left: `${threshold}%` }} title="다음 승진 기준" /> : null}
          </div>
          <b>{game.perf}</b>
        </div>
        <div className={`lr-gauge${danger ? ' lr-danger' : ''}`}>
          <span>의심도</span>
          <div className="lr-bar" role="progressbar" aria-label="의심도" aria-valuenow={game.sus} aria-valuemin={0} aria-valuemax={100}>
            <i className="lr-fill-sus" style={{ width: `${game.sus}%` }} />
          </div>
          <b>{game.sus}</b>
        </div>
      </header>

      <div className="lr-art">
        <div className="lr-pan" key={view.ev.art}>
          <SceneArt id={view.ev.art} />
        </div>
        <div className="lr-vignette" />
        <div className="lr-scene-title">{view.ev.title}</div>
        {shownWho ? (
          <div className={`lr-portrait${speaker ? '' : ' lr-dim'}`} key={shownWho}>
            <Person id={shownWho} mood={line?.mood ?? 'calm'} talking={!!speaker && view.stage !== 'choose'} />
          </div>
        ) : null}
        {applied?.lie && firstReply ? <div className="lr-stamp">장부 기록</div> : null}
        {applied?.promoted && firstReply ? <div className="lr-stamp lr-stamp-gold">승진</div> : null}
      </div>

      <section
        className="lr-panel"
        aria-live="polite"
        onClick={(e) => {
          // 대사 상자 아래 빈 곳을 눌러도 넘어가게 한다. 선택지를 고를 때는 넘어가지 않는다.
          if (e.target === e.currentTarget && view.stage !== 'choose') advance();
        }}
      >
        {view.stage !== 'choose' && line ? (
          <button ref={nextRef} className="lr-dialog" key={stageKey} onClick={advance}>
            {speaker ? <span className="lr-speaker">{charName(speaker, game.rank)}</span> : null}
            {line.who === 'me' ? <span className="lr-speaker lr-me">나</span> : null}
            <span className={`lr-line${line.who === 'narr' ? ' lr-narr' : ''}`}>{line.text}</span>
            {applied && view.i === 0 && (applied.delta.perf !== 0 || applied.delta.sus !== 0) ? (
              <span className="lr-deltas">
                {applied.delta.perf !== 0 ? (
                  <span className={applied.delta.perf > 0 ? 'lr-up' : 'lr-down'}>
                    실적 {applied.delta.perf > 0 ? '+' : ''}
                    {applied.delta.perf}
                  </span>
                ) : null}
                {applied.delta.sus !== 0 ? (
                  <span className={applied.delta.sus < 0 ? 'lr-up' : 'lr-down'}>
                    의심 {applied.delta.sus > 0 ? '+' : ''}
                    {applied.delta.sus}
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className="lr-tap" aria-hidden="true">
              다음 ▾
            </span>
          </button>
        ) : null}

        {view.stage === 'choose' && view.ev.type === 'choice' ? (
          <div className="lr-choices">
            <p className="lr-prompt">{line?.text}</p>
            {view.ev.choices.map((c) => (
              <button key={c.id} className="lr-choice" onClick={() => commit(applyChoice(game, c.id), view.ev)}>
                <span className={`lr-kind lr-kind-${c.kind}`}>{KIND[c.kind]}</span>
                <span>{c.text}</span>
              </button>
            ))}
          </div>
        ) : null}

        {view.stage === 'choose' && hearing && question ? (
          <div className="lr-choices">
            <p className="lr-grill-tag">
              이사회 추궁 {game.hearingStep + 1}/{questions.length}
            </p>
            <p className="lr-q-tag">
              {RANK_LABEL[question.lie.rank]} {question.lie.year}년 차 · {question.lie.label} 건
            </p>
            <p className="lr-prompt lr-prompt-strong">그때 뭐라고 하셨습니까?</p>
            {question.options.map((o) => (
              <button key={o} className="lr-choice" onClick={() => commit(applyHearing(game, o), view.ev)}>
                <span>{o}</span>
              </button>
            ))}
            <button className="lr-choice lr-choice-dodge" onClick={() => commit(applyHearing(game, null), view.ev)}>
              <span className="lr-kind lr-kind-honest">인정</span>
              <span>"사실 거짓말이었습니다."</span>
            </button>
          </div>
        ) : null}

        {view.stage === 'choose' && recall ? (
          <div className="lr-choices">
            <p className="lr-grill-tag">추궁</p>
            <p className="lr-prompt lr-prompt-strong">{recall.question}</p>
            {recall.options.map((o) => (
              <button key={o} className="lr-choice" onClick={() => commit(applyRecall(game, o), view.ev)}>
                <span>{o}</span>
              </button>
            ))}
            <button className="lr-choice lr-choice-dodge" onClick={() => commit(applyRecall(game, null), view.ev)}>
              <span className="lr-kind lr-kind-excuse">얼버무림</span>
              <span>{recall.dodge.text}</span>
            </button>
          </div>
        ) : null}
      </section>

      {ledger ? (
        <div className="lr-sheet-wrap" onClick={closeLedger}>
          <div
            className="lr-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="거짓말 장부"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lr-sheet-head">
              <h2>거짓말 장부</h2>
              <button className="lr-close" onClick={closeLedger} autoFocus>
                덮기
              </button>
            </div>
            {ledger.charged > 0 ? <p className="lr-charge">누가 봤을지도 몰라요. 의심 +{ledger.charged}</p> : null}
            {game.lies.length === 0 ? (
              <p className="lr-empty">아직 깨끗합니다. 아직은요.</p>
            ) : (
              <ol className="lr-ledger">
                {game.lies.map((l) => (
                  <li key={l.id}>
                    <span>
                      {RANK_LABEL[l.rank]} {l.year}년 차 · {l.label}
                    </span>
                    <strong>{l.claim}</strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
