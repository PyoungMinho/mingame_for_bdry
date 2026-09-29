import type { StoryNode } from '../types';

/**
 * 1장 "긴급재난문자" — D+0 14:00 ~ 20:00, 1201호.
 *
 * 흐름:
 *   c1_start ─┬─ c1_tv ────┐
 *             ├─ c1_kakao ─┤
 *             └─ c1_ramen_again ─(두 번 무시)→ end:ramen
 *                          ↓
 *   c1_balcony → c1_mom → c1_supplies ─┬─────────────┐
 *                                      └─ c1_hallway ─┤ (→ end:dead 가능)
 *                                                     ↓
 *   c1_peephole → c1_dark → c1_kongi ─┬─ c2b_start (콩이 숨겨 탑승 / 두고 탑승)
 *                                     └─ c2a_start (콩이와 집에 남음)
 *
 * 1장 안에서는 콩이가 c1_kongi 전까지 항상 동행한다(유일 입구가 c1_start, 분리는 c1_kongi 에서만).
 * 그래서 c1_kongi 이전의 콩이 문장은 무조건 문단으로 쓴다.
 *
 * 로컬 플래그: c1_knowsHead(머리가 약점), c1_lockedUp(걸쇠), c1_rollcall, c1_shouted(베란다 경고),
 *   c1_liedMom, c1_toldMom, c1_bathWater, c1_clearedHall, c1_neighborCode, c1_heardConfession,
 *   c1_gaveMedkit, c1_kongiUpset, c1_treats, c1_signaled, c1_drewHorde
 */
export const c1: Record<string, StoryNode> = {
  // ─────────────────────────── 1. 재난문자 ───────────────────────────
  c1_start: {
    id: 'c1_start',
    chapter: 1,
    location: 'home',
    scene: 'home_living',
    title: '토요일 오후 2시',
    clock: 14,
    alert: {
      kind: 'disaster',
      from: '행정안전부',
      text: '[행정안전부] 오늘 13:52 서울 전역 원인불명 집단 폭력사태 발생. 외출을 자제하고 문단속을 철저히 하시기 바랍니다.',
    },
    body: [
      '토요일 오후 두 시. 물이 끓는다. 스프를 털어 넣고, 계란을 깰까 말까 고민하는 참이다.',
      '식탁 위 폰이 찢어지게 운다. 민방위 훈련 때나 듣던 그 소리. 콩이가 소파 밑으로 쏙 들어간다.',
      '창밖 멀리, 검은 연기 한 줄이 곧게 올라간다. 누가 고기 굽나 싶다가, 아니다 싶다.',
    ],
    choices: [
      {
        id: 'tv',
        label: '거실 TV를 켠다',
        hint: '일단 정보부터',
        tags: ['careful'],
        outcomes: [
          {
            result: [
              '가스 불을 끄고 리모컨을 찾는다. 소파 쿠션 사이, 늘 있던 그 자리.',
              '냄비 속 면이 소리 없이 불기 시작한다.',
            ],
            next: 'c1_tv',
          },
        ],
      },
      {
        id: 'kakao',
        label: '단톡방을 연다',
        hint: '빠르지만 난리통',
        outcomes: [
          {
            result: ['알림 숫자가 999+에서 멈춰 있다. 대학동기방이 불타고 있다.'],
            next: 'c1_kakao',
          },
        ],
      },
      {
        id: 'ramen',
        label: '무시하고 라면부터 먹는다',
        hint: '배는 확실히 부르다',
        tags: ['meme'],
        outcomes: [
          {
            effects: { supply: 5, mental: 5, setFlags: ['ateRamen'] },
            result: [
              '재난문자가 한두 번이야. 지난달엔 멧돼지 출몰 문자도 왔다. 멧돼지는 끝내 안 왔다.',
              '면이 딱 좋게 익었다. 계란도 넣는다. 김치도 꺼낸다. 인생 라면이다.',
            ],
            next: 'c1_ramen_again',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 1-1. 계속 무시 줄기 ───────────────────────────
  c1_ramen_again: {
    id: 'c1_ramen_again',
    chapter: 1,
    location: 'home',
    scene: 'home_living',
    title: '두 번째 문자',
    body: [
      '젓가락을 드는 순간, 폰이 또 운다. 이번엔 진동이 멈추지 않는다.',
      '"[행정안전부] 14:12 서울 전역 실내 대피. 감염 의심자 접촉 금지. 이것은 훈련이 아닙니다." 훈련이 아니라고 굳이 적어 보내는 문자는 처음 본다.',
      '아래층 어딘가에서 유리 깨지는 소리. 콩이가 현관 쪽을 보고 낮게 으르렁거린다. 산책 가자는 소리 말고는 낼 줄 모르던 개다.',
    ],
    choices: [
      {
        id: 'finish',
        label: '국물까지 끝까지 마신다',
        hint: '이번엔 진짜일지도',
        tags: ['meme'],
        outcomes: [
          {
            result: [
              '세상 일은 배부른 다음에. 냄비째 들고 국물을 들이켠다. 이어폰을 꽂고 먹방을 튼다. 남이 먹는 소리가 사이렌을 덮는다.',
              '콩이가 발등을 긁으며 낑낑댄다. 현관 도어락이 삑, 삑, 삑, 틀린 번호를 누르는 소리. 이어폰 속 먹방 유튜버가 외친다. "국물이 진짜 미쳤어요."',
            ],
            next: 'end:ramen',
          },
        ],
      },
      {
        id: 'tv',
        label: '젓가락 내려놓고 TV를 켠다',
        hint: '라면은 불어 간다',
        tags: ['careful'],
        outcomes: [
          {
            result: ['반쯤 먹은 라면을 두고 리모컨을 집는다. 냄비 속에서 면이 퉁퉁 불어 간다. 불어 가는 게 면만은 아닌 것 같다.'],
            next: 'c1_tv',
          },
        ],
      },
      {
        id: 'kakao',
        label: '폰을 들어 단톡방을 연다',
        hint: '다들 뭐라는지 본다',
        outcomes: [
          {
            result: ['기름 묻은 손가락으로 화면을 연다. 단톡방이 이미 난리다.'],
            next: 'c1_kakao',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 2-A. TV 속보 ───────────────────────────
  c1_tv: {
    id: 'c1_tv',
    chapter: 1,
    location: 'home',
    scene: 'home_living',
    title: '방송 사고',
    body: [
      '모든 채널이 속보다. 화면 아래 빨간 자막이 흐른다. "서울 도심 곳곳 집단 폭력사태… 원인 파악 중".',
      '종로 한복판 생중계. 기자가 마이크를 쥐고 "현재 이곳은 비교적 안정된—" 하는 순간, 화면 가장자리에서 누가 달려든다.',
      '카메라가 바닥을 구른다. 하늘, 신호등, 누군가의 운동화. 스튜디오 앵커가 3초쯤 굳어 있다가 말한다. "잠시 광고 보고 오겠습니다." 광고는 치킨이다. 반반 무 많이.',
      { when: { flags: ['ateRamen'] }, text: '식탁 위 라면이 불어 터진다. 이제 아무도 그걸 신경 쓰지 않는다.' },
    ],
    choices: [
      {
        id: 'watch',
        label: '전문가 인터뷰까지 지켜본다',
        hint: '알게 되지만 무섭다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: -10, setFlags: ['c1_knowsHead'], hours: 1 },
            result: [
              '광고가 끝나고 화상 연결된 교수가 말을 고른다. "공격자들은 통증 반응이 없고… 소리에 몰리며… 머리 부위 외에는…" 앵커가 황급히 말을 자른다.',
              '머리. 그 단어가 귀에 박힌다. 리모컨 쥔 손이 조금 떨린다.',
            ],
            next: 'c1_balcony',
          },
        ],
      },
      {
        id: 'lock',
        label: '볼륨 줄이고 문단속부터 한다',
        hint: '든든하지만 깜깜이',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: 5, setFlags: ['c1_lockedUp'], hours: 1 },
            result: [
              '도어락 이중잠금, 보조키, 걸쇠까지 전부 건다. 이사 오고 한 번도 안 쓴 걸쇠가 뻑뻑하다.',
              '신발장을 현관 쪽으로 반 뼘 민다. 이 정도면 됐다. 됐겠지.',
            ],
            next: 'c1_balcony',
          },
        ],
      },
      {
        id: 'balcony',
        label: '베란다로 나가 직접 본다',
        hint: '눈으로 봐야 믿는다',
        tags: ['brave'],
        outcomes: [
          {
            effects: { setFlags: ['c1_earlyLook'], hours: 1 },
            result: ['TV 속 종로는 멀다. 12층 베란다라면 우리 동네가 보인다. 리모컨을 던져 두고 베란다 문을 연다.'],
            next: 'c1_balcony',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 2-B. 단톡방 ───────────────────────────
  c1_kakao: {
    id: 'c1_kakao',
    chapter: 1,
    location: 'home',
    scene: 'phone_alert',
    title: '대학동기방 (7)',
    body: [
      '대학동기방이 폭주 중이다. 맨 위에 영상 하나. 신촌 버스정류장, 누군가 누군가의 어깨를 문다. 흔들리는 세로 화면.',
      '"야 이거 실화냐" "합성 아님? 요즘 AI 영상 개잘만듦" "나 지금 회사 앞인데 ㄹㅇ임. 사람들 막 뛰어감" "다들 어디냐"',
      '그 와중에 한 명이 커피 기프티콘 이벤트 링크를 공유한다. 아무도 대꾸하지 않는다.',
      { when: { flags: ['ateRamen'] }, text: '라면 국물 튄 액정 너머로 영상이 재생된다. 젓가락이 멈춘다.' },
    ],
    choices: [
      {
        id: 'watch',
        label: '영상을 끝까지 돌려 본다',
        hint: '알게 되지만 못 잊는다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: -12, setFlags: ['c1_knowsHead'], hours: 1 },
            result: [
              '1분 42초짜리 영상. 물린 사람이 쓰러졌다가, 40초 뒤에 일어난다. 눈이 이상하다. 그리고 뛴다. 걷는 게 아니라, 뛴다.',
              '마지막 장면. 버스 기사가 소화기로 머리를 내리친다. 그제야 멈춘다. 머리다. 머리여야 한다.',
            ],
            next: 'c1_balcony',
          },
        ],
      },
      {
        id: 'rollcall',
        label: '"다들 위치 찍어" 생존 체크한다',
        hint: '위로는 되지만 느리다',
        tags: ['kind'],
        outcomes: [
          {
            effects: { mental: 10, setFlags: ['c1_rollcall'], hours: 1 },
            result: [
              '"다들 집이냐? 위치 찍어." 지도 캡처가 하나둘 올라온다. 강남, 수원, 부천, 회사 옥상. 방 인원 일곱, 전원 생존.',
              '"12층이면 너네 집이 최고 요새네 ㅋㅋ" "좀비는 계단 못 오름" "그거 어디서 봄?" 누가 보낸 웃는 이모티콘 하나가 이상하게 힘이 된다.',
            ],
            next: 'c1_balcony',
          },
        ],
      },
      {
        id: 'charge',
        label: '알림 끄고 보조배터리를 챙긴다',
        hint: '현실적이지만 읽씹',
        tags: ['cold'],
        outcomes: [
          {
            effects: { mental: -5, addItems: ['powerbank'], hours: 1 },
            result: [
              '"통신 곧 터진다더라" 한 줄만 보고 알림을 끈다. 서랍 속 보조배터리를 꺼내 콘센트에 꽂는다. 불이 초록으로 바뀐다.',
              '읽음 숫자가 줄어든다. 답장은 안 한다. 미안하다, 얘들아. 지금은 배터리가 우정보다 급하다.',
            ],
            next: 'c1_balcony',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 3. 베란다 ───────────────────────────
  c1_balcony: {
    id: 'c1_balcony',
    chapter: 1,
    location: 'home',
    scene: 'balcony_view',
    title: '12층에서 본 놀이터',
    body: [
      '베란다 창을 연다. 매캐한 냄새. 단지 주차장에서 SUV 한 대가 불타고 있다. 차 경보음이 멈추지 않는다.',
      '놀이터. 미끄럼틀 옆에서 등산복 차림 남자가 여자 하나를 덮친다. 어깨를 문다. 아주 오래.',
      '벤치 옆엔 아이 하나가 모래 삽을 쥐고 서 있다. 아무것도 모르는 얼굴로.',
      '발밑에서 콩이가 미친 듯이 짖는다. 12층이라 들릴 리 없는데, 아래쪽 남자가 고개를 든다.',
      { when: { flags: ['c1_knowsHead'] }, text: '머리를 노려야 한다는 말이 이제야 무슨 뜻인지 안다. 알고 싶지 않았다.' },
      { when: { flags: ['c1_earlyLook'] }, text: '일찍 나와 본 덕에 처음부터 다 봤다. 아이가 어느 쪽에서 왔는지, 경비실 문이 열려 있는지까지.' },
    ],
    choices: [
      {
        id: 'curtain',
        label: '커튼 치고 조용히 물러난다',
        hint: '안전하지만 찝찝하다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: -8, hours: 1 },
            result: [
              '콩이를 안아 입을 감싸고 뒷걸음질친다. 암막 커튼을 친다. 거실이 저녁처럼 어두워진다.',
              '아이가 어떻게 됐는지는 모른다. 모르는 채로 오후가 간다. 그게 제일 오래 남는다.',
            ],
            next: 'c1_mom',
          },
        ],
      },
      {
        id: 'shout',
        label: '"도망가요!" 소리쳐 경고한다',
        hint: '누군가 살지만 들킨다',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { flags: ['c1_earlyLook'] },
            chance: 0.8,
            effects: { mental: 10, setFlags: ['c1_shouted', 'savedStranger'], hours: 1 },
            result: [
              '"거기 꼬마! 경비실로 뛰어! 경비실!" 방향까지 찍어 준다. 아이가 모래 삽을 버리고 뛴다. 경비아저씨가 문을 열고 받아 안는다. 문이 닫힌다.',
              '그리고 놀이터의 모든 고개가 일제히 위를 본다. 12층. 정확히 이 창문.',
            ],
            next: 'c1_mom',
          },
          {
            chance: 0.5,
            effects: { mental: 10, setFlags: ['c1_shouted', 'savedStranger'], hours: 1 },
            result: [
              '목이 찢어지게 소리친다. 아이가 고개를 든다. 경비실에서 경비아저씨가 뛰쳐나와 아이를 안고 들어간다. 경비실 문이 닫힌다.',
              '그리고 놀이터의 모든 고개가 일제히 위를 본다. 12층. 정확히 이 창문.',
            ],
            next: 'c1_mom',
          },
          {
            effects: { mental: -10, setFlags: ['c1_shouted'], hours: 1 },
            result: [
              '소리는 불타는 차의 경보음에 묻힌다. 아이에게는 닿지 않는다.',
              '대신 놀이터에 엎드려 있던 것들이 고개를 든다. 몇이 이쪽 동 현관으로 달리기 시작한다. 빠르다. 영화에서 본 것보다 훨씬.',
            ],
            next: 'c1_mom',
          },
        ],
      },
      {
        id: 'video',
        label: '영상 찍어 SNS에 올린다',
        hint: '이 와중에 인증?',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.4,
            effects: { mental: 5, setFlags: ['postedVideo'], hours: 1 },
            result: [
              '줌을 끝까지 당겨 30초를 찍는다. "#서울 #실화 #제발" 올린다.',
              '10분 만에 조회수 3만. "위치 어디임" "CG 퀄 미쳤네" "빨리 숨으세요 제발". 수만 명이 같은 걸 보고 있다. 이상하게 덜 외롭다.',
            ],
            next: 'c1_mom',
          },
          {
            effects: { mental: -5, setFlags: ['postedVideo'], hours: 1 },
            result: [
              '찍는 동안 손이 너무 떨린다. 화면이 요동치고 초점은 끝까지 안 맞는다. 그래도 불타는 SUV와 놀이터 쪽으로 달려가는 뭔가가 흔들리며 담긴다. 엄지손가락도 반쯤 나온다. 그래도 올린다.',
              '조회수 12. 좋아요 1. 누른 사람은 엄마다. 아직은.',
            ],
            next: 'c1_mom',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 4. 엄마 전화 ───────────────────────────
  c1_mom: {
    id: 'c1_mom',
    chapter: 1,
    location: 'home',
    scene: 'phone_alert',
    title: '엄마',
    clock: 16,
    alert: {
      kind: 'call',
      from: '엄마',
      text: '니 괘안나? 서울 난리라 카던데. 퍼뜩 받아라.',
    },
    body: [
      '통화량 폭주라더니, 엄마 전화는 기어이 뚫고 들어온다. 받자마자 쏟아진다. "뉴스 봤제? 문 잠갔나? 밥은 뭇나?"',
      { when: { flags: ['ateRamen'] }, text: '"라면." "그기 밥이가." 이 와중에 혼난다.' },
      {
        when: { flags: ['postedVideo'] },
        text: '"니 올린 그 영상 엄마도 봤다. 그 뭐꼬, 니 집 앞 아이가?" 목소리 끝이 떨린다.',
      },
      '"당장 KTX 타고 내려온나. 엄마가 김치 다 해놨다." 서울역까지 어떻게 가는지 엄마는 모른다. 지금은 아무도 모른다.',
      '수화기 너머로 엄마네 TV 소리가 들린다. 같은 속보다. 배터리는 23%.',
      { when: { items: ['powerbank'] }, text: '보조배터리를 꽂아 둔 게 다행이다. 적어도 이 통화는 끝까지 할 수 있다.' },
    ],
    choices: [
      {
        id: 'lie',
        label: '"여긴 괜찮아" 거짓말한다',
        hint: '엄마는 안심한다',
        tags: ['kind'],
        outcomes: [
          {
            effects: { mental: 5, setFlags: ['c1_liedMom'] },
            result: [
              '"여긴 멀쩡해. 뉴스가 호들갑이야. 콩이랑 누워서 TV 봐." 목소리가 생각보다 안 떨린다.',
              {
                when: { noFlags: ['postedVideo'] },
                text: '"그래? 그라믄 됐다." 엄마가 크게 숨을 내쉰다. 그 숨소리에 이쪽 어깨도 조금 풀린다.',
              },
              {
                when: { flags: ['postedVideo'] },
                text: '"그 영상은 옆 단지야. 여긴 조용해." 엄마가 한참 말이 없다. "…그래, 니가 그렇다 카믄." 믿는 척해 주는 목소리다. 그 목소리에 이쪽 어깨가 더 무거워진다.',
              },
              '전화를 끊고 나서야 손이 떨리기 시작한다. 엄마는 오늘 밤 잘 잘 거다. 그거면 됐다. 됐어야 한다.',
            ],
            next: 'c1_supplies',
          },
        ],
      },
      {
        id: 'truth',
        label: '사실대로 다 말한다',
        hint: '아프지만 쓸모 있다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: -10, setFlags: ['c1_toldMom'] },
            result: [
              '"엄마, 진짜야. 사람이 사람을 물어. 나 지금 못 내려가." 수화기 너머가 한참 조용하다.',
              '"…알았다. 그라믄 잘 들어라. 욕조에 물부터 받아 놔라. 문 꼭 잠그고. 니 어릴 때 태풍 왔을 때처럼." 엄마 목소리가 갑자기 단단해진다.',
            ],
            next: 'c1_supplies',
          },
        ],
      },
      {
        id: 'promise',
        label: '"꼭 살아서 갈게" 약속한다',
        hint: '버틸 이유, 무거운 짐',
        tags: ['kind'],
        outcomes: [
          {
            effects: { mental: 5, setFlags: ['promisedMom'] },
            result: [
              '"엄마. 나 꼭 살아서 내려갈게. 김치 다 먹지 말고 기다려." "누가 니 김치를 먹노. 니 거는 니가 와서 무라."',
              '엄마는 먼저 끊지 않는다. 결국 이쪽에서 끊는다. 약속 하나가 생긴다. 엄마 김치를 버리게 만드는 건, 좀비보다 무서운 일이다.',
              { when: { noItems: ['powerbank'] }, text: '끊고 보니 배터리가 9%다. 약속은 배터리를 먹는다.' },
            ],
            next: 'c1_supplies',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 5. 물자 챙기기 ───────────────────────────
  c1_supplies: {
    id: 'c1_supplies',
    chapter: 1,
    location: 'home',
    scene: 'home_living',
    title: '챙길 수 있는 만큼',
    body: [
      '수돗물 줄기가 눈에 띄게 가늘어졌다. 복도에선 누가 캐리어를 끌고 엘리베이터 쪽으로 뛰어가는 소리.',
      '머릿속으로 목록을 만든다. 물, 약, 빛, 전기, 무기. 다 챙길 시간은 없다. 한 군데만 제대로 털어도 잘한 거다.',
      '콩이는 빈 밥그릇을 코로 밀며 따라다닌다. 이 난리에도 저녁 시간은 정확하다.',
      { when: { flags: ['c1_toldMom'] }, text: '"욕조에 물부터 받아 놔라." 엄마 목소리가 아직 귀에 남아 있다.' },
      { when: { flags: ['c1_lockedUp'] }, text: '걸쇠까지 건 현관이 든든하다. 적어도 챙기는 동안은.' },
    ],
    choices: [
      {
        id: 'water',
        label: '욕조에 물 받고 구급상자를 찾는다',
        hint: '농성 준비, 무기는 없다',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c1_toldMom'] },
            effects: { supply: 20, mental: 5, addItems: ['medkit'], setFlags: ['c1_bathWater'], hours: 1 },
            result: [
              '엄마 말대로 욕조부터. 냄비, 페트병, 김치통까지 전부 채운다. 김치 냄새 나는 물이다. 상관없다.',
              '화장실 수납장 맨 위에서 구급상자를 꺼낸다. 이사 선물로 받고 한 번도 안 열어 본 상자다. 엄마는 늘 옳다. 짜증 나게.',
            ],
            next: 'c1_peephole',
          },
          {
            effects: { supply: 15, addItems: ['medkit'], setFlags: ['c1_bathWater'], hours: 1 },
            result: [
              '욕조 마개를 막고 수도를 끝까지 튼다. 물이 졸졸, 아주 느리게 찬다. 그동안 화장실 수납장에서 구급상자를 꺼낸다.',
              '욕조가 반쯤 찼을 때 물줄기가 실처럼 가늘어진다. 졸졸거리는 걸 기다리고 있을 시간이 없다. 반이라도 어디냐.',
            ],
            next: 'c1_peephole',
          },
        ],
      },
      {
        id: 'storage',
        label: '베란다 창고를 뒤진다',
        hint: '싸울 준비, 물은 없다',
        tags: ['brave'],
        outcomes: [
          {
            effects: { hp: -5, mental: 5, addItems: ['bat', 'flashlight'], hours: 1 },
            result: [
              '창고 문을 열자 캠핑 의자가 쏟아져 정강이를 찍는다. 두 번 가고 접은 캠핑의 복수다. 그 밑에 캠핑용 손전등이 있다.',
              '그리고 구석에 알루미늄 야구방망이. 사회인 야구 2주 하고 접었다. 회비 12만 원. 드디어 본전을 뽑을 날이 왔다.',
            ],
            next: 'c1_peephole',
          },
        ],
      },
      {
        id: 'drawer',
        label: '서랍을 털고 전기부터 채운다',
        hint: '전기는 생명줄이다',
        tags: ['careful'],
        outcomes: [
          {
            when: { items: ['powerbank'] },
            effects: { supply: 5, addItems: ['medkit'], hours: 1 },
            result: [
              '보조배터리는 이미 빵빵하다. 대신 서랍을 끝까지 뒤진다. 영수증, 고무줄, 치킨집 쿠폰 11장.',
              '맨 밑에서 작은 구급상자가 나온다. 쿠폰 11장도 챙긴다. 한 장만 더 모으면 한 마리 공짜다. 그날이 올지는 모르겠다.',
            ],
            next: 'c1_peephole',
          },
          {
            effects: { supply: 5, mental: 5, addItems: ['powerbank'], hours: 1 },
            result: [
              '서랍 속 보조배터리를 꺼내 충전기에 꽂는다. 불이 들어온다. 전기가 살아 있을 때 채워야 한다.',
              '기다리는 동안 라면 한 봉지를 뽀개 생으로 씹는다. 스프도 찍어 먹는다. 이상하게 맛있다.',
            ],
            next: 'c1_peephole',
          },
        ],
      },
      {
        id: 'hallway',
        label: '복도 소화전 소화기를 가지러 간다',
        hint: '문 밖은 모른다',
        tags: ['brave'],
        outcomes: [
          {
            result: [
              '현관 잠금을 하나씩 조용히 푼다. 소화전함은 문에서 딱 여섯 걸음. 여섯 걸음이면 된다.',
              '콩이가 현관 턱까지 따라와 코를 킁킁댄다. "기다려." 콩이가 앉는다. 간식도 없는데 말을 듣는 건 처음이다.',
            ],
            next: 'c1_hallway',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 5-1. 복도 ───────────────────────────
  c1_hallway: {
    id: 'c1_hallway',
    chapter: 1,
    location: 'home',
    scene: 'hallway',
    title: '여섯 걸음',
    body: [
      '복도 형광등 절반이 꺼져 있다. 남은 것도 깜빡인다. 공기가 이상하게 비리다.',
      '1202호 앞 바닥에 핏자국이 길게 이어진다. 계단 쪽으로.',
      '복도 끝, 비상계단 문 앞에 누가 서 있다. 등산복. 고개가 한쪽으로 꺾인 채 벽을 보고 있다. 아직 이쪽을 모른다.',
      { when: { flags: ['c1_shouted'] }, text: '아까 베란다에서 소리친 게 떠오른다. 계단 아래에서 뭔가 올라오는 발소리가 섞여 있다.' },
    ],
    choices: [
      {
        id: 'grab',
        label: '소화기만 빼서 뒷걸음질친다',
        hint: '조용히, 딱 그것만',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c1_shouted'] },
            chance: 0.5,
            effects: { hp: -10, mental: -10, addItems: ['extinguisher'] },
            result: [
              '소화전함 문이 끼익 운다. 등산복이 돌아본다. 동시에 계단 문이 벌컥 열리고 또 하나가 튀어나온다.',
              '소화기를 끌어안고 여섯 걸음을 세 걸음에 뛴다. 문을 닫는 순간 뭔가가 문에 부딪힌다. 어깨가 문틀에 긁혀 쓰라리다.',
            ],
            next: 'c1_peephole',
          },
          {
            effects: { mental: -5, addItems: ['extinguisher'] },
            result: [
              '소화전함 문을 1mm씩 연다. 소화기를 빼는 데 1분이 걸린다. 인생에서 가장 긴 1분.',
              '등산복은 끝까지 벽만 본다. 문을 닫고 걸쇠를 건 뒤에야 숨이 쉬어진다. 콩이가 발등을 핥는다.',
            ],
            next: 'c1_peephole',
          },
        ],
      },
      {
        id: 'head',
        label: '소화기로 머리를 노린다',
        hint: '복도를 치워 둔다',
        tags: ['brave'],
        requires: { flags: ['c1_knowsHead'] },
        lockedHint: '약점을 알았더라면…',
        outcomes: [
          {
            chance: 0.7,
            effects: { mental: -15, addItems: ['extinguisher'], setFlags: ['c1_clearedHall'] },
            result: [
              '소화기를 빼 들고 걸어간다. 뛰면 들킨다. 세 걸음 앞에서 녀석이 돌아본다.',
              '머리. 한 번, 두 번. 등산복이 무너진다. 복도가 다시 조용해진다. 손이 멈추질 않는다. 한참 떨린다.',
            ],
            next: 'c1_peephole',
          },
          {
            effects: { hp: -15, mental: -15, addItems: ['extinguisher'], setFlags: ['c1_clearedHall'] },
            result: [
              '첫 방이 빗나가 어깨를 친다. 녀석이 달려든다. 소화기 몸통으로 턱을 받치고 벽에 밀어붙인 채 두 번째를 내리친다.',
              '끝났다. 팔뚝에 긁힌 자국이 있다. 이빨은 아니다. 아닐 거다. 세 번 확인한다.',
            ],
            next: 'c1_peephole',
          },
        ],
      },
      {
        id: 'store',
        label: '엘리베이터로 1층 편의점까지 간다',
        hint: '목숨 건 사재기',
        tags: ['brave'],
        outcomes: [
          {
            chance: 0.5,
            effects: { hp: -5, supply: 25, addItems: ['ramen'], hours: 1 },
            result: [
              '소화전함을 지나쳐 엘리베이터 버튼을 누른다. 지금은 소화기보다 라면이다. 1층 편의점은 문이 열린 채 비어 있다. 계산대에 "잠시 자리 비움" 팻말.',
              '라면 한 박스, 생수 여섯 병. 계산대에 쪽지를 남긴다. "1201호. 나중에 계산할게요." 올라오는 엘리베이터 안에서 다리가 풀린다.',
            ],
            next: 'c1_peephole',
          },
          {
            when: { flags: ['c1_knowsHead'] },
            effects: { hp: -25, mental: -15, hours: 1 },
            result: [
              '1층 문이 열리자마자 셋이 뛰어든다. 닫힘 버튼을 연타하며 맨 앞 녀석의 머리를 발로 찬다. 머리. 그래야 멈춘다.',
              '문이 닫힌다. 빈손으로 12층까지 올라오는 동안 거울 속 얼굴이 모르는 사람 같다.',
            ],
            next: 'c1_peephole',
          },
          {
            result: [
              '1층 문이 열린다. 로비가 사람들로 가득하다. 아니, 사람이었던 것들로.',
              '닫힘 버튼은 늘 그렇듯 반응이 느리다.',
            ],
            next: 'end:dead',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 6. 외시경 (시그니처) ───────────────────────────
  c1_peephole: {
    id: 'c1_peephole',
    chapter: 1,
    location: 'home',
    scene: 'door_peephole',
    title: '외시경',
    clock: 17,
    body: [
      '쾅, 쾅, 쾅. 현관문이 울린다. 콩이가 털을 곤두세우고 문 앞에서 으르렁거린다.',
      '외시경에 눈을 댄다. 둥글게 휜 복도. 렌즈에 바짝 붙은 얼굴. 1202호 아저씨다. 분리수거 날마다 마주치던, 늘 운동복 차림의 그 아저씨.',
      '왼팔을 움켜쥔 손가락 사이로 피가 뚝뚝 떨어진다. "저기요! 1201호! 문 좀 열어줘요! 제발요!"',
      { when: { flags: ['c1_lockedUp'] }, text: '걸쇠까지 건 문이 쾅 소리마다 덜컹인다. 문은 버틴다. 마음이 안 버틴다.' },
      { when: { flags: ['c1_clearedHall'] }, text: '아저씨 발치에 아까 쓰러뜨린 등산복이 보인다. 아저씨는 그걸 보고 더 겁에 질렸다.' },
      { when: { flags: ['c1_shouted'] }, text: '아저씨 뒤, 계단참 쪽에서 발소리가 가까워진다. 시간이 없다.' },
    ],
    choices: [
      {
        id: 'open',
        label: '문을 열어준다',
        hint: '사람일까, 아닐까',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { items: ['medkit'] },
            chance: 0.6,
            effects: { supply: 15, mental: -10, setFlags: ['openedDoor', 'c1_neighborCode'], hours: 1 },
            result: [
              '문을 열자마자 아저씨가 쓰러지듯 들어온다. 구급상자를 뜯어 팔을 꽉 압박한다. 붕대가 금세 빨개지다가, 멎는다.',
              '아저씨가 상처를 한참 내려다본다. "…물렸어요. 알고 있었어요." 그리고 스스로 일어나 문밖으로 나간다. "1202호 비번 0417이에요. 냉장고 다 가져가요. 개 참 이쁘네요."',
              '해 질 무렵, 1202호에서 생수와 햇반을 안고 나온다. 냉장고에 붙은 신혼여행 사진 자석은 그대로 둔다.',
            ],
            next: 'c1_dark',
          },
          {
            when: { anyItems: ['bat', 'extinguisher'] },
            chance: 0.85,
            effects: { hp: -10, mental: -20, setFlags: ['openedDoor'], hours: 1 },
            result: [
              '아저씨를 들여 소파에 앉힌다. 물을 뜨러 간 30초 사이, 등 뒤에서 콩이가 자지러지게 짖는다.',
              '아저씨가 일어나 있다. 눈이 뿌옇다. 입이 벌어진다. 손에 잡힌 걸 휘두른다. 머리. 한 번에 안 된다. 두 번. 세 번.',
              '복도로 끌어내 눕히고 현관 매트를 덮어 준다. 그게 해 줄 수 있는 전부다.',
            ],
            next: 'c1_dark',
          },
          {
            when: { anyItems: ['bat', 'extinguisher'] },
            effects: { hp: -15, mental: -25, infect: true, setFlags: ['openedDoor'], hours: 1 },
            result: [
              '아저씨를 소파에 앉힌 지 10분. 콩이가 자지러지게 짖는다. 돌아보니 아저씨가 일어나 있다. 눈이 뿌옇다.',
              '손에 잡힌 걸 휘두른다. 첫 방이 빗나간다. 녀석이 팔을 붙들고, 이가 손목을 긁고 지나간다. 두 번째에 머리. 세 번째에 끝.',
              '손목에 붉은 선 하나. 피는 조금. 뉴스에서 뭐라고 했더라. 물리면, 몇 시간.',
            ],
            next: 'c1_dark',
          },
          {
            chance: 0.75,
            effects: { hp: -25, mental: -20, setFlags: ['openedDoor'], hours: 1 },
            result: [
              '아저씨를 들인 지 10분. 기침, 경련, 그리고 정적. 일어난 건 아저씨가 아니다.',
              '맨손으로 어깨를 밀어낸다. 콩이가 녀석의 발목을 물고 늘어져 1초를 벌어 준다. 그 1초에 현관 밖으로 밀어내고 문을 닫는다. 온몸이 멍투성이다.',
            ],
            next: 'c1_dark',
          },
          {
            effects: { hp: -15, mental: -25, infect: true, setFlags: ['openedDoor'], hours: 1 },
            result: [
              '아저씨를 들인 지 10분. 일어난 건 아저씨가 아니다. 발목을 물고 늘어진 콩이를 떼어 내려고 손을 뻗는 순간, 누런 이가 손목에 닿는다.',
              '어떻게든 밀어내고 문을 잠근다. 손목에 반달 모양 잇자국. 피가 많이 나지는 않는다. 그래서 더 무섭다.',
              '뉴스에서 뭐라고 했더라. 물리면, 몇 시간.',
            ],
            next: 'c1_dark',
          },
        ],
      },
      {
        id: 'ignore',
        label: '문을 열지 않는다',
        hint: '몸은 안전하다',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            effects: { mental: -15, setFlags: ['abandonedSomeone'], hours: 1 },
            result: [
              '외시경에서 눈을 뗀다. 콩이를 안고 현관에서 제일 먼 방으로 간다. 이어폰을 꽂는다. 음악은 틀지 않는다.',
              '쾅쾅이 탕탕이 되고, 탕탕이 톡톡이 된다. 한참 뒤엔 긁는 소리로 바뀐다. 사각, 사각. 그 소리는 밤새 멈추지 않을 것 같다.',
            ],
            next: 'c1_dark',
          },
        ],
      },
      {
        id: 'ask',
        label: '문 너머로 상처를 묻는다',
        hint: '대답이 정직할까',
        tags: ['careful', 'kind'],
        outcomes: [
          {
            chance: 0.6,
            effects: { supply: 10, mental: -10, setFlags: ['c1_heardConfession', 'c1_neighborCode'], hours: 1 },
            result: [
              '"아저씨, 혹시… 물렸어요?" 쾅쾅이 멈춘다. 긴 정적.',
              '"…네. 알아요. 그냥 누가 한 번 대답해 줬으면 해서요." 문에 등을 기대는 소리. "1202호 비번 0417. 냉장고 다 가져가요. 우리 와이프 몫까지 드세요."',
              '발소리가 계단 쪽으로 멀어진다. 해 질 무렵 1202호에서 생수와 햇반을 들고 나온다. 끝내 아저씨 이름을 묻지 못한 게, 이상하게 제일 걸린다.',
            ],
            next: 'c1_dark',
          },
          {
            effects: { mental: -15, setFlags: ['abandonedSomeone'], hours: 1 },
            result: [
              '"아저씨, 혹시… 물렸어요?" "아니요! 넘어져서 긁힌 거라니까! 사람 말을 왜 못 믿어요!" 목소리가 복도를 쩌렁쩌렁 울린다.',
              '계단 쪽 문이 덜컹 열린다. 아저씨가 비명을 지르며 복도 반대편으로 뛴다. 발소리 여럿이 그 뒤를 쫓는다. 외시경 속 복도가 다시 텅 빈다.',
              '묻지 말걸. 아니, 물었으니까 안 연 거다. 어느 쪽인지 밤새 정하지 못한다.',
            ],
            next: 'c1_dark',
          },
        ],
      },
      {
        id: 'medkit',
        label: '구급상자를 문고리에 걸어준다',
        hint: '열지 않고 돕는다',
        tags: ['kind'],
        requires: { items: ['medkit'] },
        lockedHint: '구급상자가 있었다면…',
        outcomes: [
          {
            effects: { mental: -5, removeItems: ['medkit'], setFlags: ['c1_gaveMedkit'], hours: 1 },
            result: [
              '걸쇠를 건 채 문을 한 뼘 연다. 문틈으로 구급상자를 밀어 바깥 문고리에 건다. 피 묻은 손이 그걸 받아 간다.',
              '"고마워요. 진짜로." 문이 다시 닫힌다. 열어 주지는 못했다. 그래도 아무것도 안 한 건 아니다. 그렇게 믿기로 한다.',
            ],
            next: 'c1_dark',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 6-1. 정전 ───────────────────────────
  c1_dark: {
    id: 'c1_dark',
    chapter: 1,
    location: 'home',
    scene: 'home_dark',
    title: '정전',
    clock: 18,
    body: [
      '딸깍. 모든 게 꺼진다. 냉장고가 조용해진다. 이 집에 냉장고 소리가 있었다는 걸 처음 안다.',
      '창밖 서울이 군데군데 붉다. 맞은편 동엔 불 켜진 창이 세 개뿐이다.',
      '그때 현관 밖에서 사각, 사각. 콩이가 문을 향해 몸을 낮춘다. 목 깊은 데서 소리가 올라온다. 짖기 직전이다. 짖으면 복도 전체가 이쪽으로 온다.',
      { when: { flags: ['openedDoor'] }, text: '현관 바닥의 핏자국은 물티슈로 몇 번을 닦아도 흐리게 남는다.' },
      { when: { infected: true }, text: '손목이 욱신거린다. 이마가 뜨겁다. 체온계는 찾지 않기로 한다.' },
      { when: { flags: ['c1_bathWater'] }, text: '어둠 속에서 욕조 물이 찰랑인다. 저것만 있으면 며칠은 간다.' },
      { when: { noItems: ['powerbank'] }, text: '벽에 꽂아 둔 폰 충전기의 불도 같이 꺼진다. 배터리는 31%에서 멈췄다. 이제 더는 안 오른다.' },
    ],
    choices: [
      {
        id: 'hold',
        label: '콩이 입을 감싸 욕실로 간다',
        hint: '조용하지만 서운하다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hp: -5, mental: -5, setFlags: ['c1_kongiUpset'], hours: 1 },
            result: [
              '콩이 주둥이를 손으로 감싸고 욕실로 들어가 문을 닫는다. 콩이가 버둥거리다 손을 콱 문다. 좀비가 아니라 콩이다. 다행히도.',
              '한참 뒤 콩이가 조용해진다. 등을 돌리고 욕실 매트 위에 동그랗게 눕는다. 삐졌다. 확실히.',
            ],
            next: 'c1_kongi',
          },
        ],
      },
      {
        id: 'treats',
        label: '간식 봉지를 탈탈 털어 준다',
        hint: '보급이 줄어든다',
        tags: ['dog'],
        outcomes: [
          {
            effects: { supply: -8, mental: 5, setFlags: ['c1_treats'], hours: 1 },
            result: [
              '아껴 둔 연어 져키 봉지를 뜯는다. 바스락 소리에 콩이 귀가 번쩍, 접힌 쪽 귀까지 선다.',
              '하나, 둘, 다섯 개. 짖을 틈을 안 준다. 콩이는 배를 뒤집고 눕는다. 문밖의 사각거림이 조금씩 멀어진다.',
            ],
            next: 'c1_kongi',
          },
        ],
      },
      {
        id: 'signal',
        label: '손전등으로 맞은편 동에 신호한다',
        hint: '누군가 있을까',
        tags: ['kind'],
        requires: { items: ['flashlight'] },
        lockedHint: '손전등이 있었다면…',
        outcomes: [
          {
            effects: { mental: 15, setFlags: ['c1_signaled'], hours: 1 },
            result: [
              '베란다에서 손전등을 켰다 껐다 한다. 짧게 셋, 길게 셋, 짧게 셋. 초등학교 때 배운 SOS가 이렇게 쓰인다.',
              '맞은편 동 8층 창에서 스탠드 불빛이 깜빡깜빡 답한다. 누군지 모른다. 그래도 저기 누가 있다.',
              '콩이는 벽에 비친 빛을 쫓느라 짖는 걸 까먹었다.',
            ],
            next: 'c1_kongi',
          },
        ],
      },
      {
        id: 'music',
        label: '블루투스 스피커로 노래를 튼다',
        hint: '덮을까, 부를까',
        tags: ['meme', 'brave'],
        outcomes: [
          {
            chance: 0.4,
            effects: { mental: 10, hours: 1 },
            result: [
              '조용한 발라드를 아주 작게 튼다. 콩이가 고개를 갸웃하더니 스피커 옆에 엎드린다.',
              '문밖의 사각거림이 멈춘다. 노래가 이긴 건지, 문밖의 뭔가가 다른 데로 간 건지는 모르겠다. 모르는 게 낫다.',
            ],
            next: 'c1_kongi',
          },
          {
            effects: { mental: -15, setFlags: ['c1_drewHorde'], hours: 1 },
            result: [
              '볼륨이 지난 회식 때 그대로다. 최대. 트로트 메들리가 아파트를 찢는다.',
              '황급히 끄지만 늦었다. 복도가 발소리로 가득 찬다. 문이 쾅쾅, 탕탕, 한 시간 내내 울린다. 콩이도 끝까지 짖는다.',
            ],
            next: 'c1_kongi',
          },
        ],
      },
    ],
  },

  // ─────────────────────────── 7. 콩이 딜레마 (클라이맥스) ───────────────────────────
  c1_kongi: {
    id: 'c1_kongi',
    chapter: 1,
    location: 'home',
    scene: 'dog_kongi',
    title: '반려동물 동반 불가',
    clock: 19,
    alert: {
      kind: 'radio',
      from: '관리사무소',
      text: '안내 말씀 드립니다. 주민 여러분께서는 20시 단지 정문 앞 구청 대피버스에 탑승해 주시기 바랍니다. 반려동물은 동반 불가합니다. 다시 한번 알려 드립니다.',
    },
    body: [
      '관리사무소 방송이 끝나고, 스피커에서 지직 소리가 오래 남는다. 반려동물은 동반 불가. 두 번이나 말했다.',
      '콩이가 현관 바닥에 앉아 올려다본다. 한쪽 귀는 접히고 한쪽 귀는 서 있다. 산책 가자는 줄 안다. 꼬리가 바닥을 쓴다.',
      '신발장 위엔 동물병원 갈 때 쓰던 백팩형 이동가방. 콩이까지 5kg. 메면 티가 난다. 짖으면 끝이다.',
      '버스는 여덟 시. 시계를 볼 때마다 분침이 성큼성큼 가 있다. 오늘 마지막 버스일지도 모른다. 단톡방엔 "개는 버스 기사가 내리라 함" "고양이도 걸림" 같은 말이 벌써 돈다.',
      { when: { infected: true }, text: '열이 오른다. 버스에서 체온을 잰다는 말은 없었다. 아직은.' },
      { when: { flags: ['promisedMom'] }, text: '엄마한테 살아서 간다고 했다. 살아서. 그런데, 누구랑?' },
      { when: { flags: ['c1_drewHorde'] }, text: '아까 튼 노래 때문에 복도가 아직 시끄럽다. 정문까지 가려면 저길 지나야 한다.' },
      { when: { flags: ['c1_kongiUpset'] }, text: '욕실 일로 콩이가 아직 눈을 안 맞춘다. 그래도 옆에서 한 발짝도 안 떨어진다.' },
    ],
    choices: [
      {
        id: 'smuggle',
        label: '콩이를 이동가방에 숨겨 탄다',
        hint: '들키면 버스 전체가 적',
        tags: ['dog', 'brave'],
        outcomes: [
          {
            when: { flags: ['c1_treats'] },
            effects: { mental: 5, setFlags: ['smuggledDog', 'evacuated'], hours: 1 },
            result: [
              '가방에 연어 져키 두 개를 먼저 넣는다. 콩이가 제 발로 들어간다. 지퍼를 닫는다. 조용하다. 아까 간식이 신뢰가 됐다.',
              '엘리베이터는 정전으로 멈췄다. 가방을 등에 메고 12층 계단을 내려가는 내내 가방 속이 조용하다. 정문 앞 줄 끝에 선다. 앞쪽에서 형광 조끼 직원이 가방을 하나씩 열고 있다.',
              '등 뒤 가방이 따뜻하다. 숨 쉬는 게 느껴진다. 여기까지는 왔다.',
            ],
            next: 'c2b_start',
          },
          {
            when: { noFlags: ['c1_kongiUpset', 'c1_drewHorde'] },
            chance: 0.6,
            effects: { mental: -5, setFlags: ['smuggledDog', 'evacuated'], hours: 1 },
            result: [
              '가방을 등에 메고 캄캄한 계단을 내려간다. 5층쯤에서 가방 속 콩이가 한 번 꼬물거린다. 숨을 참고 선다. 다시 조용해진다.',
              '정문 앞 줄 끝에 선다. 앞사람이 돌아보다 가방에 눈이 멎는다. 심장이 목까지 올라온다. 앞사람이 다시 돌아선다. 아무도 못 봤다. 아마도. 앞쪽에서는 직원이 가방을 하나씩 열고 있다.',
            ],
            next: 'c2b_start',
          },
          {
            effects: { hp: -10, mental: -15, setFlags: ['smuggledDog', 'evacuated'], hours: 1 },
            result: [
              '캄캄한 계단 7층 참에서 가방이 낑, 운다. 아래층 방화문 너머에서 뭔가가 문을 긁기 시작한다. 뛰어 내려가다 계단 모서리에 무릎을 찧는다.',
              '절뚝이며 정문 줄 끝에 선다. 가방이 또 낑, 운다. 앞사람이 돌아본다. "그거 개예요? 개는 안 된다던데." 뒷줄에서 누가 소리친다. "개 때문에 사람이 못 타면 어떡해요!"',
              '시선이 따갑다. 누군가 혀를 찬다. 누군가는 작게, 아주 작게 웃는다. 가방을 등 뒤로 돌리고 고개를 숙인다. 앞쪽에서는 직원이 가방을 하나씩 열고 있다. 가방 속 콩이 심장이 이쪽보다 빨리 뛴다.',
            ],
            next: 'c2b_start',
          },
        ],
      },
      {
        id: 'leave',
        label: '사료를 잔뜩 부어 두고 혼자 탄다',
        hint: '살아야 데리러 온다',
        tags: ['cold'],
        outcomes: [
          {
            effects: {
              supply: 10,
              mental: -20,
              removeCompanions: ['kongi'],
              setFlags: ['leftDog', 'evacuated'],
              hours: 1,
            },
            result: [
              '그릇 세 개에 사료를 수북이 붓는다. 물그릇도 세 개. 이동가방 들 손에 배낭을 하나 더 든다. 짐이 가벼워진 게, 제일 무겁다.',
              { when: { flags: ['c1_bathWater'] }, text: '욕조 물은 콩이 몫으로 남긴다. 제일 큰 짐이었는데, 제일 쉽게 내려놓는다.' },
              '현관문을 닫는 순간 콩이가 따라 나오려다 멈춘다. 그 자리에 앉아서 본다. 산책이 아니라는 걸 아는 얼굴이다.',
              '"금방 올게." 거짓말인지 약속인지, 말한 사람도 모른다.',
            ],
            next: 'c2b_start',
          },
        ],
      },
      {
        id: 'stay',
        label: '버스를 보내고 콩이와 남는다',
        hint: '둘이서 12층 농성',
        tags: ['dog', 'careful'],
        outcomes: [
          {
            effects: { mental: 10, setFlags: ['stayedHome'], hours: 1 },
            result: [
              '가지 않는다. 커튼 틈으로 버스 시간이 지나가는 걸 본다. 정문 앞 헤드라이트가 멀어진다. 저게 마지막 버스라면, 그걸로 된 거다.',
              '콩이가 무릎에 턱을 괸다. 둘이다. 12층, 둘이서 버틴다.',
              { when: { flags: ['promisedMom'] }, text: '엄마, 조금만 늦을게. 대신 둘이 갈게.' },
            ],
            next: 'c2a_start',
          },
        ],
      },
    ],
  },
};
