'use client';

/**
 * 홈(H): 게임임을 밝히는 안내 + 양식 3장 + 닉네임 + 경보 + [공유 문서 만들기] + 번호로 열기 + 최근 문서 + 연습.
 * 숨기기 없음(키 훅 안 씀), 표준 Tab 이동. 안내 상자는 숨기지 않는다.
 */
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { INDUSTRIES, NICKNAME_MAX, type IndustryId } from '@/lib/monthly-close/constants';
import { COMMON_PACK, INDUSTRY_PACKS, statusText } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import { ROOM_CODE_RE } from '@/lib/monthly-close/protocol';
import { healthIsDown, mcApi } from '@/lib/monthly-close/client/api';
import {
  addRecentDoc, defaultNickname, markFreshRoom, getLastIndustry, getRecentDocs, getSavedNickname, isPracticeDone, setLastIndustry, setSavedNickname, type RecentDoc,
} from '@/lib/monthly-close/client/identity';
import { Button, Checkbox, RadioRow, TextInput } from '../_components/form/controls';
import { McIcon } from '../_components/sheet/McIcon';

export function HomeRules({ compact }: { compact?: boolean }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 20, fontSize: compact ? 'var(--mc-fs-small)' : 'var(--mc-fs-base)', lineHeight: 1.6 }}>
      {UI.home.rules.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ol>
  );
}

const panel = { background: 'var(--mc-bg)', border: '1px solid var(--mc-line)', borderRadius: 4, padding: 16 } as const;

export function Home() {
  const router = useRouter();
  const [nick, setNick] = useState('');
  const [industry, setIndustry] = useState<IndustryId>(0);
  const [alarmOn, setAlarmOn] = useState(true);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [down, setDown] = useState(false);
  const [err, setErr] = useState('');
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const [practiceDone, setPracticeDone] = useState(true);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNick(getSavedNickname() ?? defaultNickname());
    setIndustry(getLastIndustry());
    setPracticeDone(isPracticeDone());
    setNow(Date.now());
    setRecent(getRecentDocs(Date.now()));
    void mcApi.health().then((r) => setDown(healthIsDown(r)));
  }, []);

  const create = async () => {
    const name = Array.from(nick.trim()).slice(0, NICKNAME_MAX).join('');
    if (!name || busy) return;
    setBusy(true);
    setErr('');
    setSavedNickname(name);
    setLastIndustry(industry);
    const r = await mcApi.createRoom({ nickname: name, industry, alarmOn });
    if (r.ok) {
      addRecentDoc({ code: r.code, industry, at: Date.now() });
      markFreshRoom(r.code);
      router.push(`/monthly-close/${r.code}`);
      return;
    }
    setBusy(false);
    if (r.error === 'SERVICE_DOWN' || r.error === 'CAPACITY') setDown(true);
    setErr(r.error === 'RATE_LIMITED' ? statusText('rate') : COMMON_PACK.banners.serverDown);
  };

  const codeOk = ROOM_CODE_RE.test(code);
  const open = () => codeOk && router.push(`/monthly-close/${code}`);

  return (
    <main className="mc-home">
      <header style={{ height: 48, display: 'flex', alignItems: 'center', gap: 8 }}>
        <McIcon className="mc-topbar__icon" />
        <h1 style={{ margin: 0, fontSize: 'var(--mc-fs-home)', fontWeight: 600 }}>{UI.appName}</h1>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-sub)' }}>{UI.home.beta}</span>
      </header>
      <p style={{ margin: '8px 0 24px', color: 'var(--mc-text-sub)' }}>{UI.home.tagline}</p>

      {down ? (
        <div role="alert" style={{ ...panel, marginBottom: 16 }}>
          {COMMON_PACK.banners.serverDown}
        </div>
      ) : null}

      {/* 한 겹 격자: PC는 왼쪽 열(새 문서·번호·최근·연습) + 오른쪽 안내, 720px 미만은 1단(DOM 순서 = 새 문서 → 안내 → 번호 → 최근 → 연습).
          디자인 리뷰 M3: 인라인 2단이 360px에서도 그대로라 안내 상자가 새 문서 칸을 덮었다. */}
      <div className="mc-home__grid">
        <section style={{ ...panel, display: 'grid', gap: 12 }} aria-label={UI.home.newDocTitle}>
          <h2 style={{ margin: 0, fontSize: 'var(--mc-fs-dialog)' }}>{UI.home.newDocTitle}</h2>
          <label style={{ display: 'grid', gap: 4 }}>
            {UI.home.nickname} {UI.home.nicknameHint}
            <TextInput value={nick} maxLength={NICKNAME_MAX} onChange={(e) => setNick(e.target.value)} />
          </label>
          <RadioRow
            label={UI.home.formsTitle}
            value={String(industry) as '0' | '1' | '2'}
            onChange={(v) => setIndustry(Number(v) as IndustryId)}
            options={INDUSTRIES.map((k, i) => ({ value: String(i) as '0' | '1' | '2', label: INDUSTRY_PACKS[k].formName }))}
          />
          <Checkbox checked={alarmOn} onChange={setAlarmOn}>
            {UI.home.alarmCheck}
          </Checkbox>
          <div style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-faint)' }}>{UI.home.alarmCheckSub}</div>
          <div>
            <Button size="lg" onClick={create} disabled={busy || down || !nick.trim()}>
              {UI.home.create}
            </Button>
          </div>
          {err ? <div className="mc-field-error">{err}</div> : null}
        </section>

        <aside className="mc-home__notice" style={{ ...panel, borderLeft: '4px solid var(--mc-accent)', display: 'grid', gap: 8 }} aria-label={UI.home.noticeTitle}>
          <h2 style={{ margin: 0, fontSize: 'var(--mc-fs-dialog)' }}>{UI.home.noticeLead}</h2>
          <HomeRules />
          {UI.home.notes.map((n) => (
            <div key={n} style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-faint)' }}>
              ※ {n}
            </div>
          ))}
          <div style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-faint)' }}>{COMMON_PACK.legal}</div>
        </aside>

        <section style={{ ...panel, display: 'grid', gap: 8 }} aria-label={UI.home.openByNumberTitle}>
          <h2 style={{ margin: 0, fontSize: 'var(--mc-fs-dialog)' }}>{UI.home.openByNumberTitle}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextInput
              inputMode="numeric"
              maxLength={5}
              style={{ width: 160 }}
              value={code}
              aria-label={UI.home.openByNumberTitle}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && open()}
            />
            <Button variant="secondary" disabled={!codeOk || down} onClick={open}>
              {UI.home.open}
            </Button>
          </div>
          {code.length > 0 && !codeOk ? <div className="mc-field-error">{statusText('codeInvalid')}</div> : null}
        </section>

        <section style={{ ...panel }} aria-label={UI.home.recentTitle}>
          <h2 style={{ margin: '0 0 8px', fontSize: 'var(--mc-fs-dialog)' }}>{UI.home.recentTitle}</h2>
          {recent.length === 0 ? (
            <div style={{ color: 'var(--mc-text-faint)' }}>{UI.home.recentEmpty}</div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {recent.map((d) => (
                <li key={d.code} style={{ display: 'flex', gap: 8, height: 36, alignItems: 'center' }}>
                  <Button variant="text" onClick={() => router.push(`/monthly-close/${d.code}`)}>
                    {INDUSTRY_PACKS[INDUSTRIES[d.industry]].formName} {d.code}
                  </Button>
                  <span style={{ color: 'var(--mc-text-faint)' }}>{UI.home.recentWhen(Math.floor((now - d.at) / 60000))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div>
          <Button variant={practiceDone ? 'secondary' : 'primary'} size={practiceDone ? 'md' : 'lg'} onClick={() => router.push('/monthly-close/practice')}>
            {UI.home.practice}
          </Button>
        </div>
      </div>
    </main>
  );
}
