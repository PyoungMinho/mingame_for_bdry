'use client';

import { ENDING_IDS, ENDINGS_META } from '@/lib/zombie/contract';
import { ENDINGS } from '@/lib/zombie/content';
import type { EndingId, EndingKind } from '@/lib/zombie/types';
import type { FoundEndings } from '../lib/useZombieGame';

export const KIND_LABEL: Record<EndingKind, string> = {
  survived: '생존',
  dead: '사망',
  turned: '감염',
  special: '특별',
};

/** 엔딩 도감 — 발견한 엔딩만 제목이 보인다 */
export function EndingGallery({ found, highlight, inDialog }: { found: FoundEndings; highlight?: EndingId; inDialog?: boolean }) {
  const n = ENDING_IDS.filter((id) => found[id]).length;
  return (
    <section className="zb-gallery" aria-label={inDialog ? undefined : '엔딩 도감'}>
      <h2 className="zb-panel-h">
        {inDialog ? '발견한 엔딩' : '엔딩 도감'} <b>{n}</b> / {ENDING_IDS.length}
      </h2>
      <ol className="zb-gallery-grid">
        {ENDING_IDS.map((id, i) => {
          const f = found[id];
          const kind = ENDINGS_META[id].kind;
          return (
            <li key={id} data-found={f ? '' : undefined} data-kind={kind} data-now={id === highlight ? '' : undefined}>
              <span className="zb-gallery-no">{String(i + 1).padStart(2, '0')}</span>
              {f ? (
                <>
                  <span className="zb-gallery-title">{ENDINGS[id]?.title ?? id}</span>
                  <span className="zb-gallery-kind">
                    {KIND_LABEL[kind]}
                    {f.count > 1 ? ` · ${f.count}회` : ''}
                  </span>
                </>
              ) : (
                <>
                  <span className="zb-gallery-title">???</span>
                  <span className="zb-gallery-kind">미발견</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
