/**
 * §5-22 ScoreRow — 1줄: 순위·자리·역할·점수. 2줄: 지목·적중 칩(또는 범인 검거/도주).
 * 3줄~: 미션 — 역할마다 미션이 여러 개다(원고: ① 비밀 유지 = 방장 구술 판정, ② 역할별 = 앱 자동 판정).
 *  - 구술 판정 미션(auto=false): 성공/실패 세그 52h(§5-22). 다시 누르면 미판정으로.
 *  - 자동 판정 미션(auto=true): 결과 칩만(읽기 전용) — 지목 데이터로 이미 계산됐다.
 *  - 무효 미션(void, 예: 범인 검거 시 '탈출했을 때만'): '무효' 칩.
 */
import { RoleIcon } from './icons';
import type { RoleIconKey } from './types';

export interface ScoreMission {
  id: string;
  /** '[비밀] 비밀 유지' 같은 짧은 라벨 */
  label: string;
  /** 판정 보조 문구(예: 거수로 판정할 비밀 한 줄) */
  detail?: string;
  points: number;
  value: boolean | null;
  auto: boolean;
  void?: boolean;
}

export interface ScoreRowProps {
  rank: number | null;
  seat: number;
  roleName: string;
  icon?: RoleIconKey;
  score: number;
  isCulprit?: boolean;
  /** 비범인 행: 1차 지목 대상 + 적중 여부(지목 안 함 = targetSeat null) */
  vote?: { targetSeat: number | null; correct: boolean };
  /** 범인 행: 검거/도주 */
  culpritOutcome?: 'caught' | 'escaped';
  missions: ScoreMission[];
  onMissionChange?: (missionId: string, result: boolean | null) => void;
  className?: string;
}

export function ScoreRow({ rank, seat, roleName, icon, score, isCulprit, vote, culpritOutcome, missions, onMissionChange, className }: ScoreRowProps) {
  return (
    <div className={['gu-scorerow', className ?? ''].filter(Boolean).join(' ')} data-culprit={isCulprit || undefined}>
      <div className="gu-scorerow-top">
        <span className="gu-scorerow-rank gu-num" aria-label={rank ? `${rank}위` : undefined}>
          {rank ?? ''}
        </span>
        <span className="gu-scorerow-who">
          {icon && <RoleIcon iconKey={icon} size={18} />}
          {seat}번 {roleName}
          {isCulprit && <span className="gu-scorerow-culprit-chip">범인</span>}
        </span>
        <span className="gu-scorerow-score gu-num">{score}점</span>
      </div>
      <div className="gu-scorerow-bottom">
        {isCulprit ? (
          <span className="gu-scorerow-outcome" data-outcome={culpritOutcome}>
            {culpritOutcome === 'caught' ? '검거됨 ✗' : culpritOutcome === 'escaped' ? '도주 성공 ✓' : '판결 없음'}
          </span>
        ) : vote ? (
          <span className="gu-scorerow-vote" data-correct={vote.correct || undefined}>
            {vote.targetSeat === null ? '지목 없음 ✗' : `지목 ${vote.targetSeat}번 ${vote.correct ? '✓ 적중' : '✗'}`}
          </span>
        ) : null}
      </div>
      {missions.map((m) => (
        <div key={m.id} className="gu-scorerow-mission">
          <span className="gu-scorerow-mission-label">
            {m.label} <span className="gu-num">+{m.points}</span>
            {m.detail && <span className="gu-scorerow-mission-detail">{m.detail}</span>}
          </span>
          {m.void ? (
            <span className="gu-scorerow-mission-chip">무효</span>
          ) : m.auto ? (
            <span className="gu-scorerow-mission-chip" data-result={m.value === null ? 'pending' : m.value ? 'ok' : 'fail'}>
              {m.value === null ? '판정 대기' : m.value ? '성공 ✓' : '실패 ✗'}
            </span>
          ) : (
            <span className="gu-scorerow-mission-segs" role="group" aria-label={`${seat}번 ${m.label} 판정`}>
              <button
                type="button"
                className="gu-scorerow-mission-seg"
                data-active={m.value === true || undefined}
                aria-pressed={m.value === true}
                onClick={() => onMissionChange?.(m.id, m.value === true ? null : true)}
              >
                성공
              </button>
              <button
                type="button"
                className="gu-scorerow-mission-seg"
                data-tone="fail"
                data-active={m.value === false || undefined}
                aria-pressed={m.value === false}
                onClick={() => onMissionChange?.(m.id, m.value === false ? null : false)}
              >
                실패
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
