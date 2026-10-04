/**
 * 공정성 전수 점검(v3 · 2026-10-05) — "논리상 맞는데 −1" 회귀.
 *
 * 1) 엔진 전수: 모든 증언 줄 × 모든 카드 1~2장 조합을 judgePresent 로 돌린다.
 * 2) RELATED: 바이블 11장(추리 경로)·2-2(타임라인)가 그 줄과 잇는 카드 — 그 줄이 보이고 안 깨졌을 때 손에 있을 수 있는 것만.
 *    RELATED 의 카드는 한 장씩 전부 AUDIT 에 판정과 이유가 있어야 한다(빠지면 실패 = 새 카드·새 줄이 검토 없이 들어온 것).
 * 3) AUDIT: 기대 판정 + 한 줄 이유. 'WRONG' 은 '모순이 아님(지지 증거·줄 선택·레드헤링)'으로 일부러 남긴 감점이다.
 * 4) RELATED 안의 두 장 조합: 두 장이 각각 감점이 아니면 겹쳐 내도 감점이 아니어야 한다 + 논리 쌍은 PAIRS 에 따로 못 박는다.
 * 튜토리얼 T00 은 감점이 없어 뺀다. 바이블 witness-case.md 7-1c(반쪽 카드)·7-1b(우회)·개정 기록 v3 표와 같은 내용.
 */
import { describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import { KNOWN, judgePresent, newRun, type RunState } from './engine';
import type { CardId, Id } from './types';

type Kind = 'BREAK' | 'HALF' | 'REDIRECT' | 'WRONG';
interface Row {
  line: Id;
  cards: CardId[];
  want: Kind;
  why: string;
  /** 판정 전에 깨져 있어야 하는 돌파(requires 등) */
  broken?: Id[];
}

const r = (line: Id, cards: CardId[], want: Kind, why: string, broken?: Id[]): Row => ({ line, cards, want, why, broken });

/** 바이블 추리상 그 줄과 이어지는 카드(한 장 단위) */
const RELATED: Record<Id, CardId[]> = {
  'T01.1': ['E14', 'E17', 'E07'],
  'T01.2': ['E14'],
  'T01.3': ['E12'],
  'T01.4': ['E05', 'E15', 'E03', 'VICTIM'],
  'T02.1': ['E08'],
  'T02.2': ['E12', 'E18'],
  'T02.3': ['E05', 'E15', 'E12', 'E18'],
  'T02.4': ['E08'],
  'T03.1': ['E12', 'E13'],
  'T03.2': ['E12', 'E13'],
  'T03.3': ['E05', 'E12', 'E13'],
  'T03.4': ['E10'],
  'T04.1': ['E06'],
  'T04.2': ['E06', 'E16'],
  'T04.3': ['E12'],
  'T04.4': ['E01', 'E12'],
  'T04.5': ['E05', 'E15', 'E03'],
  'T05.1': ['S2', 'E08'],
  'T05.2': ['E14'],
  'T05.3': ['E11', 'E14'],
  'T05.4': ['E12'],
  'T05.5': ['E05', 'E15', 'E04'],
  'T05.6': ['E14', 'E14b'],
  'T06.1': ['E11', 'E06'],
  'T06.2': ['E05'],
  'T06.3': ['E05', 'E15', 'VICTIM'],
  'T06.4': ['E15', 'VICTIM', 'E03a', 'E03b', 'E05'],
  'T07.1': ['E06', 'E16'],
  'T07.2': ['E08', 'E12'],
  'T07.3': ['E17', 'S1', 'E14', 'E14b'],
  'T07.4': ['E02', 'E04', 'E01', 'E11', 'E17'],
  'T07.5': ['E09'],
  'T08.1': ['E12', 'E13'],
  'T08.2': ['E05'],
  'T08.3': ['E16', 'E05', 'E12'],
  'T08.4': ['E02'],
  'T09.1': ['E17', 'E14'],
  'T09.2': ['E12', 'E18'],
  'T09.3': ['E17', 'E03b', 'E03a', 'E11'],
  'T09.4': ['E16'],
  'T09.5': ['E05', 'E15'],
  'T10.1': ['E12'],
  'T10.2': ['E05', 'E15', 'VICTIM', 'E03', 'E11'],
  'T10.3': ['E12', 'E13', 'E16', 'E05', 'S3', 'E15'],
  'T10.4': ['E16', 'E05', 'E12', 'E03a', 'E15'],
};

const SUP = '지지 증거 — 그 줄은 사실이고 이 카드는 그걸 뒷받침할 뿐(모순 아님)';

const AUDIT: Row[] = [
  // T01 선우강
  r('T01.1', ['E14'], 'WRONG', "줄 선택 — '시스템엔 손 안 댔다'는 다음 줄(T01.2). 손님방에 있었다는 말과는 안 부딪힌다"),
  r('T01.1', ['E17'], 'WRONG', SUP),
  r('T01.1', ['E07'], 'WRONG', SUP),
  r('T01.2', ['E14'], 'BREAK', 'C02'),
  r('T01.3', ['E12'], 'WRONG', SUP),
  r('T01.4', ['E05'], 'REDIRECT', 'R-01 — 22:20 목소리 주장의 반복(돌파는 T10.2)'),
  r('T01.4', ['E15'], 'REDIRECT', 'R-01'),
  r('T01.4', ['E03'], 'WRONG', SUP),
  r('T01.4', ['VICTIM'], 'WRONG', "지지 — '광고 그 목소리' 맞다"),
  // T02 하늘
  r('T02.1', ['E08'], 'WRONG', SUP),
  r('T02.2', ['E12'], 'BREAK', 'C04'),
  r('T02.2', ['E18'], 'BREAK', 'C04 대체'),
  r('T02.3', ['E05'], 'REDIRECT', 'R-02'),
  r('T02.3', ['E15'], 'REDIRECT', 'R-02'),
  r('T02.3', ['E12'], 'WRONG', '22:01 옥상문 닫힘 — 22:20엔 방에 있었다(깨는 곳은 T02.2)'),
  r('T02.3', ['E18'], 'WRONG', '시각 없는 물증 — 22:20 방을 못 반박한다(깨는 곳은 T02.2)'),
  r('T02.4', ['E08'], 'WRONG', '동기를 스스로 인정한 줄 — 모순이 아니다'),
  // T03 미숙
  r('T03.1', ['E12'], 'WRONG', "9시 반 입실은 사실. '잤다'는 다음 줄(T03.2)"),
  r('T03.1', ['E13'], 'WRONG', "9시 반 입실은 사실. '잤다'는 다음 줄(T03.2)"),
  r('T03.2', ['E12'], 'BREAK', 'C03 대체'),
  r('T03.2', ['E13'], 'BREAK', 'C03'),
  r('T03.3', ['E05'], 'WRONG', SUP),
  r('T03.3', ['E12'], 'REDIRECT', "v3 R-10 — '자다 깼는데'는 T03.2('아침까지 쭉')와의 자기모순 장치. 알아챈 사람을 앞줄로"),
  r('T03.3', ['E13'], 'REDIRECT', 'v3 R-10'),
  r('T03.4', ['E10'], 'WRONG', SUP),
  // T04 준혁 1차
  r('T04.1', ['E06'], 'WRONG', '20:40 켜짐 = 지지. 깨는 곳은 다음 줄(T04.2)'),
  r('T04.2', ['E06'], 'BREAK', 'C08'),
  r('T04.2', ['E16'], 'HALF', 'v3 반쪽 — 22:01 주방의 정장 = 서재에 없었다. 다만 뒷모습 목격이라 기록(E06)이 필요'),
  r('T04.3', ['E12'], 'WRONG', SUP),
  r('T04.4', ['E01'], 'WRONG', SUP),
  r('T04.4', ['E12'], 'WRONG', SUP),
  r('T04.5', ['E05'], 'REDIRECT', 'R-03'),
  r('T04.5', ['E15'], 'REDIRECT', 'R-03'),
  r('T04.5', ['E03'], 'WRONG', SUP),
  // T05 또박이 게스트
  r('T05.1', ['S2'], 'WRONG', '기록 줄(사실). 누구였는지는 의문 Q01 — C04 뒤 답이 적힌다'),
  r('T05.1', ['E08'], 'WRONG', '기록 줄(사실)'),
  r('T05.2', ['E14'], 'WRONG', '이 줄 추궁으로 받은 카드 — 같은 기록'),
  r('T05.3', ['E11'], 'BREAK', 'C05'),
  r('T05.3', ['E14'], 'WRONG', '레드헤링 — 삭제 명령(21:38)은 공백의 원인이 아니고 네트워크를 증명하지도 않는다'),
  r('T05.4', ['E12'], 'WRONG', SUP),
  r('T05.5', ['E05'], 'REDIRECT', 'R-04'),
  r('T05.5', ['E15'], 'REDIRECT', 'R-04'),
  r('T05.5', ['E04'], 'WRONG', SUP),
  r('T05.6', ['E14'], 'REDIRECT', 'R-06 — 갱신 전 원본(권한 카드의 반쪽)'),
  r('T05.6', ['E14b'], 'BREAK', 'C06'),
  // T06 또박이 관리자
  r('T06.1', ['E11'], 'WRONG', SUP),
  r('T06.1', ['E06'], 'WRONG', "기록 줄 — '누른 손'은 C13 에서 밝혀진다"),
  r('T06.2', ['E05'], 'WRONG', '기록 줄 — 다시 켠 이유(Q05)는 C11 에서 풀리고 답이 적힌다'),
  r('T06.3', ['E05'], 'REDIRECT', 'R-08'),
  r('T06.3', ['E15'], 'REDIRECT', 'R-08'),
  r('T06.3', ['VICTIM'], 'WRONG', '줄 선택 — 수치 기록 줄. 해석(본인 판정)은 바로 아래 T06.4. 우회 카드 2장 상한'),
  r('T06.4', ['E15'], 'BREAK', 'C07'),
  r('T06.4', ['VICTIM'], 'BREAK', 'C07 대체'),
  r('T06.4', ['E03a'], 'BREAK', 'v3 C07 대체 — 해석 정정된 음성 명령 = 녹음이 통과했다'),
  r('T06.4', ['E03b'], 'BREAK', 'C07 대체'),
  r('T06.4', ['E05'], 'HALF', 'C07 조합 대체(E05+E15)의 한 장'),
  // T07 준혁 2차
  r('T07.1', ['E06'], 'WRONG', SUP),
  r('T07.1', ['E16'], 'WRONG', "주장 없는 회피 줄(v2 #7) — '어디 있었나'를 깨는 곳은 T10.4"),
  r('T07.2', ['E08'], 'WRONG', SUP),
  r('T07.2', ['E12'], 'WRONG', SUP),
  r('T07.3', ['E17'], 'BREAK', 'C09'),
  r('T07.3', ['S1'], 'WRONG', "지지 — '회색 후드티'는 그의 옷"),
  r('T07.3', ['E14'], 'WRONG', '21:38 한 시점 — 21:50 을 덮는 건 입력 무중단(E17)'),
  r('T07.3', ['E14b'], 'WRONG', '시각이 21:50 을 덮지 못한다'),
  r('T07.4', ['E02'], 'HALF', 'C10 조합의 한 장'),
  r('T07.4', ['E04'], 'HALF', 'C10 조합의 한 장'),
  r('T07.4', ['E01'], 'WRONG', '지지 — 순경의 사고 추정'),
  r('T07.4', ['E11'], 'WRONG', "공백은 '사고가 아니다'를 증명하지 못한다"),
  r('T07.4', ['E17'], 'WRONG', "쿵의 시각만 — 사고인지 아닌지는 못 가른다"),
  r('T07.5', ['E09'], 'REDIRECT', "v3 R-09 — '…명환' = 아버지. 맞는 연결이지만 증언을 깰 패가 아니라 지목(동기) 패"),
  // T08 미숙 2차
  r('T08.1', ['E12'], 'WRONG', SUP),
  r('T08.1', ['E13'], 'WRONG', SUP),
  r('T08.2', ['E05'], 'WRONG', SUP),
  r('T08.3', ['E16'], 'BREAK', 'C14'),
  r('T08.3', ['E05'], 'HALF', "v3 반쪽 — 22:02 태블릿을 만진 건 미숙이 아니다. 자동 로그인이라 '누가'는 목격(E16)이 필요"),
  r('T08.3', ['E12'], 'WRONG', '22:05 현관 나감 — 신발을 신고 있었다는 말과 양립'),
  r('T08.4', ['E02'], 'WRONG', SUP),
  // T09 대질 1
  r('T09.1', ['E17'], 'WRONG', SUP),
  r('T09.1', ['E14'], 'WRONG', SUP),
  r('T09.2', ['E12'], 'WRONG', SUP),
  r('T09.2', ['E18'], 'WRONG', SUP),
  r('T09.3', ['E17'], 'BREAK', 'C15'),
  r('T09.3', ['E03b'], 'HALF', "v3 반쪽 — '회장은 그 전에 이미 쓰러져 있었다' = 22:20 쿵이 아니다. 몇 시였는지는 E17"),
  r('T09.3', ['E03a'], 'WRONG', '목소리가 청소기였다는 것뿐 — 쓰러진 시각은 말하지 않는다'),
  r('T09.3', ['E11'], 'WRONG', '마이크 공백은 쿵의 시각을 못 박지 않는다'),
  r('T09.4', ['E16'], 'WRONG', SUP),
  r('T09.5', ['E05'], 'REDIRECT', 'R-05'),
  r('T09.5', ['E15'], 'REDIRECT', 'R-05'),
  // T10 대질 2
  r('T10.1', ['E12'], 'WRONG', SUP),
  r('T10.2', ['E05'], 'HALF', 'C11 조합의 한 장'),
  r('T10.2', ['E15'], 'HALF', 'C11 조합의 한 장'),
  r('T10.2', ['VICTIM'], 'HALF', 'v3 반쪽 — 광고 목소리 녹음이 흔하다(C07 과 같은 논리). 그 녹음이 울린 기록은 E05'),
  r('T10.2', ['E03'], 'WRONG', '같은 기록을 다시 낸 것'),
  r('T10.2', ['E11'], 'WRONG', '공백만으로 22:20 목소리를 깰 수 없다'),
  r('T10.3', ['E12'], 'BREAK', 'C12'),
  r('T10.3', ['E13'], 'BREAK', 'C12 대체'),
  r('T10.3', ['E16'], 'HALF', 'v3 반쪽 — 22:01 태블릿 앞 정장. 예약은 21:58 이라 미숙 부재(E12)가 정확히 덮는다'),
  r('T10.3', ['E05'], 'WRONG', "지지 — '집사 공용 계정'은 그의 말을 뒷받침"),
  r('T10.3', ['S3'], 'WRONG', '지지 — 미숙은 공용 계정 사용자'),
  r('T10.3', ['E15'], 'WRONG', '작년 음성팩 — 오늘 21:58 예약자를 가리지 못한다'),
  r('T10.4', ['E16'], 'HALF', 'C13 requires(C11) 전', []),
  r('T10.4', ['E16'], 'BREAK', 'C13', ['C11']),
  r('T10.4', ['E05'], 'REDIRECT', 'R-07 — 계정은 사람이 아니다(자동 로그인)'),
  r('T10.4', ['E12'], 'REDIRECT', "v3 R-07 확장 — '공용 계정 둘 + 미숙 부재' 추론의 반쪽"),
  r('T10.4', ['E03a'], 'HALF', "v3 반쪽 — 출발음은 주방 태블릿에서 바뀌었다. '누가'는 목격(E16)", ['C11']),
  r('T10.4', ['E15'], 'WRONG', '작년 음성팩 — 오늘 주방에 있었는지와 무관'),
];

/** 논리로 같이 내는 두 장 */
const PAIRS: Row[] = [
  ...['T01.4', 'T02.3', 'T04.5', 'T05.5', 'T06.3', 'T09.5'].map((l) => r(l, ['E05', 'E15'], 'REDIRECT', '22:20 목소리 반복 주장 — C11 조합을 엉뚱한 줄에')),
  r('T03.3', ['E12', 'E13'], 'REDIRECT', 'R-10 — C03 정답·대체를 겹쳐 자기모순 줄에'),
  r('T06.4', ['E05', 'E15'], 'BREAK', 'C07 조합 대체'),
  r('T07.4', ['E02', 'E04'], 'BREAK', 'C10'),
  r('T10.2', ['E05', 'E15'], 'BREAK', 'C11'),
  r('T10.2', ['E05', 'VICTIM'], 'HALF', '조합의 한 장 + 반쪽'),
  r('T04.2', ['E06', 'E16'], 'HALF', '정답 + 반쪽(정답 + 군더더기는 HALF)'),
  r('T08.3', ['E05', 'E12'], 'HALF', "v3 — '22:02 태블릿 + 미숙 쪽문' 추론(블라인드 지적 그대로)"),
  r('T10.3', ['E12', 'E16'], 'HALF', '정답 + 반쪽'),
  r('T10.4', ['E05', 'E12'], 'REDIRECT', "v3 — '공용 계정 둘 + 미숙 부재 → 태블릿은 준혁'(바이블 R-07 근거 그대로)"),
  r('T10.4', ['E03a', 'E12'], 'HALF', '반쪽 + 우회 카드', ['C11']),
  r('T10.4', ['E16', 'S4'], 'HALF', "정답 + '늘 정장' 프로필(군더더기 → HALF, 감점 없음)", ['C11']),
];

const stateFor = (row: Row): RunState => ({ ...newRun(), broken: row.broken ?? [] });

describe('공정성 전수 점검(v3) — 논리상 맞는 카드는 감점하지 않는다', () => {
  it('AUDIT · PAIRS 판정이 기대와 같다', () => {
    for (const row of [...AUDIT, ...PAIRS]) expect(judgePresent(stateFor(row), row.line, row.cards).kind, `${row.line} [${row.cards}] — ${row.why}`).toBe(row.want);
  });

  it('RELATED 의 모든 카드는 AUDIT 에 판정·이유가 있다(검토 없이 새 연결이 생기지 않게)', () => {
    for (const [line, cards] of Object.entries(RELATED))
      for (const c of cards) expect(AUDIT.some((x) => x.line === line && x.cards.length === 1 && x.cards[0] === c), `${line} ${c} 판정 없음`).toBe(true);
    for (const row of AUDIT) expect(RELATED[row.line]?.includes(row.cards[0]), `${row.line} ${row.cards[0]} 가 RELATED 에 없음`).toBe(true);
  });

  it('RELATED 의 두 장 조합: 두 장 다 감점이 아니면 겹쳐도 감점이 아니다', () => {
    let pairs = 0;
    for (const [line, cards] of Object.entries(RELATED))
      for (let i = 0; i < cards.length; i++)
        for (let j = i + 1; j < cards.length; j++) {
          const ok = (c: CardId) => AUDIT.some((x) => x.line === line && x.cards[0] === c && x.cards.length === 1 && x.want !== 'WRONG' && !x.broken?.length);
          if (!ok(cards[i]) || !ok(cards[j])) continue;
          pairs++;
          expect(judgePresent(newRun(), line, [cards[i], cards[j]]).kind, `${line} [${cards[i]}, ${cards[j]}]`).not.toBe('WRONG');
        }
    expect(pairs).toBeGreaterThan(10);
  });

  it('엔진 전수 수치 — 줄 × 1~2장 조합, 감점 판정 중 RELATED 조합은 전부 AUDIT 에서 이유가 붙은 것뿐', () => {
    const cards = [...KNOWN.cards];
    const combos: CardId[][] = [];
    for (let i = 0; i < cards.length; i++) {
      combos.push([cards[i]]);
      for (let j = i + 1; j < cards.length; j++) combos.push([cards[i], cards[j]]);
    }
    let total = 0;
    let wrong = 0;
    const lines = CASE.sets.filter((s) => s.kind !== 'tutorial').flatMap((s) => s.lines);
    for (const l of lines)
      for (const cs of combos) {
        total++;
        const k = judgePresent(newRun(), l.id, cs).kind;
        if (k !== 'WRONG') continue;
        wrong++;
        const rel = RELATED[l.id] ?? [];
        if (cs.length === 1 && rel.includes(cs[0]))
          expect(AUDIT.find((x) => x.line === l.id && x.cards[0] === cs[0] && x.cards.length === 1)?.want, `${l.id} ${cs[0]}`).toBe('WRONG');
      }
    expect(lines.length).toBe(46);
    expect(total).toBe(46 * combos.length);
    expect(wrong / total).toBeGreaterThan(0.9); // 무차별 대입은 여전히 거의 다 감점(긴장 유지)
  });
});
