// 오후의 패 — 4색 슈트 SVG 심볼 정의 (레이아웃에서 1회 렌더, 모든 화면이 <use>로 참조).
export default function SuitDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <symbol id="d-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.5" y2="12" />
            <line x1="5.3" y1="5.3" x2="7" y2="7" /><line x1="17" y1="17" x2="18.7" y2="18.7" />
            <line x1="18.7" y1="5.3" x2="17" y2="7" /><line x1="7" y1="17" x2="5.3" y2="18.7" />
          </g>
        </symbol>
        <symbol id="d-moon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" fill="currentColor" /></symbol>
        <symbol id="d-star" viewBox="0 0 24 24"><path d="M12 2l2.6 5.9 6.4.6-4.85 4.25 1.45 6.25L12 16.9 6 19l1.45-6.25L2.6 8.5l6.4-.6z" fill="currentColor" /></symbol>
        <symbol id="d-cloud" viewBox="0 0 24 24"><path d="M7.2 18.5h9.6a4.1 4.1 0 0 0 .5-8.18A6.1 6.1 0 0 0 5.6 9.2 3.6 3.6 0 0 0 7.2 18.5z" fill="currentColor" /></symbol>
      </defs>
    </svg>
  );
}
