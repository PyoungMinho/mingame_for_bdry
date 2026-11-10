'use client';

/** 입장 대화상자(J): 링크로 도착한 사람(자리 없음). 닉네임·양식 → [열기]. ESC=숨기기, Tab=입력 이동. */
import { useEffect, useRef, useState } from 'react';
import { INDUSTRIES, NICKNAME_MAX, type IndustryId } from '@/lib/monthly-close/constants';
import { INDUSTRY_PACKS } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import { InlineDialog } from '../_components/overlays/Popovers';
import { Button, RadioRow, TextInput } from '../_components/form/controls';
import { HomeRules } from './Home';

export interface JoinDialogProps {
  code: string;
  nickname: string;
  onNickname: (v: string) => void;
  industry: IndustryId;
  onIndustry: (v: IndustryId) => void;
  pending: boolean;
  error?: string;
  onOpen: () => void;
  /**
   * 처음 열 때 포커스 자리. 양식을 바꾸면 화면이 그 업종으로 다시 그려지며 대화상자도 새로 마운트되는데,
   * 그때는 닉네임 칸이 아니라 고른 양식에 포커스를 돌려준다(방향키로 양식을 고르던 흐름이 끊기지 않게, BUG-05).
   */
  initialFocus?: 'nickname' | 'industry';
}

export function JoinDialog(p: JoinDialogProps) {
  const [rules, setRules] = useState(false);
  const nick = Array.from(p.nickname).slice(0, NICKNAME_MAX).join('');
  const radiosRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (p.initialFocus === 'industry') radiosRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <InlineDialog
      title={UI.join.title}
      actions={
        <Button size="lg" cmd="join-open" disabled={p.pending || nick.trim().length === 0} onClick={p.onOpen}>
          {UI.join.open}
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          {UI.join.docNumber} <strong>{p.code}</strong>
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          {UI.join.nickname}
          <TextInput value={p.nickname} maxLength={NICKNAME_MAX} autoFocus={p.initialFocus !== 'industry'} onChange={(e) => p.onNickname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && !p.pending && nick.trim() && p.onOpen()} />
        </label>
        <div ref={radiosRef} style={{ display: 'contents' }}>
          <RadioRow
            label={UI.join.form}
            value={String(p.industry) as '0' | '1' | '2'}
            onChange={(v) => p.onIndustry(Number(v) as IndustryId)}
            options={INDUSTRIES.map((k, i) => ({ value: String(i) as '0' | '1' | '2', label: INDUSTRY_PACKS[k].formName }))}
          />
        </div>
        {p.error ? <div className="mc-field-error">{p.error}</div> : null}
        <div style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-faint)' }}>
          {UI.join.invite}
          <button type="button" className="mc-btn" data-variant="text" onClick={() => setRules((r) => !r)}>
            {rules ? UI.join.hideRules : UI.join.showRules}
          </button>
        </div>
        {rules ? <HomeRules compact /> : null}
      </div>
    </InlineDialog>
  );
}
