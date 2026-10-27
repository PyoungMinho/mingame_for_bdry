// src/lib/cloudcheck/engine/time.ts — 현재 시각과 파일의 수집 시각 차이로 만드는 알림 (judge 밖의 순수 함수)
//  - 오래된 사진: 24시간 초과(stale) · 7일 초과(very-stale). 시계 차이: 수집 시각이 기기 시계보다 5분 넘게 늦음. 오래된 안내: lastVerified + 180일 초과.
//  - 체험 모드에서는 빈 배열(체험 데이터의 기준 시각은 고정이다).
//  - now는 UI가 읽어 넘기는 한 곳의 값이다. 이 모듈은 Date.now를 부르지 않는다(INV-9).
import type { IsoUtc, Report, RuleId, TimeNotice } from "../model/report";
import { RULES } from "../rules/registry";
import { DAY_MS, FUTURE_SKEW_MINUTES, GUIDANCE_STALE_DAYS, HOUR_MS, MINUTE_MS, SNAPSHOT_STALE_HOURS, SNAPSHOT_VERY_STALE_DAYS } from "../rules/params";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]00:00)$/;

/** 엄격한 UTC 시각 파서(Date.parse 금지). 달력에 없는 날짜·범위 밖 값은 null */
export function parseIsoMs(s: string): number | null {
  const m = ISO_RE.exec(s);
  if (m === null) return null;
  const [y, mo, d, h, mi, se] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi, se);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

/** YYYY-MM-DD → UTC 일 번호 */
export function dayNumber(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m === null) return null;
  const ms = parseIsoMs(`${date}T00:00:00Z`);
  return ms === null ? null : Math.floor(ms / DAY_MS);
}

export function timeNotices(report: Report, now: IsoUtc): TimeNotice[] {
  try {
    if (report.mode.kind === "demo") return [];
    const nowMs = parseIsoMs(now);
    if (nowMs === null) return [];
    const out: TimeNotice[] = [];
    const asOf = report.collection.asOf;
    if (asOf !== null) {
      const at = parseIsoMs(asOf.at);
      if (at !== null) {
        const ahead = at - nowMs;
        if (ahead > FUTURE_SKEW_MINUTES * MINUTE_MS) {
          out.push({ kind: "future-timestamp", aheadMinutes: Math.floor(ahead / MINUTE_MS) });
        } else {
          const age = nowMs - at;
          if (age > SNAPSHOT_VERY_STALE_DAYS * DAY_MS) out.push({ kind: "snapshot-age", level: "very-stale", ageHours: Math.floor(age / HOUR_MS) });
          else if (age > SNAPSHOT_STALE_HOURS * HOUR_MS) out.push({ kind: "snapshot-age", level: "stale", ageHours: Math.floor(age / HOUR_MS) });
        }
      }
    }
    const today = Math.floor(nowMs / DAY_MS);
    const present = new Set<RuleId>(report.doors.flatMap((d) => d.rules.map((r) => r.ruleId)));
    const stale = RULES.filter((m) => present.has(m.spec.ruleId)).filter((m) => {
      const last = dayNumber(m.spec.lastVerified);
      return last !== null && today - last > GUIDANCE_STALE_DAYS;
    }).sort((a, b) => a.spec.priority - b.spec.priority).map((m) => m.spec.ruleId);
    if (stale.length > 0) out.push({ kind: "guidance-stale", ruleIds: stale });
    return out;
  } catch {
    return [];
  }
}
