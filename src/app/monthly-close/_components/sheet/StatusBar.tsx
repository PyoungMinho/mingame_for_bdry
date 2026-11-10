export interface StatusBarProps {
  /** 왼쪽 문장 (≤28자). 오류성 문장도 색을 바꾸지 않는다 */
  message: string;
  /** 오른쪽 "회차 N · 100%" / "100%" */
  right: string;
}

export function StatusBar({ message, right }: StatusBarProps) {
  return (
    <footer className="mc-status">
      <span className="mc-status__msg" role="status" aria-live="polite" data-testid="mc-status">
        {message}
      </span>
      <span className="mc-status__right">{right}</span>
    </footer>
  );
}
