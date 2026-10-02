'use client';

/**
 * O1 진행 단계 맞추기 · O2 메뉴 · O3 확인(범용) · O5 하는 법 · O8 자리 비우기 · O11 화면 꺼짐 안내 ·
 * 자리 바꾸기(O2 하위) · 용어 풀이·시각표(원고 1-5·1-6). (§3 O1/O2/O3/O5/O8, §12-5)
 * O4(토스트)·O7(카운트다운)은 Toast/CountdownOverlay 컴포넌트를 GungApp 이 직접 쓴다. O9 는 Setup.tsx.
 */
import { useEffect, useState } from 'react';
import { DEFAULT_SCORING, GUIDE, PHASE_LABELS, scoringOf, syncOptions, type GameState, type GungCase, type RoundNo } from '@/lib/gung';
import { BottomSheet, GuButton, LieRulesBox, PalaceMap, RoleIcon, SeatRing, TermList, TimeTable } from '../components';
import type { PalaceMapProps, RoleIconKey, TermItem, WatchRowView } from '../components';
import { seatRingItems } from './adapters';
import { roundSignal } from './signals';

export { roundSignal };

export interface ConfirmRequest {
  title: string;
  body: string;
  cancelLabel?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

const ROUND_WORD: Record<RoundNo, string> = { 1: '첫째', 2: '둘째', 3: '셋째' };

/**
 * 조사 라운드 진입 확인 — 플레이어 게이트(「N라운드 시작됐어요」)와 진행 단계 맞추기(O1)가 **같은 시트**를 쓴다(QA BUG-05 와 그 우회로).
 * 넘어가면 그 라운드 장소 단서·공용 카드·「R3에 떠오르는 기억」이 풀리고 한 번 본 것은 못 되돌린다.
 * 문구는 역할과 무관하다('기억'이라는 말도 쓰지 않는다) — 기억 보유 역할만 다른 시트를 받으면 역할이 드러난다.
 */
export function roundEntryConfirm(round: RoundNo, role: GameState['role'], onConfirm: () => void): ConfirmRequest {
  const word = ROUND_WORD[round];
  return {
    title: `${word} 조사로 넘어가겠소?`,
    body:
      role === 'host'
        ? `넘어가면 ${word} 조사의 공용 단서가 열리고 새 장소를 고를 수 있소. 먼저 본 것은 되돌릴 수 없소.`
        : `방장이 '${roundSignal(round)}'라고 외쳤을 때만 누르시오. 넘어가면 새 장소를 고를 수 있고, 먼저 본 것은 되돌릴 수 없소.`,
    confirmLabel: '넘어가겠소',
    onConfirm,
  };
}

/** O1 — 열릴 때마다 '지금' 단계로 초기화. 두 단계 이상 앞으로·새 조사 라운드·진상/결과로 가면 O3 확인(§3 O1, QA BUG-05) */
export function SyncSheet({
  open,
  onClose,
  state,
  onSync,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  state: GameState;
  onSync: (phase: GameState['phase']) => void;
  onConfirm: (req: ConfirmRequest) => void;
}) {
  const options = syncOptions(state);
  const [picked, setPicked] = useState(state.phase);
  useEffect(() => {
    if (open) setPicked(state.phase);
  }, [open, state.phase]);
  const chosen = options.find((o) => o.phase === picked);
  const go = () => {
    if (!chosen || picked === state.phase) return;
    onClose();
    if (chosen.needsConfirm && !chosen.spoiler && chosen.entersRound) {
      onConfirm(roundEntryConfirm(chosen.entersRound, state.role, () => onSync(picked)));
      return;
    }
    if (chosen.needsConfirm) {
      onConfirm({
        title: chosen.spoiler ? `${chosen.label}(으)로 가겠소?` : `${chosen.label}(으)로 건너뛰겠소?`,
        body: chosen.spoiler
          ? '진상·결과는 스포일러요. 방장이 진상을 밝히기 시작했을 때만 가시오.'
          : `지금(${PHASE_LABELS[state.phase]})에서 두 단계 이상 앞으로 가오. 방장 화면 단계명과 같은지 보시오.`,
        confirmLabel: '가겠소',
        danger: chosen.spoiler,
        onConfirm: () => onSync(picked),
      });
      return;
    }
    onSync(picked);
  };
  return (
    <BottomSheet
      title="지금 어디까지 왔소?"
      open={open}
      onClose={onClose}
      actions={
        <div className="gu-sheet-actions-row">
          <GuButton variant="secondary" onClick={onClose}>
            취소
          </GuButton>
          <GuButton variant={chosen?.spoiler ? 'danger' : 'primary'} onClick={go} disabled={picked === state.phase} disabledReason="단계를 고르시오">
            이동
          </GuButton>
        </div>
      }
    >
      <p className="gu-sheet-hint">방장 폰 화면 위쪽 단계명을 보고 고르시오</p>
      <div className="gu-synclist" role="radiogroup" aria-label="진행 단계">
        {options.map((o) => (
          <button
            key={o.phase}
            type="button"
            role="radio"
            aria-checked={picked === o.phase}
            className="gu-synclist-row"
            data-picked={picked === o.phase || undefined}
            onClick={() => setPicked(o.phase)}
          >
            <span className="gu-synclist-dot" data-picked={picked === o.phase || undefined} aria-hidden />
            <span className={o.spoiler ? 'gu-synclist-label gu-text-danger' : 'gu-synclist-label'}>
              {o.label}
              {o.spoiler ? ' (스포일러)' : ''}
            </span>
            {o.current && <span className="gu-synclist-current">지금</span>}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export interface MenuRow {
  key: string;
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}

export function MenuSheet({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: MenuRow[] }) {
  return (
    <BottomSheet title="메뉴" open={open} onClose={onClose}>
      <div className="gu-menulist">
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            className="gu-menulist-row"
            data-tone={r.tone ?? 'default'}
            onClick={() => {
              onClose();
              r.onClick();
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/** O3 — 확정은 항상 오른쪽, 취소는 왼쪽, 사이 24px. 스크림 탭 = 취소 */
export function ConfirmSheet({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <BottomSheet title={request?.title ?? ''} open={Boolean(request)} onClose={onClose} dismissible>
      {request && (
        <>
          <p className="gu-sheet-body-text">{request.body}</p>
          <div className="gu-sheet-actions-row">
            <GuButton variant="secondary" onClick={onClose}>
              {request.cancelLabel ?? '아직이오'}
            </GuButton>
            <GuButton
              variant={request.danger ? 'danger' : 'primary'}
              size={64}
              onClick={() => {
                onClose();
                request.onConfirm();
              }}
            >
              {request.confirmLabel ?? '하겠소'}
            </GuButton>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

/**
 * O8 — 방장 메뉴 '자리 비우기'.
 *
 * 이 시트는 **비운 자리가 범인인지 절대 보여 주지 않는다**(QA BUG-02 와 그 우회). 예전엔 비운 뒤 "사건이 성립하지 않소 /
 * 범인이 아니라는 뜻"을 띄워서, 방장이 비우기 → 결과 → ↶ 를 되풀이하면 범인 자리를 캘 수 있었다. 이제 결과 화면은 어느 자리를
 * 비우든 자리 번호만 다른 같은 문구다 — 되돌려도 알게 된 게 없다. 범인이 자리를 비운 판은 진상 공개 뒤(판결 비트·결과)에서
 * '판결 없음'으로만 드러난다(엔진 GameResult.culpritAbsent).
 * 단계: 고르기 → "정말 떠났소?" 확인 → (비움 반영 = 되돌리기 스택 기록) → 반영 안내.
 */
export function AbsentSheet({
  open,
  onClose,
  state,
  n,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  state: GameState;
  n: number;
  onConfirm: (seat: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [step, setStep] = useState<'pick' | 'confirm' | 'done'>('pick');
  useEffect(() => {
    if (open) {
      setPicked(null);
      setStep('pick');
    }
  }, [open]);
  const absent = state.host?.absentSeats ?? [];
  const seats = Array.from({ length: n - 1 }, (_, i) => i + 2).filter((s) => !absent.includes(s)); // 자리 1(방장)은 비울 수 없음
  const committed = step === 'done' && picked !== null && absent.includes(picked);
  const commit = () => {
    if (!picked) return;
    onConfirm(picked);
    setStep('done');
  };
  return (
    <BottomSheet title="누가 자리를 떴소?" open={open} onClose={onClose}>
      {step === 'pick' ? (
        <>
          <p className="gu-sheet-hint">비운 자리는 지목·집계에서 빠지오. 그 자리가 범인이었는지는 여기서 알려 주지 않소 — 진상 공개 때 드러나오.</p>
          <div className="gu-seatchip-row">
            {seats.map((s) => (
              <button key={s} type="button" className="gu-seatchip" aria-pressed={picked === s} data-picked={picked === s || undefined} onClick={() => setPicked(s)}>
                {s}
              </button>
            ))}
          </div>
          {absent.length > 0 && <p className="gu-micro">이미 비운 자리: {absent.join(', ')}번</p>}
          <div className="gu-sheet-actions-row">
            <GuButton variant="secondary" onClick={onClose}>
              취소
            </GuButton>
            <GuButton variant="danger" disabled={!picked} disabledReason="자리를 고르시오" onClick={() => setStep('confirm')}>
              비우기
            </GuButton>
          </div>
        </>
      ) : step === 'confirm' ? (
        <>
          <p className="gu-sheet-body-text">
            {picked}번이 정말 자리를 떠났소? 비우면 {picked}번은 자기소개·변론·지목·집계에서 빠지오. 잘못 눌렀으면 ↶ 로 되돌리시오.
          </p>
          <div className="gu-sheet-actions-row">
            <GuButton variant="secondary" onClick={() => setStep('pick')}>
              아니오
            </GuButton>
            <GuButton variant="danger" onClick={commit}>
              {picked}번 비우겠소
            </GuButton>
          </div>
        </>
      ) : !committed ? (
        <p className="gu-sheet-body-text">반영하지 못했소. 닫고 다시 시도하시오.</p>
      ) : (
        <>
          <p className="gu-sheet-body-text">
            {picked}번 자리를 비웠소. {picked}번은 지목·집계에서 빠지오. 범인이었는지는 진상 공개 때 드러나오.
          </p>
          <GuButton variant="primary" onClick={onClose}>
            알겠소
          </GuButton>
        </>
      )}
    </BottomSheet>
  );
}

/** 플레이어 메뉴 '자리 바꾸기' — 진행 기록(고른 장소·지목)이 지워진다는 경고를 같이 보인다 */
export function SeatChangeSheet({ open, onClose, state, n, onChange }: { open: boolean; onClose: () => void; state: GameState; n: number; onChange: (seat: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);
  const items = seatRingItems(n, { mode: 'pick', selected: picked ?? state.seat }).map((it) => (it.seat === 1 ? { ...it, state: 'disabled' as const } : it));
  return (
    <BottomSheet title="자리 바꾸기" open={open} onClose={onClose}>
      <p className="gu-sheet-hint">
        지금 {state.seat}번. 방장이 1번, 방장 왼쪽이 2번… (시계 방향). 바꾸면 내 패·단서가 그 자리 것으로 바뀌고, 고른 장소·지목 기록은 지워지오.
      </p>
      <SeatRing n={n} mode="pick" items={items} onTapSeat={(s) => s !== 1 && setPicked(s)} />
      <div className="gu-sheet-actions-row">
        <GuButton variant="secondary" onClick={onClose}>
          취소
        </GuButton>
        <GuButton
          variant="danger"
          disabled={!picked || picked === state.seat}
          disabledReason="자리를 고르시오"
          onClick={() => {
            if (!picked) return;
            onChange(picked);
            onClose();
          }}
        >
          {picked && picked !== state.seat ? `${picked}번으로 바꾸기` : '자리를 고르시오'}
        </GuButton>
      </div>
    </BottomSheet>
  );
}

/** O5 — 하는 법(R1 거짓말 규칙 상자 맨 위 + 6단계 + 점수 규칙 표 + 안내 2줄, §13) */
export function RulesSheet({ open, onClose, c }: { open: boolean; onClose: () => void; c: GungCase }) {
  const r = c ? scoringOf(c) : DEFAULT_SCORING;
  return (
    <BottomSheet title="하는 법" open={open} onClose={onClose}>
      <LieRulesBox />
      <ol className="gu-plainlist gu-steps">
        <li>① 방장이 사건 개요를 읽는다</li>
        <li>② 각자 비밀 패를 몰래 본다(꾹 누르는 동안만 보임)</li>
        <li>{GUIDE.rulesIntroStep}</li>
        <li>④ 조사 3번 — 장소 1곳 → 단서 → 공개할지 숨길지</li>
        <li>⑤ 최종 변론 1인 1분</li>
        <li>⑥ 셋에 동시 지목 → 진상 공개 → 점수</li>
      </ol>
      <table className="gu-ruletable">
        <tbody>
          <tr>
            <th scope="row">진범 지목(범인 외)</th>
            <td className="gu-num">+{r.correctVote}</td>
          </tr>
          {r.teamCatch > 0 && (
            <tr>
              <th scope="row">범인 검거 시 모두(범인 외)</th>
              <td className="gu-num">+{r.teamCatch}</td>
            </tr>
          )}
          <tr>
            <th scope="row">개인 미션 성공</th>
            <td className="gu-num">+{r.mission}~</td>
          </tr>
          {c.bonusQuestions && c.bonusQuestions.length > 0 && (
            <tr>
              <th scope="row">보너스 문항 정답(범인 외)</th>
              <td className="gu-num">+{r.bonusCorrect}</td>
            </tr>
          )}
          <tr>
            <th scope="row">범인 도주</th>
            <td className="gu-num">+{r.culpritEscape}</td>
          </tr>
        </tbody>
      </table>
      <p className="gu-micro">인원이 늘면 다음 판에서 함께(새 방)</p>
      <p className="gu-micro">캡처해서 돌리면 재미없어지오</p>
    </BottomSheet>
  );
}

/** 「?」 시트 인물 섹션 — 자기소개 뒤(rolesVisible)에만 사람이 보인다. 인원·배정만으로 정해진다(역할 무관) */
export interface HelpPeople {
  visible: boolean;
  seated: { seat?: number; name: string; icon: RoleIconKey; subtitle?: string; profile: string }[];
  /** 4·5인 판의 NPC(「이 자리에 없으나 증언을 남긴 이」) — 6인이면 빈 배열(머리도 없다) */
  absent: { name: string; icon: RoleIconKey; subtitle?: string; profile: string }[];
  aliases: string[];
}

function PeopleSection({ people }: { people: HelpPeople }) {
  return (
    <section className="gu-help-people" aria-label={GUIDE.peopleSection}>
      <p className="gu-h3">{GUIDE.peopleSection}</p>
      {!people.visible ? (
        <p className="gu-muted">{GUIDE.peopleLocked}</p>
      ) : (
        <>
          <ul className="gu-roster">
            {people.seated.map((p) => (
              <li key={p.seat} className="gu-roster-item">
                <p className="gu-roster-head">
                  <span className="gu-num">{p.seat}번</span> · <RoleIcon iconKey={p.icon} size={18} /> <span className="gu-roster-name">{p.name}</span>
                </p>
                {p.subtitle && <p className="gu-roster-sub">{p.subtitle}</p>}
                <p className="gu-roster-profile">{p.profile}</p>
              </li>
            ))}
          </ul>
          {people.absent.length > 0 && (
            <>
              <p className="gu-roster-absent-head">{GUIDE.peopleAbsentHead}</p>
              <ul className="gu-roster">
                {people.absent.map((p) => (
                  <li key={p.name} className="gu-roster-item">
                    <p className="gu-roster-head">
                      <RoleIcon iconKey={p.icon} size={18} /> <span className="gu-roster-name">{p.name}</span>
                    </p>
                    {p.subtitle && <p className="gu-roster-sub">{p.subtitle}</p>}
                    <p className="gu-roster-profile">{p.profile}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <p className="gu-roster-absent-head">{GUIDE.aliasHead}</p>
      <ul className="gu-aliases">
        {people.aliases.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 「?」 시트(R2 재구성) — 궁 배치도 → 시각표(원고 1-5) → 인물 → 용어(원고 1-6). 목록은 인원·단계만으로 정해진다 — 모든 폰에서 같다.
 * 장소 카드 용어는 그 카드 안(봉인 속), 역할 전용 용어는 내 패 봉인 속에만 있다.
 */
export function TermsSheet({
  open,
  onClose,
  rows,
  note,
  terms,
  map,
  people,
}: {
  open: boolean;
  onClose: () => void;
  rows: WatchRowView[];
  note?: string;
  terms: TermItem[];
  map: Pick<PalaceMapProps, 'maps' | 'placeIcons' | 'note'>;
  people: HelpPeople;
}) {
  return (
    <BottomSheet title={GUIDE.helpSheetTitle} open={open} onClose={onClose} className="gu-help-sheet">
      <p className="gu-h3">{GUIDE.mapSection}</p>
      <PalaceMap {...map} zoom />
      <TimeTable rows={rows} note={note} />
      <PeopleSection people={people} />
      <p className="gu-h3">{GUIDE.termsSection}</p>
      <TermList terms={terms} />
      <p className="gu-micro">단서 카드에만 나오는 말은 그 카드를 열면 카드 아래에 풀이가 붙소.</p>
    </BottomSheet>
  );
}

/** 배치도만 담은 시트(R2) — 장소 고르기 위 「🗺 궁 배치도 보기」·브리핑 지도 탭. 전체 높이로 연다 */
export function MapSheet({ open, onClose, map }: { open: boolean; onClose: () => void; map: Pick<PalaceMapProps, 'maps' | 'placeIcons' | 'note'> }) {
  return (
    <BottomSheet title={GUIDE.mapSection} open={open} onClose={onClose} className="gu-map-sheet">
      <PalaceMap {...map} zoom />
    </BottomSheet>
  );
}

/** O11 — 화면 꺼짐 방지 상태 안내 */
export function WakeSheet({
  open,
  onClose,
  status,
  isHost,
  canOpenExternal,
  onOpenExternal,
}: {
  open: boolean;
  onClose: () => void;
  status: 'on' | 'off' | 'na';
  isHost: boolean;
  canOpenExternal: boolean;
  onOpenExternal: () => void;
}) {
  return (
    <BottomSheet title="화면 꺼짐 방지" open={open} onClose={onClose}>
      <p className="gu-sheet-body-text">
        {status === 'on'
          ? '🕯 켜져 있소. 게임 중엔 화면이 꺼지지 않소.'
          : isHost
            ? '🌙 이 브라우저는 화면 꺼짐 방지를 못 하오. 방장 폰은 화면이 꺼지면 타이머 종이 안 울려요. 설정 › 자동 잠금을 늘리거나 기본 브라우저로 여시오.'
            : '🌙 이 브라우저는 화면 꺼짐 방지를 못 하오. 화면이 꺼져도 같은 코드·자리로 돌아오면 내용은 그대로요.'}
      </p>
      {isHost && status !== 'on' && canOpenExternal && (
        <GuButton variant="secondary" onClick={onOpenExternal}>
          기본 브라우저로 열기
        </GuButton>
      )}
    </BottomSheet>
  );
}
