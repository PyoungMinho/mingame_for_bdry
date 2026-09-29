'use client';

import { AlertTriangle, MessageCircle, Phone, Radio, Tv, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Alert } from '@/lib/zombie/types';

const KIND_LABEL: Record<Alert['kind'], string> = {
  disaster: '긴급재난문자',
  kakao: '단톡방',
  news: '속보',
  radio: '무전',
  call: '전화',
};

/**
 * 장면 위 연출 오버레이. 노드가 바뀔 때마다(key) 새로 떠오른다.
 * 재난문자는 휴대폰 진동 패턴을 한 번 흉내 낸다(지원 기기만, 사용자 조작 직후에만 호출됨).
 */
export function AlertOverlay({ alert, time }: { alert: Alert; time: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (alert.kind !== 'disaster') return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([180, 90, 180, 90, 360]);
    } catch {
      /* 무시 */
    }
  }, [alert]);

  if (!open) return null;

  const Icon = { disaster: AlertTriangle, kakao: MessageCircle, news: Tv, radio: Radio, call: Phone }[alert.kind];

  return (
    <div className="zb-alert" data-kind={alert.kind} role="status" aria-live="polite">
      <div className="zb-alert-head">
        <Icon className="zb-alert-icon" aria-hidden />
        <span className="zb-alert-kind">{KIND_LABEL[alert.kind]}</span>
        {alert.from && <span className="zb-alert-from">{alert.from}</span>}
        <span className="zb-alert-time">{time}</span>
        <button type="button" className="zb-alert-close" onClick={() => setOpen(false)} aria-label="알림 닫기">
          <X aria-hidden />
        </button>
      </div>
      <p className="zb-alert-text">{alert.text}</p>
    </div>
  );
}
