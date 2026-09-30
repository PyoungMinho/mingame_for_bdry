import type { Effect, Outcome, Para, StoryNode } from '../types';

/**
 * 4장 「어른의 명의」 (2013~2016, 세는나이 21~24세 — 1~3장·7장과 같은 기준)
 *
 * 흐름: c4_start(2013-07 성년·명의 이전) → c4_korbit(2013-11 코빗·첫 $1,000)
 *   ├─ 남: c4_army(2014-02 입대, 훈련소에서 마운트곡스 파산)
 *   └─ 여: c4_abroad(2014-02 교환학생, 기숙사에서 마운트곡스 파산)
 *   → c4_ltv(2014-08 LTV 70%, 은마 앞)
 *   ├─ 명의 이전을 미룬 사람: c4_gift2014(2014-12 공제 5천만 원으로 다시 결정)
 *   └─ 나머지: c4_nominee(2014-12 차명거래 금지법 시행, 식탁)
 *   → c4_eunsu(2015-12 한강, 은수 재회) → c4_alphago(2016-03 알파고) → c5_start
 *
 * 성년: 주인공은 1993년 봄 생 — 구 민법(만 20세)으로 2013년 봄 생일에 이미 성년. 2013-07-01 개정 시행은
 *   가을·겨울생 동창들이 따라온 날이다(protagonist.majority_date, civil.majority_age.pre2013·2013).
 * 여자 판 타임라인: 2014-02 교환학생 출국 → 2014-08 여름 방학 잠깐 귀국 → 2014-12 두 학기 마치고 귀국 → 2016 마지막 학년.
 *
 * 장 로컬 플래그: c4_defer(명의 이전 보류), c4_warned_junho, c4_apt_plan, c4_parents_home, c4_nvda
 * 공유 플래그 set: transfer_declare / transfer_keep / transfer_hide, hdd_wallet, hdd_lost, army, abroad, first_love
 * 공유 플래그 clear: btc_on_mtgox·hdd_wallet — 마운트곡스 파산 시점에 코인이 하나도 없으면(이미 다 판 판) 지운다.
 *   그 뒤 btc_on_mtgox 는 "마운트곡스에서 코인을 실제로 잃었다", hdd_wallet 은 "하드디스크에 코인이 든 채 넘어왔다"는 뜻.
 * 공유 플래그 read: stopped_dad, dad_lost, uncle_ally, btc_via_uncle, btc_via_mom, famous_kid, btc_on_mtgox, hdd_wallet,
 *   first_love, sus70(엔진), gift_tax_paid(엔진 — 증여세를 실제로 냄)
 * 코인·집 서술은 플래그만 보지 않고 holding(btc/apt)을 함께 건다(2011년에 다 판 판, 산 적 없는 판 대비).
 *
 * 사실 근거(2차 감사 id): civil.majority_age.2013, protagonist.majority_date, gift.deduction.adult.2000_2013,
 *   gift.deduction.adult.2014, gift.report_credit.2000_2016, crypto.korbit.first_trade, btc.event.first_1000.2013-11-27,
 *   btc.krw.close.2014, btc.krw.high.2018-01-06, btc.event.mtgox_bankruptcy.2014-02-28, army.service_21m,
 *   ltv_dti.2014-08-01, eunma76.kb.2013-12, eunma76.peak2.2022-06, bok.base_rate.2014, deposit.1y.avg.2014,
 *   finrealname.nominee_ban, kospi.close.2013~2015, eunma76.kb.2014-12, btc.usd.close.2014(321 — '달러로 3분의 1 토막')
 * 알파고·세월호는 감사 데이터에 날짜·수치가 없어 숫자 없이 서술한다. 알파고 대국 하드웨어는 엔비디아가 아니므로
 *   '저 칩이 엔비디아'라고 쓰지 않는다(딥러닝의 미래 복선으로만). 2013-11-27은 연중 고점이 아니다 — '꼭대기'라고 단정하지 않는다.
 */

type Body = Omit<Outcome, 'next' | 'when' | 'chance'>;

/** 남은 입대(c4_army), 여는 교환학생(c4_abroad) — 같은 효과·결과를 성별로 복제한다(chance 금지). */
function byGender(o: Body): Outcome[] {
  return [
    { ...o, when: { gender: 'm' }, next: 'c4_army' },
    { ...o, next: 'c4_abroad' },
  ];
}

/** 명의 이전을 미룬 사람은 2014년 12월에 다시 고른다. */
function toDecember(o: Body): Outcome[] {
  return [
    { ...o, when: { flags: ['c4_defer'] }, next: 'c4_gift2014' },
    { ...o, next: 'c4_nominee' },
  ];
}

function merge(base: Effect, extra: Effect): Effect {
  const out: Effect = { ...base, ...extra };
  for (const k of ['trust', 'happy', 'health', 'sus'] as const) {
    const v = (base[k] ?? 0) + (extra[k] ?? 0);
    if (v) out[k] = v;
    else delete out[k];
  }
  const flags = [...(base.setFlags ?? []), ...(extra.setFlags ?? [])];
  if (flags.length) out.setFlags = flags;
  return out;
}

/**
 * 2014년 2월 마운트곡스 파산 — 어떤 선택을 해도 거기 둔 코인은 사라진다.
 * 개인 지갑(외장하드)은 짐 정리 중 분실 위기(chance). 순서: 마운트곡스 → 하드 분실 → 하드 무사 → 코인 없음(플래그 정리) → 해당 없음.
 */
function goxFallout(s: {
  base: Effect;
  lossChance: number;
  mtgox: Para[];
  hddLost: Para[];
  hddSafe: Para[];
  normal: Para[];
}): Outcome[] {
  return [
    {
      when: { flags: ['btc_on_mtgox'], holding: ['btc'] },
      effects: merge(s.base, { lose: [{ asset: 'btc', pct: 1 }], happy: -14 }),
      result: s.mtgox,
      next: 'c4_ltv',
    },
    {
      when: { flags: ['hdd_wallet'], noFlags: ['hdd_lost'], holding: ['btc'] },
      chance: s.lossChance,
      effects: merge(s.base, { lose: [{ asset: 'btc', pct: 1 }], happy: -18, setFlags: ['hdd_lost'] }),
      result: s.hddLost,
      next: 'c4_ltv',
    },
    {
      when: { flags: ['hdd_wallet'], noFlags: ['hdd_lost'], holding: ['btc'] },
      effects: merge(s.base, { happy: 1 }),
      result: s.hddSafe,
      next: 'c4_ltv',
    },
    // 코인이 하나도 없는데 옛 플래그가 남은 판(결산에서 다 판 경우) — 이후 장이 "잃었다/서랍에 있다"로 오독하지 않게 지운다
    { when: { noHolding: ['btc'] }, effects: { ...s.base, clearFlags: ['btc_on_mtgox', 'hdd_wallet'] }, result: s.normal, next: 'c4_ltv' },
    { effects: s.base, result: s.normal, next: 'c4_ltv' },
  ];
}

const GOX_BODY_MTGOX: Para = {
  when: { flags: ['btc_on_mtgox'], holding: ['btc'] },
  text: '숨이 멎는다. 저기에 내 코인이 있다. 알고 있었다. 석 달 전에 뺄 수 있었다.',
};
const GOX_BODY_CLEAN: Para = {
  when: { noFlags: ['btc_on_mtgox', 'hdd_wallet'] },
  text: '내 코인은 저기 없다. 남의 일이다. 남의 일이라 다행인 게, 조금 미안하다.',
};
const GOX_BODY_SOLD: Para = {
  when: { flags: ['btc_on_mtgox'], noHolding: ['btc'] },
  text: '한때 내 코인도 저기 있었다. 다 팔고 나온 뒤라 등골이 늦게 서늘해진다. 남의 일이 될 뻔한 게 아니라, 남의 일이 된 거다.',
};
const GOX_BODY_EMPTY_HDD: Para = {
  when: { flags: ['hdd_wallet'], noFlags: ['btc_on_mtgox'], noHolding: ['btc'] },
  text: '내 코인은 저기 없다. 서랍 속 하드디스크도 이미 비웠다. 남의 일이라 다행인 게, 조금 미안하다.',
};

export const c4: Record<string, StoryNode> = {
  // ───────────────────────────── 1. 성년, 명의 이전 ─────────────────────────────
  c4_start: {
    id: 'c4_start',
    chapter: 4,
    date: '2013-07',
    scene: 'family_table',
    title: '엄마 이름의 통장들',
    alert: { kind: 'news', from: '뉴스 속보', text: '오늘부터 만 19세 성년 — 개정 민법 시행' },
    body: [
      '2013년 7월 1일. 개정 민법이 시행되고 성년이 만 19세로 내려온다. 7월 이후에 태어난 동창들이, 빠른 94까지, 오늘 한꺼번에 어른이 된다. 나는 한발 먼저였다. 봄 생일에 만 스무 살, 옛 민법으로 이미 어른이 됐다.',
      '생일상엔 미역국뿐이었다. 통장 얘기는 엄마도 나도 꺼내지 않았다. 동창들까지 다 어른이 된 오늘 밤에야, 엄마가 먼저 꺼낸다.',
      '밤 아홉 시. 은하미용실 셔터를 내리고 온 엄마가 앞치마도 안 푼 채 식탁에 통장을 늘어놓는다. 전부 엄마 이름이다. 여덟 살짜리 헛소리를 믿어 준 13년이 그 안에 들어 있다.',
      { when: { maxNetWorth: 30_000_000 }, text: '들어 있는 건 솔직히 많지 않다. 그래도 엄마는 그걸 적금 붓듯 지켜 왔다.' },
      { when: { minNetWorth: 300_000_000, maxNetWorth: 9_999_999_999 }, text: '엄마가 잔고의 동그라미를 세다가 두 번 틀린다. 가위 들고 평생 벌어도 못 만져 볼 숫자다.' },
      {
        when: { minNetWorth: 10_000_000_000 },
        text: '엄마는 동그라미를 세다 말고 통장을 덮는다. "이거는… 나라가 가만 안 두겠다." 틀린 말이 아니다. 이 숫자가 스물한 살 이름으로 넘어가는 순간, 누군가는 서류를 편다.',
      },
      '"인자 니 이름으로 가져가라. 근데 이거, 그냥 가져가도 되는 기가?" 가계부 쓰는 사람은 안다. 공짜로 옮겨지는 돈은 없다.',
      '길은 셋이다. 증여 신고하고 세금을 낸다. 엄마 명의로 둔다. 조용히 빼 온다. 서른셋의 기억이 한 줄 보탠다. 내년 1월 1일부터 성년 자녀 증여공제가 3천만 원에서 5천만 원으로 오른다. 반년만 버티면 2천만 원을 더 세금 없이 옮길 수 있다. 그 반년 동안 아무 일도 없다면.',
      { when: { flags: ['stopped_dad'] }, text: '아빠는 신문 너머로 듣기만 한다. 2000년에 새롬기술을 말린 뒤로, 이 집에서 내 말은 무게가 다르다.' },
      { when: { flags: ['dad_lost'] }, text: '아빠는 텔레비전 볼륨을 한 칸 올린다. 2000년 코스닥 얘기는 이 식탁의 금지어다.' },
      { when: { flags: ['uncle_ally'] }, text: '막내삼촌이 수박을 베어 물며 끼어든다. "뭘 신고를 해. 현금으로 빼, 누가 안다고." 공범 1호다운 조언이다.' },
    ],
    choices: [
      {
        id: 'declare',
        label: '증여 신고하고 세금을 낸다',
        hint: '세금이 나오면 낸다',
        tags: ['honest', 'safe'],
        outcomes: [
          {
            effects: { transfer: 'declare', sus: -10, trust: 2, happy: -4, setFlags: ['transfer_declare'] },
            result: [
              '다음 날 세무서 민원실. 번호표 뽑고 40분. 기한 안에 자진신고하면 산출세액의 10%를 깎아 준다고 창구 직원이 알려 준다. 1회차의 나는 평생 몰랐던 제도다.',
              { when: { maxNetWorth: 30_000_000 }, text: '공제 한도 안쪽이라 낼 세금은 없다. 신고서 한 장으로 돈의 출처가 깨끗해진다.' },
              {
                when: { minNetWorth: 30_000_001, maxNetWorth: 299_999_999 },
                text: '공제 3천만 원을 넘는 몫에 세금이 붙는다. 통장에서 숫자가 빠져나간다. 아깝다. 아까운 만큼 깨끗해진다.',
              },
              { when: { minNetWorth: 300_000_000 }, text: '엄마가 고지서 숫자를 가계부에 옮겨 적다가 볼펜을 내려놓는다. "세금을 이래 내고도… 남는 기가?" 남는다. 엄마 얼굴을 보니 그게 더 무섭다.' },
              '이제 이 돈엔 이름표가 붙었다. 내 이름. 누가 물어도 서류 한 장이면 끝난다.',
            ],
            next: 'c4_korbit',
          },
        ],
      },
      {
        id: 'keep',
        label: '엄마 명의 그대로 둔다',
        hint: '엄마를 믿는 만큼',
        tags: ['family'],
        outcomes: [
          {
            when: { max: { trust: 40 } },
            effects: { transfer: 'keep', trust: -2, setFlags: ['transfer_keep'] },
            result: [
              '엄마가 통장을 서랍에 도로 넣는다. 잠금장치 딸깍 소리가 유난히 크다.',
              '명의는 엄마, 돈은 나. 요즘 우리 사이로는, 이 문장이 언제까지 참일지 모르겠다.',
            ],
            next: 'c4_korbit',
          },
          {
            effects: { transfer: 'keep', trust: 2, happy: 1, setFlags: ['transfer_keep'] },
            result: [
              '"그라믄 엄마가 계속 들고 있으께." 엄마 얼굴이 조금 펴진다. 통장이 서랍으로 돌아간다.',
              '세금은 0원. 대신 이 돈은 엄마 기분과 엄마 건강과 엄마 서명 위에 놓였다. 가족이니까 괜찮다. 아마도.',
            ],
            next: 'c4_korbit',
          },
        ],
      },
      {
        id: 'hide',
        label: '현금으로 빼서 조용히 옮긴다',
        hint: '세금 0원, 대신…',
        tags: ['sly'],
        outcomes: [
          {
            effects: { transfer: 'hide', sus: 10, trust: -6, setFlags: ['transfer_hide'] },
            result: [
              '몇 주에 걸쳐 조금씩 뺀다. 은행 창구 직원이 두 번째부터 얼굴을 기억한다.',
              '머릿속 달력에 동그라미가 하나 있다. 2014년 11월 29일. 그날부터 탈법 목적의 차명거래는 형사처벌 대상이 된다. 아직 1년 넘게 남았다. 아직은.',
              { when: { flags: ['uncle_ally'] }, text: '삼촌이 엄지를 든다. 이 집에서 제일 믿으면 안 되는 사람의 칭찬이다.' },
            ],
            next: 'c4_korbit',
          },
        ],
      },
      {
        id: 'defer',
        label: '해 넘겨서 정리하자고 한다',
        hint: '공제는 오른다, 값도 변한다',
        tags: ['safe'],
        outcomes: [
          {
            effects: { trust: 1, setFlags: ['c4_defer'] },
            result: [
              '"와 하필 내년이고?" "그냥… 느낌이 그래." 반년 뒤면 공제가 2천만 원 늘어난다는 말은 삼킨다. 내년 세법을 외우고 다니는 스물한 살은 없다.',
              '엄마는 고개를 갸웃하며 통장을 도로 챙긴다. 그동안 이 돈은 여전히 엄마 이름이다. 엄마를 믿는 동안만 내 돈이다.',
            ],
            next: 'c4_korbit',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 2. 코빗, 첫 1,000달러 ─────────────────────────────
  c4_korbit: {
    id: 'c4_korbit',
    chapter: 4,
    date: '2013-11',
    scene: 'oneroom_coin',
    title: '네 자리가 된 밤',
    alert: { kind: 'ticker', text: 'BTC/USD 1,000 돌파 (마운트곡스)' },
    body: [
      '11월 27일, 자정이 가까운 학교 앞 원룸. 기말 과제 파일을 띄워 둔 채 다른 창만 본다. 마운트곡스 시세창에 네 자리 숫자가 뜬다. 비트코인, 처음으로 1,000달러.',
      '9월 3일, 코빗에서 국내 첫 원화 거래가 체결됐다. 이제 해외 송금도 어른 명의도 필요 없다. 내 이름, 내 계좌, 내 클릭.',
      { when: { flags: ['btc_via_uncle'] }, text: '삼촌 손을 빌려 해외 거래소에 가던 시절은 끝났다. 삼촌은 좀 섭섭해한다. "내가 뚫어 준 길인데."' },
      { when: { flags: ['btc_via_mom'] }, text: '엄마 이름으로 해외 송금 신청서를 쓰던 시절도 끝났다. 엄마는 오히려 반긴다. "인자 은행 가서 그 영어 신청서 안 써도 되제?"' },
      '카톡이 온다. 준호다. "야 비트코인 천 달러 찍었대ㅋㅋ 지금 타도 되냐" 스타크래프트 빌드 오더를 외우던 머리로, 준호는 이제 차트를 외운다.',
      '이 불꽃은 오래 못 간다. 내년 말이면 달러로 3분의 1 토막이다. 그리고 몇 년 더 지나면, 오늘 가격은 헐값이 된다. 둘 다 사실이라서 곤란하다.',
      { when: { flags: ['btc_on_mtgox'], holding: ['btc'] }, text: '그리고 내 코인은 아직 도쿄의 마운트곡스에 있다. 석 달 뒤 그 거래소에 무슨 일이 생기는지도 안다.' },
      { when: { flags: ['hdd_wallet'], holding: ['btc'] }, text: '외장하드 속 지갑 파일은 책상 서랍에서 잘 자고 있다. 거래소가 망해도 저건 안 망한다. 잃어버리지만 않으면.' },
    ],
    choices: [
      {
        id: 'sell_top',
        label: '천 달러에 절반 판다',
        hint: '꼭대기 근처에서 내린다',
        requires: { holding: ['btc'] },
        tags: ['trader'],
        outcomes: byGender({
          effects: { trades: [{ kind: 'sell', asset: 'btc', pct: 0.5, at: 'ev-2013-11-27' }], sus: 3 },
          result: [
            '매도 버튼을 누르는 손가락이 생각보다 무겁다. 파는 순간에도 머릿속 다른 방에서는 몇 년 뒤의 광풍이 소리를 지른다.',
            '준호가 답장한다. "미쳤냐 이제 시작인데." 1회차의 나라면 똑같이 말했을 거다.',
            { when: { flags: ['btc_on_mtgox'] }, text: '남은 절반은 여전히 도쿄에 있다. 그 생각이 잠깐 스쳤다가, 기말고사에 밀려난다.' },
          ],
        }),
      },
      {
        id: 'buy_cold',
        label: '사서 개인 지갑에 묻는다',
        hint: '거래소는 못 믿는다',
        tags: ['hodl'],
        outcomes: byGender({
          effects: {
            trades: [{ kind: 'buy', asset: 'btc', pct: 0.5, at: 'ev-2013-11-27' }],
            sus: 2,
            setFlags: ['hdd_wallet'],
            clearFlags: ['btc_on_mtgox'],
          },
          result: [
            '꼭대기 근처인 줄 알면서 산다. 10년쯤 뒤에서 보면 여기도 바닥이니까.',
            '산 코인은 거래소에 두지 않는다. 거래소가 어떻게 죽는지는 너무 많이 봤다. 지갑 파일을 외장하드에 옮기고, 하드는 책상 서랍 깊숙이.',
            { when: { flags: ['btc_on_mtgox'], holding: ['btc'] }, text: '마운트곡스에 있던 코인도 이참에 전부 빼 온다. 출금 버튼이 아직 눌린다. 아직은.' },
          ],
        }),
      },
      {
        id: 'withdraw',
        label: '마운트곡스에서 코인을 뺀다',
        hint: '석 달 뒤를 안다',
        requires: { flags: ['btc_on_mtgox'], holding: ['btc'] },
        tags: ['safe'],
        outcomes: byGender({
          effects: { happy: 1, setFlags: ['hdd_wallet'], clearFlags: ['btc_on_mtgox'] },
          result: [
            '전송 버튼. 확인 메일. 또 확인. 새벽 네 시까지 입금 내역을 새로고침한다.',
            '도쿄에서 서랍 속 외장하드로, 코인이 이사를 마친다. 석 달 뒤의 뉴스가 이제 남의 일이 된다. 서랍만 잘 지키면.',
          ],
        }),
      },
      {
        id: 'warn_junho',
        label: '준호를 말린다',
        hint: '친구는 꼭대기에서 산다',
        tags: ['safe'],
        outcomes: byGender({
          effects: { happy: 1, setFlags: ['c4_warned_junho'] },
          result: [
            '"지금은 사지 마. 진짜 꼭대기야." "니가 그걸 어떻게 아는데." 대답할 수 없는 질문이다.',
            '준호는 결국 산다. 내 말을 반만 들어서, 반만 산다. 친구를 말리는 데도 요령이 필요하다는 걸 그날 배운다.',
          ],
        }),
      },
    ],
  },

  // ───────────────────────────── 3-남. 입대, 훈련소의 마운트곡스 ─────────────────────────────
  c4_army: {
    id: 'c4_army',
    chapter: 4,
    date: '2014-02',
    scene: 'barracks',
    title: '행정반 TV의 도쿄',
    alert: { kind: 'news', from: '뉴스 속보', text: '日 비트코인 거래소 마운트곡스 파산보호 신청… 85만 BTC 분실' },
    body: [
      '머리를 민다. 휴대폰을 반납한다. 이름 대신 번호로 불린다. 육군 21개월. 1회차에 한 번 해 본 군대를 스물두 살 몸으로 또 한다. 요령은 안다. 체력이 모자랄 뿐.',
      '2월 말 저녁, 행정반 TV 자막이 흘러간다. 도쿄의 비트코인 거래소 마운트곡스, 파산보호 신청. 85만 개 분실. 2월 7일부터 출금이 막혀 있었단다. 동기가 묻는다. "비트코인이 뭐냐?"',
      GOX_BODY_MTGOX,
      {
        when: { flags: ['hdd_wallet'], noFlags: ['hdd_lost'], holding: ['btc'] },
        text: '그리고 번개처럼 떠오른다. 외장하드. 입대 전에 원룸을 빼면서 짐을 전부 집으로 부쳤다. 엄마는 "안 쓰는 건 싹 갖다 버린다" 했다.',
      },
      GOX_BODY_CLEAN,
      GOX_BODY_SOLD,
      GOX_BODY_EMPTY_HDD,
    ],
    choices: [
      {
        id: 'payphone',
        label: '공중전화 줄에 선다',
        hint: '통화는 3분',
        tags: ['family'],
        outcomes: goxFallout({
          base: { trust: 1, setFlags: ['army'] },
          lossChance: 0.15,
          mtgox: [
            '3분 중 1분을 엄마한테 마운트곡스를 설명하는 데 쓴다. "마운트 뭐?" 설명이 끝나기도 전에 깨닫는다. 설명해도 달라지는 건 없다.',
            '거기 둔 코인은 이제 서류 속 숫자다. 먼 훗날 일부가 돌아온다는 것도 알지만, 먼 훗날은 먼 훗날이다. 남은 2분은 엄마 목소리를 듣는 데 쓴다.',
          ],
          hddLost: [
            '"까만 거? 그거 지난주에 고물상 할배 줬는데. 와, 중요한 기가?" 수화기를 쥔 손에 땀이 찬다.',
            '그 안에 뭐가 들었는지 말하면 엄마는 쓰러진다. "아니, 괜찮아." 괜찮지 않다. 그날 밤 불침번을 서며, 고물상 트럭이 지금 어디쯤 굴러가고 있을지 생각한다.',
          ],
          hddSafe: [
            '"까만 거? 니 책상에 그대로 있다. 와?" 3분 중 2분을 "절대 버리지 마"에 쓴다.',
            '엄마가 웃는다. "군대 가더니 별걸 다 챙기네." 그 까만 네모 안에 뭐가 들었는지는 전역하고 말하기로 한다.',
          ],
          normal: [
            '엄마 목소리를 듣는다. 밥은 먹었나, 춥지는 않나. 코인 얘기는 한 마디도 없다.',
            '뒷사람이 헛기침을 한다. 3분이 이렇게 짧았나. 수화기를 내려놓고서야, 처음으로 스물두 살 같은 기분이 든다.',
          ],
        }),
      },
      {
        id: 'preach',
        label: '동기들에게 비트코인을 가르친다',
        hint: '훈련소 예언가',
        outcomes: goxFallout({
          base: { sus: 4, happy: 2, setFlags: ['army'] },
          lossChance: 0.4,
          mtgox: [
            '"이게 뭐냐면, 인터넷 돈인데…" 설명하다 목이 멘다. 방금 그 인터넷 돈의 일부가 증발했다.',
            '동기들은 "너 거기 돈 넣었냐"며 낄낄댄다. 넣었다. 그리고 뺄 수 있었다. 그 두 문장이 21개월 내내 따라다닌다.',
          ],
          hddLost: [
            '"몇 년 뒤엔 하나에 몇천만 원 간다니까." 동기들이 배를 잡고 웃는다. 별명이 생긴다. 코인 도사.',
            '주말에야 전화를 건다. 엄마가 말한다. "서랍 정리했다. 까만 거는 버렸고." 코인 도사가 전화부스 안에서 말을 잃는다.',
          ],
          hddSafe: [
            '"몇 년 뒤엔 하나에 몇천만 원 간다니까." 동기들이 배를 잡고 웃는다. 별명이 생긴다. 코인 도사.',
            '주말 통화에서 엄마가 말한다. "서랍 치우다 까만 거 나왔는데, 버릴라다 말았다." 코인 도사가 전화부스 안에서 합장을 한다.',
          ],
          normal: [
            '"몇 년 뒤엔 하나에 몇천만 원 간다니까." 동기들이 배를 잡고 웃는다. 별명이 생긴다. 코인 도사.',
            '웃긴 건, 이 중 누군가는 몇 년 뒤 나를 찾아와 그때 그 얘기 다시 해 보라고 할 거라는 사실이다.',
          ],
        }),
      },
      {
        id: 'forget',
        label: '잊는다. 지금은 군인이다',
        hint: '할 수 있는 게 없다',
        tags: ['safe'],
        outcomes: goxFallout({
          base: { health: 5, happy: -2, setFlags: ['army'] },
          lossChance: 0.3,
          mtgox: [
            '눈을 감는다. 할 수 있는 건 없다. 문은 2월 7일에 이미 닫혔다.',
            '그날부터 연병장을 남들보다 한 바퀴 더 돈다. 몸이라도 힘들어야 생각이 멎는다. 거기 둔 코인은 서류 속 숫자가 된다.',
          ],
          hddLost: [
            '생각을 끈다. 엄마가 설마 그걸 버리겠어.',
            '설마가 사람 잡는다. 자대 첫 면회 날, 엄마가 치킨을 내밀며 말한다. "니 방 싹 치웠다. 쓸데없는 거 다 버리고." 치킨이 목에 걸린다.',
          ],
          hddSafe: [
            '생각을 끈다. 엄마가 설마 그걸 버리겠어.',
            '자대 첫 면회 날, 엄마가 치킨을 내밀며 말한다. "니 방 싹 치웠는데, 까만 거 하나는 니 거 같아서 뒀다." 치킨이 유난히 맛있다.',
          ],
          normal: [
            '구보, 사격, 제식. 몸이 바쁘니 머리가 조용하다. 이번 생이 시작된 뒤로 처음 느끼는 고요다.',
            '차트 없는 21개월. 어쩌면 이번 생에서 제일 건강한 시간일지도 모른다.',
          ],
        }),
      },
    ],
  },

  // ───────────────────────────── 3-여. 교환학생, 새벽 세 시 ─────────────────────────────
  c4_abroad: {
    id: 'c4_abroad',
    chapter: 4,
    date: '2014-02',
    scene: 'campus',
    title: '새벽 세 시의 기숙사',
    alert: { kind: 'news', from: '뉴스 속보', text: '日 비트코인 거래소 마운트곡스 파산보호 신청… 85만 BTC 분실' },
    body: [
      '교환학생 첫 학기. 비행기로 열두 시간 떨어진 작은 대학 도시. 캐리어 절반은 옷, 절반은 엄마가 욱여넣은 김과 고추장이다. 공항에서 엄마는 끝까지 "밥 무라"만 세 번 했다.',
      '2월 말, 시차 때문에 새벽 세 시에 깨어 노트북을 연다. 헤드라인. 도쿄의 비트코인 거래소 마운트곡스, 파산보호 신청. 85만 개 분실. 2월 7일부터 출금이 막혀 있었단다. 룸메이트가 잠결에 묻는다. "Are you okay?"',
      GOX_BODY_MTGOX,
      {
        when: { flags: ['hdd_wallet'], noFlags: ['hdd_lost'], holding: ['btc'] },
        text: '그리고 등골이 서늘해진다. 외장하드. 출국 전에 원룸을 빼면서 짐을 전부 집으로 부쳤다. 엄마는 봄맞이 대청소를 한다고 했다.',
      },
      GOX_BODY_CLEAN,
      GOX_BODY_SOLD,
      GOX_BODY_EMPTY_HDD,
    ],
    choices: [
      {
        id: 'intl_call',
        label: '국제전화 카드를 긁는다',
        hint: '분당 요금이 아깝다',
        tags: ['family'],
        outcomes: goxFallout({
          base: { trust: 1, setFlags: ['abroad'] },
          lossChance: 0.15,
          mtgox: [
            '서울은 오전 열한 시. 미용실 드라이기 소리 너머로 엄마가 묻는다. "마운트 뭐?" 설명이 끝나기도 전에 깨닫는다. 설명해도 달라지는 건 없다.',
            '거기 둔 코인은 이제 서류 속 숫자다. 먼 훗날 일부가 돌아온다는 것도 알지만, 먼 훗날은 먼 훗날이다. 남은 통화는 엄마 목소리를 듣는 데 쓴다.',
          ],
          hddLost: [
            '"까만 거? 대청소하다 고물상 할배 줬는데. 와, 중요한 기가?" 기숙사 복도 끝에서 무릎이 풀린다.',
            '그 안에 뭐가 들었는지 말하면 엄마는 쓰러진다. "아니, 괜찮아." 괜찮지 않다. 창밖이 밝아 올 때까지, 지구 반대편 고물상 트럭을 생각한다.',
          ],
          hddSafe: [
            '"까만 거? 니 책상에 그대로 있다. 와?" 비싼 국제전화 절반을 "절대 버리지 마"에 쓴다.',
            '엄마가 웃는다. "외국 가더니 별걸 다 챙기네." 그 까만 네모 안에 뭐가 들었는지는 귀국해서 말하기로 한다.',
          ],
          normal: [
            '엄마 목소리를 듣는다. 밥은 먹나, 거기 춥나. 코인 얘기는 한 마디도 없다.',
            '카드 잔액이 줄어드는 소리가 들리는 것 같다. 전화를 끊고서야, 처음으로 스물두 살 같은 기분이 든다.',
          ],
        }),
      },
      {
        id: 'roommate',
        label: '룸메이트에게 비트코인을 설명한다',
        hint: '새벽 세 시의 예언',
        outcomes: goxFallout({
          base: { sus: 3, happy: 2, setFlags: ['abroad'] },
          lossChance: 0.4,
          mtgox: [
            '"It\'s like internet money…" 설명하다 목이 멘다. 방금 그 인터넷 돈의 일부가 증발했다.',
            '룸메이트가 "너 거기 돈 넣었어?"라고 묻는다. 넣었다. 그리고 뺄 수 있었다. 그 두 문장이 한 학기 내내 따라다닌다.',
          ],
          hddLost: [
            '"몇 년 뒤엔 하나에 몇천만 원이야." 룸메이트가 웃으며 별명을 붙인다. 코리안 오라클.',
            '주말에야 전화를 건다. 엄마가 말한다. "서랍 정리했다. 까만 거는 버렸고." 오라클이 기숙사 복도에서 말을 잃는다.',
          ],
          hddSafe: [
            '"몇 년 뒤엔 하나에 몇천만 원이야." 룸메이트가 웃으며 별명을 붙인다. 코리안 오라클.',
            '주말 통화에서 엄마가 말한다. "서랍 치우다 까만 거 나왔는데, 버릴라다 말았다." 오라클이 복도에서 두 손을 모은다.',
          ],
          normal: [
            '"몇 년 뒤엔 하나에 몇천만 원이야." 룸메이트가 웃으며 별명을 붙인다. 코리안 오라클.',
            '룸메이트는 결국 한 푼도 사지 않는다. 그게 제일 현명한 반응이라는 걸, 조금 부럽게 인정한다.',
          ],
        }),
      },
      {
        id: 'library',
        label: '도서관에 간다. 여기 온 이유다',
        hint: '할 수 있는 게 없다',
        tags: ['safe'],
        outcomes: goxFallout({
          base: { health: 3, happy: 1, setFlags: ['abroad'] },
          lossChance: 0.3,
          mtgox: [
            '노트북을 덮는다. 할 수 있는 건 없다. 문은 2월 7일에 이미 닫혔다.',
            '해가 뜰 때까지 원서를 읽는다. 한 줄도 머리에 안 들어온다. 거기 둔 코인은 서류 속 숫자가 된다.',
          ],
          hddLost: [
            '노트북을 덮는다. 엄마가 설마 그걸 버리겠어.',
            '설마가 사람 잡는다. 한 달 뒤 엄마 메일. "니 방 싹 치웠다. 쓸데없는 거 다 버리고." 첨부된 사진 속 방이 너무 깨끗하다.',
          ],
          hddSafe: [
            '노트북을 덮는다. 엄마가 설마 그걸 버리겠어.',
            '한 달 뒤 엄마 메일. "니 방 싹 치웠는데, 까만 거 하나는 니 거 같아서 뒀다." 도서관 한복판에서 소리 없이 만세를 부른다.',
          ],
          normal: [
            '도서관은 새벽에도 불이 켜져 있다. 차트 대신 원서를 편다. 모르는 단어가 많아서 좋다.',
            '미래를 아는 인생에서, 모르는 걸 배우는 시간은 드물다. 여기 온 이유가 그거였다는 걸 이제 안다.',
          ],
        }),
      },
    ],
  },

  // ───────────────────────────── 4. LTV 70%, 은마 앞 ─────────────────────────────
  c4_ltv: {
    id: 'c4_ltv',
    chapter: 4,
    date: '2014-08',
    scene: 'apt_night',
    title: '대출 70%의 여름',
    alert: { kind: 'news', from: '경제 뉴스', text: '8월 1일부터 LTV 70%·DTI 60% — 주택담보대출 규제 완화' },
    body: [
      '봄에는 온 나라가 노란 리본을 달았다. 그 봄은 두 번째에도 똑같이 아프다.',
      {
        when: { gender: 'm', noHolding: ['apt'] },
        text: '여름, 첫 휴가. 집에 들르기도 전에 대치동 은마아파트 앞부터 간다. 휴가 나온 일병이 재건축 아파트를 올려다보고 있으니 경비 아저씨가 두 번 쳐다본다.',
      },
      {
        when: { gender: 'm', holding: ['apt'] },
        text: '여름, 첫 휴가. 은마, 우리 집 현관에 군화를 벗는다. 엄마가 김치찌개부터 올린다. 저녁을 먹고 단지를 한 바퀴 돈다. 오늘따라 우리 동이 낯설게 보인다.',
      },
      {
        when: { gender: 'f', noHolding: ['apt'] },
        text: '여름 방학, 잠깐 들어온 한국. 시차도 안 풀린 눈으로 대치동 은마아파트 앞에 선다. 캐리어 바퀴 소리가 단지 안에 유난히 크다.',
      },
      {
        when: { gender: 'f', holding: ['apt'] },
        text: '여름 방학, 잠깐 들어온 한국. 캐리어를 끌고 은마 우리 집 복도를 걷는다. 바퀴 소리가 한밤 복도에 유난히 크다. 오늘따라 우리 동이 낯설게 보인다.',
      },
      '8월 1일부터 대출 규제가 풀렸다. 집값의 70%까지 빌려준다. 작년 말 KB 시세 7억 8,250만 원. 녹슨 복도, 금 간 외벽. 누가 봐도 낡은 아파트다.',
      '8년 뒤, 이 낡은 아파트는 24억이 된다.',
      { when: { maxNetWorth: 9_999_999_999 }, text: '문제는 나머지 30%다. 그리고 세금. 그리고 스물두 살이라는 것.' },
      {
        when: { minNetWorth: 10_000_000_000 },
        text: '대출은 필요 없다. 뭘 조금만 팔아도 몇 채는 산다. 문제는 돈이 아니라, 스물두 살이 강남 아파트를 사면 누군가 반드시 묻는다는 것.',
      },
      { when: { minCash: 300_000_000, maxNetWorth: 9_999_999_999 }, text: '통장엔 그 돈이 있다. 스물두 살의 통장에. 그게 또 다른 문제다.' },
      { when: { maxCash: 299_999_999, maxNetWorth: 299_999_999 }, text: '통장엔 그 돈이 없다. 미래를 알아도 계약금은 현금으로 낸다.' },
      {
        when: { maxCash: 299_999_999, minNetWorth: 300_000_000, maxNetWorth: 9_999_999_999 },
        text: '통장엔 그 돈이 없다. 돈은 다른 데 묶여 있다. 팔면 된다. 스물두 살이 뭘 팔아 은마 계약금을 냈는지, 그걸 설명하는 게 문제다.',
      },
    ],
    choices: [
      {
        id: 'apt_plan',
        label: '연말에 은마를 산다',
        hint: '결산에서 대출 70%',
        tags: ['estate', 'yolo'],
        outcomes: toDecember({
          effects: { happy: 1, sus: 3, setFlags: ['c4_apt_plan'] },
          result: [
            '부동산 유리창에 붙은 매물 쪽지를 사진으로 찍는다. 연말 결산에서, 대출을 끼고, 내 이름으로.',
            { when: { holding: ['apt'] }, text: '우리 집 말고 한 채 더. 옆 동 매물이다.' },
            '연말 KB 시세는 8억 7,750만 원. 작년 말보다 1억 가까이 올라 있을 거다. 기다리는 동안에도 계산서는 불어난다.',
            { when: { minCash: 300_000_000 }, text: '중개사 사장님이 앳된 얼굴을 한참 본다. "부모님이랑 같이 오시죠." 명의는 내 것인데, 신용은 아직 부모님 것이다.' },
            { when: { maxCash: 299_999_999 }, text: '계산기를 두드린다. 모자란다. 연말까지 뭘 팔든, 30%와 세금을 만들어야 한다.' },
            '이 동네에서 제일 비싼 건 집이 아니라, 버티는 시간이다.',
          ],
        }),
      },
      {
        id: 'parents_home',
        label: '부모님께 집부터 사시라 한다',
        hint: '명의는 부모님 것',
        requires: { min: { trust: 60 } },
        lockedHint: '아직 그 말을 꺼낼 신뢰가 없다',
        tags: ['family', 'estate'],
        outcomes: toDecember({
          effects: { trust: 3, happy: 2, setFlags: ['c4_parents_home'] },
          result: [
            { when: { noHolding: ['apt'] }, text: '"우리가 무슨 은마고." 아빠가 웃는다. 은마 아니어도 된다. 부모님 이름으로, 부모님 돈으로, 대출 조금 끼고. 지금이 그때라는 것만 믿어 주면 된다.' },
            {
              when: { holding: ['apt'] },
              text: '"은마 살면서 집을 또 사나." 아빠가 웃는다. 은마는 내 돈으로 산 집이다. 엄마 아빠 돈으로, 엄마 아빠 이름으로 된 집이 하나 있어야 한다. 지금이 그때라는 것만 믿어 주면 된다.',
            },
            { when: { flags: ['stopped_dad'] }, text: '아빠가 계산기를 꺼낸다. 새롬기술 이후로, 아빠는 내 말에 계산기부터 꺼낸다. 그게 아빠식 믿음이다.' },
            { when: { flags: ['dad_lost'] }, text: '아빠가 한참 말이 없다. 2000년에 날린 돈은 아직 이 집 어딘가에 구멍으로 남아 있다. 그래도 고개를 끄덕인다.' },
            '가을에 부모님은 부모님 이름으로 된 새 집으로 이사한다. 엄마가 새 집 현관에 미용실에서 쓰다 바꾼 옛 거울을 건다.',
          ],
        }),
      },
      {
        id: 'deposit',
        label: '대출은 무섭다, 예금에 둔다',
        hint: '금리가 내려간다',
        tags: ['safe'],
        outcomes: toDecember({
          effects: { happy: -2, health: 2 },
          result: [
            '정기예금 금리 2%대. 한국은행은 이달 기준금리를 2.25%로 내린다. 돈은 싸지는데, 나는 돈을 쥐고 있다.',
            '머릿속 서른셋은 이게 틀린 답이라고 한다. 스물두 살은 틀려도 잠은 잘 수 있다고 한다. 오늘은 스물두 살 말을 듣는다.',
          ],
        }),
      },
    ],
  },

  // ───────────────────────────── 5. 차명거래 금지법, 식탁 ─────────────────────────────
  c4_nominee: {
    id: 'c4_nominee',
    chapter: 4,
    date: '2014-12',
    scene: 'family_table',
    title: '귤 까는 손이 느려진다',
    alert: { kind: 'news', from: '뉴스', text: '차명거래 금지법 11월 29일 시행 — 5년 이하 징역 또는 5천만 원 이하 벌금' },
    body: [
      { when: { gender: 'm' }, text: '연말 휴가. 전투복 위에 패딩만 걸치고 식탁에 앉는다. 엄마가 밥부터 퍼 온다. "살이 쏙 빠졌네."' },
      { when: { gender: 'f' }, text: '교환학생 두 학기를 마치고 돌아온 겨울. 캐리어에서 아직 고추장 냄새가 난다.' },
      '은하미용실 셔터를 내린 밤, 식탁 위에 귤 한 봉지. 뉴스가 새 법을 설명한다. 탈세 같은 불법 목적으로 남의 이름을 빌리면, 이름을 빌려준 사람까지 처벌한다. 엄마의 귤 까는 손이 느려진다.',
      { when: { flags: ['transfer_hide'] }, text: '작년 여름 조용히 빼 온 돈이 떠오른다. 신고 한 장 없이 옮긴 돈. 어제까지는 세금 얘기였다. 오늘부터는 앵커의 목소리로 들린다.' },
      { when: { flags: ['transfer_keep'] }, text: '엄마 이름 통장에 내 돈이 있다. 앵커가 한 줄 덧붙인다. 이제 실명계좌의 돈은 명의자 것으로 추정한다고. 법 앞에서 그 돈은 엄마 돈이다. 엄마가 조용히 묻는다. "이거, 우리 괜찮은 기가?"' },
      { when: { flags: ['transfer_declare', 'gift_tax_paid'] }, text: '서랍 속 증여세 신고서 한 장. 이런 뉴스를 귤 까먹으며 볼 수 있는 게, 작년에 낸 세금값이다.' },
      { when: { flags: ['transfer_declare'], noFlags: ['gift_tax_paid'] }, text: '서랍 속 증여세 신고서 한 장. 공제 안쪽이라 낸 세금은 0원이었다. 종이 한 장으로 산 평화치고는 싸다.' },
      '엄마가 다른 얘기를 꺼낸다. 미용실 건물 주인이 바뀌었다고. 내년 봄부터 월세를 올린다고. 간판 불은 반쯤 나갔는데 고칠 엄두가 안 난다고. 가계부 맨 아래 칸이 요즘 자꾸 빨갛다고.',
    ],
    choices: [
      {
        id: 'help_shop',
        label: '은하미용실 살림을 보탠다',
        hint: '돈으로 하는 효도',
        requires: { minNetWorth: 5_000_000 },
        lockedHint: '보탤 돈이 없다',
        tags: ['family'],
        outcomes: [
          {
            when: { minNetWorth: 1_000_000_000, minCash: 50_000_000 },
            effects: { cash: -50_000_000, trust: 4, happy: 2 },
            result: [
              '봉투 대신 통장을 내민다. 올린 월세 몇 해 치에 새 간판 값까지. "이 돈 어데서 났노" 소리는 안 한다. 엄마는 이미 다 안다. 대신 통장을 한참 쥐고 있다.',
              '봄에 은하미용실 간판에 새 불이 들어온다. 엄마가 사진을 찍어 보낸다. 흔들린 사진이다. 그래서 더 좋다.',
            ],
            next: 'c4_eunsu',
          },
          {
            when: { minNetWorth: 100_000_000 },
            effects: { cash: -5_000_000, trust: 3, happy: 2 },
            result: [
              { when: { maxCash: 4_999_999 }, text: '통장만으로는 모자라, 들고 있던 걸 조금 판다. 봉투는 그렇게 채운다.' },
              '"이 돈 어데서 났노" 소리는 안 한다. 엄마는 이미 다 안다. 대신 봉투를 두 번 접었다 편다.',
              '봄에 은하미용실 간판에 새 불이 들어온다. 엄마가 사진을 찍어 보낸다. 흔들린 사진이다. 그래서 더 좋다.',
            ],
            next: 'c4_eunsu',
          },
          {
            when: { minNetWorth: 30_000_000 },
            effects: { cash: -3_000_000, trust: 3, happy: 2 },
            result: [
              { when: { maxCash: 2_999_999 }, text: '통장만으로는 모자라, 들고 있던 걸 조금 판다. 봉투는 그렇게 채운다.' },
              '"이 돈 어데서 났노" 소리는 안 한다. 엄마는 이미 다 안다. 대신 봉투를 두 번 접었다 편다.',
              '봄에 은하미용실 간판에 새 불이 들어온다. 엄마가 사진을 찍어 보낸다. 흔들린 사진이다. 그래서 더 좋다.',
            ],
            next: 'c4_eunsu',
          },
          {
            effects: { cash: -1_500_000, trust: 2, happy: 2 },
            result: [
              { when: { maxCash: 1_499_999 }, text: '통장만으로는 모자라, 들고 있던 걸 조금 판다. 봉투는 그렇게 채운다.' },
              '봉투가 얇다. 대학생 봉투는 원래 얇다. 엄마는 그 얇은 걸 두 번 접었다 편다. "니 밥은 묵고 다니나."',
              '봄에 은하미용실 간판에 나갔던 불이 다시 들어온다. 엄마가 사진을 찍어 보낸다. 흔들린 사진이다. 그래서 더 좋다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
      {
        id: 'declare_late',
        label: '이참에 내 이름으로 신고한다',
        hint: '공제가 5천만 원',
        requires: { flags: ['transfer_keep'] },
        tags: ['honest'],
        outcomes: [
          {
            effects: { transfer: 'declare', sus: -8, trust: 1, clearFlags: ['transfer_keep'], setFlags: ['transfer_declare'] },
            result: [
              '"엄마, 이제 내 이름으로 할게. 세금 내고." 엄마가 귤을 내려놓고 한참 본다. "니 다 컸네."',
              '올해부터 성년 자녀 증여공제는 5천만 원이다. 작년보다 2천만 원 늘었다. 늦게 한 덕을 본다. 이번 생에선 가끔 늦는 것도 답이다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
      {
        id: 'tax_advisor',
        label: '세무사 사무실 문을 두드린다',
        hint: '이미 옮긴 돈인데',
        requires: { flags: ['transfer_hide'] },
        outcomes: [
          {
            effects: { cash: -1_000_000, sus: -5, happy: -4 },
            result: [
              '세무사가 서류를 넘기다 말고 안경을 벗는다. "지금이라도 신고하시면 됩니다. 가산세는 붙고요. 그런데 이 돈, 어디서 났는지 설명하셔야 합니다."',
              '설명할 수 없는 돈이다. 여덟 살 때 미래를 알았다고 할 수는 없으니까. 상담료만 내고 나온다. 문제는 그대로다. 다만 이제, 무엇이 문제인지는 정확히 안다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
      {
        id: 'peel',
        label: '아무 일 없다는 듯 귤을 깐다',
        hint: '뉴스는 뉴스일 뿐',
        outcomes: [
          {
            when: { flags: ['transfer_hide'] },
            effects: { sus: 3, happy: -2 },
            result: [
              '귤이 시다. 채널을 돌린다. 예능에서도 누가 자꾸 "조사"라는 말을 하는 것 같다.',
              '엄마는 모른다. 모르는 게 엄마를 지키는 건지, 나를 지키는 건지 헷갈린다.',
            ],
            next: 'c4_eunsu',
          },
          {
            when: { flags: ['transfer_keep'] },
            effects: { happy: 1 },
            result: [
              '"괜찮다, 엄마." 엄마가 고개를 끄덕인다. 믿어서가 아니라, 믿고 싶어서다.',
              '귤 껍질이 식탁에 작은 산을 이룬다. 명의는 엄마, 돈은 나. 이 겨울까지는 그 문장이 참이다.',
            ],
            next: 'c4_eunsu',
          },
          {
            effects: { happy: 1 },
            result: [
              '귤이 달다. 엄마가 제일 잘 익은 걸 골라 내 쪽으로 민다. 내가 몇 살이든, 몇 번째 인생이든, 엄마는 그걸 한다.',
              '겨울밤이 길다. 그래도 이 식탁은 따뜻하다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 5'. 미뤘던 명의 이전 ─────────────────────────────
  c4_gift2014: {
    id: 'c4_gift2014',
    chapter: 4,
    date: '2014-12',
    scene: 'tax_office',
    title: '해 넘긴 계산서',
    alert: { kind: 'sms', from: '엄마', text: '니 말대로 해 넘겼다. 인자 우짤끼고' },
    body: [
      { when: { gender: 'm' }, text: '연말 휴가. 휴가증을 주머니에 넣은 채 세무서 앞에 선다. 까까머리 군인이 증여세 창구를 기웃거린다. 누가 봐도 사연이 있다.' },
      { when: { gender: 'f' }, text: '교환학생 두 학기를 마치고 돌아온 겨울. 시차가 덜 풀린 눈으로 세무서 앞에 선다.' },
      '1월 1일부로 성년 자녀 증여공제가 5천만 원이 됐다. 작년 여름 식탁에서 삼킨 말이 그대로 법이 됐다. 엄마는 "니 우째 알았노" 대신 "신기하네"를 골랐다.',
      '그리고 11월 29일부터 차명거래 금지법이 시행됐다. 불법 목적으로 남의 이름을 빌리면, 빌린 쪽도 빌려준 쪽도 5년 이하 징역 또는 5천만 원 이하 벌금. 성년이 되고도 1년 반을 엄마 이름에 맡겨 둔 돈, 이제 정말 정리할 때다.',
      '세무서 앞 벤치. 엄마가 보온병 커피를 따라 준다. 선택지는 작년과 똑같다. 달라진 건 숫자뿐이다.',
    ],
    choices: [
      {
        id: 'declare_2014',
        label: '5천만 원 공제 받고 신고한다',
        hint: '기다린 보람',
        tags: ['honest', 'safe'],
        outcomes: [
          {
            effects: { transfer: 'declare', sus: -10, trust: 2, setFlags: ['transfer_declare'] },
            result: [
              { when: { maxNetWorth: 50_000_000 }, text: '번호표, 서류, 도장. 공제 5천만 원 안쪽이라 낼 세금이 없다. 창구 직원이 "딱 맞춰 오셨네요" 한다. 1년 반을 기다린 타이밍이다.' },
              {
                when: { minNetWorth: 50_000_001 },
                text: '번호표, 서류, 도장. 공제 5천만 원을 넘는 몫에 세금이 붙는다. 자진신고 세액공제 10%까지 챙긴다. 창구 직원이 "꼼꼼하시네요" 한다. 1년 반을 기다린 꼼꼼함이다.',
              },
              '엄마가 세무서 계단을 내려가며 말한다. "니는 커서 뭐가 될라꼬 이래 계산이 빠르노." 이미 커 봤다고는 말하지 않는다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
      {
        id: 'keep_2014',
        label: '그래도 엄마 명의로 둔다',
        hint: '법은 법, 엄마는 엄마',
        tags: ['family'],
        outcomes: [
          {
            effects: { transfer: 'keep', trust: 1, setFlags: ['transfer_keep'] },
            result: [
              '보온병 뚜껑을 닫으며 엄마가 말한다. "그래, 엄마가 들고 있으께. 니 필요할 때 말해라."',
              '세무서 앞까지 와서 그냥 돌아간다. 엄마 이름은 여전히 가장 안전한 금고이고, 가장 무거운 짐이다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
      {
        id: 'hide_2014',
        label: '법 시행 한 달째에 몰래 뺀다',
        hint: '간이 커졌다',
        tags: ['sly'],
        outcomes: [
          {
            effects: { transfer: 'hide', sus: 15, trust: -6, setFlags: ['transfer_hide'] },
            result: [
              '"엄마는 모르는 거다." "뭘?" "그래, 그거."',
              '차명거래 금지법 시행 한 달째에 몰래 옮기는 길을 고른다. 진짜 스물두 살이었으면 겁부터 났을 거다. 머릿속 서른셋은 겁 대신 확률을 센다. 좋은 쪽의 계산은 아니다.',
            ],
            next: 'c4_eunsu',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 6. 한강, 은수 ─────────────────────────────
  c4_eunsu: {
    id: 'c4_eunsu',
    chapter: 4,
    date: '2015-12',
    scene: 'hangang_night',
    title: '한강, 편의점 캔맥주',
    body: [
      { when: { gender: 'm' }, text: '전역한 지 한 달. 걸음걸이에 아직 각이 남아 있다. 복학 신청을 하고 나니 할 일이 없다.' },
      { when: { gender: 'f' }, text: '돌아온 지 1년. 영어 단어는 줄고, 대신 동기들 입에서 "갭투자"라는 말이 늘었다.' },
      '과 송년회 2차. 누가 한강 가자고 한다. 편의점 캔맥주, 12월 강바람. 코스피는 올해도 2,000 언저리에서 논다. 누가 "박스피"라며 웃는다. 전세 끼고 집 사는 얘기가 스물세 살들의 안주다.',
      '그리고 은수가 있다.',
      { when: { flags: ['first_love'] }, text: '중학교 복도의 그 은수, 대학 첫 강의실의 그 은수. 이번 생에서 처음으로, 계산 없이 마음이 움직였던 사람.' },
      { when: { flags: ['first_love'], gender: 'm' }, text: '입대하고 편지가 몇 통 오갔다. 상병을 달 무렵 끊겼다. 누가 먼저 안 썼는지는 둘 다 모른 척한다.' },
      { when: { flags: ['first_love'], gender: 'f' }, text: '교환학생 가 있는 동안 시차가 둘 사이를 갉아먹었다. 내가 잘 때 은수가 깨 있었고, 은수가 잘 때 나는 차트를 봤다.' },
      { when: { noFlags: ['first_love'] }, text: '중학교 같은 반, 대학 같은 과. 인연이 두 번이나 옆자리를 스쳐 갔는데, 말 한 번 제대로 못 섞었다. 그 은수가 지금, 내 옆에서 캔을 딴다.' },
      '서른셋의 기억에 은수의 미래는 없다. 1회차의 나는 은수가 어떻게 사는지 몰랐다. 모르는 미래는 이것 하나다. 이상하게, 그게 설렌다.',
      { when: { flags: ['famous_kid'], noFlags: ['first_love'], gender: 'm' }, text: '은수가 눈을 가늘게 뜬다. "너 그거 맞지? 어릴 때 신문에 났던 예언 소년."' },
      { when: { flags: ['famous_kid'], noFlags: ['first_love'], gender: 'f' }, text: '은수가 눈을 가늘게 뜬다. "너 그거 맞지? 어릴 때 신문에 났던 예언 소녀."' },
      { when: { flags: ['famous_kid', 'first_love'] }, text: '은수가 캔을 톡 부딪친다. "너 아직도 예언해? 요즘은 뭐가 오른대?"' },
      { when: { flags: ['sus70'], noFlags: ['famous_kid'] }, text: '은수가 웃는다. "동창들 사이에서 너 유명해. 점쟁이라며."' },
    ],
    choices: [
      {
        id: 'speak_first',
        label: '이번엔 먼저 말을 건다',
        hint: '모르는 미래 쪽으로',
        outcomes: [
          {
            when: { flags: ['first_love'] },
            effects: { happy: 5 },
            result: [
              '"오랜만이다." 준비한 말은 그게 전부인데, 은수가 기다렸다는 듯 웃는다.',
              '막차 시간을 둘 다 모른 척한다. 이 밤의 결말은 모른다. 이번 생에서 제일 좋은 모름이다.',
            ],
            next: 'c4_alphago',
          },
          {
            chance: 0.55,
            effects: { happy: 5, setFlags: ['first_love'] },
            result: [
              '"우리 중학교도 같이 나왔잖아." 은수가 캔을 내려놓는다. "알아. 같은 과 4년 차에 이제야 말 거는 애." "그래서 지금 하려고."',
              '강바람에 캔이 식는 줄도 모른다. 기억 어디에도 없는 장면이다. 각본 없는 장면이 이렇게 떨리는 줄 몰랐다.',
            ],
            next: 'c4_alphago',
          },
          {
            effects: { happy: 1 },
            result: [
              '말을 걸긴 건다. 은수는 친절하게 웃고, 그뿐이다. 번호는 받았다. 그게 오늘의 전부다.',
              '미래를 알아도 사람 마음은 호가창에 안 뜬다. 오히려 그래서 다행이라고, 지하철에서 생각한다.',
            ],
            next: 'c4_alphago',
          },
        ],
      },
      {
        id: 'prophecy',
        label: '비트코인 얘기를 해 버린다',
        hint: '고백 대신 예언',
        tags: ['yolo'],
        outcomes: [
          {
            when: { flags: ['first_love'] },
            effects: { happy: 3, sus: 4 },
            result: [
              '"비트코인 사 둬. 진짜로." 은수가 캔을 흔들며 웃는다. "너 원래 이상했잖아."',
              '그 말이 이상하게 좋다. 이상한 사람으로 기억되는 것도 기억되는 거니까.',
            ],
            next: 'c4_alphago',
          },
          {
            effects: { happy: -4, sus: 5 },
            result: [
              '"비트코인 사 둬. 진짜로." 은수 얼굴이 식는다. 다단계 권유를 들은 얼굴이다.',
              '은수는 화장실 간다며 일어나 다른 무리로 간다. 조언은 정확했고, 타이밍은 최악이었다.',
            ],
            next: 'c4_alphago',
          },
        ],
      },
      {
        id: 'gap_talk',
        label: '갭투자 판에 끼어든다',
        hint: '돈 얘기가 편하다',
        tags: ['estate'],
        outcomes: [
          {
            effects: { happy: -4, sus: 2 },
            result: [
              '"전세가율이 높으면 갭이 작잖아." 동기들 대화에 끼니 말이 술술 나온다. 서른셋에겐 이게 모국어다.',
              '정신을 차리니 은수는 다른 무리에 가 있다. 강 건너 불빛이 예쁘다고 누가 사진을 찍는다. 나는 그 불빛들의 시세를 떠올린다.',
            ],
            next: 'c4_alphago',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 7. 알파고 ─────────────────────────────
  c4_alphago: {
    id: 'c4_alphago',
    chapter: 4,
    date: '2016-03',
    scene: 'alphago',
    title: '기계가 이긴 봄',
    alert: { kind: 'news', from: '뉴스 속보', text: '구글 인공지능 알파고, 세계 정상급 프로 기사 꺾어' },
    body: [
      { when: { gender: 'm' }, text: '복학하고 맞는 첫 봄.' },
      { when: { gender: 'f' }, text: '마지막 학년의 첫 봄.' },
      '학생식당 TV 앞에 사람들이 모여 있다. 구글의 인공지능 알파고가 바둑으로 사람과 겨룬다. 다들 사람이 이길 거라고 했다. 바둑만은 기계가 아직 멀었다고. 기계가 이긴다. 숟가락 소리가 멎는다.',
      '다들 바둑판을 본다. 나는 다른 걸 본다. 이런 계산이 앞으로 무엇 위에서 돌아가게 될지. 게이머들이나 아는 그래픽카드 회사. 엔비디아.',
      { when: { holding: ['nvda'] }, text: '그 이름은 이미 내 계좌에 있다. 남들보다 먼저 표를 끊어 두고, 극장에서 예고편을 보는 기분이다.' },
      '서른셋의 기억 속에서, 몇 년 뒤 이 이름은 경제 뉴스 첫 줄에 오른다. 기계가 사람 말로 대답하고, 칩 하나를 못 구해 회사들이 줄을 선다. 그 긴 이야기의 예고편이 지금 식판 너머에서 흐른다.',
      '휴대폰이 울린다. 준호가 코인 시세 캡처를 보낸다. "기계가 바둑을 왜 둬. 돈도 안 되는데."',
    ],
    choices: [
      {
        id: 'nvda_plan',
        label: '연말엔 엔비디아를 산다',
        hint: '게이머의 회사 · 결산에서 직접 산다',
        tags: ['hodl'],
        outcomes: [
          {
            effects: { happy: 1, setFlags: ['c4_nvda'] },
            result: [
              { when: { holding: ['nvda'] }, text: '엔비디아는 이미 계좌에 있다. 연말 결산 때 한 층 더 얹으면 된다.' },
              { when: { noHolding: ['nvda'], holding: ['aapl'] }, text: '해외주식 계좌는 이미 있다. 종목 칸에 이름 하나를 더 적는다. 연말 결산 때 사면 된다.' },
              { when: { noHolding: ['nvda', 'aapl'], holding: ['tsla'] }, text: '해외주식 계좌는 이미 있다. 종목 칸에 이름 하나를 더 적는다. 연말 결산 때 사면 된다.' },
              { when: { noHolding: ['nvda', 'aapl', 'tsla'] }, text: '해외주식 계좌를 튼다. 내 이름, 내 서명. 연말 결산 때 사면 된다.' },
              '증권사 직원이 묻는다. "엔비디아요? 게임 좋아하시나 봐요." "네, 아주." 7년을 기다릴 줄 아는 게이머다.',
            ],
            next: 'c5_start',
          },
        ],
      },
      {
        id: 'junho_pcbang',
        label: '준호를 PC방으로 끌고 간다',
        hint: '코인 말고 칩 얘기',
        outcomes: [
          {
            effects: { happy: 2, sus: 3 },
            result: [
              'PC방. 스타크래프트 대신 뉴스 창을 띄운다. "이 그래픽카드 만드는 회사를 사." "그걸로 코인 캐는 사람들은 있더라." 맞는 말이라 할 말이 없다.',
              { when: { flags: ['c4_warned_junho'] }, text: '천 달러 찍던 밤의 내 경고를 기억하는 준호가, 이번엔 휴대폰에 메모를 한다. 반만 믿는다는 뜻이다.' },
              '준호는 "한 방"이라는 말을 좋아한다. 그 말이 6년 뒤 어떤 모양이 되는지, 나는 안다.',
            ],
            next: 'c5_start',
          },
        ],
      },
      {
        id: 'with_eunsu',
        label: '은수와 중계를 끝까지 본다',
        hint: '미래보다 오늘',
        requires: { flags: ['first_love'] },
        lockedHint: '옆자리가 비어 있다',
        outcomes: [
          {
            effects: { happy: 5, health: 2 },
            result: [
              '은수는 바둑을 모른다. 나도 모른다. 둘이서 해설자 말투를 흉내 내며 웃는다.',
              '기계가 이긴 날, 사람 둘이 이긴 기분으로 집에 간다. 서른셋이 스물넷에게 진다. 기꺼이.',
            ],
            next: 'c5_start',
          },
        ],
      },
      {
        id: 'call_home',
        label: '엄마 아빠한테 전화한다',
        hint: '기계가 이겼대',
        tags: ['family'],
        outcomes: [
          {
            effects: { trust: 2, happy: 1 },
            result: [
              '"봤나? 기계가 이겼다 카대." 엄마가 먼저 흥분한다. 미용실 손님들이 오늘 그 얘기만 했단다.',
              { when: { flags: ['c4_parents_home'] }, text: '새 집 베란다에서 받는 전화라, 엄마 목소리가 조금 울린다.' },
              '아빠가 수화기를 뺏는다. "니는 저런 거 올 줄 알았제." 무슨 뜻인지 묻지 않는다. 아빠는 가끔, 나보다 먼저 안다.',
            ],
            next: 'c5_start',
          },
        ],
      },
    ],
  },
};
