'use client';

/**
 * 현장 보기(원고 10장 · UX 스펙 gung-compact-scene-spec.md §1) — 다 같이 보는 장소 그림 화면.
 *
 *  - 장소 그림 위 물건(핫스팟)을 누르면 관찰 한 줄이 크게 뜬다. 모두가 같은 줄을 본다(공용).
 *  - **역할 무관**: 이 파일은 `@/lib/gung/scene`(types 만 import 하는 순수 모듈)·`types`·`guide-data`(상수) 만 쓴다.
 *    assign·seal·deck·getSheet·getClue 를 import 하지 않으므로 인원·자리·역할에 따라 화면이 달라질 수 없다(스펙 S5).
 *    방 코드는 '본 물건' 기록을 판마다 나누는 데만 쓴다(화면에 그리지 않는다).
 *  - **라운드 잠금**: 줄·물건은 scenesFor(c, upTo) 가 내려준 것만 그린다 — fromRound > upTo 줄의 글자는 DOM 어디에도 없다.
 *    그림의 R2 겉모습(연잎 위 하얀 것 등)도 round ≥ 2 에서만 그린다.
 *  - 「새」: 이번 조사에 새 줄이 열린 물건(R2·R3). 열어 보면 사라지고 ✓(본 물건)가 붙는다.
 *  - 본 물건 기록: localStorage `gu:scene:v1`(12시간, 다른 방 코드면 버림, 저장소가 막히면 메모리). 게임 저장 `gu:game:v1` 은
 *    읽지도 쓰지도 않는다.
 *  - 배치: 기본은 폰 세로 한 줄(장소 넘기기 ‹ › → 그림 → 관찰 카드 → 이번 조사 새 관찰). `wide` 면 900px 이상에서
 *    그림 | 카드 두 단 + 장소 탭(큰 화면 모드 /gung/scene).
 *  - 통합(프론트팀장): `map` 을 주면 가운데 장소 이름이 단추가 되어 궁 배치도(궁 전체 한 장)를 펼친다 — 배치도의 장소를 누르면
 *    그 현장으로 간다(배치도 데이터는 부르는 쪽이 넘긴다: 이 파일은 case-extras(assign 의존)를 import 하지 않는다).
 *  - 방장 무대는 타이머 때문에 1초마다 다시 그려진다 → 컴포넌트는 memo, 그림 SVG 는 (그림·라운드·idScope) 로 memo.
 */
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { GungCase, PlaceId } from '@/lib/gung/types';
import {
  newObservations,
  observationSeenKey,
  sceneRound,
  scenesFor,
  type NewObservation,
  type SceneObject,
  type SceneView as SceneViewData,
} from '@/lib/gung/scene';
import { GUIDE } from '@/lib/gung/guide-data';
import { sceneArt, SceneFallbackArt } from '../components/scenes';
import { PalaceMap, type PalaceMapProps } from '../components/PalaceMap';

/** 현장 배치도 패널에 그리는 지도 — 궁 전체 한 장(동궁전 확대도는 현장 그림이 대신한다) */
const SCENE_MAP_KEY = 'palace';

// ─────────────────────────────── 본 물건 기록(gu:scene:v1) ───────────────────────────────

export const SCENE_STORE_KEY = 'gu:scene:v1';
export const SCENE_STORE_TTL_MS = 12 * 60 * 60 * 1000;
const SEEN_RE = /^[A-Za-z0-9-]{1,40}@[123]$/;
const CODE_RE = /^[2-9A-HJKMNP-Z]{4}[4-6]$/;
const MAX_SEEN = 200;

export interface SceneStoreData {
  v: 1;
  /** 방 코드(없으면 null — 큰 화면을 코드 없이 연 경우) */
  code: string | null;
  /** 마지막으로 쓴 시각(ms) */
  at: number;
  /** 본 물건 seenKey 목록 `OB-DG1@3` */
  seen: string[];
  /** 큰 화면: 지금 보는 조사(1..3) */
  round: 1 | 2 | 3;
  /** 큰 화면: 확인을 거쳐 연 가장 높은 조사(1..3) — ②③ 확인은 처음 한 번만 */
  opened: 1 | 2 | 3;
}

let memoryStore: SceneStoreData | null = null;

function asRound(v: unknown): 1 | 2 | 3 | null {
  return v === 1 || v === 2 || v === 3 ? v : null;
}

/** 화이트리스트 파서 — 모양이 하나라도 어긋나면 null(깨진 기록은 버린다) */
export function parseSceneStore(raw: string | null): SceneStoreData | null {
  if (!raw) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const d = o as Record<string, unknown>;
  if (d.v !== 1 || typeof d.at !== 'number' || !Number.isFinite(d.at) || !Array.isArray(d.seen)) return null;
  const code = d.code === null ? null : typeof d.code === 'string' && CODE_RE.test(d.code) ? d.code : undefined;
  const round = asRound(d.round);
  const opened = asRound(d.opened);
  if (code === undefined || !round || !opened) return null;
  const seen = d.seen.filter((s): s is string => typeof s === 'string' && SEEN_RE.test(s)).slice(-MAX_SEEN);
  return { v: 1, code, at: d.at, seen, round, opened };
}

function emptyStore(code: string | null, now: number): SceneStoreData {
  return { v: 1, code, at: now, seen: [], round: 1, opened: 1 };
}

/** 지금 기기에 남은 기록 — 12시간 지났거나 다른 방 코드면 새것 */
export function readSceneStore(code: string | null, now = Date.now()): SceneStoreData {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SCENE_STORE_KEY);
  } catch {
    raw = null;
  }
  const d = parseSceneStore(raw) ?? memoryStore;
  if (!d || now - d.at > SCENE_STORE_TTL_MS || d.at > now + 60_000) return emptyStore(code, now);
  // QA6-01: 기록은 그 방 코드(코드 없음도 하나의 '판')에만 — 코드 없이 조사 3 까지 연 큰 화면 기록을 새 판 코드가 이어받으면
  // ②③ 확인 없이 미래 관찰이 첫 화면에 뜬다(반대 방향도 같다). 코드가 하나라도 다르면 새 기록으로 시작한다.
  if ((code ?? null) !== (d.code ?? null)) return emptyStore(code, now);
  return d;
}

function writeSceneStore(d: SceneStoreData): void {
  memoryStore = d;
  try {
    window.localStorage.setItem(SCENE_STORE_KEY, JSON.stringify(d));
  } catch {
    /* 저장소가 막혀도 메모리로 이번 화면은 유지 */
  }
}

/** 새 판·처음으로·새 방에서 부른다(notes.clear 와 같은 자리) */
export function clearSceneStore(): void {
  memoryStore = null;
  try {
    window.localStorage.removeItem(SCENE_STORE_KEY);
  } catch {
    /* noop */
  }
}

export interface SceneStoreApi {
  /** 마운트 뒤 기록을 읽었는가(SSR·첫 프레임엔 false) */
  ready: boolean;
  seen: ReadonlySet<string>;
  round: 1 | 2 | 3;
  opened: 1 | 2 | 3;
  markSeen: (seenKey: string) => void;
  setRound: (round: 1 | 2 | 3) => void;
  clearSeen: () => void;
}

/** 본 물건·큰 화면 라운드 기록 훅 — 저장 실패에도 화면은 돈다 */
export function useSceneStore(code: string | null, enabled = true): SceneStoreApi {
  const [data, setData] = useState<SceneStoreData | null>(null);
  useEffect(() => {
    if (enabled) setData(readSceneStore(code));
  }, [code, enabled]);
  const update = useCallback(
    (fn: (d: SceneStoreData) => SceneStoreData) => {
      setData((prev) => {
        const base = prev ?? readSceneStore(code);
        const next = { ...fn(base), at: Date.now() };
        writeSceneStore(next);
        return next;
      });
    },
    [code],
  );
  const seen = useMemo(() => new Set(data?.seen ?? []), [data]);
  return {
    ready: data !== null,
    seen,
    round: data?.round ?? 1,
    opened: data?.opened ?? 1,
    markSeen: useCallback(
      (key: string) => update((d) => (d.seen.includes(key) ? d : { ...d, seen: [...d.seen, key].slice(-MAX_SEEN) })),
      [update],
    ),
    setRound: useCallback(
      (round: 1 | 2 | 3) => update((d) => ({ ...d, round, opened: (Math.max(d.opened, round) as 1 | 2 | 3) })),
      [update],
    ),
    clearSeen: useCallback(() => update((d) => ({ ...d, seen: [] })), [update]),
  };
}

// ─────────────────────────────── 화면 ───────────────────────────────

export interface SceneViewProps {
  c: GungCase;
  /** 이 기기가 들어선 조사 라운드(reachedRound(phase), 0..3). 0 이면 「조사 전」 */
  upTo: number;
  /** 방 코드 — 본 물건 기록을 판마다 나눈다(화면엔 안 그림). 없으면 null */
  code?: string | null;
  /** 큰 화면 모드(/gung/scene) — 900px 이상에서 그림 | 카드 두 단 */
  wide?: boolean;
  /** 처음 펼칠 장소(기본: 그 라운드 첫 장소 = 동궁전) */
  initialPlaceId?: PlaceId;
  /**
   * 조사 2·3 에서 처음 펼칠 장소를 「새」 관찰이 있는 첫 장소로(initialPlaceId 가 없을 때). 방장 무대·현장 시트용 —
   * 조사 2 는 동궁전에 새 줄이 없어 첫 화면이 '볼 것 없는 그림'이 되던 것을 막는다. 장소 순서는 그대로(‹ › 로 동궁전).
   */
  startAtNew?: boolean;
  /** 처음부터 열어 둘 물건 id(그 장소에 있을 때만) */
  initialOpenId?: string;
  /**
   * 그림 SVG id 고정 범위 — 주면 렌더마다 DOM 이 같다(역할 무관 DOM 비교 테스트). 한 화면에 SceneView 가 둘이면 서로 다른 값.
   * 예: 방장 진행 탭 'host', 현장 시트 'sheet', 큰 화면 'big'. 없으면 useId.
   */
  idScope?: string;
  /** 바깥에서 기록을 쥐고 있으면 넘긴다(큰 화면 페이지가 라운드 칩과 같은 기록을 쓰도록) */
  store?: SceneStoreApi;
  /** 궁 배치도(공개 부록) — 주면 장소 이름을 눌러 배치도를 펼치고, 배치도의 장소를 눌러 그 현장으로 간다 */
  map?: Pick<PalaceMapProps, 'maps' | 'placeIcons'>;
  className?: string;
}

const SPEAKER_RE = /^([가-힣 ]{1,6}):\s*(.+)$/;

/** 「의관: …」 꼴이면 말한 이를 굵게 */
function LineText({ text }: { text: string }) {
  const m = SPEAKER_RE.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <b className="gu-scene-who">{m[1]}</b> {m[2]}
    </>
  );
}

function labelOf(view: SceneViewData, o: { id: string; name: string }): string {
  return sceneArt(view.art)?.labels[o.id] ?? o.name;
}

function SceneViewImpl({ c, upTo, code = null, wide = false, initialPlaceId, startAtNew = false, initialOpenId, idScope, store: outerStore, map, className }: SceneViewProps) {
  const round = sceneRound(upTo);
  const scenes = useMemo(() => scenesFor(c, round), [c, round]);
  // placeId 가 null 이면 기본 장소 — 첫 장소, 또는(startAtNew) 「새」가 있는 첫 장소. 라운드가 바뀌면 다시 계산된다
  const defaultIdx = useMemo(() => {
    if (!startAtNew || round < 2) return 0;
    const i = scenes.findIndex((v) => v.newCount > 0);
    return i >= 0 ? i : 0;
  }, [scenes, startAtNew, round]);
  const fresh = useMemo(() => newObservations(c, round), [c, round]);
  const innerStore = useSceneStore(code, !outerStore);
  const store = outerStore ?? innerStore;
  const [placeId, setPlaceId] = useState<PlaceId | null>(initialPlaceId ?? null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [mapOpen, setMapOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 라운드가 바뀌면 열린 카드를 닫는다(줄이 달라진다). 장소는 그대로 둔다. 첫 렌더는 건너뛴다(initialOpenId 유지).
  const roundRef = useRef(round);
  useEffect(() => {
    if (roundRef.current === round) return;
    roundRef.current = round;
    setOpenId(null);
  }, [round]);

  const found = scenes.findIndex((s) => s.placeId === placeId);
  const idx = found >= 0 ? found : defaultIdx;
  const view = scenes[idx] ?? null;
  const artDef = view ? sceneArt(view.art) : undefined;
  const ArtComp = artDef?.Art ?? SceneFallbackArt;
  // 그림 SVG 는 그림·라운드·idScope 가 같으면 다시 그리지 않는다(방장 무대의 1초 타이머 재렌더)
  const artNode = useMemo(() => <ArtComp round={round || 1} idScope={idScope} />, [ArtComp, round, idScope]);
  const mapNode = useMemo(() => {
    if (!map) return null;
    const maps = map.maps.filter((m) => m.key === SCENE_MAP_KEY);
    return maps.length ? maps : map.maps.slice(0, 1);
  }, [map]);

  const openObject = useCallback(
    (o: SceneObject, revealCard = true) => {
      setOpenId(o.id);
      store.markSeen(o.seenKey);
      // 폰: 그림 아래 카드가 액션바에 가려 있으면 보일 만큼만 올린다(scroll-margin 이 액션바 높이를 비운다). 두 단(큰 화면)에선 움직임 없음
      if (revealCard && typeof window !== 'undefined') {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        window.requestAnimationFrame?.(() => cardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }));
      }
    },
    [store],
  );

  if (!round || !view) {
    return (
      <section className={['gu-scene', 'gu-scene--empty', className ?? ''].filter(Boolean).join(' ')} aria-label={GUIDE.sceneLabel}>
        <p className="gu-scene-emptytext">조사가 시작되면 현장이 열리오</p>
      </section>
    );
  }

  const art = artDef;
  const open = view.objects.find((o) => o.id === openId) ?? null;
  const openHasNew = Boolean(open && round >= 2 && open.lines.some((l) => l.isNew));
  const unseenNew = (v: SceneViewData) => v.objects.filter((o) => o.isNew && !store.seen.has(o.seenKey)).length;
  const seenCount = view.objects.filter((o) => store.seen.has(o.seenKey)).length;
  const freshUnseen = fresh.filter((f) => !store.seen.has(observationSeenKey(f.objectId, f.round))).length;

  const goPlace = (i: number) => {
    const n = scenes.length;
    setPlaceId(scenes[((i % n) + n) % n].placeId);
    setOpenId(null);
  };
  const goPlaceId = (pid: string) => {
    const i = scenes.findIndex((s) => s.placeId === pid);
    if (i < 0) return;
    goPlace(i);
    setMapOpen(false);
  };
  const jump = (f: NewObservation) => {
    const v = scenes.find((s) => s.placeId === f.placeId);
    const o = v?.objects.find((x) => x.id === f.objectId);
    if (!v || !o) return;
    setPlaceId(v.placeId);
    openObject(o, false);
    stageRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && (openId || mapOpen)) {
      e.stopPropagation();
      if (openId) setOpenId(null);
      else setMapOpen(false);
    }
  };
  const prev = scenes[(idx - 1 + scenes.length) % scenes.length];
  const next = scenes[(idx + 1) % scenes.length];
  const newHere = unseenNew(view);

  return (
    <section
      className={['gu-scene', wide ? 'gu-scene--wide' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-label={GUIDE.sceneLabel}
      data-round={round}
      onKeyDown={onKeyDown}
    >
      <div className="gu-scene-main">
        {scenes.length > 1 && (
          <div className="gu-scene-pager">
            <button type="button" className="gu-scene-pagebtn" aria-label={`이전 장소 ${prev.placeName}`} onClick={() => goPlace(idx - 1)}>
              <ChevronLeft size={28} aria-hidden />
            </button>
            {mapNode ? (
              <button
                type="button"
                className="gu-scene-pagecur gu-scene-pagecur--btn"
                aria-expanded={mapOpen}
                aria-label={`${view.placeName} · ${GUIDE.sceneMapToggle}`}
                onClick={() => setMapOpen((o) => !o)}
              >
                <span className="gu-scene-pagename gu-display">
                  {view.placeName}
                  <ChevronDown size={18} aria-hidden className="gu-scene-pagecaret" />
                </span>
                <span className="gu-scene-pagemeta" aria-live="polite">
                  {idx + 1}/{scenes.length} · 본 {seenCount}/{view.objects.length}
                  {newHere > 0 && <b className="gu-scene-pagenew"> · 새 {newHere}</b>}
                </span>
              </button>
            ) : (
              <p className="gu-scene-pagecur" aria-live="polite">
                <span className="gu-scene-pagename gu-display">{view.placeName}</span>
                <span className="gu-scene-pagemeta">
                  {idx + 1}/{scenes.length} · 본 {seenCount}/{view.objects.length}
                  {newHere > 0 && <b className="gu-scene-pagenew"> · 새 {newHere}</b>}
                </span>
              </p>
            )}
            <button type="button" className="gu-scene-pagebtn" aria-label={`다음 장소 ${next.placeName}`} onClick={() => goPlace(idx + 1)}>
              <ChevronRight size={28} aria-hidden />
            </button>
          </div>
        )}
        {wide && (
          <div className="gu-scene-tabs" role="group" aria-label="장소">
            {scenes.map((s, i) => {
              const n = unseenNew(s);
              return (
                <button key={s.placeId} type="button" className="gu-scene-tab" aria-pressed={i === idx} onClick={() => goPlace(i)}>
                  {s.placeName}
                  {n > 0 && <span className="gu-scene-tab-new" role="img" aria-label={`새 관찰 ${n}`} />}
                </button>
              );
            })}
          </div>
        )}
        {mapNode && mapOpen && map && (
          <div className="gu-scene-mappanel">
            <PalaceMap maps={mapNode} placeIcons={map.placeIcons} note={GUIDE.sceneMapHint} onPlace={goPlaceId} activePlace={view.placeId} className="gu-map--scene" />
          </div>
        )}
        <div className="gu-scene-stage" ref={stageRef}>
          <div className="gu-scene-canvas" data-place={view.placeId}>
            {artNode}
            {view.objects.map((o) => {
              const [x, y] = art?.anchors[o.id] ?? o.pos;
              const isSeen = store.seen.has(o.seenKey);
              const showNew = o.isNew && !isSeen;
              return (
                <button
                  key={o.id}
                  type="button"
                  className="gu-scene-spot"
                  style={{ left: `${x}%`, top: `${y}%`, '--x': x, '--y': y } as CSSProperties}
                  data-obj={o.id}
                  data-new={showNew ? '' : undefined}
                  data-seen={isSeen ? '' : undefined}
                  aria-pressed={o.id === openId}
                  aria-label={[o.name, showNew ? '새 관찰' : '', isSeen ? '본 물건' : ''].filter(Boolean).join(', ')}
                  onClick={() => openObject(o)}
                >
                  <span className="gu-scene-tag">
                    {showNew && (
                      <span className="gu-scene-tag-new" aria-hidden>
                        새
                      </span>
                    )}
                    <span className="gu-scene-tag-label">{labelOf(view, o)}</span>
                    {isSeen && (
                      <span className="gu-scene-tag-seen" aria-hidden>
                        ✓
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="gu-scene-side">
        <div className="gu-scene-card" ref={cardRef} role="region" aria-live="polite" aria-label="관찰" data-empty={open ? undefined : ''}>
          {open ? (
            <>
              <div className="gu-scene-card-head">
                <p className="gu-scene-card-place">{view.placeName}</p>
                <h3 className="gu-scene-card-name gu-display">{open.name}</h3>
                <button type="button" className="gu-scene-card-close" aria-label="관찰 닫기" onClick={() => setOpenId(null)}>
                  <X size={22} aria-hidden />
                </button>
              </div>
              <ul className="gu-scene-lines">
                {open.lines.map((l) => (
                  <li
                    key={l.fromRound}
                    className="gu-scene-line"
                    data-new={openHasNew && l.isNew ? '' : undefined}
                    data-old={openHasNew && !l.isNew ? '' : undefined}
                  >
                    {round >= 2 && <span className="gu-scene-line-round">{openHasNew && l.isNew ? `새 · 조사 ${l.fromRound}` : `조사 ${l.fromRound}`}</span>}
                    <p className="gu-scene-line-text">
                      <LineText text={l.text} />
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="gu-scene-card-hint">
              그림 속 물건을 누르시오
              {round >= 2 && fresh.length > 0 && <span className="gu-scene-card-subhint">새 = 이번 조사에 새로 보이는 것</span>}
            </p>
          )}
        </div>

        {fresh.length > 0 && (
          <section className="gu-scene-new" aria-label={GUIDE.sceneNewHead}>
            <p className="gu-scene-new-head">
              {GUIDE.sceneNewHead}
              {freshUnseen > 0 && <span className="gu-scene-new-count">안 본 것 {freshUnseen}</span>}
            </p>
            <ul className="gu-scene-new-list">
              {fresh.map((f) => {
                const seen = store.seen.has(observationSeenKey(f.objectId, f.round));
                const v = scenes.find((s) => s.placeId === f.placeId);
                return (
                  <li key={`${f.objectId}@${f.round}`}>
                    <button type="button" className="gu-scene-new-item" data-seen={seen ? '' : undefined} onClick={() => jump(f)}>
                      <span className="gu-scene-new-where">
                        {f.placeName} · {v ? labelOf(v, { id: f.objectId, name: f.name }) : f.name}
                        {seen && (
                          <span className="gu-scene-new-check" aria-label="본 물건">
                            ✓
                          </span>
                        )}
                      </span>
                      <span className="gu-scene-new-text">
                        <LineText text={f.text} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}

/** 방장 무대(1초 타이머 재렌더)에서 props 가 같으면 다시 그리지 않는다 — c·map 은 모듈 상수, upTo·code·idScope 는 원시값 */
export const SceneView = memo(SceneViewImpl);
