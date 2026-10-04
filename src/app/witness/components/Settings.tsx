'use client';

/**
 * 설정(W70, 디자인 §5-18) · 규칙 카드(W03, 설정 > 도움말에서 다시 보기).
 * 항목: 글자 속도 · 글자 크기 · 화면 효과(기본/짧게/줄이기) · 진동 · 왼손 모드 · 읽은 대사 바로 보기 · 허브 지도/목록 · 도움말 · 데이터 삭제 · 1인용 안내.
 * 바꾸면 즉시 반영하고 meta.settings 에 저장한다. 위험 항목은 아래, 확인 시트에서 취소가 기본 포커스.
 */
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CASE, type Settings as SettingsT } from '@/lib/witness';
import { GLOSSARY, NOTICE, RULE_CARD_2_EXTRA, RULE_TITLES, SETTINGS_TEXT } from '../lib/copy';
import { canVibrate } from '../lib/fx';
import { useWt } from '../lib/context';
import { useTypewriter } from '../lib/useTypewriter';
import { ActionPips, StarGate, TrustMeter } from './Hud';
import { BottomSheet, ConfirmSheet } from './BottomSheet';

function Seg<T extends string>({ label, value, options, onChange, id }: { label: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="wt-setrow">
      <span className="wt-setlabel" id={id}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="wt-seg wt-seg--set">
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} data-testid={`set-${id}-${o.v}`}>
            {value === o.v && <Check size={13} aria-hidden />} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, desc, on, onChange, id }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div className="wt-setrow wt-setrow--toggle">
      <span className="wt-setlabel" id={id}>
        {label}
        {desc && <small>{desc}</small>}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="wt-toggle" data-on={on ? '1' : undefined} onClick={() => onChange(!on)} data-testid={`set-${id}`}>
        <i aria-hidden>{on && <Check size={12} />}</i>
        <span>{on ? '켬' : '끔'}</span>
      </button>
    </div>
  );
}

export function SettingsSheet({ open, onClose, inGame, onTitle, onShowRules }: { open: boolean; onClose: () => void; inGame: boolean; onTitle: () => void; onShowRules: () => void }) {
  const { game, toast } = useWt();
  const s = game.settings;
  const [vib, setVib] = useState(false);
  const [confirm, setConfirm] = useState<null | 'run' | 'all'>(null);
  useEffect(() => setVib(canVibrate()), []);
  const set = (p: Partial<SettingsT>) => game.updateSettings(p);
  const tw = useTypewriter(SETTINGS_TEXT.previewLine, s.speed, { resetKey: `${s.speed}${s.text}${open}` });

  return (
    <>
      <BottomSheet open={open} title="설정" onClose={onClose} height="tall" className="wt-sheet--settings">
        {!game.persistent && <p className="wt-banner">{NOTICE.noStorage}</p>}
        <p className="wt-preview" aria-live="polite" data-testid="settings-preview">
          {tw.shown}
        </p>
        <Seg id="speed" label="글자 속도" value={s.speed} options={[{ v: 'normal', label: '보통' }, { v: 'fast', label: '빠름' }, { v: 'instant', label: '즉시' }]} onChange={(v) => set({ speed: v })} />
        <Seg id="text" label="글자 크기" value={s.text} options={[{ v: 'm', label: '보통' }, { v: 'l', label: '크게' }, { v: 'xl', label: '아주 크게' }]} onChange={(v) => set({ text: v })} />
        <Seg
          id="fx"
          label="화면 효과"
          value={s.fx === 'auto' ? game.fxMode : s.fx}
          options={[{ v: 'full', label: '기본' }, { v: 'short', label: '짧게' }, { v: 'reduced', label: '줄이기' }]}
          onChange={(v) => set({ fx: v })}
        />
        <p className="wt-sethint">줄이기: 흔들림·번쩍임·번짐을 없애요.</p>
        {vib && <Toggle id="haptics" label="진동" on={s.haptics} onChange={(v) => set({ haptics: v })} />}
        <Toggle id="lefthand" label="왼손 모드" desc="버튼 좌우를 뒤집어요" on={s.leftHand} onChange={(v) => set({ leftHand: v })} />
        <Toggle id="readfast" label="읽은 대사 바로 보기" desc="이미 본 대사는 바로 보여요" on={s.readFast} onChange={(v) => set({ readFast: v })} />
        <Seg id="hubview" label="허브 지도" value={s.hubView} options={[{ v: 'map', label: '지도' }, { v: 'list', label: '목록' }]} onChange={(v) => set({ hubView: v })} />

        <h3 className="wt-sec-h">도움말</h3>
        <div className="wt-setbtns">
          <button type="button" className="wt-btn wt-btn--secondary" onClick={onShowRules}>
            게임 방법 다시 보기
          </button>
          <button
            type="button"
            className="wt-btn wt-btn--secondary"
            onClick={() => {
              game.resetCoach();
              toast({ kind: 'ok', text: '도움말 말풍선을 다시 보여 줄게요' });
            }}
          >
            도움말 말풍선 다시 보기
          </button>
        </div>
        <details className="wt-glossary">
          <summary>용어 풀이</summary>
          <dl>
            {GLOSSARY.map((g) => (
              <div key={g.term}>
                <dt>{g.term}</dt>
                <dd>{g.desc}</dd>
              </div>
            ))}
          </dl>
        </details>

        {inGame && (
          <div className="wt-setbtns">
            <button type="button" className="wt-btn wt-btn--secondary" onClick={onTitle} data-testid="settings-title">
              제목으로 (기록은 저장돼요)
            </button>
          </div>
        )}

        <h3 className="wt-sec-h">데이터</h3>
        <div className="wt-setbtns">
          <button type="button" className="wt-btn wt-btn--danger" onClick={() => setConfirm('run')} data-testid="settings-clear-run">
            진행 중인 수사 지우기
          </button>
          <button type="button" className="wt-btn wt-btn--danger" onClick={() => setConfirm('all')} data-testid="settings-clear-all">
            도감까지 모두 지우기
          </button>
        </div>
        <p className="wt-solo">{SETTINGS_TEXT.solo}</p>
        <p className="wt-version">{SETTINGS_TEXT.version}</p>
      </BottomSheet>
      <ConfirmSheet
        open={confirm === 'run'}
        title="진행 중인 수사를 지울까요?"
        confirmLabel="지운다"
        cancelLabel="취소"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          game.clearProgress();
          onClose();
          toast({ kind: 'ok', text: '진행 중인 수사를 지웠어요' });
        }}
      >
        <p>엔딩 도감·업적은 그대로예요.</p>
      </ConfirmSheet>
      <ConfirmSheet
        open={confirm === 'all'}
        title="도감까지 모두 지울까요?"
        confirmLabel="모두 지운다"
        cancelLabel="취소"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          game.wipeAll();
          onClose();
          toast({ kind: 'ok', text: '모두 지웠어요' });
        }}
      >
        <p>엔딩 도감·비밀·업적·플레이 기록이 사라져요. 되돌릴 수 없어요.</p>
      </ConfirmSheet>
    </>
  );
}

/** 규칙 카드 3장(W03) — 그림 자리에 실제 HUD 컴포넌트를 그대로 쓴다. 좌우 스와이프 + 버튼 */
export function RuleCards({ onDone, doneLabel = '수사 시작' }: { onDone: () => void; doneLabel?: string }) {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const texts = CASE.rules;
  const last = i >= texts.length - 1;
  const go = (d: 1 | -1) => setI((c) => Math.min(texts.length - 1, Math.max(0, c + d)));
  return (
    <div
      className="wt-rules"
      onPointerDown={(e) => (touch.current = e.clientX)}
      onPointerUp={(e) => {
        if (touch.current === null) return;
        const dx = e.clientX - touch.current;
        touch.current = null;
        if (dx <= -48) go(1);
        else if (dx >= 48) go(-1);
      }}
    >
      <p className="wt-rules-n" aria-live="polite">
        {i + 1}/{texts.length}
      </p>
      <div className="wt-rulecard" data-i={i}>
        <div className="wt-rulecard-art" aria-hidden>
          {i === 0 && (
            <div className="wt-rule-pips">
              <ActionPips left={12} />
              <b>12</b>
            </div>
          )}
          {i === 1 && (
            <div className="wt-rule-line">
              <p className="wt-rule-quote">“저녁 뒤론 손님방에 있었어요.”</p>
              <span className="wt-rule-card">증거 카드</span>
              <TrustMeter value={5} showDelta={false} />
            </div>
          )}
          {i === 2 && (
            <div className="wt-rule-gate">
              <StarGate count={3} />
              <div className="wt-rule-slots">
                <span>수단</span>
                <span>기회</span>
                <span>동기</span>
              </div>
            </div>
          )}
        </div>
        <h2 className="wt-display wt-rulecard-h">{RULE_TITLES[i]}</h2>
        <p className="wt-rulecard-t">{texts[i]}</p>
        {i === 1 && <p className="wt-rulecard-extra">{RULE_CARD_2_EXTRA}</p>}
      </div>
      <div className="wt-dotsrow" aria-hidden>
        {texts.map((_, k) => (
          <i key={k} data-on={k === i ? '1' : undefined} />
        ))}
      </div>
      <div className="wt-actions">
        {i > 0 && (
          <button type="button" className="wt-btn wt-btn--ghost" onClick={() => go(-1)}>
            이전
          </button>
        )}
        <button type="button" className="wt-btn wt-btn--primary" onClick={last ? onDone : () => go(1)} data-testid="rules-next">
          {last ? doneLabel : '다음'}
        </button>
      </div>
    </div>
  );
}

export function RulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} title="게임 방법" onClose={onClose} height="tall">
      <RuleCards onDone={onClose} doneLabel="닫기" />
    </BottomSheet>
  );
}
