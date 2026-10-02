'use client';

/**
 * §5-30 ResultImageModal — 전체 화면 모달. 카톡/인스타 인앱은 다운로드가 막히므로
 * "꾹 눌러 저장" 안내만, 일반 브라우저는 [다운로드](fetch→blob→a[download]) 추가(§9-5).
 */
import { useEffect, useState } from 'react';
import { GuButton } from './GuButton';

export interface ResultImageModalProps {
  src: string;
  alt?: string;
  onClose: () => void;
  className?: string;
}

function detectInApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /KAKAOTALK|Instagram|FBAN|FBAV/i.test(navigator.userAgent);
}

export function ResultImageModal({ src, alt = '결과 이미지', onClose, className }: ResultImageModalProps) {
  const [inApp, setInApp] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => setInApp(detectInApp()), []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gung-result.png'; // OG 라우트는 PNG 를 낸다(QA BUG-18)
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* 실패 시 조용히 — 이미지는 이미 화면에 보이므로 꾹 눌러 저장할 수 있다 */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={['gu-resultmodal', className ?? ''].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label="결과 이미지">
      <button type="button" className="gu-sheet-scrim" aria-hidden tabIndex={-1} onClick={onClose} />
      <div className="gu-resultmodal-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="gu-resultmodal-img" />
        <p className="gu-resultmodal-hint">{inApp ? '이미지를 꾹 눌러 저장하시오' : '아래 버튼으로 저장하거나, 이미지를 꾹 눌러 저장하시오'}</p>
        <div className="gu-resultmodal-actions">
          {!inApp && (
            <GuButton variant="secondary" onClick={handleDownload} disabled={downloading} disabledReason="저장 중…">
              다운로드
            </GuButton>
          )}
          <GuButton variant="ghost" onClick={onClose}>
            닫기
          </GuButton>
        </div>
      </div>
    </div>
  );
}
