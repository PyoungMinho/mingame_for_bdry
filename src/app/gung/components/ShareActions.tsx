/**
 * §5-29 ShareActions — Kakao 64 + 저장(결과만) + 링크 복사. 실제 SDK 호출·폴백 체인(§8-5)은
 * `lib/share.ts`(페이지개발자) 소유 — 이 컴포넌트는 버튼과 콜백 연결만 한다.
 */
import { ImageDown, Link } from 'lucide-react';
import { GuButton } from './GuButton';

export interface ShareActionsProps {
  kind: 'invite' | 'result' | 'generic';
  onShare: () => void;
  onSaveImage?: () => void;
  onCopyLink?: () => void;
  copied?: boolean;
  className?: string;
}

const SHARE_LABEL: Record<ShareActionsProps['kind'], string> = {
  invite: '카톡으로 초대 보내기',
  result: '카톡으로 결과 공유',
  generic: '다른 모임에 추천하기',
};

export function ShareActions({ kind, onShare, onSaveImage, onCopyLink, copied, className }: ShareActionsProps) {
  return (
    <div className={['gu-share', className ?? ''].filter(Boolean).join(' ')}>
      <GuButton variant="kakao" onClick={onShare} debounceMs={800}>
        {SHARE_LABEL[kind]}
      </GuButton>
      {(onSaveImage || onCopyLink) && (
        <div className="gu-share-row">
          {onSaveImage && (
            <GuButton variant="secondary" fullWidth={false} icon={<ImageDown aria-hidden size={18} />} onClick={onSaveImage}>
              이미지 저장
            </GuButton>
          )}
          {onCopyLink && (
            <GuButton variant="secondary" fullWidth={false} icon={<Link aria-hidden size={18} />} onClick={onCopyLink}>
              {copied ? '복사됨 ✓' : '링크 복사'}
            </GuButton>
          )}
        </div>
      )}
    </div>
  );
}
