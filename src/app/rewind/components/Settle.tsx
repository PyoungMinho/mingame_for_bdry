'use client';

import { AlertTriangle, ArrowRight, FileWarning, Landmark } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ASSET_IDS, ASSETS, BUY_CAP_KRW } from '@/lib/rewind/contract';
import { formatKRW, type RunState } from '@/lib/rewind/engine';
import { access, lotSize, netWorth, priceOf, yearEndDate, type TradeReceipt } from '@/lib/rewind/market';
import type { AssetId, MarketData } from '@/lib/rewind/types';
import { Change, Money, ageIn } from './common';

type Trade = { asset: AssetId; side: 'buy'; krw: number } | { asset: AssetId; side: 'sell'; pct: number };

const BUY_STEPS = [0.1, 0.25, 0.5, 1];
const SELL_STEPS = [0.25, 0.5, 1];

function qtyText(asset: AssetId, q: number, year: number) {
  const u = ASSETS[asset].unit;
  const lot = lotSize(asset, yearEndDate(year));
  if (lot > 1) return `${Math.round((q / lot) * 100) / 100}${u}(지금 기준 ${Math.round(q).toLocaleString()}${u})`;
  if (asset === 'btc') return `${q < 1 ? q.toFixed(4) : q.toFixed(2)} ${u}`;
  if (asset === 'usd') return `${Math.round(q).toLocaleString()} ${u}`;
  if (q >= 100) return `${Math.floor(q).toLocaleString()}${u}`;
  return `${q.toFixed(q < 10 ? 2 : 1)}${u}`;
}

function receiptText(r: TradeReceipt, year: number) {
  if (!r.ok) return `체결 실패 — ${r.reason}`;
  const n = ASSETS[r.asset].name;
  if (r.side === 'buy') {
    const cost = r.asset === 'gold' && r.fee > 0 ? ` (부가세·마진 −${formatKRW(r.fee)})` : '';
    return `${n} ${qtyText(r.asset, r.qty, year)} 매수${cost}${r.loan ? ` (대출 ${formatKRW(r.loan)})` : ''}${r.capped ? ' — 시장 한도까지만 체결됐다' : ''}`;
  }
  return `${n} ${qtyText(r.asset, r.qty, year)} 매도 → ${formatKRW(r.gross - r.fee - r.tax)}`;
}

/** 연말 결산 — 그해 연말가로 평가하고 사고판다 */
export function Settle({
  state,
  data,
  lastTrade,
  onTrade,
  onRepay,
  onNext,
}: {
  state: RunState;
  data: MarketData;
  lastTrade: TradeReceipt | null;
  onTrade: (t: Trade) => void;
  onRepay: () => void;
  onNext: (year: number) => void;
}) {
  const s = state.settling!;
  const headRef = useRef<HTMLHeadingElement>(null);
  // 결산 화면이 뜨자마자 들어온 두 번째 클릭(더블클릭)이 다음 해로 넘기지 않게 잠깐 잠근다
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    headRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setArmed(true), 450);
    return () => window.clearTimeout(t);
  }, []);
  const year = s.year;
  const rep = s.report;
  const w = state.wallet;
  const nw = netWorth(w);
  const [open, setOpen] = useState<AssetId | null>(null);
  const ctx = { year, trust: state.stats.trust, flags: state.flags };
  const prevYear = data.years[year - 1];
  const rows = ASSET_IDS.filter((a) => priceOf(data, a, { year }) || w.qty[a] > 0);
  const last = state.pending.length <= 1;

  return (
    <section className="rw-settle" aria-label={`${year}년 연말 결산`}>
      <header className="rw-settle-head">
        <span className="rw-date rw-date-inline" aria-hidden>{`'${String(year).slice(2)} 12 31`}</span>
        <h1 ref={headRef} tabIndex={-1}>
          {year}년 결산
        </h1>
        <p className="rw-settle-age">
          {ageIn(year)}살 · {w.underParent ? '부모님 명의' : '내 명의'}
        </p>
        <p className="rw-settle-nw">
          <Money v={nw} /> <Change from={rep.netWorthBefore} to={nw} />
        </p>
      </header>

      <ul className="rw-settle-lines">
        {rep.interest > 0 && (
          <li>
            <Landmark aria-hidden /> 예금 이자 <b data-dir="up">+{formatKRW(rep.interest)}</b>
          </li>
        )}
        {rep.income > 0 && (
          <li>
            한 해 저축({w.income?.label ?? '저축'}) <b data-dir="up">+{formatKRW(rep.income)}</b>
          </li>
        )}
        {rep.debtInterest > 0 && (
          <li>
            대출 이자 <b data-dir="down">−{formatKRW(rep.debtInterest)}</b>
          </li>
        )}
        {rep.overseasTax > 0 && (
          <li>
            작년 해외주식 양도세 <b data-dir="down">−{formatKRW(rep.overseasTax)}</b>
          </li>
        )}
        {rep.forced?.length > 0 && (
          <li className="rw-settle-bad">
            <FileWarning aria-hidden /> 낼 현금이 모자라 {rep.forced.map((f) => ASSETS[f.asset].name).join('·')}을(를) 일부 팔았다.
          </li>
        )}
        {rep.susDelta > 0 && (
          <li className="rw-settle-warn">
            <AlertTriangle aria-hidden /> 너무 잘 벌었다 — 주변이 수상하게 본다 <b>수상함 +{rep.susDelta}</b>
          </li>
        )}
        {rep.secretSale && (
          <li className="rw-settle-bad">
            <FileWarning aria-hidden /> 부모님이 몰래 절반을 팔았다. 그 돈 중 {formatKRW(rep.secretSale.taken)}은 집안 빚으로 사라졌다.
          </li>
        )}
      </ul>

      {rep.audit && (
        <div className="rw-audit" role="alert">
          <p className="rw-audit-title">국세청 세무조사</p>
          {rep.audit.clean && rep.audit.found > 0 ? (
            <p>
              몰래 가져온 {formatKRW(rep.audit.found)}이 드러났다. 다행히 증여재산공제 한도 안이라 낼 세금은 없었다. 세무 대리 비용 <b>−{formatKRW(rep.audit.total)}</b>. 조사관이 서류를 덮으며 말한다. "다음부턴 신고하세요."
            </p>
          ) : rep.audit.clean ? (
            <p>
              뒤져도 나오는 게 없었다. 세무 대리 비용만 <b>−{formatKRW(rep.audit.total)}</b>. 조사관이 나가면서 한마디 한다. "운이 좋으시네요. 너무."
            </p>
          ) : (
            <>
              <p>몰래 가져온 {formatKRW(rep.audit.found)}이 걸렸다.</p>
              <dl>
                <div>
                  <dt>증여세</dt>
                  <dd>{formatKRW(rep.audit.tax)}</dd>
                </div>
                <div>
                  <dt>부정 무신고 가산세</dt>
                  <dd>{formatKRW(rep.audit.penalty)}</dd>
                </div>
                <div>
                  <dt>납부지연 가산세</dt>
                  <dd>{formatKRW(rep.audit.late)}</dd>
                </div>
                <div className="rw-audit-total">
                  <dt>추징 합계</dt>
                  <dd>−{formatKRW(rep.audit.total)}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      )}

      <div className="rw-book" aria-label="보유 자산과 연말 시세 — 종목을 누르면 사고팔 수 있다">
        <div className="rw-book-row rw-book-headrow" aria-hidden>
          <span>종목</span>
          <span>연말가</span>
          <span>보유</span>
        </div>
        <div className="rw-book-row">
          <span className="rw-book-name">
            현금·예금 <small>{data.years[year].depositRate}%</small>
          </span>
          <span />
          <span>
            <Money v={w.cash} />
            {w.debt > 0 && <small className="rw-debt">대출 {formatKRW(w.debt)}</small>}
          </span>
        </div>
        {w.debt > 0 && w.cash > 0 && (
          <div className="rw-trade-row rw-repay">
            <span>대출</span>
            <button type="button" className="rw-pill" data-side="sell" onClick={onRepay}>
              남은 현금으로 {formatKRW(Math.min(w.cash, w.debt))} 갚기
            </button>
          </div>
        )}
        {rows.map((a) => {
          const p = priceOf(data, a, { year });
          const prev = prevYear?.prices[a]?.krw ?? 0;
          const acc = access(data, ctx, a);
          const held = w.qty[a] > 0;
          return (
            <div key={a} className="rw-book-item" data-open={open === a ? '' : undefined}>
              <button type="button" className="rw-book-row" onClick={() => setOpen(open === a ? null : a)} aria-expanded={open === a} aria-controls={`rw-trade-${a}`}>
                <span className="rw-book-name">
                  {ASSETS[a].name}
                  {p?.estimated && <small title="원천 원화 시세가 없어 달러×환율로 환산">추정</small>}
                </span>
                <span className="rw-book-price">
                  {p ? formatKRW(p.krw) : '—'}
                  {p && prev > 0 && <Change from={prev} to={p.krw} />}
                </span>
                <span>{held ? <Money v={w.qty[a] * w.mark[a]} /> : <span className="rw-muted">—</span>}</span>
              </button>
              {open === a && (
                <div className="rw-trade" id={`rw-trade-${a}`}>
                  {held && <p className="rw-trade-held">보유 {qtyText(a, w.qty[a], year)}</p>}
                  {p && lotSize(a, yearEndDate(year)) > 1 && (
                    <p className="rw-trade-note">
                      {year}년엔 1주 = {formatKRW(p.krw * lotSize(a, yearEndDate(year)))} (분할 전이라 1주 단위로만 산다)
                    </p>
                  )}
                  {a === 'gold' && year < data.rules.goldRetailCostUntil && (
                    <p className="rw-trade-note">
                      {data.rules.goldRetailCostUntil - 1}년까지는 금을 살 때 부가세·마진 {Math.round(data.rules.goldRetailCost * 100)}%가 붙는다(평가는 시세 그대로)
                    </p>
                  )}
                  {acc.ok ? (
                    <>
                      {w.cash > 0 && (
                        <div className="rw-trade-row">
                          <span>{a === 'apt' ? '한 채 매수' : '매수'}</span>
                          {a === 'apt' ? (
                            <button type="button" className="rw-pill" data-side="buy" onClick={() => onTrade({ asset: a, side: 'buy', krw: 0 })}>
                              대출 끼고 1채
                            </button>
                          ) : (
                            BUY_STEPS.map((f) => (
                              <button key={f} type="button" className="rw-pill" data-side="buy" onClick={() => onTrade({ asset: a, side: 'buy', krw: Math.floor(w.cash * f) })}>
                                {f === 1 ? '현금 전부' : `${f * 100}%`}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {held && (
                        <div className="rw-trade-row">
                          <span>매도</span>
                          {(a === 'apt' ? [1] : SELL_STEPS).map((f) => (
                            <button key={f} type="button" className="rw-pill" data-side="sell" onClick={() => onTrade({ asset: a, side: 'sell', pct: f })}>
                              {f === 1 ? '전량' : `${f * 100}%`}
                            </button>
                          ))}
                        </div>
                      )}
                      {acc.via === 'parent' && <p className="rw-trade-note">부모님 명의로 거래된다</p>}
                    </>
                  ) : (
                    <p className="rw-trade-blocked">{acc.reason}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="rw-fine rw-book-note">
        그해 마지막 거래일 종가(실제 시세). 삼성전자는 2018년 50:1 액면분할을 반영한 가격, 해외 자산은 그해 연말 환율로 환산했다. 한 자산을 한 해에 살 수 있는 돈은 {formatKRW(BUY_CAP_KRW)}까지다(게임 규칙).
      </p>

      <p className="rw-receipt" role="status" aria-live="polite">
        {lastTrade ? receiptText(lastTrade, year) : ' '}
      </p>

      <button type="button" className="rw-next" onClick={() => onNext(year)} disabled={!armed}>
        {last && state.toEnd ? '2026년, 마지막 정산으로' : `${year + 1}년으로`}
        <ArrowRight aria-hidden />
      </button>
    </section>
  );
}
