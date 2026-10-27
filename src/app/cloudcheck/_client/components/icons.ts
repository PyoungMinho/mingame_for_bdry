/*!
 * Icons: door-closed, key-round, warehouse, cctv, file-text are adapted from Lucide (lucide.dev).
 *
 * ISC License
 * Copyright (c) 2026 Lucide Icons and Contributors
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is
 * hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE
 * INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
 * FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
 * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Some Lucide icons are derived from Feather (MIT License, Copyright (c) 2013-present Cole Bemis). This notice is
 * kept in case any icon above is among them: permission is granted free of charge, without restriction, provided
 * this copyright notice and permission notice are included in all copies or substantial portions of the software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */
// src/app/cloudcheck/_client/components/icons.ts — 아이콘 path 데이터(디자인 최종안 §4-6: UI 스펙 §2-2·§3-1·§3-2 path 그대로).
//  - 위 고지는 esbuild legalComments:'eof'로 번들 끝에 남는다(G5에서 grep). 자체 도형 10종(상태 5 + 창문 + external·chevron·back·close)은 고지 대상이 아니다.
//  - 상태 도형은 색을 갖지 않는다. 색·굵기는 base.css의 .cc-si 클래스가 준다(SVG 속성 fill·stroke·width·height는 쓰지 않는다 — 가드 G-D22).
import type { DoorId, Status } from "../../../../lib/cloudcheck/model/report";

/** 상태 도형: shape(채운 실루엣) + glyph(뚫린 글리프). 체크·물음표는 글자가 아니라 path다(금지어 '✓' 회피) */
export type StatusShape =
  | { readonly circle: true; readonly glyph: string }
  | { readonly circle: false; readonly d: string; readonly glyph: string };

export const STATUS_SHAPES: Readonly<Record<Status, StatusShape>> = {
  // ▲
  risk: { circle: false, d: "M12 4 21 20H3Z", glyph: "M12 10v4.2M12 17.4h.01" },
  // ◆
  caution: { circle: false, d: "M12 3.6 20.4 12 12 20.4 3.6 12Z", glyph: "M12 7.8v4.6M12 16.1h.01" },
  // ● (원)
  clear: { circle: true, glyph: "m7.8 12.2 2.8 2.8 5.6-5.8" },
  // ■ (둥근 사각 — 가드가 <rect>의 width·height 속성을 막으므로 같은 기하(x3.4 y3.4 17.2×17.2 rx3.2)를 path로 그린다)
  unknown: {
    circle: false,
    d: "M6.6 3.4h10.8a3.2 3.2 0 0 1 3.2 3.2v10.8a3.2 3.2 0 0 1-3.2 3.2H6.6a3.2 3.2 0 0 1-3.2-3.2V6.6a3.2 3.2 0 0 1 3.2-3.2Z",
    glyph: "M9.3 9.6a2.7 2.7 0 0 1 5.4 0c0 1.7-2.7 2.1-2.7 4M12 17.2h.01",
  },
  // ◌ (점선 원 — 점선은 CSS stroke-dasharray)
  na: { circle: true, glyph: "M8.4 12h7.2" },
};

/** 문 아이콘(단색 선). mfa·key·sto·log는 Lucide 유래, net은 자체 도형 */
export const DOOR_PATHS: Readonly<Record<DoorId, string>> = {
  mfa: "M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M2 21h20M9 12h.01",
  key: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4zM16.5 7.5h.01",
  net: "M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3ZM12 3v18M4 12h16",
  sto: "M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8zM6 13h12M6 17h12",
  log: "M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3zM2 19h3.76a2 2 0 0 0 1.8-1.1L9 15M2 21v-4M7 9h.01",
};

/** UI 아이콘 5종. file만 Lucide 유래 */
export const ICON_NAMES = ["external", "chevron", "file", "back", "close"] as const;
export type IconName = (typeof ICON_NAMES)[number];
export const ICON_PATHS: Readonly<Record<IconName, string>> = {
  external: "M7 17 17 7M9 7h8v8",
  chevron: "M6.5 9.5 12 15l5.5-5.5",
  file: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8",
  back: "M19 12H6M11.5 6.5 6 12l5.5 5.5",
  close: "M7 7l10 10M17 7 7 17",
};
/** 기본 크기(UI 스펙 §3-2) */
export const ICON_DEFAULT_SIZE: Readonly<Record<IconName, 16 | 20 | 24>> = { external: 16, chevron: 20, file: 20, back: 16, close: 16 };
