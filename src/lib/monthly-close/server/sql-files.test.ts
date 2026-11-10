/**
 * supabase/monthly-close-*.sql 정적 검사 — PM이 운영 DB에서 1회 실행하는 파일이라 사고를 파일 단계에서 막는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = path.resolve(__dirname, '../../../../supabase');
const read = (n: string) => readFileSync(path.join(DIR, n), 'utf8');
const schema = read('monthly-close-schema.sql');
const teardown = read('monthly-close-teardown.sql');
const gate = read('monthly-close-gate.sql');

/** 한 줄 주석(-- …)을 지운 SQL 본문(문자열 리터럴 안의 -- 는 쓰지 않는다) */
const code = (s: string) => s.replace(/--.*$/gm, '');

/** 다른 서비스(/pae, /dongne) 객체 이름. 주석에도 쓰지 않는다 */
const FOREIGN = /\b(rooms|room_players|hands|dongne_dau)\b/;

const TABLES = ['mc_rooms', 'mc_players', 'mc_matches', 'mc_events'] as const;

describe('공통 — mc_ 외 객체 이름 금지', () => {
  for (const [name, sql] of [['schema', schema], ['teardown', teardown], ['gate', gate]] as const) {
    it(`${name}: 다른 서비스 테이블 이름이 어디에도(주석 포함) 없다`, () => {
      expect(sql).not.toMatch(FOREIGN);
    });
    it(`${name}: public.<이름>은 전부 mc_ 로 시작한다`, () => {
      const refs = [...code(sql).matchAll(/\bpublic\.([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.filter((r) => !r.startsWith('mc_'))).toEqual([]);
    });
  }

  it('schema: create table/index 이름이 전부 mc_ 로 시작한다', () => {
    const c = code(schema);
    const tables = [...c.matchAll(/create\s+table\s+if\s+not\s+exists\s+public\.([a-z_0-9]+)/gi)].map((m) => m[1]);
    const idx = [...c.matchAll(/create\s+(?:unique\s+)?index\s+if\s+not\s+exists\s+([a-z_0-9]+)/gi)].map((m) => m[1]);
    expect(tables.sort()).toEqual([...TABLES].sort());
    expect(idx.length).toBeGreaterThanOrEqual(8);
    expect(idx.filter((i) => !i.startsWith('mc_'))).toEqual([]);
  });

  it('실행 안내와 pae 재실행 금지 경고가 파일 상단에 있다', () => {
    for (const sql of [schema, teardown]) {
      const head = sql.split('\n').slice(0, 25).join('\n');
      expect(head).toMatch(/SQL Editor/);
    }
    const head = schema.split('\n').slice(0, 25).join('\n');
    expect(head).toMatch(/pae-schema\.sql/);
    expect(head).toMatch(/다시 실행하지 말 것/);
  });
});

describe('schema.sql', () => {
  const c = code(schema);

  it('drop / truncate / delete / 파괴적 alter가 없다 (멱등)', () => {
    expect(c).not.toMatch(/\bdrop\b/i);
    expect(c).not.toMatch(/\btruncate\s+(table\s+)?public\./i);
    expect(c).not.toMatch(/\bdelete\s+from\b/i);
    expect(c).not.toMatch(/\bdrop\s+column\b|\brename\b/i);
  });

  it('모든 create는 if not exists', () => {
    const creates = [...c.matchAll(/create\s+(?:unique\s+)?(table|index)\s+(?!if\s+not\s+exists)/gi)];
    expect(creates).toEqual([]);
  });

  it('한 트랜잭션(begin … commit)이고 마지막이 확인용 SELECT 1개다', () => {
    expect(c).toMatch(/^\s*begin;/im);
    expect(c.match(/^\s*commit;/gim)).toHaveLength(1);
    const afterCommit = c.slice(c.search(/^\s*commit;/im) + 'commit;'.length);
    expect(afterCommit.match(/\bselect\b/gi)!.length).toBeGreaterThanOrEqual(1);
    expect(afterCommit.trim().endsWith(';')).toBe(true);
    // commit 뒤에는 SELECT 문 하나뿐
    expect(afterCommit.split(';').filter((s) => s.trim()).length).toBe(1);
  });

  it('4개 테이블 모두 RLS를 켜고 정책은 하나도 만들지 않는다', () => {
    for (const t of TABLES) {
      expect(c).toMatch(new RegExp(`alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`, 'i'));
    }
    expect(c).not.toMatch(/create\s+policy/i);
    expect(c).not.toMatch(/alter\s+policy/i);
  });

  it('anon·authenticated 권한을 회수하고 어디에도 부여하지 않는다', () => {
    for (const t of TABLES) {
      expect(c).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${t}\\s+from\\s+anon,\\s*authenticated`, 'i'));
    }
    expect(c).toMatch(/revoke\s+all\s+on\s+sequence\s+public\.mc_events_id_seq\s+from\s+anon,\s*authenticated/i);
    const grants = [...c.matchAll(/grant\s[^;]*;/gi)].map((m) => m[0]);
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) expect(g).toMatch(/to\s+service_role\s*;/i);
    expect(c).not.toMatch(/\bto\s+(anon|authenticated|public)\b/i);
  });

  it('Realtime 발행, 함수, 트리거, 기본 권한 변경이 없다', () => {
    expect(c).not.toMatch(/alter\s+publication|create\s+publication/i);
    expect(c).not.toMatch(/create\s+(or\s+replace\s+)?(function|trigger|extension|schema|role)/i);
    expect(c).not.toMatch(/alter\s+default\s+privileges/i);
    expect(c).not.toMatch(/\balter\s+table\s+(?!public\.mc_)/i);
  });

  it('개인정보 열이 없다 (IP·User-Agent·쿠키·이메일)', () => {
    const cols = [...c.matchAll(/^\s{2}([a-z_]+)\s+(?:uuid|text|integer|smallint|bigint|boolean|timestamptz|jsonb)/gim)].map((m) => m[1]);
    expect(cols.length).toBeGreaterThan(30);
    expect(cols.filter((n) => /(^ip|_ip$|agent|ua$|cookie|email|phone)/.test(n))).toEqual([]);
    // 닉네임은 mc_players에만
    const matchesAndEvents = c.slice(c.indexOf('create table if not exists public.mc_matches'), c.indexOf('-- 잠금') > 0 ? c.indexOf('alter table public.mc_rooms') : undefined);
    expect(matchesAndEvents).not.toMatch(/nickname/i);
  });

  it('필수 인덱스·고유 조건이 있다', () => {
    for (const re of [
      /mc_rooms_code_uq\s+on\s+public\.mc_rooms\s*\(code\)/i,
      /mc_rooms_expires_at_idx\s+on\s+public\.mc_rooms\s*\(expires_at\)/i,
      /mc_players_room_seat_uq\s+on\s+public\.mc_players\s*\(room_id,\s*seat\)/i,
      /mc_players_room_key_uq\s+on\s+public\.mc_players\s*\(room_id,\s*player_key\)/i,
      /mc_matches_started_at_idx\s+on\s+public\.mc_matches\s*\(started_at\)/i,
      /mc_events_type_at_idx\s+on\s+public\.mc_events\s*\(type,\s*at\)/i,
      /mc_events_player_key_idx\s+on\s+public\.mc_events\s*\(player_key\)/i,
      /mc_events_dedupe_key_uq\s+on\s+public\.mc_events\s*\(dedupe_key\)/i,
    ]) {
      expect(c).toMatch(re);
    }
    // 방이 지워지면 자리도 지워진다
    expect(c).toMatch(/room_id\s+uuid\s+not null\s+references\s+public\.mc_rooms\s*\(id\)\s+on delete cascade/i);
  });

  it('새 환경변수·키를 요구하지 않는다', () => {
    expect(schema).not.toMatch(/SERVICE_ROLE_KEY|NEXT_PUBLIC_|ANON_KEY/);
  });
});

describe('teardown.sql', () => {
  const c = code(teardown);
  it('drop은 mc_ 테이블만, CASCADE 없음, 자식 → 부모 순서', () => {
    const drops = [...c.matchAll(/drop\s+([a-z]+)\s+(?:if\s+exists\s+)?([a-z_.0-9]+)/gi)];
    expect(drops.length).toBe(4);
    for (const d of drops) {
      expect(d[1].toLowerCase()).toBe('table');
      expect(d[2]).toMatch(/^public\.mc_/);
    }
    expect(c).not.toMatch(/\bcascade\b/i);
    const order = drops.map((d) => d[2].replace('public.', ''));
    expect(order.indexOf('mc_players')).toBeLessThan(order.indexOf('mc_rooms'));
    expect(new Set(order)).toEqual(new Set(TABLES));
  });
  it('schema.sql에는 drop이 없고 teardown에만 있다', () => {
    expect(code(schema)).not.toMatch(/\bdrop\b/i);
    expect(code(gate)).not.toMatch(/\bdrop\b/i);
  });
  it('데이터 삭제 경고와 확인 SELECT가 있다', () => {
    expect(teardown).toMatch(/영구 삭제/);
    expect(c).toMatch(/select\s+count\(\*\)\s+as\s+remaining_mc_tables/i);
  });
});

describe('gate.sql', () => {
  const c = code(gate);
  it('읽기 전용: SELECT/WITH만, 변경 문장이 없다', () => {
    expect(c).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|vacuum)\b/i);
    const stmts = c.split(';').map((s) => s.trim()).filter(Boolean);
    expect(stmts).toHaveLength(4);
    for (const s of stmts) expect(s).toMatch(/^(with|select)\b/i);
  });
  it('운영·비테스트만 집계하고 14일 창을 쓴다', () => {
    expect(c).toMatch(/env\s*=\s*'production'/i);
    expect(c).toMatch(/not\s+(e\.|m\.)?is_test/i);
    expect(c).toMatch(/interval\s+'14 days'/i);
    expect(gate).toMatch(/\[설정\]/);
  });
  it('mc_events / mc_matches만 읽는다 (방·자리 테이블 불필요 → 방이 삭제돼도 지표 유지)', () => {
    const refs = new Set([...c.matchAll(/public\.(mc_[a-z]+)/gi)].map((m) => m[1]));
    expect([...refs].sort()).toEqual(['mc_events', 'mc_matches']);
  });
  it('기획서 지표를 모두 낸다', () => {
    for (const label of ['볼륨', '핵심①', '핵심②', '핵심③', '핵심④', '웃음', '안전']) expect(gate).toContain(label);
  });
});
