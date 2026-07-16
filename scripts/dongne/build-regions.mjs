#!/usr/bin/env node
/**
 * 동네고수 — 시군구 실루엣/매니페스트 빌드 파이프라인 (오프라인, 의존성 0)
 *
 * 입력:  scripts/dongne/raw/skorea-municipalities-2018-geo.json
 *        (southkorea-maps, KOSTAT 2018 시군구 경계 — .gitignore 대상, 헤더의 curl로 재현)
 * 출력:  src/app/dongne/data/manifest.json                — 전 지역 메타 (실루엣 미포함: 2분할 페이로드)
 *        src/app/dongne/data/silhouettes/{code}.json      — 지역별 정규화 SVG path (오늘 것만 온디맨드 fetch)
 *        src/lib/dongne/region-codes.ts                   — 코드 배열만 (queue.ts 셔플 입력, 정답목록 노출 방지)
 *
 * 정규화 규칙(디자인 최종안 §4-3 · 방향서 §2):
 *  - 정북 고정(회전 없음) · 미러 금지 (x=경도, y=-위도)
 *  - 위경도 왜곡 보정: 지역별 중위도 코사인 스케일 (x' = lng·cos(latMid))
 *  - fit-to-frame 88%: viewBox 0 0 100 100, 최장변 88유닛, 중앙 정렬
 *  - 단순화: Douglas-Peucker (path 문자열 예산 초과 시 epsilon 증가 재시도)
 *  - 다도해: 최대 면적 대비 5% 미만 섬 제거, 본체 포함 최대 6개 폴리곤
 *  - centroid: 기하중심 금지 → pole of inaccessibility (polylabel 직접 구현)
 *
 * 행정개편 반영(2018 데이터 → 2026 현재):
 *  - 23030 남구(인천) → 미추홀구 (2018-07 개명)
 *  - 37310 군위군: 경북 → 대구광역시 편입 (2023-07). 코드는 데이터셋 원본 유지(내부 판정용 안정 ID)
 *  - 강원특별자치도(2023-06)·전북특별자치도(2024-01) 명칭 반영
 *  - 부천시 일반구 재설치(2024)는 데이터셋에 없음 → 부천시 단일 출제 단위 유지
 *
 * 실행: node scripts/dongne/build-regions.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const RAW_PATH = path.join(__dirname, 'raw', 'skorea-municipalities-2018-geo.json');
const DATA_DIR = path.join(ROOT, 'src', 'app', 'dongne', 'data');
const SIL_DIR = path.join(DATA_DIR, 'silhouettes');
const CODES_TS = path.join(ROOT, 'src', 'lib', 'dongne', 'region-codes.ts');

// ---------- 시도 매핑 (KOSTAT 코드 앞 2자리) ----------
const SIDO = {
  11: ['서울', '서울특별시'],
  21: ['부산', '부산광역시'],
  22: ['대구', '대구광역시'],
  23: ['인천', '인천광역시'],
  24: ['광주', '광주광역시'],
  25: ['대전', '대전광역시'],
  26: ['울산', '울산광역시'],
  29: ['세종', '세종특별자치시'],
  31: ['경기', '경기도'],
  32: ['강원', '강원특별자치도'],
  33: ['충북', '충청북도'],
  34: ['충남', '충청남도'],
  35: ['전북', '전북특별자치도'],
  36: ['전남', '전라남도'],
  37: ['경북', '경상북도'],
  38: ['경남', '경상남도'],
  39: ['제주', '제주특별자치도'],
};
const METRO_PREFIXES = new Set(['11', '21', '22', '23', '24', '25', '26']);

// ---------- 행정개편 override ----------
const OVERRIDES = {
  '23030': { name: '미추홀구' }, // 2018-07 인천 남구 → 미추홀구
  '37310': { sidoPrefix: '22' }, // 2023-07 군위군 대구 편입
};

// ---------- 파라미터 ----------
const VIEWBOX = 100;
const FIT = 0.88; // fit-to-frame 88%
const ISLAND_KEEP_RATIO = 0.05; // 최대 폴리곤 면적 대비 5% 미만 섬 제거
const MAX_POLYS = 6; // 본체 포함 최대 폴리곤 수
const HOLE_KEEP_RATIO = 0.02; // 외곽 면적 대비 2% 미만 구멍 제거
const MIN_POLY_UNIT_AREA = 1.5; // 변환 후 1.5unit² 미만 점 폴리곤 제거(본체 제외)
const PATH_BUDGET = 4200; // path 문자열 예산(chars) — 초과 시 epsilon 증가
const EPS_START = 0.35; // DP epsilon (viewBox 유닛)

// ================= 기하 유틸 =================

/** 부호 있는 면적(shoelace). 입력 [[x,y],...] */
function ringArea(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** 점-선분 수직거리 제곱 */
function segDist2(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker (반복 스택 구현). 닫힌 링: 마지막≠첫 점 가정 */
function simplifyDP(pts, eps) {
  const n = pts.length;
  if (n <= 4) return pts.slice();
  const eps2 = eps * eps;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(pts[i], pts[first], pts[last]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps2 && idx !== -1) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

/** ray casting 내부 판정 */
function pointInRing(p, ring) {
  let inside = false;
  const [px, py] = p;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(p, polygon) {
  if (!pointInRing(p, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (pointInRing(p, polygon[k])) return false;
  return true;
}

/** 점 → 폴리곤 부호거리(내부 양수) */
function pointToPolygonDist(p, polygon) {
  let inside = pointInPolygon(p, polygon);
  let min2 = Infinity;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d = segDist2(p, ring[j], ring[i]);
      if (d < min2) min2 = d;
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(min2);
}

/**
 * Pole of inaccessibility (Mapbox polylabel 알고리즘 직접 구현)
 * polygon = [outer, ...holes] (projected 좌표), precision = 동일 단위
 */
function polylabel(polygon, precision) {
  const outer = polygon[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [minX, minY];

  const makeCell = (x, y, h) => {
    const d = pointToPolygonDist([x, y], polygon);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  let h = cellSize / 2;
  const queue = [];
  for (let x = minX; x < maxX; x += cellSize)
    for (let y = minY; y < maxY; y += cellSize) queue.push(makeCell(x + h, y + h, h));

  // 초기 후보: 대략 중심
  let best = makeCell(minX + width / 2, minY + height / 2, 0);

  while (queue.length) {
    // 간단 우선순위 큐(최대 max 셀 추출) — 셀 수가 적어 O(n) pop으로 충분
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].max > queue[bi].max) bi = i;
    const cell = queue.splice(bi, 1)[0];
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    h = cell.h / 2;
    queue.push(
      makeCell(cell.x - h, cell.y - h, h),
      makeCell(cell.x + h, cell.y - h, h),
      makeCell(cell.x - h, cell.y + h, h),
      makeCell(cell.x + h, cell.y + h, h),
    );
  }
  return [best.x, best.y];
}

// ================= 이름/별칭 =================

// "수원시장안구"→"수원시 장안구", "포항시북구"→"포항시 북구" (구 어근 1글자 포함)
// 자치구/시/군 단독명에는 '시'+'구' 조합이 없어 오분리 없음 (전 지역 검증됨)
const CITY_GU_RE = /^([가-힣]{2,}시)([가-힣]+구)$/;

function normalizeName(rawName) {
  const m = rawName.match(CITY_GU_RE);
  return m ? `${m[1]} ${m[2]}` : rawName;
}

function buildAliases(code, name) {
  const set = new Set();
  if (name.includes(' ')) {
    const [city, gu] = name.split(' ');
    set.add(gu); // 장안구
    set.add(city); // 수원시
    if (city.length >= 3) set.add(city.slice(0, -1)); // 수원
    set.add(city + gu); // 수원시장안구 (원본 붙임 표기)
  } else if (name.length >= 3) {
    set.add(name.slice(0, -1)); // 강릉시→강릉, 강남구→강남, 고성군→고성
  }
  if (code === '29010') {
    set.add('세종');
    set.add('세종특별자치시');
  }
  set.delete(name);
  return [...set];
}

// ================= 메인 =================

function fmt(n) {
  // 1자리 소수, 불필요한 .0 제거
  const s = n.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function buildPathD(rings) {
  let d = '';
  for (const ring of rings) {
    let prev = null;
    let part = '';
    let count = 0;
    for (const [x, y] of ring) {
      const sx = fmt(x);
      const sy = fmt(y);
      if (prev && prev[0] === sx && prev[1] === sy) continue; // 반올림 중복 제거
      part += (count === 0 ? 'M' : 'L') + sx + ' ' + sy;
      prev = [sx, sy];
      count++;
    }
    if (count >= 3) d += part + 'Z';
  }
  return d;
}

function main() {
  if (!existsSync(RAW_PATH)) {
    console.error(`원본 없음: ${RAW_PATH}\n스크립트 헤더의 curl 명령으로 내려받은 뒤 재실행하세요.`);
    process.exit(1);
  }
  const geo = JSON.parse(readFileSync(RAW_PATH, 'utf8'));
  const feats = geo.features;
  console.log(`원본 지역 수: ${feats.length}`);

  // 이름 정규화 + override 선반영 → 동명 판정
  const pre = feats.map((f) => {
    const code = f.properties.code;
    const ov = OVERRIDES[code] || {};
    const name = normalizeName(ov.name || f.properties.name);
    const sidoPrefix = ov.sidoPrefix || code.slice(0, 2);
    const [sido, sidoFull] = SIDO[Number(sidoPrefix)];
    return { code, name, sido, sidoFull, geometry: f.geometry };
  });
  const nameCount = new Map();
  for (const r of pre) nameCount.set(r.name, (nameCount.get(r.name) || 0) + 1);
  const dupNames = [...nameCount.entries()].filter(([, c]) => c > 1).map(([n]) => n);
  console.log(`동명 지역: ${dupNames.join(', ')}`);

  rmSync(SIL_DIR, { recursive: true, force: true });
  mkdirSync(SIL_DIR, { recursive: true });

  const manifest = [];
  const problems = [];
  let totalSilBytes = 0;
  let maxSil = { code: '', bytes: 0 };
  let maxEpsUsed = 0;

  for (const r of pre.sort((a, b) => a.code.localeCompare(b.code))) {
    const { code, name, sido, sidoFull } = r;
    if (r.geometry.type !== 'MultiPolygon') {
      problems.push(`${code} ${name}: 지원하지 않는 geometry ${r.geometry.type}`);
      continue;
    }
    const polys = r.geometry.coordinates; // [ [outer, ...holes], ... ]

    // 전체 지리 bbox (섬 제거 전 원본 기준 — 지역 실제 범위)
    let gMinLng = Infinity, gMinLat = Infinity, gMaxLng = -Infinity, gMaxLat = -Infinity;
    for (const poly of polys)
      for (const [lng, lat] of poly[0]) {
        if (lng < gMinLng) gMinLng = lng;
        if (lat < gMinLat) gMinLat = lat;
        if (lng > gMaxLng) gMaxLng = lng;
        if (lat > gMaxLat) gMaxLat = lat;
      }

    // 위도 코사인 보정 투영 (정북 고정 · 미러 금지)
    const latMid = ((gMinLat + gMaxLat) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(latMid);
    const project = ([lng, lat]) => [lng * cosLat, -lat];

    // 폴리곤별 외곽 면적 → 주요 섬만 유지
    const measured = polys
      .map((poly) => ({ poly, area: Math.abs(ringArea(poly[0].map(project))) }))
      .sort((a, b) => b.area - a.area);
    const maxArea = measured[0].area;
    const kept = measured
      .filter((m, i) => i === 0 || m.area >= maxArea * ISLAND_KEEP_RATIO)
      .slice(0, MAX_POLYS);

    // 유지 폴리곤 기준 투영 bbox → fit-to-frame 88%
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { poly } of kept)
      for (const [lng, lat] of poly[0]) {
        const [x, y] = project([lng, lat]);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    const scale = (VIEWBOX * FIT) / Math.max(maxX - minX, maxY - minY);
    const tx = (VIEWBOX - (maxX - minX) * scale) / 2 - minX * scale;
    const ty = (VIEWBOX - (maxY - minY) * scale) / 2 - minY * scale;
    const toUnit = (pt) => {
      const [x, y] = project(pt);
      return [x * scale + tx, y * scale + ty];
    };

    // DP 단순화 (+예산 초과 시 epsilon 증가 재시도)
    let eps = EPS_START;
    let d = '';
    for (let iter = 0; iter < 8; iter++) {
      const ringsOut = [];
      for (let pi = 0; pi < kept.length; pi++) {
        const { poly } = kept[pi];
        const outerUnit = poly[0].map(toUnit);
        const outerArea = Math.abs(ringArea(outerUnit));
        if (pi > 0 && outerArea < MIN_POLY_UNIT_AREA) continue; // 점 섬 제거
        const outerSimple = simplifyDP(outerUnit, eps);
        if (outerSimple.length < 3) {
          if (pi === 0) ringsOut.push(outerUnit); // 본체는 절대 드롭 금지
          continue;
        }
        ringsOut.push(outerSimple);
        for (let hi = 1; hi < poly.length; hi++) {
          const holeUnit = poly[hi].map(toUnit);
          if (Math.abs(ringArea(holeUnit)) < outerArea * HOLE_KEEP_RATIO) continue;
          const holeSimple = simplifyDP(holeUnit, eps);
          if (holeSimple.length >= 3) ringsOut.push(holeSimple);
        }
      }
      d = buildPathD(ringsOut);
      if (d.length <= PATH_BUDGET) break;
      eps *= 1.4;
    }
    if (eps > maxEpsUsed) maxEpsUsed = eps;
    if (!d) {
      problems.push(`${code} ${name}: path 생성 실패`);
      continue;
    }

    // centroid = pole of inaccessibility (본체 폴리곤, 투영 좌표계)
    const mainPoly = kept[0].poly;
    const projOuter = simplifyDP(mainPoly[0].map(project), 0.0005);
    const projHoles = mainPoly
      .slice(1)
      .filter((h) => Math.abs(ringArea(h.map(project))) >= kept[0].area * 0.01)
      .map((h) => simplifyDP(h.map(project), 0.0005));
    const [px, py] = polylabel([projOuter, ...projHoles], 0.002);
    const centroid = {
      lat: Math.round(-py * 1e4) / 1e4,
      lng: Math.round((px / cosLat) * 1e4) / 1e4,
    };
    // 검증: centroid가 본체 내부인지
    if (!pointInRing([px, py], projOuter)) {
      problems.push(`${code} ${name}: centroid가 본체 외부 (수동 override 필요)`);
    }
    // 검증: centroid가 지리 bbox 내부인지
    if (
      centroid.lng < gMinLng || centroid.lng > gMaxLng ||
      centroid.lat < gMinLat || centroid.lat > gMaxLat
    ) {
      problems.push(`${code} ${name}: centroid가 bbox 외부`);
    }

    // 실루엣 파일
    const sil = JSON.stringify({ code, viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`, d });
    writeFileSync(path.join(SIL_DIR, `${code}.json`), sil);
    totalSilBytes += Buffer.byteLength(sil);
    if (Buffer.byteLength(sil) > maxSil.bytes) maxSil = { code: `${code} ${name}`, bytes: Buffer.byteLength(sil) };

    // 동명 병기 규칙: 전국 동명 or 특별·광역시 자치구
    const isMetroGu = METRO_PREFIXES.has(code.slice(0, 2)) && name.endsWith('구') && !name.includes(' ');
    const nameWithSido = dupNames.includes(name) || isMetroGu ? `${name}(${sido})` : name;

    manifest.push({
      code,
      name,
      sido,
      sidoFull,
      nameWithSido,
      aliases: buildAliases(code, name),
      centroid,
      bbox: [gMinLng, gMinLat, gMaxLng, gMaxLat].map((v) => Math.round(v * 1e3) / 1e3),
    });
  }

  // manifest 저장
  const manifestJson = JSON.stringify(manifest);
  writeFileSync(path.join(DATA_DIR, 'manifest.json'), manifestJson);

  // region-codes.ts 생성 (코드 배열만 — 정답 목록 친절 구조 노출 금지)
  const codes = manifest.map((m) => m.code);
  const codesTs = `// AUTO-GENERATED by scripts/dongne/build-regions.mjs — 직접 수정 금지
// 시군구 행정코드 오름차순 (KOSTAT 2018 기준, 동네고수 내부 안정 ID)
export const REGION_CODES: readonly string[] = ${JSON.stringify(codes)};
export const REGION_COUNT = ${codes.length};
`;
  mkdirSync(path.dirname(CODES_TS), { recursive: true });
  writeFileSync(CODES_TS, codesTs);

  // 리포트
  const silFiles = readdirSync(SIL_DIR);
  console.log('--- 빌드 결과 ---');
  console.log(`지역 수: ${manifest.length}`);
  console.log(`manifest.json: ${(Buffer.byteLength(manifestJson) / 1024).toFixed(1)} KB`);
  console.log(`실루엣: ${silFiles.length}개, 총 ${(totalSilBytes / 1024).toFixed(1)} KB, 평균 ${(totalSilBytes / silFiles.length / 1024).toFixed(2)} KB`);
  console.log(`최대 실루엣: ${maxSil.code} — ${(maxSil.bytes / 1024).toFixed(2)} KB`);
  console.log(`최대 epsilon 사용: ${maxEpsUsed.toFixed(3)} unit`);
  if (problems.length) {
    console.log(`⚠ 문제 ${problems.length}건:`);
    for (const p of problems) console.log('  - ' + p);
  } else {
    console.log('검증 문제 0건 (centroid 내부성·bbox 전수 통과)');
  }
}

main();
