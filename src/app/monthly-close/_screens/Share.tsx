'use client';

/** 공유 패널(W 대기): 문서 번호 크게, 링크·번호 복사, 경보 포함 표시(읽기 전용), 대기 상태. 포털 없이 게임 레이어 안. */
import { COMMON_PACK } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import { Button } from '../_components/form/controls';
import { Popover } from '../_components/overlays/Popovers';

export interface SharePanelProps {
  code: string;
  alarmOn: boolean;
  waiting: boolean;
  onCopyLink: () => void;
  onCopyNumber: () => void;
  onShareNative?: () => void;
}

export function SharePanel(p: SharePanelProps) {
  return (
    <Popover title={UI.share.title} style={{ top: 4, right: 12 }} label={UI.share.title}>
      <div style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-sub)' }}>{UI.share.docNumber}</div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.4em', margin: '4px 0 12px' }} aria-label={p.code.split('').join(' ')}>
        {p.code}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="secondary" cmd="copy-link" onClick={p.onCopyLink}>{UI.share.copyLink}</Button>
        <Button variant="secondary" cmd="copy-number" onClick={p.onCopyNumber}>{UI.share.copyNumber}</Button>
        {p.onShareNative ? <Button variant="secondary" cmd="share-native" onClick={p.onShareNative}>{UI.share.shareMore}</Button> : null}
      </div>
      <div style={{ marginTop: 12 }}>{UI.share.alarmIncluded(p.alarmOn)}</div>
      {p.waiting ? <div>{COMMON_PACK.status.waitingGuest}</div> : null}
      <div style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-faint)', marginTop: 4 }}>{UI.share.sameBrowser}</div>
    </Popover>
  );
}
