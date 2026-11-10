#!/usr/bin/env node
/**
 * 월마감(/monthly-close) 배포 직후 연기 시험 — 방향서 §10 STEP 7 "라이브 검증" ②③④.
 *
 *   node scripts/monthly-close-smoke.mjs <대상 URL>
 *   예) node scripts/monthly-close-smoke.mjs https://project-orsrw.vercel.app
 *       node scripts/monthly-close-smoke.mjs http://localhost:3000      (로컬 MemoryStore)
 *
 * 하는 일(테스트 표시 비밀키 2개):
 *   health(db ok) → A 방 만들기 → B 입장 → 둘 다 배치 완료 → 차례인 사람 발사 1회 → A 기권 → 결과 확인
 *   모든 응답에서: 캐시 금지·noindex 헤더, 금지 키(대전 중), 비밀키 원문·해시 미노출, 상대 배 미노출(종료 전)
 * 선택(④): 환경변수 NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY가 있으면 익명 키로 mc_ 테이블 4개를
 *   직접 조회해 거부(401/403) 또는 빈 결과인지 본다. 둘 다 공개 값이라 비밀이 아니다. 서비스 키는 쓰지 않는다.
 *
 * 운영 기록: 모든 요청에 x-mc-test: 1 → 방·매치·이벤트가 is_test = true로 남아 게이트 SQL에서 빠진다.
 *   방 1개는 30분 뒤 만료되고 다음 방 만들기 때 정리된다(그동안 활성 방 200개 중 1개를 쓴다).
 * 대상 URL 기본값은 없다(실수로 운영을 치지 않게). 의존성 없음(Node 18+ fetch·crypto).
 * 종료 코드: 0 = 전부 통과, 1 = 하나라도 실패, 2 = 사용법 오류.
 */
import { createHash, randomBytes } from 'node:crypto';

const arg = process.argv[2];
if (!arg || !/^https?:\/\/[^\s/]+/.test(arg)) {
  console.error('사용법: node scripts/monthly-close-smoke.mjs <대상 URL>   예) https://project-orsrw.vercel.app');
  process.exit(2);
}
const BASE = arg.replace(/\/+$/, '');
const API = `${BASE}/api/monthly-close`;

// protocol.ts VIEW_FORBIDDEN_KEYS와 같게 유지할 것(이 스크립트는 TS를 import하지 않는다)
const FORBIDDEN = ['secret', 'boards', 'answer', 'quizAnswer', 'alarmRound', 'playerKey', 'keyHash', 'hostKey', 'actionIds', 'deliveredAt', 'oppShips', 'oppHints', 'oppLockUntil', 'reveal'];
const FLEET_A = [
  { slot: 'L4', start: 'A1', dir: 'h' },
  { slot: 'L3', start: 'A3', dir: 'h' },
  { slot: 'L2', start: 'A5', dir: 'h' },
];
const FLEET_B = [
  { slot: 'L4', start: 'E1', dir: 'v' },
  { slot: 'L3', start: 'G1', dir: 'v' },
  { slot: 'L2', start: 'F6', dir: 'h' },
];

const keyA = randomBytes(16).toString('hex');
const keyB = randomBytes(16).toString('hex');
const sha = (k) => createHash('sha256').update(k, 'utf8').digest('hex');
const SECRETS = [keyA, keyB, sha(keyA), sha(keyB)];

let failures = 0;
const ok = (msg) => console.log(`  통과  ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  실패  ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

function allKeys(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (out.add(k), allKeys(x, out));
  return out;
}

/** 응답 공통 점검: 헤더, 금지 키, 비밀키·해시 미노출, (종료 전) 상대 배 정의 미노출 */
function inspect(label, res, text, body, oppFleet) {
  if (res.headers.get('cache-control') !== 'no-store') bad(`${label}: Cache-Control no-store 아님`);
  if (res.headers.get('x-robots-tag') !== 'noindex') bad(`${label}: X-Robots-Tag noindex 아님`);
  for (const s of SECRETS) if (text.includes(s)) bad(`${label}: 비밀키 원문 또는 해시가 응답에 있음`);
  const view = body && body.view;
  if (!view) return;
  const keys = allKeys(view);
  const ended = view.status === 'ended';
  for (const k of FORBIDDEN) if (keys.has(k) && !(ended && k === 'reveal')) bad(`${label}: 금지 키 "${k}"`);
  if (view.opp && 'ships' in view.opp) bad(`${label}: opp에 ships 필드`);
  if (!ended && oppFleet) {
    for (const p of oppFleet) {
      const frag = `"slot":"${p.slot}","start":"${p.start}","dir":"${p.dir}"`;
      // 내 배와 정의가 같으면 비교 불가(이 스크립트의 두 함대는 겹치지 않음)
      if (text.includes(frag)) bad(`${label}: 아직 안 맞은 상대 배 정의 ${p.slot}@${p.start}`);
    }
  }
}

async function call(label, method, path, key, body, oppFleet) {
  const headers = { 'content-type': 'application/json', 'x-mc-test': '1' };
  if (key) headers['x-mc-key'] = key;
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
  } catch (e) {
    bad(`${label}: 네트워크 오류 ${e && e.name}`);
    return { status: 0, body: null };
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    bad(`${label}: JSON이 아닌 응답(HTTP ${res.status})`);
  }
  inspect(label, res, text, json, oppFleet);
  console.log(`  ·     ${label} → HTTP ${res.status} (${Date.now() - t0}ms)`);
  return { status: res.status, body: json };
}

async function anonCheck() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.log('  건너뜀 익명 키 직접 조회(④): NEXT_PUBLIC_SUPABASE_URL·NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수 없음');
    return;
  }
  for (const t of ['mc_rooms', 'mc_players', 'mc_matches', 'mc_events']) {
    try {
      const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
      const text = await res.text();
      const denied = res.status === 401 || res.status === 403 || res.status === 404;
      const empty = res.status === 200 && text.trim() === '[]';
      check(denied || empty, `익명 키로 ${t} 조회 → ${denied ? `거부(HTTP ${res.status})` : empty ? '빈 결과' : `노출! HTTP ${res.status}`}`);
    } catch (e) {
      bad(`익명 키 조회 ${t}: 네트워크 오류 ${e && e.name}`);
    }
  }
}

async function main() {
  console.log(`월마감 연기 시험 → ${BASE}`);

  // ① health
  const h = await call('health', 'GET', `/health?v=${Date.now()}`);
  check(h.status === 200 && h.body && h.body.db === 'ok', `health db = ${h.body && h.body.db}`);
  if (!(h.body && h.body.db === 'ok')) {
    console.log('DB가 ok가 아니라 여기서 멈춘다(방을 만들지 않음).');
    return finish();
  }

  // 키 없는 요청은 INVALID key
  const nk = await call('키 없음', 'POST', '/rooms', null, { nickname: '점검', industry: 0, alarmOn: false });
  check(nk.status === 400 && nk.body && nk.body.reason === 'key', '비밀키 없는 방 만들기 → INVALID key');

  // ② 방 만들기
  const c = await call('방 만들기(A)', 'POST', '/rooms', keyA, { nickname: '점검A', industry: 0, alarmOn: false });
  const code = c.body && c.body.ok ? c.body.code : null;
  check(Boolean(code) && c.body.view.status === 'waiting', `방 만들기 → 방 번호 ${code ?? '-'}`);
  if (!code) return finish();

  // ③ 입장
  const j = await call('입장(B)', 'POST', `/rooms/${code}/join`, keyB, { nickname: '점검B', industry: 1 }, FLEET_A);
  check(j.body && j.body.ok && j.body.seat === 1 && j.body.view.status === 'placing', '입장 → 1번 자리, 배치 단계');

  // ④ 배치(초안 저장 후 완료)
  const pa = await call('배치(A)', 'POST', `/rooms/${code}/action`, keyA, { actionId: `smokeA-${Date.now()}`, type: 'place', ships: FLEET_A, confirm: true }, FLEET_B);
  check(pa.body && pa.body.ok, 'A 배치 완료');
  const pb = await call('배치(B)', 'POST', `/rooms/${code}/action`, keyB, { actionId: `smokeB-${Date.now()}`, type: 'place', ships: FLEET_B, confirm: true }, FLEET_A);
  check(pb.body && pb.body.ok && pb.body.view.status === 'playing', '두 배치 완료 → 대전 시작');
  if (!(pb.body && pb.body.ok && pb.body.view.status === 'playing')) return finish();

  // 차례 확인(sync)
  const sa = await call('sync(A)', 'POST', `/rooms/${code}/sync`, keyA, { knownVersion: -1, view: 'game' }, FLEET_B);
  const turn = sa.body && sa.body.ok && sa.body.changed ? sa.body.view.game.turn : null;
  check(turn === 0 || turn === 1, `sync → 차례 ${turn}`);
  const sameVersion = sa.body && sa.body.changed ? sa.body.view.room.version : -1;
  const s2 = await call('sync(A, 변경 없음)', 'POST', `/rooms/${code}/sync`, keyA, { knownVersion: sameVersion, view: 'game' }, FLEET_B);
  check(s2.body && s2.body.ok && s2.body.changed === false, 'sync 같은 version → 변경 없음 짧은 응답');

  // ⑤ 발사 1회(차례인 사람, 상대 배가 없는 칸 H8)
  const shooter = turn === 1 ? keyB : keyA;
  const f = await call('발사', 'POST', `/rooms/${code}/action`, shooter, { actionId: `smokeF-${Date.now()}`, type: 'fire', cell: 'H8' }, turn === 1 ? FLEET_A : FLEET_B);
  check(f.body && f.body.ok && f.body.view.game.myShots.length === 1 && f.body.view.game.myShots[0].result === 'miss', '발사 1회 → 해당 없음(miss)');
  const notTurn = await call('차례 아닌 발사', 'POST', `/rooms/${code}/action`, shooter, { actionId: `smokeF2-${Date.now()}`, type: 'fire', cell: 'H7' }, turn === 1 ? FLEET_A : FLEET_B);
  check(notTurn.status === 409 && notTurn.body && notTurn.body.error === 'NOT_YOUR_TURN' && notTurn.body.view, '같은 사람 연속 발사 → NOT_YOUR_TURN + 최신 화면');

  // ⑥ 기권(A)
  const r = await call('기권(A)', 'POST', `/rooms/${code}/action`, keyA, { actionId: `smokeR-${Date.now()}`, type: 'resign' });
  const ended = r.body && r.body.ok && r.body.view.status === 'ended';
  check(ended && r.body.view.result.reason === 'resign' && r.body.view.result.winner === 1, '기권 → 종료, B 승리');
  check(ended && Array.isArray(r.body.view.reveal) && r.body.view.reveal.length === 3, '종료 후 상대 배치 공개(reveal 3척)');
  const matchId = ended ? r.body.view.game.matchId : null;

  // 자리 없는 제3자
  const third = randomBytes(16).toString('hex');
  const t3 = await call('제3자 sync', 'POST', `/rooms/${code}/sync`, third, { knownVersion: -1, view: 'game' });
  check(t3.status === 409 && t3.body && t3.body.error === 'ROOM_FULL' && !t3.body.view, '자리 없는 키 → ROOM_FULL, 화면 데이터 없음');

  await anonCheck();
  console.log(`  기록  방 ${code}, 매치 ${matchId ?? '-'} (테스트 표시, 게이트 제외)`);
  return finish();
}

function finish() {
  console.log(failures === 0 ? '결과: 전부 통과' : `결과: 실패 ${failures}건`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`예외: ${e && e.name}`);
  process.exit(1);
});
