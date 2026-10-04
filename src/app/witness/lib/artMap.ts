/**
 * 아트 매핑(디자인 §8-3 A5) — 기기 핫스팟 id → 로그 시트 스킨. 색만 바뀐다(구조·행 스타일 동일).
 *  hub      시안 앱 톤(또박이·태블릿) / panel 회청 시스템 패널(조명·월패드·공유기) / terminal 노트북(검은 배경 + 초록 글자)
 * 사건 데이터에 없는 기기는 panel.
 */
export type LogSkin = 'hub' | 'panel' | 'terminal';

const SKIN: Record<string, LogSkin> = {
  'L0.h3': 'hub',
  'L1.h1': 'hub',
  'L2.h1': 'panel',
  'L3.h1': 'panel',
  'L3.h2': 'panel',
  'L5.h3': 'terminal',
};

export function logSkinOf(hotspotId: string): LogSkin {
  return SKIN[hotspotId] ?? 'panel';
}

/** 'HH:MM' 또는 'HH:MM:SS' 로 시작하는 로그 행을 (시각, 메시지)로 쪼갠다. 아니면 시각 없음 */
export function splitLogRow(row: string): { time?: string; msg: string } {
  const m = /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.*)$/.exec(row);
  return m ? { time: m[1], msg: m[2] } : { msg: row };
}
