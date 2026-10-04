'use client';

/**
 * 셋업 화면 S1~S6 + O9(이어하기 충돌) + 코드 오류. (§3) 전부 게임 시작 전 로컬 UI — GameState 없음.
 */
import { useState, type ReactNode } from 'react';
import type { GungCase, PlayerCount, RoomCode as RoomCodeT } from '@/lib/gung';
import { extractRoomCode, formatRoomCode, GUIDE, SCENE_ROUTE_PATH } from '@/lib/gung';
import { Banner, CodeInput, GuButton, RoomCode, SeatRing, ShareActions } from '../components';
import { seatRingItems } from './adapters';

function GuSeal({ size = 96 }: { size?: number }) {
  return (
    <div className="gu-seal" style={{ width: size, height: size }} aria-hidden>
      궁
    </div>
  );
}

export function Home({
  hasResume,
  resumeLabel,
  onResume,
  onCreateRoom,
  onEnterCode,
  onRules,
  banner,
}: {
  hasResume: boolean;
  resumeLabel?: string;
  onResume: () => void;
  onCreateRoom: () => void;
  onEnterCode: () => void;
  onRules: () => void;
  banner?: ReactNode;
}) {
  return (
    <main className="gu-setup gu-home">
      {banner}
      <GuSeal />
      <h1 className="gu-display gu-display-xl">세자 독살 사건</h1>
      <p className="gu-stagebody gu-home-tagline">
        오늘 밤, 세자가 독살당했다.
        <br />
        범인은 이 자리에 있다.
      </p>
      <div className="gu-home-chips">
        <span className="gu-infochip">4~6인</span>
        <span className="gu-infochip">폰 1대씩</span>
        {/* M1(개선 묶음 1): 시뮬 실측 약 70분 + 보너스 단계·인장 입력 — 실측 뒤 다시 맞춘다 */}
        <span className="gu-infochip">{GUIDE.homeMinutes}</span>
      </div>
      {hasResume && (
        <div className="gu-home-resume">
          <p className="gu-home-resume-label">진행 중인 사건 · {resumeLabel}</p>
          <GuButton variant="primary" onClick={onResume}>
            이어하기 →
          </GuButton>
        </div>
      )}
      <GuButton variant={hasResume ? 'secondary' : 'primary'} size={hasResume ? 52 : 64} onClick={onCreateRoom}>
        방 만들기 (방장)
      </GuButton>
      <GuButton variant="secondary" onClick={onEnterCode}>
        코드로 참가하기
      </GuButton>
      <button type="button" className="gu-ghostlink gu-center-self" onClick={onRules}>
        하는 법 1분 요약 ›
      </button>
      {/* 통합: 노트북·TV 현장 화면(/gung/scene) — 게임 상태 없이 현장 그림만. 방 코드는 방장 ⋮ › 노트북·TV로 현장 보기 에서 붙여 준다 */}
      <a className="gu-ghostlink gu-center-self gu-home-biglink" href={SCENE_ROUTE_PATH}>
        {GUIDE.bigScreenHomeLink}
      </a>
      <p className="gu-micro gu-home-disclaimer">가상의 왕조 이야기입니다 · 실존 인물·사건과 무관합니다</p>
    </main>
  );
}

/**
 * S2 — 인원 고르기. 등장인물(인원별 구성) 목록은 두지 않는다(QA BUG-12 결정 — 원고 1-3 「앱은 플레이어 화면 어디에도 인원별
 * 구성표를 띄우지 않는다」): 방장도 플레이어이고, 4↔6 을 눌러 보면 "5·6번 역할은 빠질 수 있다 → 범인 아님"이 드러난다.
 */
export function CreateRoom({ onBack, onCreate }: { c?: GungCase; onBack: () => void; onCreate: (n: PlayerCount) => void }) {
  const [n, setN] = useState<PlayerCount | null>(null);
  return (
    <main className="gu-setup">
      <button type="button" className="gu-header-iconbtn gu-setup-back" onClick={onBack} aria-label="뒤로">
        ‹
      </button>
      <h1 className="gu-display">오늘 몇 명이오?</h1>
      <p className="gu-body">(지금 이 자리에 있는 사람 수)</p>
      <div className="gu-counttiles">
        {([4, 5, 6] as PlayerCount[]).map((count) => (
          <button key={count} type="button" className="gu-counttile" data-selected={n === count || undefined} onClick={() => setN(count)}>
            <span className="gu-num gu-counttile-num">{count}</span>
            <span>명</span>
          </button>
        ))}
      </div>
      <Banner tone="info">⚠ 인원은 나중에 못 바꿔요. 바꾸면 새 방이 됩니다.</Banner>
      <GuButton variant="primary" disabled={!n} disabledReason="인원을 골라주세요" onClick={() => n && onCreate(n)}>
        방 열기 →
      </GuButton>
    </main>
  );
}

export function Invite({
  room,
  onContinue,
  onShare,
  onCopyLink,
  copied,
  banner,
  onBigScreen,
}: {
  room: RoomCodeT;
  onContinue: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  copied?: boolean;
  /** §12-5 방장 폰 화면 꺼짐 방지 미지원 경고 */
  banner?: ReactNode;
  /** 통합: 노트북·TV 현장 주소 시트 */
  onBigScreen?: () => void;
}) {
  return (
    <main className="gu-setup">
      <h1 className="gu-display">방이 열렸소</h1>
      <div className="gu-invitecard">
        <RoomCode code={room.code} n={room.n} tag={room.tag} />
      </div>
      <ShareActions kind="invite" onShare={onShare} onCopyLink={onCopyLink} copied={copied} />
      <p className="gu-body gu-invite-note">
        · 단톡방에 보내면 각자 눌러 입장
        <br />
        · 방장은 1번. 방장 왼쪽 사람이 2번, 그 왼쪽이 3번… (시계 방향)
      </p>
      {onBigScreen && (
        <button type="button" className="gu-ghostlink gu-center-self" onClick={onBigScreen}>
          {GUIDE.bigScreenMenu} ›
        </button>
      )}
      {banner}
      <GuButton variant="primary" onClick={onContinue}>
        대기실로 →
      </GuButton>
    </main>
  );
}

export function EnterCode({ onBack, onSubmit }: { onBack: () => void; onSubmit: (code: string) => boolean }) {
  const [invalid, setInvalid] = useState(false);
  return (
    <main className="gu-setup">
      <button type="button" className="gu-header-iconbtn gu-setup-back" onClick={onBack} aria-label="뒤로">
        ‹
      </button>
      <h1 className="gu-display">방장에게 받은 코드를 넣으시오</h1>
      <CodeInput
        invalid={invalid}
        parsePaste={extractRoomCode}
        onComplete={(code) => {
          const ok = onSubmit(code);
          setInvalid(!ok);
        }}
      />
    </main>
  );
}

export type SeatPickStep = 'landing' | 'seat';

export function SeatPick({
  room,
  asHost,
  onEnter,
  onBecomeHost,
  onSeat,
  onRules,
  versionMismatch,
  step: stepProp,
  onStepChange,
}: {
  c?: GungCase;
  room: RoomCodeT;
  asHost: boolean;
  onEnter: () => void;
  onBecomeHost: () => void;
  /** late = 「늦게 왔소」 — 입장 직후 O1 진행 단계 맞추기를 연다(§2-E, QA BUG-23) */
  onSeat: (seat: number, opts?: { late?: boolean }) => void;
  onRules: () => void;
  /** §2-E 초대 링크 &v= ≠ 지금 사건 버전 */
  versionMismatch?: boolean;
  /** 상위가 단계를 쥐면(하드웨어 뒤로 = 이전 셋업 단계, §12-4) 제어 모드 */
  step?: SeatPickStep;
  onStepChange?: (step: SeatPickStep) => void;
}) {
  const [innerStep, setInnerStep] = useState<SeatPickStep>('landing');
  const step = stepProp ?? innerStep;
  const setStep = (next: SeatPickStep) => (onStepChange ? onStepChange(next) : setInnerStep(next));
  const [selected, setSelected] = useState<number | null>(null);

  if (asHost) {
    return (
      <main className="gu-setup">
        <GuSeal size={72} />
        <h1 className="gu-display">세자 독살 사건</h1>
        <p className="gu-stagebody">방장으로 이어서 진행하시오.</p>
        <div className="gu-invitecard">
          <RoomCode code={room.code} n={room.n} tag={room.tag} compact />
        </div>
        <GuButton variant="primary" onClick={onBecomeHost}>
          방장으로 입장하기 →
        </GuButton>
      </main>
    );
  }

  if (step === 'landing') {
    return (
      // key: 'seat' 단계와 같은 위치에 같은 태그(main)·같은 자식 타입(GuButton)이 와서, key 없이는
      // React가 두 단계를 "같은 엘리먼트의 업데이트"로 재사용해 GuButton의 내부 상태(탭 디바운스 lastRef)가
      // 단계를 넘어 새어 나간다(방금 누른 "입장하기"의 쿨다운이 "자리에 앉기"에 그대로 적용되는 버그).
      <main key="landing" className="gu-setup">
        <button type="button" className="gu-header-iconbtn gu-setup-back" onClick={onEnter} aria-label="처음 화면으로">
          ‹
        </button>
        <GuSeal />
        <h1 className="gu-display">세자 독살 사건</h1>
        <p className="gu-stagebody">
          오늘 밤, 세자가 숨을 거두었소.
          <br />
          범인은 이 자리에 있소.
        </p>
        <div className="gu-invitecard">
          <p className="gu-body">
            방 코드 {formatRoomCode(room.code)} · {room.n}인
          </p>
          <p className="gu-body">사건 표식 「{room.tag}」</p>
          <p className="gu-muted">방장 화면의 표식과 같은지 보시오</p>
        </div>
        {versionMismatch && <Banner tone="warn">방장과 사건 버전이 달라요. 모두 새로고침해 주세요.</Banner>}
        <GuButton variant="primary" onClick={() => setStep('seat')}>
          입장하기 →
        </GuButton>
        <div className="gu-linkrow">
          <button type="button" className="gu-ghostlink" onClick={onRules}>
            하는 법 ›
          </button>
          <button type="button" className="gu-ghostlink" onClick={onBecomeHost}>
            내가 방장이에요(이어서 진행) ›
          </button>
        </div>
      </main>
    );
  }

  const items = seatRingItems(room.n, { mode: 'pick', selected });
  return (
    <main key="seat" className="gu-setup">
      <h1 className="gu-display">나는 몇 번 자리요?</h1>
      <p className="gu-body">
        방장이 1번. 방장 왼쪽이 2번, 그 왼쪽이 3번… (시계 방향 ↻)
      </p>
      <SeatRing n={room.n} mode="pick" items={items} hostSeat={1} onTapSeat={(seat) => seat !== 1 && setSelected(seat)} />
      <p className="gu-micro">같은 코드·같은 자리로 다시 들어오면 내용은 그대로예요.</p>
      <GuButton variant="primary" disabled={!selected} disabledReason="자리를 고르시오" onClick={() => selected && onSeat(selected)}>
        {selected ? `${selected}번 자리에 앉기 →` : '자리에 앉기 →'}
      </GuButton>
      {selected && (
        // §2-E 늦게 온 사람 — 앉자마자 "지금 어디까지 왔소?"(O1)를 연다
        <button type="button" className="gu-ghostlink gu-center-self" onClick={() => onSeat(selected, { late: true })}>
          이미 시작했소? 늦게 왔으면 여기로 앉고 단계 맞추기 ›
        </button>
      )}
      <GuButton variant="ghost" onClick={() => setStep('landing')}>
        ‹ 뒤로
      </GuButton>
    </main>
  );
}

export function ConflictScreen({
  savedLabel,
  newLabel,
  onResume,
  onFresh,
}: {
  savedLabel: string;
  newLabel?: string;
  onResume: () => void;
  onFresh: () => void;
}) {
  return (
    <main className="gu-setup">
      <h1 className="gu-display">진행 중인 사건({savedLabel})이 있소</h1>
      <p className="gu-body">
        {newLabel ? `새 링크(${newLabel})로 들어왔소. ` : ''}이어하거나, 기존 기록을 지우고 새 사건으로 들어가시오.
      </p>
      <GuButton variant="primary" onClick={onResume}>
        이어하기
      </GuButton>
      <GuButton variant="danger" onClick={onFresh}>
        새 사건으로 입장
      </GuButton>
    </main>
  );
}

export function BadCodeScreen({ onHome }: { onHome: () => void }) {
  return (
    <main className="gu-setup">
      <h1 className="gu-display">코드가 맞지 않소</h1>
      <p className="gu-body">0·O·1·I·L은 쓰지 않아요. 코드를 다시 확인하시오.</p>
      <GuButton variant="primary" onClick={onHome}>
        처음으로
      </GuButton>
    </main>
  );
}
