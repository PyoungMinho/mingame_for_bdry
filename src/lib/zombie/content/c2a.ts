import type { Outcome, Para, StoryNode } from '../types';

/**
 * 2장 A루트 — "첫날 밤, 12층 농성" (D+0 21:00 ~ D+1 08:00)
 *
 * 흐름: c2a_start(단수 직전) → c2a_upstairs(윗집 민준) → c2a_kakao(입주민 단톡방)
 *     → c2a_grandma(1203호 할머니) → c2a_stairs(비상계단 결정)
 *        ├─ 1층 탐색: c2a_elevator(멈춘 엘리베이터 아이) → c2a_guardroom(경비실) → c2a_garage(B2 차 키)
 *        └─ 탐색 생략 ────────────────────────────────────────────────────────────┐
 *     → c2a_fire(새벽 화재) → c2a_rooftop(옥상 헬기) → c3_start / end:fortress
 *                          └→ c3_start(완강기·계단 탈출) / end:dead(연기 속 계단)
 *
 * 로컬 플래그: c2a_water, c2a_dark, c2a_leftMinjun, c2a_registered, c2a_roasted,
 *   c2a_checkedGrandma, c2a_ignoredGrandma, c2a_kidWaiting, c2a_savedKid, c2a_fireOut, c2a_lobbyBroken
 *
 * 연속성 메모: 1장 c1_dark(18:00)에서 이미 정전됐다. 이 장의 입구 재난문자는 '단수'다.
 * 1장에서 욕조를 채웠을 수 있으므로(c1_bathWater, 읽기 불가) 욕조 문장은 양쪽에 다 맞게 쓴다.
 * 시간표: 21 → 22 → 23 → 24 → 25(계단) → 26 → 27(경비실) → 28(B2) → 29(화재) → 30(옥상).
 * 1장 c1_kongi 가 19시대 후반에 끝나 20:45~21:00 에 들어오므로 입구를 21시로 보정한다(본문 시각도 여기에 맞춤).
 */
/**
 * 민준을 13층에 남겨 둔 채(c2a_leftMinjun) 옥상을 거치지 않고 건물을 빠져나가는 결과에만
 * abandonedSomeone 을 켠다. 옥상에서 다시 만나면 두고 간 게 아니므로(c2a_upstairs wait 에서 켜지 않는다).
 * 화재 시점엔 c2a_leftMinjun ⟹ 민준 미동행이다(합류는 옥상에서만).
 * chance 가 있는 결과는 재굴림을 막으려고 양쪽을 서로 배타적으로 나눈다.
 */
const LEFT_MINJUN_LINE: Para = {
  when: { flags: ['c2a_leftMinjun'] },
  text: '13층 쪽은 끝내 올려다보지 않는다. 아침을 기다리던 목소리가 저 연기 위 어딘가에 있다.',
};

function splitLeftMinjun(o: Outcome): Outcome[] {
  const w = o.when ?? {};
  const left: Outcome = {
    ...o,
    when: { ...w, flags: [...(w.flags ?? []), 'c2a_leftMinjun'] },
    effects: {
      ...o.effects,
      mental: (o.effects?.mental ?? 0) - 5,
      setFlags: [...(o.effects?.setFlags ?? []), 'abandonedSomeone'],
    },
  };
  if (o.chance === undefined) return [left, o];
  return [left, { ...o, when: { ...w, noFlags: [...(w.noFlags ?? []), 'c2a_leftMinjun'] } }];
}

export const c2a: Record<string, StoryNode> = {
  // ───────────────────────────── 1. 단수 직전 ─────────────────────────────
  c2a_start: {
    id: 'c2a_start',
    chapter: 2,
    location: 'home',
    scene: 'home_dark',
    title: '단수 한 시간 전',
    clock: 21,
    alert: {
      kind: 'disaster',
      from: '서울특별시',
      text: '[서울특별시] 금일 22시부터 강북 일대 단수 예정. 식수를 미리 확보하시고, 야간에는 불빛과 소리를 최소화하십시오.',
    },
    body: [
      '밤 9시. 전기가 나간 지 세 시간. 대피 버스 헤드라이트가 정문을 빠져나간 뒤로 단지엔 불빛이 없다. 마주 보는 105동 창문이 전부 까맣다. 다 떠난 건지, 다 숨죽인 건지 모르겠다.',
      '냉동실 문 아래로 물이 한 방울씩 떨어진다. 그리고 재난문자 한 통. 전기 다음은 물이다.',
      { when: { items: ['powerbank'] }, text: '보조배터리 초록불 네 칸. 오늘 밤 이 집의 유일한 발전소다.' },
      { when: { noItems: ['powerbank'], noFlags: ['promisedMom'] }, text: '폰 배터리 17%. 충전기는 이제 그냥 줄이다. 밝기를 최저로 내린다.' },
      { when: { noItems: ['powerbank'], flags: ['promisedMom'] }, text: '폰 배터리 7%. 엄마랑 한 약속이 거의 다 먹었다. 충전기는 이제 그냥 줄이다. 밝기를 최저로 내린다.' },
      { when: { companions: ['kongi'] }, text: '콩이가 발치에 붙어 앉는다. 접힌 귀가 자꾸 현관 쪽으로 돌아간다.' },
      { when: { infected: true }, text: '낮에 물린 자리가 화끈거린다. 이마를 짚어 본다. 미지근하다. 아직은.' },
    ],
    choices: [
      {
        id: 'fill_water',
        label: '담을 수 있는 건 다 물을 받는다',
        hint: '물은 남고 소리가 난다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { supply: 12, mental: -5, hours: 1, setFlags: ['c2a_water'] },
            result: [
              '냄비, 김치통, 전기포트, 빈 페트병. 물이 담기는 건 전부 싱크대 앞에 줄 세운다. 욕조도 넘치기 직전까지 튼다.',
              { when: { companions: ['kongi'] }, text: '콩이 물그릇도 넘치게 채운다. 콩이가 한 번 핥아 보고 만족한 얼굴을 한다.' },
              '물 떨어지는 소리가 배관을 타고 층층이 울린다. 위층도 아래층도 다 같은 생각인 모양이다. 그 소리에 뭐가 모여들까 봐 꼭지를 반만 연다.',
              '9시 47분. 물줄기가 연필심처럼 가늘어지더니 수도관이 꾸르륵 운다. 13분 일찍 끊겼다. 문자 보낸 사람도 오늘 처음 겪는 일이다.',
            ],
            next: 'c2a_upstairs',
          },
        ],
      },
      {
        id: 'blackout',
        label: '커튼을 치고 빛을 틀어막는다',
        hint: '숨긴다. 대신 막막하다',
        tags: ['careful'],
        outcomes: [
          {
            when: { items: ['flashlight'] },
            effects: { mental: 10, hours: 1, setFlags: ['c2a_dark'] },
            result: [
              '암막 커튼을 치고, 틈은 택배 상자를 뜯어 박스테이프로 막는다. 손전등 머리엔 빨간 셀로판을 씌운다. 캠핑 유튜브에서 본 거다.',
              '불그스름한 빛 한 점. 밖으로는 새지 않는다. 이 좁은 빛이 이상하게 사람을 진정시킨다.',
            ],
            next: 'c2a_upstairs',
          },
          {
            effects: { mental: -5, hours: 1, setFlags: ['c2a_dark'] },
            result: [
              '커튼을 치고, 촛불을 끄고, 폰 화면까지 엎어 둔다. 방이 먹물이 된다.',
              '보이는 게 없으니 소리만 남는다. 이 층, 저 층, 누가 걷는 소리. 뛰는 소리. 사람인지는 모르겠다.',
            ],
            next: 'c2a_upstairs',
          },
        ],
      },
      {
        id: 'order',
        label: '배달앱을 켜 본다',
        hint: '이 와중에?',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.4,
            effects: { supply: 12, mental: 10, hours: 1 },
            result: [
              '앱이 돈다. "영업 중" 치킨집 딱 한 곳. 예상 배달 시간 40~200분. 결제 버튼을 누르고 나서야 스스로에게 놀란다.',
              '52분 뒤, 현관 앞에 봉지 놓이는 소리. 외시경 너머로 헬멧 하나가 계단 쪽으로 사라진다. 요청사항엔 "벨X 노크X 제발"이라고 적었었다. 이 동네 라이더들은 진짜다.',
              { when: { companions: ['kongi'] }, text: '콩이가 코를 벌름거린다. 닭가슴살을 한 조각 떼어 준다. 뼈는 절대 안 된다. 세상이 끝나도.' },
            ],
            next: 'c2a_upstairs',
          },
          {
            effects: { mental: -5, hours: 1 },
            result: [
              '"라이더 배정 중". 동그라미가 20분, 40분 돈다. 동그라미만 돈다.',
              '그러다 앱이 한 줄을 띄운다. "배달 불가 지역입니다." 우리 동네가 방금 공식적으로 지도에서 지워졌다.',
            ],
            next: 'c2a_upstairs',
          },
        ],
      },
      {
        id: 'fridge',
        label: '냉동실을 지금 다 털어 먹는다',
        hint: '배는 부르다. 냄새가 난다',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.55,
            effects: { hp: 10, supply: 5, mental: 5, hours: 1 },
            result: [
              '냉동실이 벌써 흥건하다. 어차피 내일이면 다 녹는다. 부탄가스 버너에 삼겹살, 만두, 언제 산지 모를 떡갈비를 한꺼번에 올린다.',
              { when: { flags: ['ateRamen'] }, text: '낮에 먹은 라면이 아직 소화도 안 됐다. 상관없다. 오늘은 먹는 날이다.' },
              '마지막 만두를 입에 넣는다. 종말의 첫 끼가 회식 2차보다 푸짐하다. 배가 따뜻하니 겁도 조금 준다.',
            ],
            next: 'c2a_upstairs',
          },
          {
            effects: { hp: 10, mental: -10, hours: 1 },
            result: [
              '삼겹살 기름 튀는 소리가 생각보다 크다. 고기 냄새가 현관문 틈으로 복도까지 샌다.',
              '두 번째 판을 올릴 때쯤 현관문에서 소리가 난다. 드르륵. 손톱으로 긁는 소리. 불을 끄고 싱크대 밑에 웅크린 채 식어 가는 고기를 먹는다. 맛이 안 난다.',
            ],
            next: 'c2a_upstairs',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 2. 윗집의 쿵쿵 ─────────────────────────────
  c2a_upstairs: {
    id: 'c2a_upstairs',
    chapter: 2,
    location: 'home',
    scene: 'balcony_view',
    title: '윗집의 쿵쿵',
    body: [
      '밤 10시. 수도꼭지가 마지막 한 방울을 떨군다. 그리고 쿵. 쿵쿵. 천장이 울린다.',
      '1301호. 작년 겨울 새벽 2시에 줄넘기를 하던 그 집. 관리사무소에 민원을 두 번 넣었다. 그런데 오늘은 박자가 이상하다. 쿵, 쿵쿵, 쿵. 누가 일부러 신호를 보내는 소리다.',
      '베란다 창을 조금 열자 위에서 목소리가 떨어진다. "저기요… 아래 사람 있어요?" 고개를 빼 보니 13층 난간에 트레이닝복 차림의 남자애가 매달리듯 서 있다. 등 뒤 거실 유리문을 누군가 안쪽에서 계속 친다.',
      '"저 1301호 민준인데요. 엄마랑 아빠가… 좀 이상해져서요. 베란다 문 잠그고 여기 세 시간째예요. 줄넘기는 죄송했어요."',
      { when: { companions: ['kongi'] }, text: '콩이가 천장을 올려다보며 낮게 낑낑거린다. 짖지는 않는다. 짖으면 안 된다는 걸 아는 얼굴이다.' },
    ],
    choices: [
      {
        id: 'sheet',
        label: '이불을 묶어 끌어내린다',
        hint: '빠르다. 매듭을 믿어야 한다',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            chance: 0.6,
            effects: { hp: -10, supply: 5, hours: 1, addCompanions: ['minjun'], setFlags: ['savedStranger'] },
            result: [
              '이불 두 장, 커튼 한 장. 매듭을 세 번씩 짓고 한쪽 끝을 빨래 건조대 기둥에 감는다. 민준이 이불을 잡고 난간을 넘는다. 12층 허공에서 운동화가 한 번 헛돈다.',
              '민준이 우리 집 베란다에 굴러떨어진다. 손바닥이 다 쓸렸다. 가방에서 에너지바와 홍삼 스틱을 한 줌 꺼내 놓는다. 엄마가 싸 준 수험생 간식이다.',
              '한참 숨을 고르던 민준이 묻는다. "근데… 수능, 이제 안 봐도 되는 거죠?" 웃는 건지 우는 건지 둘 다 모른다.',
            ],
            next: 'c2a_kakao',
          },
          {
            effects: { hp: -20, mental: -5, hours: 1, addCompanions: ['minjun'], setFlags: ['savedStranger'] },
            result: [
              '두 번째 매듭이 풀린다. 민준이 반 층을 미끄러진다. 반사적으로 손목을 낚아챈다. 어깨가 빠지는 줄 알았다.',
              '둘이 베란다 바닥에 대자로 뻗는다. 위층에서 유리문 깨지는 소리. 한 박자만 늦었어도.',
              '민준이 천장을 보며 중얼거린다. "살면서 층간소음으로 목숨 건진 사람 저밖에 없을 거예요."',
            ],
            next: 'c2a_kakao',
          },
        ],
      },
      {
        id: 'flashlight',
        label: '손전등으로 디딜 곳을 비춰 준다',
        hint: '안전하다. 빛이 샌다',
        requires: { items: ['flashlight'] },
        lockedHint: '손전등이 있었다면…',
        tags: ['careful', 'kind'],
        outcomes: [
          {
            effects: { mental: 5, supply: 5, hours: 1, addCompanions: ['minjun'], setFlags: ['savedStranger'] },
            result: [
              '손전등 불빛을 13층 난간 아래로 비춘다. 에어컨 실외기 받침대, 배관 브래킷, 우리 집 빨래 건조대. 하나씩 짚어 준다. "거기. 오른발. 이제 왼손."',
              '민준이 불빛을 징검다리 삼아 한 층을 내려온다. 발이 바닥에 닿자 다리가 풀려 주저앉는다. 맞은편 105동 어딘가에서 창문이 쾅 닫힌다. 불빛을 본 게 사람만은 아닐지도 모른다.',
              '민준이 가방에서 수험생 간식을 한 줌 꺼내 놓고 묻는다. "수능… 이제 안 봐도 되는 거죠?" 대답 대신 에너지바 포장을 뜯어 준다.',
            ],
            next: 'c2a_kakao',
          },
        ],
      },
      {
        id: 'broom',
        label: '빗자루로 천장을 쳐서 답한다',
        hint: '1년 묵은 복수?',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.5,
            effects: { mental: 10, hours: 1, addCompanions: ['minjun'] },
            result: [
              '쿵쿵. 빗자루 자루로 천장을 친다. 1년 치 민원이 담긴 두 번이다. 위에서 바로 답이 온다. 쿵쿵쿵. "아 진짜 사람 있다!"',
              { when: { companions: ['kongi'] }, text: '콩이가 참지 못하고 "왕!" 한 번. 급히 주둥이를 감싸 쥔다. 콩이가 억울하다는 눈으로 본다.' },
              '용기가 생겼는지 민준이 스스로 난간을 타고 내려온다. 체대 입시 준비생의 팔 힘이다. 베란다에 착지하자마자 한마디. "수능… 이제 안 봐도 되는 거죠?"',
            ],
            next: 'c2a_kakao',
          },
          {
            effects: { mental: -5, hours: 1, setFlags: ['c2a_leftMinjun'] },
            result: [
              '쿵쿵. 위에서 쿵쿵쿵. 민준이 한 발을 난간 밖으로 내렸다가 다시 올린다.',
              '"못 하겠어요. 무서워요. 아침에… 아침에 와 주시면 안 돼요?" 그날 밤, 천장 너머로 가끔 쿵 소리가 난다. 아직 살아 있다는 신호다.',
            ],
            next: 'c2a_kakao',
          },
        ],
      },
      {
        id: 'wait',
        label: '아침에 구하러 가겠다고 한다',
        hint: '지금은 안전하다. 지금은',
        tags: ['careful', 'cold'],
        outcomes: [
          {
            effects: { mental: -10, hours: 1, setFlags: ['c2a_leftMinjun'] },
            result: [
              '"날 밝으면 갈게. 거기 가만히 있어." 위에서 목소리가 작아진다. "…네. 기다릴게요."',
              '그날 밤 천장은 조용하다. 차라리 쿵쿵거려 주면 좋겠다고, 1년 만에 처음으로 생각한다.',
            ],
            next: 'c2a_kakao',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 3. 입주민 단톡방 ─────────────────────────────
  c2a_kakao: {
    id: 'c2a_kakao',
    chapter: 2,
    location: 'home',
    scene: 'phone_alert',
    title: '입주민 소통방 (214)',
    alert: {
      kind: 'kakao',
      from: '○○아파트 입주민 (214)',
      text: '[동대표 1502호] 생존 세대 확인합니다. 동·호수와 인원 남겨 주세요. 내일 06시 옥상 집결, 구조 요청 예정입니다.',
    },
    body: [
      '밤 11시. 폰이 쉬지 않고 떤다. 평소엔 주차 민원이랑 분리수거 사진만 올라오던 방이다.',
      '"1204호 생수 20박스 사재기함. 엘베 CCTV 봤음" "제 돈으로 산 겁니다" "지금 돈 얘기가 나와요?" "수돗물에 바이러스 풀렸다는 거 진짜예요? 저 아까 마셨는데" "찌라시 퍼 나르지 마세요 신고합니다" "어디에요 경찰"',
      { when: { companions: ['kongi'], noFlags: ['c1_drewHorde'] }, text: '그리고 누군가 쓴다. "1201호 개 짖는 소리 좀비 부름. 조치 바람." 좋아요 14. 콩이가 오늘 짖은 건 손에 꼽을 만큼이다. 억울한 얼굴로 올려다본다. 틀린 말만은 아니라서 편들어 주기가 애매하다.' },
      { when: { companions: ['kongi'], flags: ['c1_drewHorde'] }, text: '그리고 누군가 쓴다. "1201호 개 짖는 소리 좀비 부름. 조치 바람." 좋아요 14. 콩이가 고개를 돌려 이쪽을 본다. 할 말이 없다. 저녁에 복도를 채운 발소리를 부른 건 트로트였고, 트로트를 튼 건 이쪽이다.' },
      { when: { noCompanions: ['kongi'] }, text: '그리고 누군가 쓴다. "1201호 개 짖는 소리 들림." 콩이는 지금 여기 없다. 없는데. 폰을 쥔 손이 멈춘다.' },
      { when: { flags: ['postedVideo'] }, text: '"1201호 낮에 좀비 영상 올린 사람 아님?" 조회수 12만. 몇 명은 그 영상으로 사태를 처음 알았다며 고맙다고 하고, 몇 명은 관종이라고 한다.' },
      { when: { companions: ['minjun'] }, text: '민준이 옆에서 화면을 들여다본다. "우리 엄마도 이 방 있었는데." 말끝이 흐려진다. 1301호 칸은 아무도 채우지 않는다.' },
    ],
    choices: [
      {
        id: 'register',
        label: '동·호수와 인원을 남긴다',
        hint: '성실하다. 다 알려진다',
        tags: ['careful', 'kind'],
        outcomes: [
          {
            effects: { mental: 5, hours: 1, setFlags: ['c2a_registered'] },
            result: [
              '"101동 1201호 생존." 몇 명인지 세다가, 결국 한 줄을 덧붙인다.',
              { when: { companions: ['kongi'] }, text: '"+ 강아지 1." 동대표 답장. "1201호 확인. 옥상 집결 시 반려견 목줄 필수." 그래도 명단에 콩이 자리가 생겼다.' },
              '동대표가 이어서 공지한다. "1203호 연락 두절. 혼자 사시는 어르신, 무릎 때문에 버스 못 타심. 옆집 분 확인 바랍니다." 옆집이 여기다.',
            ],
            next: 'c2a_grandma',
          },
        ],
      },
      {
        id: 'roast',
        label: '"개보다 공지가 더 시끄럽다" 친다',
        hint: '속은 시원하다',
        tags: ['meme'],
        outcomes: [
          {
            effects: { mental: 10, hours: 1, setFlags: ['c2a_roasted'] },
            result: [
              '"개보다 동대표님 공지 알림이 더 시끄럽습니다." 전송.',
              '좋아요 31. "ㅋㅋㅋㅋ" 열두 개. 동대표가 3분간 침묵하다 공지를 하나 올린다. "옥상 집결 명단은 제가 직접 관리합니다." 어쩐지 명단에서 한 줄이 지워진 기분이다.',
            ],
            next: 'c2a_grandma',
          },
        ],
      },
      {
        id: 'dm1204',
        label: '1204호에 물을 나눠 달라 한다',
        hint: '굽히면 얻을지도',
        tags: ['cold'],
        outcomes: [
          {
            chance: 0.5,
            effects: { supply: 10, mental: -5, hours: 1 },
            result: [
              '같은 층, 두 집 건너. 개인 톡을 보낸다. "사장님, 물 조금만…" 5분 뒤 답장. "문 앞에 2L 네 병 둡니다. 대신 단톡에서 제 편 좀 들어 주세요."',
              '복도에 나가 물을 들여오고, 단톡에 쓴다. "사재기 아니고 원래 쟁여 두시는 분이에요." 물은 달다. 입은 쓰다.',
            ],
            next: 'c2a_grandma',
          },
          {
            effects: { mental: -5, hours: 1 },
            result: [
              '읽음 표시 1이 사라진다. 답은 없다. 10분 뒤, 대화 상대 이름이 "(알 수 없음)"으로 바뀐다.',
              '같은 층 두 집 건너에 물 20박스가 있다. 그 사실이 밤새 목을 마르게 한다.',
            ],
            next: 'c2a_grandma',
          },
        ],
      },
      {
        id: 'mute',
        label: '알림을 끄고 콩이를 안는다',
        hint: '정보보다 체온',
        requires: { companions: ['kongi'] },
        lockedHint: '콩이가 곁에 있었다면…',
        tags: ['dog'],
        outcomes: [
          {
            effects: { mental: 15, hours: 1 },
            result: [
              '폰을 엎어 둔다. 진동이 바닥을 두드리다 지쳐 멈춘다.',
              '콩이 배를 쓰다듬는다. 따뜻하고, 조금 빠르게 오르내린다. 214명의 공포보다 5kg의 체온이 훨씬 설득력 있다. 콩이가 손목에 턱을 괸다. 그걸로 됐다.',
            ],
            next: 'c2a_grandma',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 4. 1203호 할머니 ─────────────────────────────
  c2a_grandma: {
    id: 'c2a_grandma',
    chapter: 2,
    location: 'home',
    scene: 'door_peephole',
    title: '1203호의 노크',
    body: [
      '자정. 똑, 똑. 아주 작은 노크. 숨을 죽이고 외시경에 눈을 댄다.',
      '어안렌즈 속에 1203호 할머니가 서 있다. 꽃무늬 조끼, 두 손에 받쳐 든 양은 냄비. 복도 비상등이 흰머리를 초록으로 물들인다.',
      { when: { flags: ['c1_drewHorde'] }, text: '저녁에 복도를 채웠던 발소리들은 계단 아래로 빠져나간 모양이다. 지금 복도는 조용하다. 할머니 조끼 자락에 누구 것인지 모를 검은 얼룩이 묻어 있다. 할머니도 그 한 시간을 문 하나 사이에 두고 버틴 거다.' },
      '"1201호, 자는겨? 나 옆집이여. 무릎 땜시 버스를 못 탔어. 부산 아들은 전화를 안 받고… 혼자 있응께 무서워서 그려."',
      { when: { flags: ['openedDoor'] }, text: '할머니 발치, 1202호 앞 바닥에 낮의 핏자국이 검게 말라붙어 있다. 할머니는 그쪽을 한 번도 보지 않는다. 일부러 안 보는 거다.' },
      { when: { companions: ['kongi'] }, text: '콩이가 현관 앞에서 꼬리를 친다. 김장 때마다 수육 한 점씩 얻어먹던 걸 기억하는 꼬리다.' },
      { when: { companions: ['minjun'] }, text: '민준이 속삭인다. "저 할머니 엘베에서 맨날 저한테 공부 열심히 하라고…" 말을 끝맺지 못한다.' },
    ],
    choices: [
      {
        id: 'take_in',
        label: '할머니를 우리 집에 모신다',
        hint: '든든하다. 입이 는다',
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['minjun'] },
            effects: { supply: 15, mental: 10, hours: 1, addCompanions: ['grandma'] },
            result: [
              '문을 열자 할머니가 김치찌개 냄비부터 내민다. 민준이 1203호를 두 번 왕복하며 김치통, 쌀 반 포대, 부탄가스 한 줄을 옮긴다.',
              '할머니가 민준을 위아래로 훑는다. "이 총각은 누구여?" "윗집이요. 쿵쿵…" "아, 그 줄넘기!" 종말의 밤, 층간소음 가해자와 피해자와 옆집 할머니가 한 식탁에 앉는다.',
            ],
            next: 'c2a_stairs',
          },
          {
            effects: { supply: 12, mental: 10, hours: 1, addCompanions: ['grandma'] },
            result: [
              '문을 열자 할머니가 김치찌개 냄비부터 내민다. 둘이서 1203호를 두 번 왕복한다. 김치통, 쌀 반 포대, 부탄가스 한 줄, 그리고 왜인지 모를 소금 한 봉지.',
              '"난리통엔 쌀하고 소금이여. 피란 때도 그랬어." 할머니가 부탄가스 버너에 찌개를 데운다. 정전된 집에 김이 오른다.',
            ],
            next: 'c2a_stairs',
          },
        ],
      },
      {
        id: 'check_door',
        label: '체인을 건 채 물과 안부만 나눈다',
        hint: '서로 부담은 없다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: 5, hours: 1, setFlags: ['c2a_checkedGrandma'] },
            result: [
              '체인을 건 채로 문을 한 뼘 연다. 생수 한 병을 내밀고, 김치찌개 냄비를 받는다. 물물교환이다.',
              '"문 꼭 잠그고 있어. 뭔 소리가 나도 열지 말고." 할머니가 1203호로 돌아간다. 옆집 도어록 잠기는 소리가 벽 너머에서 들린다. 일단은, 무사하다.',
            ],
            next: 'c2a_stairs',
          },
        ],
      },
      {
        id: 'silent',
        label: '숨죽이고 없는 척한다',
        hint: '문은 열리지 않는다',
        tags: ['cold'],
        outcomes: [
          {
            effects: { supply: 8, mental: -15, hours: 1, setFlags: ['abandonedSomeone', 'c2a_ignoredGrandma'] },
            result: [
              '할머니가 두 번 더 두드린다. "자나 보네." 혼잣말. 슬리퍼 끄는 소리가 멀어진다.',
              '한참 뒤 문을 연다. 현관 앞에 냄비가 놓여 있다. 뚜껑 위 포스트잇. "1201호 먹어. 문 꼭 잠그고." 김치찌개는 아직 따뜻하다. 그게 제일 견디기 힘들다.',
            ],
            next: 'c2a_stairs',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 5. 비상계단 ─────────────────────────────
  c2a_stairs: {
    id: 'c2a_stairs',
    chapter: 2,
    location: 'complex',
    scene: 'stairwell',
    title: '12층 비상계단',
    alert: {
      kind: 'radio',
      from: '관리사무소',
      text: '관리사무소에서 알려드립니다. 엘리베이터 운행을 전면 중단합니다. 경비실 무전 응답 없습니다. 비상계단 방화문은 반드시 닫아 주십시오. 반드시.',
    },
    body: [
      '새벽 1시. 비상 스피커 방송이 뚝 끊긴다. 마지막 "반드시"가 계단 아래로 메아리친다.',
      '1층 경비실엔 무전기가 있다. 관리실 창고엔 공구와 민방위 방독면 박스가 쌓여 있다고, 동대표가 작년 단톡에 자랑한 적이 있다. 12층에서 1층까지, 스물네 번 꺾이는 계단.',
      { when: { noItems: ['flashlight'] }, text: '계단참마다 초록 비상구 표시등 하나. 그 아래는 전부 까맣다.' },
      { when: { items: ['flashlight'] }, text: '손전등을 켜면 계단 여섯 칸이 보인다. 끄면 아무것도 안 보인다. 켜면, 저쪽에서도 보인다.' },
      { when: { companions: ['grandma'] }, text: '할머니가 소파에서 한마디 한다. "밤에 나대는 거 아니여. 해 뜨면 가."' },
      { when: { infected: true }, text: '계단 난간이 차갑게 느껴진다. 몸이 뜨거워서다. 입안이 자꾸 마른다.' },
    ],
    choices: [
      {
        id: 'go_down',
        label: '1층 경비실까지 내려간다',
        hint: '얻을 게 많다. 멀다',
        tags: ['brave'],
        outcomes: [
          {
            effects: { mental: -5, hours: 1 },
            result: [
              '방화문을 소리 안 나게 닫고 한 칸씩 내려간다. 11층, 10층. 층수 표시가 줄어들수록 공기가 무거워진다.',
              { when: { companions: ['minjun'] }, text: '민준이 앞장선다. "계단은 제가 빨라요. 학원 엘베 기다리기 싫어서 맨날 뛰었거든요."' },
              { when: { companions: ['grandma'] }, text: '할머니는 집을 지킨다. "문 두 번 똑똑, 한 번 쉬고 똑. 그래야 열어 줄 겨." 암호가 생겼다.' },
              '9층 계단참에서 발이 멈춘다. 엘리베이터 홀 쪽에서 소리가 난다.',
            ],
            next: 'c2a_elevator',
          },
        ],
      },
      {
        id: 'hydrant',
        label: '복도 소화전함만 챙긴다',
        hint: '가까운 것부터',
        tags: ['careful'],
        outcomes: [
          {
            when: { items: ['extinguisher'] },
            effects: { supply: 8, hours: 2 },
            result: [
              '12층 복도 소화전함. 빨간 문이 삐걱 열리는 소리가 복도 끝까지 굴러간다. 소화기는 낮에 이미 챙겼다. 빈손으로 닫으려는데, 호스 뒤에 검은 비닐봉지가 끼여 있다.',
              '초코바 네 개, 믹스커피 한 줌, 담배 한 갑. 누군가의 비상식량이다. 경비아저씨가 순찰 돌다 몰래 쉬던 자리였나 보다. 죄송합니다, 하고 챙긴다.',
            ],
            next: 'c2a_fire',
          },
          {
            effects: { hours: 2, addItems: ['extinguisher'] },
            result: [
              '12층 복도 소화전함. 빨간 문이 삐걱 열리는 소리가 복도 끝까지 굴러간다. 한참을 얼어붙어 있다가 소화기를 꺼낸다. 3.3kg. 생각보다 묵직하다.',
              '집으로 돌아와 소화기를 현관 옆에 세워 둔다. 1층은 멀다. 오늘 밤은 여기까지다.',
            ],
            next: 'c2a_fire',
          },
        ],
      },
      {
        id: 'sleep',
        label: '방화문을 닫고 눈을 붙인다',
        hint: '쉬면 버틴다. 빈손이다',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c2a_dark'] },
            effects: { hp: 15, mental: 15, hours: 3 },
            result: [
              '현관 앞에 식탁 의자와 캐리어를 쌓고 거실 바닥에 눕는다. 아까 커튼을 꽁꽁 쳐 둔 덕에 빛 한 줄 새지 않는다.',
              '새벽 3시쯤 복도에서 발소리가 오간다. 문 앞에서 멈췄다가, 그냥 지나간다. 불 켜진 집부터 찾는 모양이다. 이 집은 없는 집이다.',
              { when: { companions: ['kongi'] }, text: '콩이가 겨드랑이 밑으로 파고든다. 작은 심장이 규칙적으로 뛴다. 그 박자를 세다가 까무룩 잠든다.' },
              '그 뒤로는 꿈도 없이 가라앉는다. 오랜만에 깊은 잠이다.',
            ],
            next: 'c2a_fire',
          },
          {
            effects: { hp: 10, mental: 10, hours: 3 },
            result: [
              '현관 앞에 식탁 의자와 캐리어를 쌓고 거실 바닥에 눕는다. 잠은 안 올 줄 알았다.',
              { when: { companions: ['kongi'] }, text: '콩이가 겨드랑이 밑으로 파고든다. 작은 심장이 규칙적으로 뛴다. 그 박자를 세다가 까무룩 잠든다.' },
              { when: { companions: ['grandma'] }, text: '할머니 코 고는 소리가 1년 치 층간소음보다 크다. 이상하게 안심된다. 이 소리가 들리는 동안은 둘 다 살아 있다.' },
              '어느새 눈꺼풀이 내려온다. 몸이 거실 바닥으로 천천히 가라앉는다.',
            ],
            next: 'c2a_fire',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 6. 멈춘 엘리베이터 ─────────────────────────────
  c2a_elevator: {
    id: 'c2a_elevator',
    chapter: 2,
    location: 'complex',
    scene: 'elevator',
    title: '8층과 9층 사이',
    body: [
      '훌쩍이는 소리. 사람 소리다. 멈춘 엘리베이터가 8층과 9층 사이에 걸려 있다. 9층 문을 비틀어 보니 위쪽에 손바닥만 한 틈이 벌어져 있다.',
      '틈 안에서 초등학생쯤 되는 목소리가 말한다. "살려 주세요… 친구네서 놀다가 집에 가려고 탔는데, 불 꺼지면서 멈췄어요. 엄마는 7층이에요."',
      '문제는 소리다. 아이가 울음을 터뜨릴 때마다 아래 어딘가에서 무언가 계단을 긁으며 올라온다. 한 층. 또 한 층.',
      { when: { companions: ['minjun'] }, text: '민준이 틈을 올려다본다. "저 턱걸이 스무 개 해요. 체육 수행평가 만점이었어요."' },
    ],
    choices: [
      {
        id: 'pry',
        label: '문을 벌려 아이를 끌어낸다',
        hint: '시끄럽다. 손이 모자라다',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            when: { companions: ['minjun'] },
            effects: { hp: -5, supply: 5, hours: 1, addItems: ['gasmask'], setFlags: ['savedStranger', 'c2a_savedKid'] },
            result: [
              '둘이 양쪽에서 문짝을 잡고 벌린다. 민준이 틈에 팔을 넣어 아이 겨드랑이를 걸고 한 번에 끌어올린다. 수행평가 만점은 거짓말이 아니었다.',
              '7층 703호. 문이 열리자마자 엄마가 아이를 끌어안고 무너진다. 잠시 뒤 신발장에서 방독면과 생수 두 병을 꺼내 준다. "애 아빠가 민방위 때 받아 온 거예요. 가져가세요, 제발."',
            ],
            next: 'c2a_guardroom',
          },
          {
            when: { items: ['bat'] },
            effects: { hp: -10, supply: 5, hours: 1, addItems: ['gasmask'], setFlags: ['savedStranger', 'c2a_savedKid'] },
            result: [
              '야구방망이를 문틈에 끼워 지렛대로 쓴다. 치라고 산 방망이인데 비트는 데 재능이 더 있다. 문짝이 신음하며 벌어진다.',
              '아이를 끌어내 7층에 데려다준다. 엄마가 아이를 끌어안고 한참을 운다. 그리고 방독면 하나와 생수 두 병을 내민다. "애 아빠 민방위 거예요. 가져가세요."',
            ],
            next: 'c2a_guardroom',
          },
          {
            chance: 0.5,
            effects: { hp: -15, supply: 5, hours: 1, addItems: ['gasmask'], setFlags: ['savedStranger', 'c2a_savedKid'] },
            result: [
              '맨손으로 문짝을 벌린다. 손톱 하나가 들린다. 문이 한 뼘, 두 뼘. 아이가 팔을 뻗는다. 잡았다.',
              '7층 엄마가 아이를 받아 안고, 신발장에서 방독면을 꺼내 준다. 피 나는 손가락엔 뽀로로 밴드를 붙여 준다.',
            ],
            next: 'c2a_guardroom',
          },
          {
            effects: { hp: -15, mental: -10, hours: 1, setFlags: ['c2a_kidWaiting'] },
            result: [
              '문짝이 끼익, 크게 운다. 동시에 아래층 방화문이 쾅 열린다. 뛰는 발소리가 올라온다.',
              '손을 놓고 벽에 붙는다. 발소리가 8층에서 멈췄다가, 한참 뒤 다시 내려간다. 틈 안의 아이에게 속삭인다. "열쇠 가져올게. 조용히, 천까지 세고 있어." 아이가 코를 훌쩍인다. "…하나, 둘."',
            ],
            next: 'c2a_guardroom',
          },
        ],
      },
      {
        id: 'promise',
        label: '비상키를 찾아오겠다고 한다',
        hint: '약속은 무겁다',
        tags: ['careful', 'kind'],
        outcomes: [
          {
            effects: { hours: 1, setFlags: ['c2a_kidWaiting'] },
            result: [
              '"경비실에 비상키 있어. 금방 올게. 소리 내지 말고, 천까지 세고 있어."',
              '틈 안에서 작게 들린다. "…하나, 둘, 셋." 계단을 내려가는 내내 그 숫자가 발목에 감긴다.',
            ],
            next: 'c2a_guardroom',
          },
        ],
      },
      {
        id: 'pass',
        label: '못 들은 척 지나친다',
        hint: '빠르고 조용하다',
        tags: ['cold'],
        outcomes: [
          {
            effects: { mental: -15, hours: 1, setFlags: ['abandonedSomeone'] },
            result: [
              '계단을 내려갈수록 울음소리가 작아진다. 작아지는 게 거리 때문인지, 다른 이유인지 모른다.',
              '7층을 지날 때 방화문 너머에서 여자 목소리가 들린다. "준서야, 준서야…" 걸음을 멈추지 않는다. 멈추면 다시 못 걷는다.',
            ],
            next: 'c2a_guardroom',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 7. 1층 경비실 ─────────────────────────────
  c2a_guardroom: {
    id: 'c2a_guardroom',
    chapter: 2,
    location: 'complex',
    scene: 'hallway',
    title: '1층 경비실',
    body: [
      '새벽 3시. 1층 방화문을 손가락 한 마디만큼 연다. 로비 유리문 밖에 셋, 아니 넷. 그림자들이 목적 없이 흔들린다. 가끔 누가 유리에 이마를 댄다.',
      '복도 끝 경비실 창에 촛불 한 점. 박 씨 아저씨가 손짓한다. 매일 아침 택배 찾아가라고 이름을 불러 주던 그 아저씨. 종아리에 수건이 감겨 있다. 수건은 검붉다.',
      '"무전기랑 빠루는 여기 있어. 관리실 창고 열쇠도. 창고엔 방독면이랑 완강기 예비품 있고." 아저씨가 창구 너머로 열쇠 꾸러미를 흔든다. "근데 창고 셔터가 시끄러. 저것들 소리에 환장혀."',
      { when: { companions: ['kongi'] }, text: '콩이가 아저씨 쪽으로 꼬리를 흔들다가, 수건 근처에서 코를 멈춘다. 으르렁. 아주 작게.' },
      { when: { flags: ['c2a_kidWaiting'] }, text: '저 열쇠 꾸러미 어딘가에 엘리베이터 비상키가 있다. 위에서 아이가 숫자를 세고 있다.' },
    ],
    choices: [
      {
        id: 'storeroom',
        label: '관리실 창고 셔터를 올린다',
        hint: '다 챙긴다. 시끄럽다',
        tags: ['brave'],
        outcomes: [
          {
            when: { companions: ['minjun'] },
            effects: { hp: -5, hours: 1, addItems: ['radio', 'crowbar', 'gasmask', 'descender'] },
            result: [
              '민준이 로비 반대편 우편함을 걷어차고 지하 쪽으로 뛴다. 유리문 밖 그림자들이 일제히 그쪽으로 고개를 돌린다.',
              '그 틈에 셔터를 올린다. 무전기, 빠루, 방독면, 완강기 예비품. 양팔이 모자라다. 계단참에서 헐떡이는 민준과 합류한다. "저 방금 인생 최고 기록 나왔어요."',
            ],
            next: 'c2a_garage',
          },
          {
            chance: 0.5,
            effects: { hp: -10, hours: 1, addItems: ['radio', 'crowbar', 'gasmask', 'descender'] },
            result: [
              '셔터를 아주 천천히, 한 칸씩 올린다. 드르륵. 멈춤. 드르륵. 유리문 밖 그림자들이 고개를 갸웃한다. 들어오지는 않는다.',
              '무전기, 빠루, 방독면, 완강기. 전부 끌어안고 계단으로 돌아온다. 정강이가 계단 모서리에 찍혔지만 수확은 완벽하다.',
            ],
            next: 'c2a_garage',
          },
          {
            effects: { hp: -20, mental: -10, hours: 1, addItems: ['crowbar'], setFlags: ['c2a_lobbyBroken'] },
            result: [
              '셔터 레일이 녹슬어 있다. 드르르르륵. 새벽 공기를 찢는 소리.',
              '로비 유리문에 손바닥 열 개가 동시에 달라붙는다. 유리에 거미줄 같은 금이 간다. 손에 잡히는 빠루 하나만 쥐고 계단으로 뛴다. 등 뒤에서 유리가 무너지는 소리.',
            ],
            next: 'c2a_garage',
          },
        ],
      },
      {
        id: 'window',
        label: '아저씨가 건네는 것만 받는다',
        hint: '안전하다. 절반이다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: -5, hours: 1, addItems: ['radio', 'crowbar'] },
            result: [
              '창구 틈으로 무전기와 빠루가 넘어온다. "채널 9번. 군 방송도 가끔 잡혀."',
              '아저씨는 나오지 않는다. "난 여기 있을 거여. 누가 문 두드리면 열어 줘야지. 그게 경비여." 촛불이 흔들린다. 돌아보지 않고 계단으로 향한다.',
            ],
            next: 'c2a_garage',
          },
        ],
      },
      {
        id: 'carry',
        label: '아저씨를 부축해 올라간다',
        hint: '종아리 수건이 마음에 걸린다',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { mental: -10, hours: 1, addItems: ['radio', 'crowbar', 'gasmask'] },
            result: [
              '경비실 문을 여는 순간 콩이가 앞을 막아선다. 이빨을 드러낸다. 콩이가 사람한테 이러는 건 처음이다.',
              '아저씨가 멈춘다. 자기 종아리를 내려다본다. "…개가 먼저 아네." 아저씨가 무전기, 빠루, 방독면을 창구로 밀어 주고 문을 안에서 잠근다. "올라가. 뒤돌아보지 말고."',
              '계단을 오르다 한 번 돌아본다. 촛불이 꺼져 있다.',
            ],
            next: 'c2a_garage',
          },
          {
            chance: 0.5,
            effects: { hp: -10, mental: -15, hours: 1, addItems: ['radio', 'crowbar', 'gasmask'] },
            result: [
              '아저씨 팔을 어깨에 걸고 계단을 오른다. 2층, 3층. 아저씨 몸이 점점 뜨거워진다. 4층에서 아저씨가 발을 멈춘다.',
              '"여기까지여." 아저씨가 조끼 안에서 제 몫의 방독면을 꺼내 무전기, 빠루와 함께 품에 안겨 준다. "난 인자 숨 안 쉬어도 될 것 같어." 그리고 4층 방화문 안으로 들어가 문을 닫는다.',
              '철컥. 안에서 잠그는 소리. 그리고 오래도록, 아무 소리도 없다.',
            ],
            next: 'c2a_garage',
          },
          {
            effects: { hp: -15, mental: -15, hours: 1, infect: true, addItems: ['radio'] },
            result: [
              '3층 계단참. 어깨에 걸린 팔이 갑자기 뻣뻣해진다. 아저씨 고개가 이상한 각도로 돌아온다.',
              '뿌리치는 순간 손목에 뜨거운 것이 박힌다. 아저씨를 계단 아래로 밀어내고 뛴다. 주머니엔 무전기 하나. 손목엔 이빨 자국. 12층까지 올라오는 내내, 그 자리가 심장처럼 뛴다.',
            ],
            next: 'c2a_garage',
          },
        ],
      },
      {
        id: 'elevkey',
        label: '비상키부터 받아 아이를 꺼낸다',
        hint: '약속을 지킨다',
        requires: { flags: ['c2a_kidWaiting'] },
        tags: ['kind'],
        outcomes: [
          {
            effects: {
              mental: 10,
              supply: 5,
              hours: 1,
              addItems: ['radio', 'gasmask'],
              setFlags: ['savedStranger', 'c2a_savedKid'],
              clearFlags: ['c2a_kidWaiting'],
            },
            result: [
              '아저씨가 비상키와 무전기를 함께 건넨다. "그 애, 703호 준서여. 태권도 노란 띠." 다시 8층까지. 허벅지가 비명을 지른다.',
              '비상키를 돌리자 문이 스르륵 열린다. "…구백구십팔, 구백구십구." 아이가 정말로 세고 있었다.',
              '703호 엄마가 아이를 끌어안고 주저앉는다. 그리고 방독면과 생수를 쥐여 준다. "애 아빠 민방위 거예요. 이것밖에 없어요."',
            ],
            next: 'c2a_garage',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 8. 지하주차장 B2 ─────────────────────────────
  c2a_garage: {
    id: 'c2a_garage',
    chapter: 2,
    location: 'complex',
    scene: 'parking_garage',
    title: 'B2로 가는 계단',
    body: [
      '1층 계단참에서 계단이 두 번 더 꺾여 내려간다. B1, B2. 지하에서 올라오는 공기가 차고 눅눅하다. 배기가스 냄새와, 다른 냄새.',
      '차 키는 차 안에 있다. 지난주 대리 기사님이 콘솔박스에 넣어 두고 갔고, 스페어 키는 본가 서랍에 있다. 차는 B2 기둥 C-14. 기름은 반 칸.',
      '멀리서 차 경보음 하나가 울다 지쳐 멈춘다. 정적. 그 정적 속에서 발소리. 걷는 소리가 아니라 뛰는 소리다.',
      { when: { flags: ['c2a_lobbyBroken'] }, text: '위쪽 로비에서 유리 조각 밟는 소리가 서성인다. 올라갈 길도 이제 조용하지 않다.' },
      { when: { items: ['flashlight'] }, text: '손전등이 있다. 바닥만 비추면 된다. 얼굴은 비추지 말 것.' },
      { when: { companions: ['kongi'] }, text: '콩이가 계단 끝에서 코를 바닥에 붙인다. 접힌 귀가 B2 쪽 어둠을 향해 선다.' },
      { when: { infected: true }, text: '어지럽다. 계단이 한 칸씩 물결친다. 열이 오르고 있다.' },
    ],
    choices: [
      {
        id: 'go_b2',
        label: 'B2로 내려가 차 키를 꺼낸다',
        hint: '바퀴냐, 목숨이냐',
        tags: ['brave'],
        outcomes: [
          {
            when: { items: ['flashlight'] },
            effects: { hp: -5, hours: 1, addItems: ['carKey'] },
            result: [
              '손전등을 손바닥으로 반쯤 가리고 바닥만 비춘다. 기둥 번호가 하나씩 지나간다. C-12, C-13, C-14.',
              '차 문을 열자 실내등이 켜진다. 재빨리 끈다. 콘솔박스 속 차 키를 쥐고 돌아선다. 저쪽 기둥 뒤에서 무언가 고개를 든다. 이미 계단이다.',
            ],
            next: 'c2a_fire',
          },
          {
            when: { companions: ['kongi'] },
            chance: 0.65,
            effects: { hp: -5, mental: 5, hours: 1, addItems: ['carKey'] },
            result: [
              '콩이 목줄을 짧게 쥐고 내려간다. C-11 기둥 앞에서 콩이가 딱 멈춘다. 목 깊은 데서 아주 작게 으르렁. 그쪽으로 안 간다. 차 두 대를 빙 돌아간다.',
              '콘솔박스 속 차 키를 쥐고 나오는 길, 아까 그 기둥 뒤에서 무언가 킁킁거리며 고개를 든다. 이미 계단이다. 콩이 머리를 한 번 쓰다듬는다. 오늘 밥값은 했다.',
            ],
            next: 'c2a_fire',
          },
          {
            chance: 0.45,
            effects: { hp: -12, hours: 1, addItems: ['carKey'] },
            result: [
              '폰 화면 불빛에 의지해 기둥을 센다. 두 번 잘못 꺾고, 세 번째에 C-14.',
              '차 키를 쥐고 돌아서다 주차 턱에 걸려 넘어진다. 무릎이 까진다. 그래도 키는 놓지 않는다.',
            ],
            next: 'c2a_fire',
          },
          {
            effects: { hp: -25, mental: -10, hours: 1 },
            result: [
              '차 문을 여는 순간, 띵띵띵띵. "키가 차 안에 있습니다." 친절한 경고음이 지하 2층 전체에 울려 퍼진다.',
              '기둥마다 그림자가 떨어져 나온다. 키는 손끝에서 미끄러져 좌석 밑으로 굴러간다. 줍지 못한다. 계단까지 스무 걸음. 등 뒤로 손톱이 스친다.',
            ],
            next: 'c2a_fire',
          },
        ],
      },
      {
        id: 'decoy',
        label: '민준이 시선을 끄는 사이 들어간다',
        hint: '둘이면 된다',
        requires: { companions: ['minjun'] },
        lockedHint: '누가 시선을 끌어 줬다면…',
        tags: ['brave', 'cold'],
        outcomes: [
          {
            chance: 0.7,
            effects: { hp: -5, hours: 1, addItems: ['carKey'] },
            result: [
              '민준이 B1 반대편 비상문을 걷어차고 소리친다. "여기요, 여기!" 그림자들이 파도처럼 그쪽으로 쏠린다.',
              '그 사이 B2로 뛰어 내려가 키를 꺼낸다. 계단에서 다시 만난 민준이 무릎을 짚고 헐떡인다. "체력장 1급이었어요. 이제 쓸 데가 없는 줄 알았는데."',
            ],
            next: 'c2a_fire',
          },
          {
            effects: { hp: -10, mental: -10, hours: 1, addItems: ['carKey'] },
            result: [
              '민준이 소리를 지르며 뛴다. 그런데 그림자 둘이 이쪽에 남는다. 키를 쥐고 손에 잡히는 건 뭐든 휘두르며 버틴다.',
              '계단에서 만난 민준은 발목을 절뚝인다. "괜찮아요, 괜찮아요." 전혀 괜찮지 않은 목소리다. 그래도 키는 손에 있다.',
            ],
            next: 'c2a_fire',
          },
        ],
      },
      {
        id: 'up',
        label: '차는 잊고 12층으로 올라간다',
        hint: '스물네 번 꺾어야 한다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hp: -5, mental: 5, hours: 1 },
            result: [
              '차는 없던 셈 친다. 할부가 18개월 남았다는 생각이 잠깐 든다. 이 와중에.',
              '12층까지 스물네 번을 꺾는다. 허벅지가 타들어 간다. 현관 앞에 도착해 문을 두드린다.',
              { when: { companions: ['grandma'] }, text: '똑똑, 쉬고, 똑. 할머니가 문을 연다. 식탁 위에 촛불 하나와 김치찌개 한 그릇이 기다리고 있다.' },
            ],
            next: 'c2a_fire',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 9. 새벽 화재 ─────────────────────────────
  c2a_fire: {
    id: 'c2a_fire',
    chapter: 2,
    location: 'home',
    scene: 'home_dark',
    title: '새벽 5시, 연기',
    clock: 29,
    body: [
      '새벽 5시. 매캐한 냄새에 눈이 떠진다. 현관문 아래 틈으로 회색 연기가 실처럼 기어 들어온다.',
      '베란다에서 내려다본다. 8층 창문에서 주황빛이 넘실거린다. 누가 촛불을 켜 두고 잠들었을까. 누가 가스레인지를 건드렸을까. 이유는 중요하지 않다. 연기는 위로 온다.',
      '119는 "대기 중"이다. 소방차 사이렌은 들리지 않는다. 방독면 없이 계단을 타면, 계단은 굴뚝이 된다.',
      { when: { companions: ['grandma'] }, text: '할머니가 벌떡 일어나 수건을 적신다. "코 막어. 낮게 기어. 연기는 위로 가." 이 분, 뭔가 겪어 본 사람이다.' },
      { when: { flags: ['c2a_checkedGrandma'] }, text: '벽 너머 1203호에서 기침 소리가 들린다. 할머니가 아직 거기 있다.' },
      { when: { flags: ['c2a_ignoredGrandma'] }, text: '1203호 쪽은 조용하다. 너무 조용하다. 현관 옆엔 빈 냄비가 놓여 있다.' },
      { when: { flags: ['c2a_leftMinjun'], noCompanions: ['minjun'] }, text: '천장 위에서 쿵, 쿵. 연기가 13층까지 올라간 모양이다.' },
      { when: { companions: ['kongi'] }, text: '콩이가 현관 앞에서 킁킁대다 뒷걸음질 친다. 재채기를 연달아 한다.' },
      { when: { infected: true }, text: '연기 때문인지 열 때문인지 눈앞이 뿌옇다. 손끝이 저리다.' },
    ],
    choices: [
      {
        id: 'extinguish',
        label: '소화기를 들고 8층으로 내려간다',
        hint: '끄면 건물이 산다',
        requires: { items: ['extinguisher'] },
        lockedHint: '소화기가 있었다면…',
        tags: ['brave'],
        outcomes: [
          {
            when: { items: ['gasmask'] },
            effects: { hp: -5, hours: 1, setFlags: ['c2a_fireOut'] },
            result: [
              '방독면 끈을 조인다. 민방위 훈련 때 대충 들었던 설명이 기억난다. 정화통 마개를 뺄 것.',
              '연기 속을 걸어 내려가 8층 복도에 소화기를 쏜다. 분말이 하얗게 번지고 불길이 주저앉는다. 다른 집 소화전함에서 하나를 더 꺼내 마무리한다. 벽은 까맣게 그을렸지만, 건물은 서 있다.',
            ],
            next: 'c2a_rooftop',
          },
          {
            when: { companions: ['minjun'] },
            effects: { hp: -10, hours: 1, setFlags: ['c2a_fireOut'] },
            result: [
              '민준이 젖은 수건을 두 장 가져온다. 둘이서 교대로 숨을 참고 뛰어 들어간다. 한 명이 뿌리고, 한 명이 다음 층 소화기를 가져온다.',
              '세 통째에 불이 잦아든다. 민준이 콜록대며 웃는다. "이거 생기부에 봉사 시간으로 안 되나요?"',
            ],
            next: 'c2a_rooftop',
          },
          {
            chance: 0.55,
            effects: { hp: -15, hours: 1, setFlags: ['c2a_fireOut'] },
            result: [
              '젖은 수건을 입에 물고 계단을 내려간다. 8층 방화문을 열자 열기가 얼굴을 친다. 안전핀을 뽑고, 불 뿌리를 향해 쓸 듯이 쏜다.',
              '분말이 떨어질 무렵 불길도 기세를 잃는다. 눈썹 끝이 그을렸다. 대신 12층이 산다.',
            ],
            next: 'c2a_rooftop',
          },
          {
            effects: { hp: -25, mental: -10, hours: 1, removeItems: ['extinguisher'] },
            result: [
              '분말은 20초 만에 바닥난다. 불은 커튼을 타고 천장까지 번져 있다. 20초로는 어림도 없다.',
              '빈 소화기를 던지고 기어서 위로 도망친다. 목이 타들어 간다. 올라갈 곳은 한 곳뿐이다.',
            ],
            next: 'c2a_rooftop',
          },
        ],
      },
      {
        id: 'descend',
        label: '완강기로 베란다를 내려간다',
        hint: '건물을 버리고 나간다',
        requires: { items: ['descender'] },
        lockedHint: '완강기가 있었다면…',
        tags: ['careful'],
        outcomes: splitLeftMinjun({
            effects: { hp: -5, mental: -5, hours: 2 },
            result: [
              '베란다 거치대에 완강기를 걸고, 줄을 밖으로 던진다. 줄이 연기 속으로 사라진다. 어디까지 닿는지는 내려가 봐야 안다.',
              { when: { flags: ['c2a_checkedGrandma'], noCompanions: ['grandma'] }, text: '내려가기 전, 1203호 쪽 벽을 주먹으로 두드린다. 벽 너머에서 기침 섞인 목소리. "나는 옥상으로 갈 겨! 먼저 가!" 대답할 새도 없이 기침 소리가 멀어진다.' },
              { when: { companions: ['grandma'] }, text: '할머니를 먼저 내려 보낸다. 벨트를 채워 드리자 할머니가 말한다. "놀이공원 가 본 지가 언젠지 몰러." 할머니는 소리 한 번 안 지르고 1층에 닿는다.' },
              { when: { companions: ['minjun'] }, text: '민준은 벨트도 대충 채우고 내려간다. 위에서 보기엔 거의 떨어지는 속도다.' },
              { when: { companions: ['kongi'] }, text: '콩이를 에코백에 넣어 가슴에 멘다. 콩이가 가방 밖으로 코만 내밀고 떤다. 같이 떤다.' },
              LEFT_MINJUN_LINE,
              '벽을 등지고, 한 층씩. 불타는 8층 창문 옆을 지날 때 등이 뜨겁다. 발이 화단 흙에 닿는다. 동이 트기 직전의 단지, 연기 냄새, 그리고 살아 있다는 감각.',
            ],
            next: 'c3_start',
          }),
      },
      {
        id: 'run_down',
        label: '연기를 뚫고 계단으로 뛴다',
        hint: '방독면 없인 도박이다',
        tags: ['brave'],
        outcomes: [
          ...splitLeftMinjun({
            when: { items: ['gasmask'] },
            effects: { hp: -5, mental: -5, hours: 2 },
            result: [
              '방독면을 뒤집어쓴다. 시야가 좁고 숨소리가 크다. 다스 베이더가 된 기분이다. 그래도 숨이 쉬어진다.',
              { when: { anyCompanions: ['grandma', 'minjun'] }, text: '일행에게 젖은 수건을 물리고 한 줄로 손을 잡는다. 앞사람 어깨만 보고 내려간다.' },
              { when: { companions: ['kongi'] }, text: '콩이는 품에 안고 수건으로 머리를 감싼다. 콩이가 한 번도 버둥대지 않는다.' },
              LEFT_MINJUN_LINE,
              '8층 연기 벽을 통과한다. 1층 로비 유리문이 새벽빛에 파랗다. 문을 밀고 나간다.',
            ],
            next: 'c3_start',
          }),
          ...splitLeftMinjun({
            when: { flags: ['c2a_water'] },
            chance: 0.85,
            effects: { hp: -18, mental: -10, hours: 2 },
            result: [
              '어젯밤 받아 둔 물에 수건을 흠뻑 적신다. 한 장은 입에, 한 장은 머리에. 물이 뚝뚝 떨어지는 채로 계단을 뛴다. 11, 10, 9. 8층에서 세상이 회색이 된다.',
              { when: { companions: ['kongi'] }, text: '품 안의 콩이가 콜록인다. 젖은 수건으로 콩이 머리를 한 번 더 감싼다. 괜찮아, 괜찮아. 누구한테 하는 말인지 모르겠다.' },
              LEFT_MINJUN_LINE,
              '수건이 끝까지 젖어 있다. 6층쯤에서 연기가 걷힌다. 로비 바닥에 엎어져 기침을 한참 한다. 어젯밤 물 받던 한 시간이 목숨값이 될 줄은 몰랐다.',
            ],
            next: 'c3_start',
          }),
          ...splitLeftMinjun({
            when: { noFlags: ['c2a_water'] },
            chance: 0.65,
            effects: { hp: -22, mental: -10, hours: 2 },
            result: [
              '마지막 생수 한 병을 수건에 쏟아붓고 입에 문다. 11, 10, 9. 8층에서 세상이 회색이 된다. 난간만 붙잡고 발로 계단을 더듬는다.',
              { when: { companions: ['kongi'] }, text: '품 안의 콩이가 콜록인다. 괜찮아, 괜찮아. 누구한테 하는 말인지 모르겠다.' },
              LEFT_MINJUN_LINE,
              '6층쯤에서 연기가 걷힌다. 1층까지 굴러떨어지듯 내려와 로비 바닥에 엎어진다. 폐가 불에 덴 것 같다. 그래도 공기다. 진짜 공기다.',
            ],
            next: 'c3_start',
          }),
          {
            effects: { hp: -30 },
            result: [
              '8층. 연기가 벽이 된다. 수건은 이미 말라 있다. 한 번만 숨을 쉬자, 딱 한 번만.',
              { when: { companions: ['kongi'] }, text: '팔에서 힘이 빠진다. 콩이가 품에서 미끄러져 나간다. 아래로, 연기가 옅은 쪽으로. 작은 발소리가 계단을 타고 멀어진다. 그래, 가. 너는 가.' },
              '7층 계단참에서 무릎이 꺾인다. 비상구 표시등 속 초록색 사람은 여전히 어딘가로 급하게 뛰어가고 있다. 그게 마지막 장면이다.',
            ],
            next: 'end:dead',
          },
        ],
      },
      {
        id: 'roof',
        label: '위로, 옥상으로 올라간다',
        hint: '연기도 위로 간다',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c2a_checkedGrandma'], noCompanions: ['grandma'] },
            effects: { hp: -10, mental: 5, hours: 1, addCompanions: ['grandma'] },
            result: [
              '나가자마자 1203호 문을 주먹으로 두드린다. "할머니! 불이에요!" 할머니가 젖은 수건을 입에 대고 문을 연다. 이미 다 챙긴 보따리가 발치에 있다.',
              '할머니 손을 잡고 한 층씩 오른다. 옥상 문을 밀자 차가운 바람이 쏟아진다. 할머니가 기침 끝에 말한다. "거봐. 사람은 옆집이 있어야 혀."',
            ],
            next: 'c2a_rooftop',
          },
          {
            when: { companions: ['grandma'] },
            effects: { hp: -5, hours: 1 },
            result: [
              '할머니 말대로 수건을 적셔 입을 막고, 벽을 짚고 몸을 낮춘다. 연기가 머리 위로 흘러간다. 할머니는 느리지만 한 번도 쉬지 않는다.',
              '옥상 문이 열린다. 새벽 공기가 폐에 들어온다. 할머니가 수건을 짜며 말한다. "그 옛날 불 난리 때도 이렇게 했어."',
            ],
            next: 'c2a_rooftop',
          },
          {
            effects: { hp: -12, mental: -5, hours: 1 },
            result: [
              '계단은 이미 뿌옇다. 기침을 참으며 한 층을 오른다. 13층, 14층, 15층. 옥상까지는 길다.',
              { when: { companions: ['kongi'] }, text: '콩이를 품에 안는다. 5kg이 20kg처럼 느껴진다. 그래도 내려놓지 않는다.' },
              '옥상 철문을 어깨로 밀자 새벽바람이 쏟아진다. 무릎을 짚고 한참을 기침한다.',
            ],
            next: 'c2a_rooftop',
          },
        ],
      },
    ],
  },

  // ───────────────────────────── 10. 옥상 헬기 ─────────────────────────────
  c2a_rooftop: {
    id: 'c2a_rooftop',
    chapter: 2,
    location: 'complex',
    scene: 'rooftop',
    title: '옥상, 동틀 녘',
    clock: 30,
    body: [
      '새벽 6시. 옥상 물탱크 옆에 사람들이 모여 있다. 등산복, 잠옷, 롱패딩. 스무 명 남짓. 214명 단톡방의 실물은 생각보다 적다.',
      '동대표가 두 손을 모아 외친다. "조용히! 헬기 소리 들리면 다 같이 손 흔드는 겁니다!" 누군가 "그럼 조용히 하라는 거예요, 흔들라는 거예요?" 하고 묻는다.',
      { when: { flags: ['c2a_fireOut'] }, text: '아래층 불은 꺼졌다. 8층 복도가 까맣게 그을렸을 뿐, 건물은 서 있다. 누군가 소화기 가루투성이 옷을 알아보고 박수를 친다. 몇 명이 따라 친다.' },
      { when: { noFlags: ['c2a_fireOut'] }, text: '발밑 어딘가에서 아직 연기가 샌다. 불은 제풀에 잦아드는 중이다. 8층 아래가 어떻게 됐는지는 아무도 모른다.' },
      { when: { flags: ['c2a_leftMinjun'], noCompanions: ['minjun'] }, text: '물탱크 뒤에 트레이닝복 하나가 웅크리고 있다. 민준이다. 연기를 피해 13층에서 기어 올라왔다. 눈이 마주치자 민준이 먼저 손을 든다. "아침에 온다면서요."' },
      { when: { flags: ['c2a_roasted'] }, text: '동대표가 명단을 훑다가 1201호에서 눈을 가늘게 뜬다. "아, 그 공지 시끄럽다던 분."' },
      { when: { flags: ['c2a_savedKid'] }, text: '703호 엄마가 아이 손을 잡고 서 있다. 아이가 노란 띠 도복 차림으로 꾸벅 인사를 한다.' },
      { when: { flags: ['c2a_ignoredGrandma'] }, text: '동대표가 명단을 부른다. "1203호? 1203호 할머니 보신 분?" 아무도 대답하지 않는다. 대답할 수 있는 사람은 여기 딱 한 명이다.' },
      { when: { flags: ['c2a_checkedGrandma'], noCompanions: ['grandma'] }, text: '1203호 할머니는 올라오지 않았다. 무릎으로 옥상 계단은 무리였을 거다. 집에서 문 꼭 잠그고 계실 거다. 그렇게 믿기로 한다.' },
      '그리고 들린다. 두두두두. 남산 쪽 하늘에서 불빛 하나가 이쪽으로 온다.',
    ],
    choices: [
      {
        id: 'signal',
        label: '폰 플래시로 구조 신호를 보낸다',
        hint: '희망에 건다',
        tags: ['brave'],
        outcomes: [
          {
            when: { flags: ['c2a_leftMinjun'], noCompanions: ['minjun'] },
            chance: 0.35,
            effects: { mental: -5, hours: 1, setFlags: ['knowsBroadcast'], addCompanions: ['minjun'] },
            result: [
              '스무 개의 폰 플래시가 동시에 켜진다. 물탱크 뒤에서 민준도 걸어 나와 옆에 서서 제 폰을 흔든다. 헬기가 고도를 낮춘다.',
              '헬기는 착륙하지 않는다. 서치라이트를 두 번 깜빡이고, 스피커로 짧게 외친다. "…잠실 종합운동장 구조 거점으로 자력 이동 바랍니다…" 그리고 남동쪽으로 사라진다.',
              '민준이 폰을 내리고 말한다. "잠실이면 걸어서 몇 시간이에요?" "몰라. 같이 걸어 보면 알겠지." 민준이 고개를 끄덕인다. 이번엔 두고 가지 않는다.',
            ],
            next: 'c3_start',
          },
          {
            when: { flags: ['c2a_leftMinjun'], noCompanions: ['minjun'] },
            effects: { mental: -10, hours: 1, addCompanions: ['minjun'] },
            result: [
              '스무 개의 폰 플래시가 동시에 켜진다. 물탱크 뒤에서 민준도 걸어 나와 옆에 서서 제 폰을 흔든다. 헬기는 고도를 바꾸지 않는다. 불빛이 한강 쪽으로 멀어진다.',
              '민준이 폰을 내린다. "저 어젯밤 내내 저것만 기다렸거든요." 대답 대신 어깨를 잡는다. "내려가자. 이번엔 같이." 헬기보다 늦게 왔지만, 헬기와 달리 지나치지는 않았다.',
            ],
            next: 'c3_start',
          },
          {
            chance: 0.35,
            effects: { mental: -5, hours: 1, setFlags: ['knowsBroadcast'] },
            result: [
              '스무 개의 폰 플래시가 동시에 켜진다. 헬기가 고도를 낮춘다. 사람들이 소리를 지른다.',
              '헬기는 착륙하지 않는다. 서치라이트를 두 번 깜빡이고, 스피커로 짧게 외친다. "…잠실 종합운동장 구조 거점으로 자력 이동 바랍니다…" 그리고 남동쪽으로 사라진다.',
              '사람들이 주저앉는다. 그래도 하나는 얻었다. 가야 할 곳의 이름.',
            ],
            next: 'c3_start',
          },
          {
            effects: { mental: -15, hours: 1 },
            result: [
              '스무 개의 폰 플래시가 동시에 켜진다. 누구는 이불을 흔들고, 누구는 "여기요!"를 외친다. 동대표가 확성기 앱을 켠다.',
              '헬기는 고도를 바꾸지 않는다. 불빛이 머리 위를 지나 한강 쪽으로 멀어진다. 아무도 손을 내리지 않는다. 한참을.',
              '누군가 작게 말한다. "우리 못 봤나 봐." 다들 알고 있다. 봤다는 걸.',
            ],
            next: 'c3_start',
          },
        ],
      },
      {
        id: 'radio',
        label: '무전기로 헬기 교신을 잡는다',
        hint: '확실하다. 차갑다',
        requires: { items: ['radio'] },
        lockedHint: '무전기가 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c2a_leftMinjun'], noCompanions: ['minjun'] },
            effects: { mental: -5, hours: 1, setFlags: ['knowsBroadcast'], addCompanions: ['minjun'] },
            result: [
              '채널 9번. 잡음 사이로 건조한 목소리가 끼어든다. "…강북 고층 생존자 다수 확인. 구조 우선순위 외. 잠실 종합운동장 거점, 인천항 수송선 운용 중. 자력 이동 권고. 이상."',
              '물탱크 뒤에서 듣고 있던 민준이 다가온다. "우선순위 외… 우리 버려졌다는 거죠?" "아니. 우리가 알아서 간다는 거지." 민준이 가방을 고쳐 멘다. 이번엔 먼저 손을 내민다.',
            ],
            next: 'c3_start',
          },
          {
            effects: { mental: -5, hours: 1, setFlags: ['knowsBroadcast'] },
            result: [
              '채널 9번. 잡음 사이로 건조한 목소리가 끼어든다. "…강북 고층 생존자 다수 확인. 구조 우선순위 외. 잠실 종합운동장 거점, 인천항 수송선 운용 중. 자력 이동 권고. 이상."',
              '헬기는 우리를 태우러 온 게 아니었다. 세러 온 거다. 무전기를 끄고 사람들에게 말한다. 잠실. 인천항. 걸어서 가야 한다고.',
            ],
            next: 'c3_start',
          },
        ],
      },
      {
        id: 'leave',
        label: '내려가서 떠날 채비를 한다',
        hint: '헬기는 안 온다',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            when: { flags: ['c2a_leftMinjun'], noCompanions: ['minjun'] },
            effects: { mental: 10, hours: 1, addCompanions: ['minjun'] },
            result: [
              '헬기 불빛이 멀어지는 동안 물탱크 뒤로 간다. 민준에게 손을 내민다. "늦어서 미안."',
              '민준이 손을 잡고 일어선다. 운동화에 그을음이 잔뜩이다. "저 이제 진짜 공부 안 해도 되는 거죠?" "응. 대신 오늘은 좀 걸어야 돼." "그건 자신 있어요."',
            ],
            next: 'c3_start',
          },
          {
            when: { flags: ['c2a_registered'], noFlags: ['c2a_roasted'] },
            effects: { supply: 10, hours: 1 },
            result: [
              '계단으로 향하는데 동대표가 부른다. "1201호! 명단에 있는 세대는 생수 두 병씩 챙겨 가요. 1204호가 내놨어요."',
              '생수 두 병과 컵라면 하나. 명단에 이름을 적어 둔 값이다. 성실함이 이렇게 보상받는 날도 있다.',
            ],
            next: 'c3_start',
          },
          {
            when: { flags: ['c2a_roasted'] },
            effects: { mental: -5, hours: 1 },
            result: [
              '물 나눔 줄에 서자 동대표가 명단을 가린다. "공지가 시끄러우셨다면서요." 뒤에 선 주민이 킥킥 웃는다.',
              '빈손으로 계단을 내려간다. 단톡방 한 줄의 값은 생수 두 병이었다.',
            ],
            next: 'c3_start',
          },
          {
            effects: { hours: 1 },
            result: [
              '헬기 불빛이 사라지기도 전에 계단으로 향한다. 기다리는 동안 보급은 줄고, 해는 뜬다.',
              '12층 집에 들러 가방을 싼다. 문을 잠그고, 도어록 비밀번호를 한 번 더 눌러 본다. 다시 올 수 있을까. 모르겠다.',
            ],
            next: 'c3_start',
          },
        ],
      },
      {
        id: 'fortress',
        label: '남아서 이 건물을 요새로 만든다',
        hint: '12층의 왕이 된다',
        requires: { companions: ['minjun', 'grandma'], flags: ['c2a_fireOut'], min: { supply: 40 } },
        lockedHint: '불을 끄고, 사람과 식량이 있었다면…',
        tags: ['careful', 'brave'],
        outcomes: [
          {
            effects: { mental: 15, hours: 2 },
            result: [
              '사람들이 계단으로 흩어질 때, 남는다. 불은 껐다. 쌀이 있다. 체력 좋은 고3과, 난리를 겪어 본 할머니가 있다.',
              '민준이 캐비닛과 소파로 3층 방화문을 틀어막는다. 할머니는 옥상 물탱크 밸브 여는 법을 안다. "우리 영감이 여기 관리 기사였어." 욕조에 물을 채우고, 베란다 화분에 상추를 심는다.',
              { when: { companions: ['kongi'] }, text: '콩이는 현관 매트를 제 초소로 정했다. 계단에서 무슨 소리만 나면 접힌 귀까지 선다. 이 왕국의 경비대장이다. 월급은 연어 져키.' },
              '12층. 층간소음 원수와 옆집 할머니와 함께 짓는 작은 왕국. 헬기는 안 온다. 괜찮다. 여기가 집이다.',
            ],
            next: 'end:fortress',
          },
        ],
      },
    ],
  },
};
