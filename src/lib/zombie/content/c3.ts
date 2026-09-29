import type { StoryNode } from '../types';

/**
 * 3장 "서울 한복판" — D+1 08:00 ~ 22:00.
 * 진입: c2a(stayedHome) / c2b(evacuated) → c3_start.
 * 목표: 재난문자로 알게 된 초등학교 강당 임시 대피소까지 가는 하루.
 *
 * 흐름(DAG):
 *   c3_start ─┬─ c3_car ─────────────┬─ c3_checkpoint ─ c3_dusk ─ c4_start
 *             ├─ c3_bike ──┬─ c3_mart ─┬─ c3_hospital ─┤
 *             ├─ c3_store ─┼─ c3_pcbang┘               │
 *             └─ c3_station ─ c3_tunnel ────── c3_horde ┘
 */
export const c3: Record<string, StoryNode> = {
  // ─────────────────────────────── 허브 ───────────────────────────────
  c3_start: {
    id: 'c3_start',
    chapter: 3,
    location: 'store',
    scene: 'street_chaos',
    title: 'D+1, 아침 여덟 시',
    clock: 32,
    alert: {
      kind: 'disaster',
      from: '서울특별시',
      text: '[서울특별시] 금일 08시부터 관내 초등학교 강당을 임시 대피소로 운영합니다. 이동 시 큰 소리를 내지 마시고 무리 지어 이동하십시오.',
    },
    body: [
      {
        when: { flags: ['stayedHome'] },
        text: '단지 화단에 서서 12층을 올려다본다. 저 까마득한 데서 밤을 넘겼다. 다시 올라갈 일은 없을 것 같다.',
      },
      {
        when: { flags: ['evacuated'] },
        text: '버스가 데려다주기로 한 구민회관은 새벽에 문을 닫았다. 역 앞 공터 쪽 드럼통 연기가 가늘어진다. 밤을 넘긴 사람들이 하나둘 가방을 메고 흩어진다. 갈 곳을 정한 얼굴은 하나도 없다. 이쪽도 마찬가지다.',
      },
      '버려진 택시 지붕 표시등이 아직도 "빈차"로 깜빡인다. 그 위로 재난문자가 아침 공기를 찢는다. 초등학교 강당까지 걸어서 한 시간 반. 평소라면.',
      {
        when: { companions: ['kongi'] },
        text: '콩이가 다리 사이에 바짝 붙는다. 접힌 귀가 자꾸 뒤를 향한다.',
      },
      {
        when: { flags: ['leftDog'], noCompanions: ['kongi'] },
        text: '집 쪽 하늘을 한 번 본다. 현관에 사료 그릇 세 개. 콩이가 그걸 아껴 먹을 리 없다. 벌써 바닥났을 거다.',
      },
      {
        when: { infected: true },
        text: '물린 자리가 밤새 부어올랐다. 열은 아직, 모른 척할 수 있을 만큼이다.',
      },
    ],
    choices: [
      {
        id: 'car',
        label: '차를 몰고 간다',
        hint: '빠르지만 도로가 막혔다',
        requires: { items: ['carKey'] },
        lockedHint: '차 키가 있었다면…',
        tags: ['brave'],
        outcomes: [
          {
            effects: { hours: 1 },
            result: [
              '주머니 속 차 키를 쥔다. 기름은 반 칸. 서울에서 반 칸이면 어디든 간다. 도로가 뚫려 있기만 하면.',
              '간밤에 한 번 내려갔던 지하주차장 계단 앞에서 숨을 고른다. 두 번 다시 안 올 줄 알았다.',
            ],
            next: 'c3_car',
          },
        ],
      },
      {
        id: 'bike',
        label: '따릉이를 빌린다',
        hint: '앱은 먹통, 자물쇠는?',
        tags: ['meme'],
        outcomes: [
          {
            when: { items: ['bike'] },
            effects: { mental: 5, hours: 1 },
            result: [
              '대여소까지 갈 것도 없다. 간밤에 끌고 다닌 따릉이가 옆에 서 있다. 대여 시간 초과 열두 시간째. 요금은 서울시가 살아남으면 내기로 한다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이는 앞 바구니에 쏙 들어간다. 어젯밤에 한 번 타 봤다고 벌써 제자리처럼 군다.',
              },
              {
                when: { anyCompanions: ['grandma', 'minjun', 'rider'] },
                text: '일행 몫은 대여소에서 푼다. 밤새 배터리가 나간 거치대는 레버만 당겨도 자물쇠를 놓는다. 딸깍, 딸깍. 종말의 따릉이 단체 대여.',
              },
            ],
            next: 'c3_bike',
          },
          {
            effects: { addItems: ['bike'], hours: 1 },
            result: [
              '대여소 앞. 앱은 "일시적인 오류입니다"만 무한 반복한다. 거치대 레버를 하나씩 당겨 본다. 하나, 둘, 다섯.',
              '여섯 번째에서 딸깍. 자물쇠가 풀린다. 밤새 정전이 이어지는 동안 거치대 배터리가 먼저 나간 모양이다. 서울시에 속으로 사과하고 안장에 오른다. 반납은 꼭 하겠다고.',
              {
                when: { companions: ['kongi'] },
                text: '콩이는 앞 바구니에 쏙 들어간다. 5kg이라 다행이다. 다이어트 안 시킨 게 처음으로 고맙다.',
              },
              {
                when: { anyCompanions: ['grandma', 'minjun', 'rider'] },
                text: '배터리 나간 거치대를 몇 개 더 찾아 일행 몫까지 푼다. 딸깍, 딸깍. 종말의 따릉이 단체 대여.',
              },
              {
                when: { companions: ['grandma'] },
                text: '할머니가 안장을 꾹꾹 눌러 본다. "새마을운동 때 쌀가마 싣고 고개 넘던 사람이여." 무릎은 못 뛰어도 페달은 밟는다.',
              },
            ],
            next: 'c3_bike',
          },
        ],
      },
      {
        id: 'walk',
        label: '걸어서 간다',
        hint: '느리지만 조용하다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 1 },
            result: [
              '큰길 대신 골목으로 든다. 담벼락에 붙어서, 모퉁이마다 멈춰서.',
              {
                when: { companions: ['minjun'] },
                text: '민준이 모퉁이마다 먼저 고개를 내밀어 본다. "저 시력 1.5예요. 체대 입시 신체검사에서 쟀어요." 믿기로 한다.',
              },
              {
                when: { companions: ['rider'] },
                text: '용석이 담벼락 하나를 턱으로 가리킨다. "저거 넘으면 5분 단축이요. 콜 밀리면 매일 넘었어요." 오늘은 콜이 없어서 돌아간다.',
              },
              '역 앞 편의점 불빛이 보인다. 이 와중에 불이 켜진 가게라니.',
            ],
            next: 'c3_store',
          },
        ],
      },
      {
        id: 'subway',
        label: '지하철역으로 내려간다',
        hint: '지름길, 대신 어둡다',
        tags: ['brave'],
        outcomes: [
          {
            effects: { hours: 1 },
            result: [
              {
                when: { noFlags: ['evacuated'] },
                text: '지하철역 입구 셔터가 반쯤 내려와 있다. 허리를 숙여 들어간다.',
              },
              {
                when: { flags: ['evacuated'] },
                text: '간밤 내내 눈에 밟히던 그 역이다. 셔터는 여전히 반쯤 내려와 있고, 틈으로 새던 불빛은 꺼졌다. 허리를 숙여 다시 들어간다.',
              },
              { when: { items: ['flashlight'] }, text: '손전등을 쥔 손에 땀이 찬다.' },
              {
                when: { noItems: ['flashlight'] },
                text: '손전등이 없다. 휴대폰 플래시가 전부다. 배터리가 버텨 줄지.',
              },
            ],
            next: 'c3_station',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 차 루트 ───────────────────────────────
  c3_car: {
    id: 'c3_car',
    chapter: 3,
    location: 'complex',
    scene: 'parking_garage',
    title: 'B2, 반 칸 남은 기름',
    body: [
      '지하주차장 B2. 천장 형광등 절반이 나갔다. 내 차는 간밤에 키를 꺼내 간 그 자리, 기둥 C-14 옆에 얌전히 서 있다.',
      '문제는 옆 칸 SUV. 운전석의 누군가가 핸들에 이마를 대고 앉아 있다. 미동이 없다. 자는 건지, 아닌 건지.',
      '시동을 걸면 소리가 난다. 소리가 나면 몰려온다. 그래도 네 바퀴는 네 바퀴다.',
      {
        when: { companions: ['kongi'] },
        text: '콩이가 SUV 쪽을 보고 코를 벌름거린다. 아직 으르렁거리진 않는다.',
      },
    ],
    choices: [
      {
        id: 'rush',
        label: '시동 걸고 바로 뺀다',
        hint: '빠르지만 시끄럽다',
        tags: ['brave'],
        outcomes: [
          {
            chance: 0.5,
            effects: { mental: 5, hours: 2, setFlags: ['c3_drove'] },
            result: [
              '엔진 소리가 주차장 전체에 울린다. SUV 운전석의 고개가 천천히 든다. 액셀을 밟는다.',
              '출구 경사로를 튀어 오른다. 차단기가 보닛에 맞고 날아간다. 관리비에서 까겠지.',
              '큰길은 버려진 차로 꽉 막혔다. 역주행으로 강변 쪽 샛길을 탄다. 내비가 계속 "경로를 이탈했습니다"라고 한다. 안다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { hp: -12, mental: -8, hours: 1 },
            result: [
              '시동과 동시에 SUV 문이 열린다. 사람이었던 것이 운전석 창에 몸을 던진다. 유리에 거미줄 금이 간다.',
              '급하게 후진하다 기둥을 들이받는다. 이마가 핸들에 부딪힌다. 경적이 멈추지 않는다.',
              '결국 차를 버리고 뛴다. 경적 소리를 따라 주차장 입구로 그림자들이 몰려든다.',
            ],
            next: 'c3_horde',
          },
        ],
      },
      {
        id: 'check',
        label: '조용히 SUV를 확인한다',
        hint: '맞으면 안심, 틀리면 끝',
        tags: ['careful'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { mental: 5, hours: 2, setFlags: ['c3_drove'] },
            result: [
              '손을 뻗기도 전에 콩이가 낮게 으르렁거린다. 한 번도 들어 본 적 없는 소리. 확인할 필요가 없어진다.',
              '기어를 중립에 놓고 차를 밀어 경사로 앞까지 옮긴다. 온몸이 땀범벅이다. 시동은 밖에서 건다.',
              'SUV 운전석은 끝내 고개를 들지 않는다. 큰길은 막혔지만 샛길을 타고 강변 쪽으로 빠진다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            chance: 0.5,
            effects: { mental: 10, addItems: ['powerbank'], hours: 2, setFlags: ['c3_drove'] },
            result: [
              '창문을 두드린다. 남자가 벌떡 일어난다. "아 깜짝이야! 콜 들어온 줄." 대리기사님이다. 밤새 여기서 잤단다.',
              '고맙다며 보조배터리를 하나 건넨다. "대리는 배터리가 목숨이에요. 두 개 있으니까 하나 가져가요."',
              '큰길은 다 막혔다고, 강변 샛길로 가라고 알려 준다. 종말에도 길 안내는 대리기사님이 제일 정확하다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { hp: -15, mental: -10, hours: 2, setFlags: ['c3_drove'] },
            result: [
              '창문을 두드린다. 고개가 돌아간다. 사람 목이 돌아가면 안 되는 각도로.',
              '유리가 깨지기 전에 내 차로 뛰어든다. 긁힌 팔에서 피가 난다. 이빨은 아니다. 손톱이다. 세 번 확인한다.',
              '시동, 액셀. SUV가 백미러 속에서 작아진다. 손은 강변에 닿을 때까지 떨린다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
      {
        id: 'giveup',
        label: '차를 포기하고 걷는다',
        hint: '조용하지만 느리다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 2 },
            result: [
              '키를 도로 주머니에 넣는다. 저 SUV 옆에서 시동을 걸 배짱은 없다. 차는 나중에. 살아 있으면.',
              '계단으로 올라와 골목길을 걷는다. 역 앞 편의점 불빛이 보인다.',
            ],
            next: 'c3_store',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 따릉이 루트 ───────────────────────────────
  c3_bike: {
    id: 'c3_bike',
    chapter: 3,
    location: 'store',
    scene: 'bike_street',
    title: '자전거 도로의 추격전',
    body: [
      '페달을 밟을수록 바람이 차다. 일요일 아침 자전거 도로. 한강 가는 쫄쫄이 부대가 하나도 없다. 그게 제일 이상하다.',
      '사거리 너머에서 헬멧 쓴 남자가 뛰어온다. 배달 가방을 멘 채. 그 뒤로 셋, 아니 넷. 전력 질주로 쫓아온다.',
      '"거기요! 뒷자리! 뒷자리 좀!" 따릉이엔 뒷자리가 없다. 남자도 알 텐데.',
      {
        when: { flags: ['evacuated'], noCompanions: ['rider'] },
        text: '헬멧에 박힌 배달 앱 로고가 눈에 익다. 어젯밤 역 근처 골목에서 본 그 헬멧 같다. 골목을 제집처럼 누비던 헬멧이 지금은 골목에서 쫓기고 있다.',
      },
      {
        when: { companions: ['rider'] },
        text: '용석이 눈을 가늘게 뜬다. "저 형, 같은 대행 사무실이에요. 콜 맨날 뺏어 가던."',
      },
    ],
    choices: [
      {
        id: 'save',
        label: '남자 쪽으로 핸들을 꺾는다',
        hint: '구하면, 같이 쫓긴다',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { companions: ['rider'] },
            effects: { hp: -5, mental: 10, hours: 1, setFlags: ['savedStranger'] },
            result: [
              '용석이 소리친다. "형! 왼쪽 골목!" 남자가 본능처럼 방향을 튼다. 좀비들 앞을 가로지르며 벨을 미친 듯이 울린다.',
              '골목 끝에서 둘이 헉헉대며 주먹을 맞댄다. "콜 뺏은 거 미안했다." "지금 그게 중요해요?"',
              '남자는 가족 쪽으로 간다며 사라진다. 대형마트 하역장으로 빠지는 지름길을 알려 주고.',
            ],
            next: 'c3_mart',
          },
          {
            when: { noCompanions: ['rider'] },
            chance: 0.6,
            effects: { addCompanions: ['rider'], hp: -5, mental: 5, hours: 1, setFlags: ['savedStranger'] },
            result: [
              '좀비들 앞을 가로지르며 벨을 미친 듯이 울린다. 녀석들이 반 박자 멈칫한다. 그 틈에 남자가 뒷바퀴 축에 발을 걸고 어깨를 움켜쥔다. 따릉이 정원 초과. 과태료는 서울시에 달아 둔다.',
              '두 사람 무게에 체인이 비명을 지른다. 남자가 뒤에서 외친다. "오른쪽! 다음 좌회전! 여기 제 구역이에요!"',
              {
                when: { noFlags: ['evacuated'] },
                text: '골목 세 개를 돌자 추격이 끊긴다. 남자가 헬멧을 벗는다. "용석이요. 배달 3년 차. 이 동네 골목은 다 알아요." 대형마트 하역장까지 안내하겠단다.',
              },
              {
                when: { flags: ['evacuated'] },
                text: '골목 세 개를 돌자 추격이 끊긴다. 남자가 헬멧을 벗는다. 어젯밤 그 얼굴이 맞다. "또 뵙네요. 용석이요. 이 동네 골목은 다 안다니까요. 오늘은 좀 쫓겼지만." 대형마트 하역장까지 안내하겠단다.',
              },
            ],
            next: 'c3_mart',
          },
          {
            effects: { hp: -10, mental: -15, hours: 1, setFlags: ['abandonedSomeone'] },
            result: [
              '핸들을 꺾는 순간 남자가 연석에 걸려 넘어진다. 손을 뻗는다. 닿지 않는다.',
              '그 뒤는 보지 않는다. 볼 수가 없다. 페달만 밟는다. 비명이 거리를 울리고, 거리 곳곳에서 고개들이 든다.',
              '다리가 후들거린다. 남자의 목소리가 귀에서 떠나지 않는다. 그리고 뒤에서 발소리가 불어난다.',
            ],
            next: 'c3_horde',
          },
        ],
      },
      {
        id: 'bell',
        label: '벨을 울려 좀비를 끈다',
        hint: '미끼가 되는 건 나다',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            chance: 0.5,
            effects: { hp: -5, mental: 10, hours: 1, setFlags: ['savedStranger'] },
            result: [
              '따르릉. 종말의 서울에서 가장 경쾌한 소리. 좀비 넷이 일제히 고개를 돌린다.',
              '그대로 언덕길을 내리꽂는다. 따릉이 최고 속도가 이렇게 빨랐던가. 남자는 반대편 골목으로 사라지며 외친다. "복 받으실 거예요!"',
              '언덕 끝에 대학병원 간판이 보인다. 추격은 거기서 끊긴다.',
            ],
            next: 'c3_hospital',
          },
          {
            effects: { hp: -15, mental: -5, removeItems: ['bike'], hours: 1, setFlags: ['savedStranger'] },
            result: [
              '따르릉. 좀비들이 고개를 돌린다. 그중 하나가 유난히 빠르다. 뒷바퀴를 낚아챈다.',
              '자전거째 나뒹군다. 무릎이 아스팔트에 갈린다. 따릉이는 두고 기어서 담을 넘는다. 반납은 틀렸다.',
              {
                when: { companions: ['kongi'] },
                text: '넘어지는 순간 콩이가 바구니에서 튕겨 나간다. 담 너머에서 짖는 소리. 콩이가 먼저 넘어가 있다. 그 작은 몸으로.',
              },
              '남자는 무사히 도망쳤다. 그거면 됐다고, 욱신거리는 무릎에게 말해 준다. 담 너머는 대학병원 뒷길이다.',
            ],
            next: 'c3_hospital',
          },
        ],
      },
      {
        id: 'flee',
        label: '못 본 척 반대로 달린다',
        hint: '안전하다. 마음 빼고',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            effects: { mental: -10, hours: 1, setFlags: ['abandonedSomeone'] },
            result: [
              '핸들을 반대로 꺾는다. "저기요! 저기요!" 목소리가 점점 작아진다. 뒤를 보지 않는다.',
              {
                when: { companions: ['kongi'] },
                text: '바구니 속 콩이가 몸을 돌려 뒤를 본다. 낑낑거린다. 대신 봐 주는 것 같다.',
              },
              '언덕길 끝에 대학병원 간판이 보인다. 다리는 멀쩡한데 가슴 한쪽이 무겁다.',
            ],
            next: 'c3_hospital',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 편의점 ───────────────────────────────
  c3_store: {
    id: 'c3_store',
    chapter: 3,
    location: 'store',
    scene: 'convenience_store',
    title: '외상 장부',
    body: [
      '역 앞 편의점. 문은 열려 있고 불도 켜져 있다. 알바도 손님도 없다. 카드 단말기 화면엔 "통신 오류" 네 글자뿐.',
      '진열대는 반쯤 비었다. 생수 몇 병, 삼각김밥, 컵라면. 그리고 이상하게 아무도 안 가져간 민트초코 우유 한 줄.',
      '계산대 옆 벽이 포스트잇으로 뒤덮였다. "생수 2, 삼김 3. 꼭 갚겠습니다. ○○은행 110-…" "라면 5개 죄송합니다. 복구되면 이체할게요." 세상이 끝나도 이 나라는 외상을 긋는다.',
      '계산대 뒤 주류 진열장은 자물쇠로 잠겨 있다. 초록 병이 줄지어 서 있다.',
    ],
    choices: [
      {
        id: 'loot',
        label: '쓸어 담는다',
        hint: '배는 부르고 양심은 빈다',
        tags: ['cold'],
        outcomes: [
          {
            chance: 0.4,
            effects: { supply: 20, hp: -10, mental: -5, hours: 1, setFlags: ['c3_looted'] },
            result: [
              '가방에 되는 대로 쓸어 넣는다. 그때 천장 스피커가 지직거린다.',
              '"고객님, 계산은 하고 가셔야죠." 점주다. 집에서 CCTV 앱으로 보고 있었다. 이 와중에. 볼륨은 최대다.',
              '목소리가 거리로 울려 퍼진다. 골목 끝에서 그림자들이 고개를 든다. 가방을 끌어안고 옆 건물 계단으로 뛰어오른다. "신고할 거예요!" 신고는 받아 줄까.',
            ],
            next: 'c3_pcbang',
          },
          {
            effects: { supply: 25, mental: -5, hours: 1, setFlags: ['c3_looted'] },
            result: [
              '가방이 터질 때까지 쓸어 담는다. 생수, 삼각김밥, 초코바, 건전지. 벽의 포스트잇들이 쳐다보는 것 같다.',
              '나서면서 한 번 뒤를 돌아본다. 텅 빈 진열대. 다음 사람 몫은 없다. 대형마트 쪽으로 방향을 잡는다.',
            ],
            next: 'c3_mart',
          },
        ],
      },
      {
        id: 'note',
        label: '계좌번호 메모를 남긴다',
        hint: '양심값은 시간이다',
        tags: ['kind', 'meme'],
        outcomes: [
          {
            chance: 0.4,
            effects: { supply: 8, hp: -10, mental: 5, hours: 1, setFlags: ['c3_leftNote'] },
            result: [
              '계좌번호 열네 자리를 또박또박 적는다. 하이픈 위치가 헷갈려 한 장을 버리고 새로 쓴다. 그때 자동문이 "어서 오세요" 하고 열린다.',
              '들어온 건 손님이 아니다. 진열대를 방패 삼아 뒷걸음질 친다. 가방을 반쯤 채운 채 창고 뒷문으로 굴러 나온다. 어깨가 선반 모서리에 찍혔다.',
              '쪽지는 벽에 붙였다. 그건 해냈다. 옆 건물 2층에서 키보드 소리가 들린다. 이 시간에?',
            ],
            next: 'c3_pcbang',
          },
          {
            effects: { supply: 12, mental: 10, hours: 1, setFlags: ['c3_leftNote'] },
            result: [
              '필요한 만큼만 담는다. 포스트잇을 한 장 뗀다. "생수 3, 컵라면 4, 삼김 2. 1201호. 꼭 갚습니다." 계좌번호까지 또박또박.',
              '벽에 붙이고 나니 이상하게 마음이 놓인다. 언젠가 누군가 이 쪽지를 다 모아서 받아 낼 날이 오면 좋겠다. 그런 날이 온다는 뜻이니까.',
              '가게를 나서자 옆 건물 2층에서 키보드 두드리는 소리가 들린다. 이 시간에?',
            ],
            next: 'c3_pcbang',
          },
        ],
      },
      {
        id: 'leave',
        label: '아무것도 안 가져간다',
        hint: '빈손, 대신 떳떳하다',
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.5,
            effects: { addItems: ['ramen'], supply: 10, mental: 10, hours: 1, setFlags: ['c3_leftNote'] },
            result: [
              '빈손으로 나서는데 창고 문이 열린다. 앞치마를 두른 초로의 남자. 점주다. 창고에서 다 보고 있었다.',
              '"다들 쓸어 가는데 왜 그냥 가요." 대답을 고르는 사이 라면 한 박스가 품에 안긴다. "가져가요. 어차피 다 끝났는데. 벽에 이름이나 적고."',
              '포스트잇에 1201호라고 적는다. 점주가 그 밑에 "갚을 필요 없음"이라고 덧쓴다.',
            ],
            next: 'c3_mart',
          },
          {
            effects: { mental: 5, hours: 1 },
            result: [
              '아무것도 안 집고 나온다. 배가 꼬르륵거린다. 양심은 배를 채워 주지 않는다.',
              '그래도 발걸음은 가볍다. 대형마트 쪽으로 방향을 잡는다. 거긴 계산대가 수십 개다. 누군가는 있겠지.',
            ],
            next: 'c3_mart',
          },
        ],
      },
      {
        id: 'soju',
        label: '주류 진열장을 딴다',
        hint: '소주는 쓸 데가 있다',
        requires: { anyItems: ['crowbar', 'bat'] },
        lockedHint: '빠루나 방망이가 있었다면…',
        tags: ['meme', 'brave'],
        outcomes: [
          {
            effects: { addItems: ['soju'], supply: 5, hours: 1 },
            result: [
              '자물쇠를 한 번에 날린다. 소주 여섯 병을 신문지에 싸서 가방 옆주머니에 꽂는다.',
              '마시면 용기, 던지면 화염병. 어느 쪽이 먼저일지는 모르겠다.',
              {
                when: { companions: ['grandma'] },
                text: '할머니가 혀를 찬다. "그거 두어 병 더 챙겨. 소독도 되고, 불도 붙어."',
              },
              '가게를 나서자 옆 건물 2층에서 키보드 소리가 들린다.',
            ],
            next: 'c3_pcbang',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 지하철역 ───────────────────────────────
  c3_station: {
    id: 'c3_station',
    chapter: 3,
    location: 'station',
    scene: 'subway_platform',
    title: '열차 운행 중단',
    body: [
      '계단을 내려가자 공기가 서늘해진다. 전광판엔 "열차 운행 중단 — 안전한 곳으로 대피하십시오"만 흐른다. 그 안전한 곳이 어딘지는 안 알려 준다.',
      {
        when: { flags: ['evacuated'] },
        text: '대합실은 비었다. 개찰구 옆에 깔린 박스들, 초코파이 빈 봉지. 밤을 넘긴 사람들은 새벽 재난문자와 함께 다 흩어졌다. 셔터 안쪽엔 접이식 의자 하나와 꺼진 손전등. 밤새 누가 여길 지킨 모양인데, 그 사람은 보이지 않는다.',
      },
      '승강장 끝 스크린도어 비상문이 열려 있다. 선로를 따라 두 정거장 가면 대학병원 앞. 지상보다 좀비가 적다는 소문이 단톡방에 돌았다.',
      '역무실 문이 반쯤 열려 있다. 안에서 무전기 잡음이 치직거린다.',
      {
        when: { companions: ['kongi'] },
        text: '콩이가 선로 쪽 어둠에 코를 대고 킁킁거린다. 꼬리가 내려가 있다.',
      },
    ],
    choices: [
      {
        id: 'office',
        label: '역무실을 뒤진다',
        hint: '뭔가 있다. 누군가도',
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.5,
            effects: { addItems: ['radio', 'flashlight'], mental: 5, hours: 1 },
            result: [
              '역무실은 비어 있다. 의자에 제복 재킷이 걸려 있고, 책상 위엔 식은 커피.',
              '충전 거치대의 무전기 하나, 벽에 걸린 비상 손전등 하나. 둘 다 챙긴다. 무전기에선 알아들을 수 없는 호출 부호가 흘러나온다.',
            ],
            next: 'c3_tunnel',
          },
          {
            when: { anyItems: ['bat', 'crowbar', 'extinguisher'] },
            effects: { addItems: ['radio'], hp: -5, mental: -5, hours: 1 },
            result: [
              '책상 밑에 역무원이 웅크려 있다. 아니, 역무원이었던 것. 제복 명찰이 흔들린다.',
              '달려드는 순간 머리를 노려 휘두른다. 한 번. 두 번. 조용해진다.',
              '거치대에서 무전기를 뽑는다. 손이 떨려서 두 번 놓친다.',
            ],
            next: 'c3_tunnel',
          },
          {
            effects: { addItems: ['flashlight'], hp: -15, mental: -10, hours: 1 },
            result: [
              '책상 밑에서 역무원이었던 것이 튀어나온다. 맨손으로 밀쳐 낸다. 팔뚝을 할퀸 손톱자국이 뜨겁다. 이빨은 아니다.',
              '벽의 비상 손전등만 낚아채고 문을 닫는다. 문 너머에서 쿵, 쿵. 무전기는 두고 왔다.',
            ],
            next: 'c3_tunnel',
          },
        ],
      },
      {
        id: 'rails',
        label: '바로 선로로 내려간다',
        hint: '빠르지만 깜깜하다',
        tags: ['brave'],
        outcomes: [
          {
            effects: { hours: 1 },
            result: [
              {
                when: { items: ['flashlight'] },
                text: '손전등을 켠다. 빛줄기가 레일 위로 길게 뻗는다. 끝이 안 보인다.',
              },
              {
                when: { noItems: ['flashlight', 'powerbank'] },
                text: '휴대폰 플래시를 켠다. 배터리 아이콘이 빨갛다. 빛은 세 걸음 앞에서 끝난다.',
              },
              {
                when: { noItems: ['flashlight'], items: ['powerbank'] },
                text: '휴대폰 플래시를 켠다. 주머니 속 보조배터리 선이 폰까지 이어져 있다. 그래도 빛은 세 걸음 앞에서 끝난다.',
              },
              '비상문을 지나 선로로 내려선다. 자갈이 발밑에서 와그작거린다. 생각보다 훨씬 시끄럽다.',
            ],
            next: 'c3_tunnel',
          },
        ],
      },
      {
        id: 'up',
        label: '지상으로 다시 올라간다',
        hint: '어둠보단 낫다. 아마도',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: -3, hours: 1 },
            result: [
              '선로 쪽 어둠을 한참 보다가 발길을 돌린다. 반대편 출구로 나온다.',
              '어디선가 키보드 두드리는 소리가 들린다. 다다닥, 딸깍. 적어도 저건 사람 손이다.',
            ],
            next: 'c3_pcbang',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 선로 ───────────────────────────────
  c3_tunnel: {
    id: 'c3_tunnel',
    chapter: 3,
    location: 'tunnel',
    scene: 'subway_tunnel',
    title: '선로 위의 어둠',
    body: [
      '자갈 밟는 소리가 터널 벽에 부딪혀 두 배로 돌아온다. 아무리 살살 걸어도 소리가 난다. 30분쯤 걸었을까. 멈춰 선 열차가 선로를 막고 있다.',
      {
        when: { items: ['flashlight'] },
        text: '손전등 빛에 열차 옆 좁은 틈이 드러난다. 어깨 하나 겨우 들어갈 폭. 창문 안쪽은 김이 서린 것처럼 뿌옇다.',
      },
      {
        when: { noItems: ['flashlight'] },
        text: '휴대폰 불빛으로는 열차 옆 좁은 틈이 겨우 보인다. 그 너머는 그냥 검정이다.',
      },
      {
        when: { companions: ['kongi'] },
        text: '콩이가 딱 멈춘다. 털이 곤두선다. 열차 밑을 향해 낮게, 아주 낮게 으르렁거린다.',
      },
      '열차 안에서 뭔가가 유리를 긁는다. 딱 한 번.',
    ],
    choices: [
      {
        id: 'squeeze',
        label: '열차 옆 틈으로 지나간다',
        hint: '좁다. 붙잡히면 끝이다',
        tags: ['brave'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { hp: -5, mental: 5, hours: 2 },
            result: [
              '콩이의 으르렁 소리에 반 박자 먼저 멈춘다. 바로 그 자리, 열차 밑에서 팔 하나가 허공을 휘젓는다. 한 걸음만 더 갔으면 발목이었다.',
              '벽에 등을 붙이고 팔이 닿지 않는 쪽으로 게걸음을 친다. 콩이가 앞장선다. 그 겁쟁이가.',
              '터널 끝에 초록 비상등. 대학병원역이다.',
            ],
            next: 'c3_hospital',
          },
          {
            chance: 0.5,
            effects: { mental: -5, hours: 2 },
            result: [
              '숨을 참고 틈으로 몸을 밀어 넣는다. 열차 창문 너머에서 얼굴들이 따라 움직인다. 유리가 버텨 준다.',
              '반대편으로 빠져나오자 다리에 힘이 풀린다. 터널 끝 초록 비상등. 대학병원역이다.',
            ],
            next: 'c3_hospital',
          },
          {
            when: { anyItems: ['bat', 'crowbar', 'extinguisher'] },
            effects: { hp: -10, mental: -10, hours: 2 },
            result: [
              '틈 한가운데서 열차 밑으로부터 손이 발목을 움켜쥔다. 생각보다 몸이 먼저 움직인다. 머리를 노려 내려친다.',
              '손아귀가 풀린다. 뒤도 안 보고 빠져나온다. 발목에 손자국이 시퍼렇게 남았다. 양말을 내리고 불빛을 바짝 댄다. 이빨 자국은 없다.',
              '터널 끝 초록 비상등. 대학병원역이다.',
            ],
            next: 'c3_hospital',
          },
          {
            effects: { hp: -20, mental: -10, infect: true, hours: 2 },
            result: [
              '틈 한가운데서 열차 밑으로부터 손이 뻗어 나와 벽을 짚은 손목을 움켜쥔다. 휘두를 게 없다. 비틀고, 당기고, 그 손을 열차 옆구리에 짓찧는다. 뭔가가 팔로 딸려 올라온다.',
              '겨우 팔을 빼냈을 때 팔뚝에 반달 모양 자국이 남아 있다. 피가 배어 나온다. 이빨이다. 티셔츠 자락을 찢어 칭칭 감는다. 소매를 끌어내려 덮는다.',
              '터널 끝 초록 비상등. 대학병원역. 병원이라 다행인 건지, 그냥 우연인 건지.',
            ],
            next: 'c3_hospital',
          },
        ],
      },
      {
        id: 'lure',
        label: '돌을 던져 반대쪽으로 끈다',
        hint: '머리를 쓴다. 대신 모인다',
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.6,
            effects: { mental: 5, hours: 2 },
            result: [
              '자갈 하나를 주워 온 길 쪽으로 힘껏 던진다. 딱, 딱, 데구르르.',
              '열차 문틈에서 그림자 셋이 기어 나와 소리 쪽으로 뛴다. 그 틈에 조용히 지난다. 발끝으로. 숨도 참고.',
              '초록 비상등. 대학병원역. 계단을 오르며 소리 없이 웃는다. 머리 쓴 보람이 있다.',
            ],
            next: 'c3_hospital',
          },
          {
            effects: { hp: -10, mental: -5, hours: 1 },
            result: [
              '던진 돌이 레일에 맞아 쨍 하고 울린다. 터널 전체가 종처럼 울린다.',
              '열차 안의 것만이 아니다. 터널 양쪽 어둠이 한꺼번에 깨어난다. 가장 가까운 환기구 사다리로 뛴다. 손바닥이 녹슨 쇠에 찢긴다.',
              '올라온 곳은 사거리 한복판. 소리를 따라온 것들이 이미 모여 있다.',
            ],
            next: 'c3_horde',
          },
        ],
      },
      {
        id: 'back',
        label: '되돌아가 지상으로 간다',
        hint: '안전하다. 돌아가면 멀다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { supply: -5, mental: -5, hours: 3 },
            result: [
              '열차 앞에서 돌아선다. 왔던 30분을 다시 걷는다. 자갈 소리가 등 뒤를 따라오는 것 같다.',
              '지상은 눈이 부시다. 방향을 잃고 한참 헤매다 대형마트 간판을 발견한다.',
            ],
            next: 'c3_mart',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── PC방 ───────────────────────────────
  c3_pcbang: {
    id: 'c3_pcbang',
    chapter: 3,
    location: 'store',
    scene: 'street_chaos',
    title: '한 판만 더',
    alert: {
      kind: 'kakao',
      from: '대학동기방 (7)',
      text: '살아있는 사람 1 눌러 봐. 지금 1 세 개밖에 안 떴어',
    },
    body: [
      '골목 2층 PC방 간판이 멀쩡히 돌아간다. "24시 · 최신 사양 · 라면 맛집". 계단 위에서 키보드 소리가 쏟아진다. 이 와중에.',
      '유리문 너머, 고등학생 넷이 헤드셋을 쓰고 모니터에 코를 박고 있다. 한 명이 힐끗 보더니 손가락 하나를 든다. "잠깐만요, 이 판만. 지금 한타예요."',
      '건물 비상발전기가 돈다. 카운터 온수기엔 불이 들어와 있고, 컵라면 냄새가 계단까지 내려온다.',
      {
        when: { noCompanions: ['minjun'] },
        text: '구석 자리엔 교복 위에 패딩을 걸친 애가 혼자 앉아 있다. 필통에 "수능 D-49" 스티커. 윗집 민준이다. 새벽마다 쿵쿵 뛰던 그 층간소음.',
      },
    ],
    choices: [
      {
        id: 'wait',
        label: '판 끝날 때까지 기다린다',
        hint: '라면은 얻고, 시간은 잃는다',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.4,
            effects: { hp: -10, supply: 10, hours: 2 },
            result: [
              '한 판에 15분이라더니 40분째다. 누군가 서렌을 거부했다. 그 사이 계단 아래에서 발소리가 올라온다.',
              '문 앞을 몸으로 막는다. 안에서는 "아 잠깐만 넥서스!"가 들린다. 겨우 밀어내고 셔터를 내린다. 애들은 모른다. 이겼단다.',
              '승리 기념으로 컵라면을 하나 준다. 땀에 젖은 채 먹는다. 맛있다. 억울하게.',
            ],
            next: 'c3_mart',
          },
          {
            effects: { addItems: ['ramen'], supply: 15, mental: 10, hours: 2 },
            result: [
              '"GG!" 이겼다. 문이 열린다. 애들이 컵라면을 박스째 안긴다. "이거 가져가세요. 창고에 더 있어요."',
              '온수기 물로 컵라면 하나를 먹는다. 국물까지 마신다. 어제 이후 처음 먹는 따뜻한 음식. 눈물 나게 짜다.',
              {
                when: { flags: ['ateRamen'] },
                text: '어제 재난문자가 울리는 와중에도 라면을 끝까지 먹었었다. 역시 인간은 라면으로 버틴다.',
              },
            ],
            next: 'c3_mart',
          },
        ],
      },
      {
        id: 'carry',
        label: '"나 다이아야" 대리를 뛰어준다',
        hint: '헛소리다. 대신 들어간다',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.5,
            effects: { hp: 5, mental: 15, addItems: ['powerbank'], hours: 2 },
            result: [
              '실버 2다. 말은 안 한다. 애들 자리에 앉아 마우스를 잡는다. 손이 기억한다. 대학 때 밤새던 그 손.',
              '이긴다. 애들이 소리를 지른다. "와 진짜 다이아 맞네!" 아니다. 운이다.',
              '보답으로 충전 꽉 찬 보조배터리를 받는다. 한 시간 동안 세상이 끝난 걸 잊었다.',
            ],
            next: 'c3_mart',
          },
          {
            effects: { hp: 10, mental: -5, hours: 3 },
            result: [
              '실버 2다. 3분 만에 들통난다. "아 트롤이네." 고등학생한테 트롤 소리를 듣는다. 종말보다 이게 더 아프다.',
              '벤치로 쫓겨나 소파에서 눈을 붙인다. 발전기 소리가 자장가 같다. 깨어 보니 세 시간이 지났다. 애들은 아직도 "한 판만 더"다.',
            ],
            next: 'c3_mart',
          },
        ],
      },
      {
        id: 'persuade',
        label: '애들을 설득해 같이 간다',
        hint: '사람이 늘면 입도 는다',
        tags: ['kind'],
        outcomes: [
          {
            when: { noCompanions: ['minjun'] },
            effects: { addCompanions: ['minjun'], mental: 5, hours: 1, setFlags: ['savedStranger'] },
            result: [
              '게임하는 애들은 부모님이 데리러 온다며 꿈쩍도 안 한다. 구석의 민준만 일어선다.',
              '"저기… 층간소음, 죄송했어요. 새벽에 줄넘기한 거." 가방을 멘다. "근데 저 체력은 좋아요. 반에서 오래달리기 1등이에요."',
              '어깨가 넓다. 수능 D-49의 고3이 뒤를 따른다. 문제집은 두고 온다. 아무도 뭐라 하지 않는다.',
            ],
            next: 'c3_mart',
          },
          {
            effects: { supply: 10, hours: 1 },
            result: [
              {
                when: { companions: ['minjun'] },
                text: '민준이 애들한테 가서 뭐라 한다. 한 명이 헤드셋을 벗는다. "형, 수능 연기됐어요?" "몰라. 근데 여기 있으면 수능 못 봐."',
              },
              '애들은 부모님을 기다리겠다고 한다. 대신 컵라면 몇 개와 생수를 챙겨 준다. "대피소 가면 저희 여기 있다고 말해 주세요."',
              '약속한다. PC방 이름을 손등에 볼펜으로 적는다.',
            ],
            next: 'c3_mart',
          },
        ],
      },
      {
        id: 'warn',
        label: '경고만 하고 떠난다',
        hint: '빠르다. 애들은 남는다',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            effects: { mental: -5, hours: 2 },
            result: [
              '유리문을 두드린다. "밖에 좀비 있어! 문 잠가!" 한 명이 엄지를 든다. 헤드셋은 안 벗는다.',
              '뒷골목 지름길로 빠진다. 대학병원 뒤편으로 이어지는 길이다. 등 뒤로 키보드 소리가 멀어진다.',
            ],
            next: 'c3_hospital',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 대형마트 ───────────────────────────────
  c3_mart: {
    id: 'c3_mart',
    chapter: 3,
    location: 'mart',
    scene: 'mart',
    title: '물자 쟁탈전',
    body: [
      '대형마트 셔터가 사람 키 높이까지 뜯겨 올라가 있다. 안은 이미 전쟁터다. 카트 부딪히는 소리, 누가 누구를 밀치는 소리, 그리고 아직도 흘러나오는 매장 BGM.',
      '생수 코너 앞. 등산복 차림 아저씨 셋이 마지막 생수 팩 더미를 카트 두 대로 막고 섰다. 한 명은 등산스틱을 창처럼 쥐었다. "여긴 우리가 먼저 왔어요."',
      '반려동물 코너는 아무도 안 건드렸다. 연어맛 사료가 산처럼 쌓여 있다.',
      {
        when: { companions: ['rider'] },
        text: '용석이 귓속말을 한다. "여기 새벽배송 물건 빼는 하역장 있어요. 뒤로 돌면 창고예요."',
      },
    ],
    choices: [
      {
        id: 'fight',
        label: '맞붙어서 뺏는다',
        hint: '이기면 다 가진다',
        tags: ['brave', 'cold'],
        outcomes: [
          {
            when: { anyItems: ['bat', 'crowbar'] },
            effects: { supply: 25, mental: -10, hours: 1, setFlags: ['c3_martFight'] },
            result: [
              '무기를 어깨에 걸치고 걸어간다. 말은 안 한다. 등산스틱이 먼저 내려간다.',
              '생수 팩을 카트째 끌고 나온다. 아저씨들 시선이 등에 꽂힌다. 어제까지 동네 산악회 총무였을 사람들이다.',
              '이긴 건데 기분이 이상하다. 좀비보다 사람을 먼저 겨눴다. 소란이 마트 밖까지 번진다.',
            ],
            next: 'c3_horde',
          },
          {
            when: { anyCompanions: ['minjun', 'rider'] },
            effects: { supply: 20, hp: -10, mental: -5, hours: 1, setFlags: ['c3_martFight'] },
            result: [
              '머릿수가 맞으니 해 볼 만하다. 카트가 부딪히고, 누군가의 팔꿈치가 광대에 꽂힌다.',
              {
                when: { companions: ['minjun'] },
                text: '민준이 아저씨 하나를 카트째 밀어 버린다. 오래달리기 1등은 거짓말이 아니었다.',
              },
              {
                when: { companions: ['rider'] },
                text: '용석이 몸을 날려 등산스틱을 붙잡는다. "배달 가방보다 가볍네."',
              },
              '생수 팩 두 개를 들고 뛴다. 입안에서 피 맛이 난다. 소란에 마트 밖이 술렁인다.',
            ],
            next: 'c3_horde',
          },
          {
            chance: 0.4,
            effects: { supply: 20, hp: -15, hours: 1, setFlags: ['c3_martFight'] },
            result: [
              '맨몸으로 부딪힌다. 등산스틱이 옆구리를 친다. 숨이 턱 막힌다.',
              '그래도 생수 팩 하나는 끌어안고 빠져나온다. 뒤에서 욕설이 쏟아진다. 소란이 마트 밖까지 번진다.',
            ],
            next: 'c3_horde',
          },
          {
            effects: { supply: 5, hp: -20, mental: -10, hours: 1 },
            result: [
              '등산스틱 끝이 어깨에 박힌다. 바닥에 나뒹군다. 생수 한 병만 겨우 쥐고 기어 나온다.',
              '"요즘 젊은 것들은." 종말에도 들을 줄은 몰랐다. 소란에 마트 밖이 술렁인다.',
            ],
            next: 'c3_horde',
          },
        ],
      },
      {
        id: 'trade',
        label: '물물교환을 제안한다',
        hint: '뭘 내놓느냐가 문제',
        tags: ['kind', 'careful'],
        outcomes: [
          {
            when: { companions: ['grandma'] },
            effects: { supply: 20, mental: 10, hours: 1 },
            result: [
              '할머니가 앞으로 나선다. 아저씨들 등산복 가슴팍 자수를 보더니 묻는다. "자네들, 수락산악회 아닌가?"',
              '돌아가신 할아버지가 거기 초대 회장이었단다. 아저씨들이 동시에 모자를 벗는다. 생수 팩 두 개가 카트째 넘어온다.',
              '"어머님, 조심히 가세요." 산악회는 종말에도 서열이 있다.',
            ],
            next: 'c3_hospital',
          },
          {
            when: { items: ['ramen'] },
            effects: { removeItems: ['ramen'], supply: 25, mental: 5, hours: 1 },
            result: [
              '라면 박스를 카트 위에 올려놓는다. 아저씨들 눈빛이 달라진다. 물은 있어도 끓여 먹을 게 없었던 거다.',
              '라면 한 박스에 생수 두 팩, 참치캔 여섯 개. 종말의 환율은 라면이 정한다.',
            ],
            next: 'c3_hospital',
          },
          {
            when: { items: ['soju'] },
            effects: { removeItems: ['soju'], supply: 20, mental: 5, hours: 1 },
            result: [
              '가방 옆주머니의 소주를 전부 내민다. 등산스틱이 내려간다. "…정상주가 없었거든요."',
              '생수 한 팩이 넘어온다. 아저씨들이 그 자리에서 한 병 따서 돌린다. 종말에도 건배는 한다.',
            ],
            next: 'c3_hospital',
          },
          {
            effects: { supply: 8, mental: -5, hours: 1 },
            result: [
              '내놓을 게 없다. 빈 가방을 열어 보인다. 아저씨들이 서로 눈치를 본다.',
              '제일 나이 많은 아저씨가 생수 두 병을 던져 준다. "젊은 사람이 굶으면 안 되지." 고맙고, 비참하다.',
            ],
            next: 'c3_hospital',
          },
        ],
      },
      {
        id: 'sneak',
        label: '하역장으로 몰래 돈다',
        hint: '조용하다. 창고는 어둡다',
        tags: ['careful'],
        outcomes: [
          {
            when: { companions: ['rider'] },
            effects: { supply: 30, hours: 2 },
            result: [
              '용석이 앞장선다. 직원용 문 비밀번호까지 안다. "새벽배송 물건 받으러 맨날 왔거든요."',
              '창고엔 뜯지도 않은 박스가 천장까지 쌓여 있다. 생수, 통조림, 즉석밥. 가방이 모자란다.',
            ],
            next: 'c3_hospital',
          },
          {
            chance: 0.5,
            effects: { supply: 20, hours: 2 },
            result: [
              '하역장 셔터 틈으로 기어든다. 어둠 속에 박스 더미. 생수와 통조림을 조용히 가방에 옮긴다.',
              '들어올 때보다 무거운 가방을 메고 나온다. 아무도 몰랐다. 이 도시에서는 조용한 쪽이 이긴다.',
            ],
            next: 'c3_hospital',
          },
          {
            effects: { supply: 5, hp: -10, hours: 1 },
            result: [
              '창고 안쪽에 형광 조끼를 입은 직원이 서 있다. 등을 돌린 채 흔들린다. 박스를 건드리는 순간 고개가 돌아간다.',
              '가방에 든 걸 반쯤 쏟으며 뛴다. 하역장 셔터 밖으로 굴러 나온다. 뒤따라 나온 것들이 거리의 다른 것들을 부른다.',
            ],
            next: 'c3_horde',
          },
        ],
      },
      {
        id: 'dogfood',
        label: '콩이 사료를 챙긴다',
        hint: '사람 먹을 건 아니다',
        tags: ['dog'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { addItems: ['dogfood'], mental: 10, hours: 1 },
            result: [
              '연어맛 한 포대를 가방에 꽂는다. 콩이가 봉지 냄새를 맡고 꼬리를 프로펠러처럼 돌린다. 어제 이후 처음 보는 꼬리다.',
              '그 꼬리 하나로 오늘 하루치 기운이 난다.',
            ],
            next: 'c3_hospital',
          },
          {
            when: { flags: ['leftDog'] },
            effects: { addItems: ['dogfood'], mental: -10, hours: 1 },
            result: [
              '연어맛 한 포대를 집어 드는 순간 손이 멈춘다. 콩이 최애. 12층 현관에 두고 온 그 얼굴이 떠오른다. 접힌 귀까지.',
              '봉지를 가방에 넣는다. 이유는 묻지 않기로 한다. 다시 만나면 주려고. 만날 거니까.',
            ],
            next: 'c3_hospital',
          },
          {
            effects: { addItems: ['dogfood'], mental: 5, hours: 1 },
            result: [
              '연어맛 한 포대를 챙긴다. 사람도 급하면 먹는다는 소문이 있다. 아직 그 정도로 급하진 않다.',
              '가방이 묵직하다. 언젠가 쓸 데가 있겠지. 콩이를 다시 만나는 날이라든가.',
            ],
            next: 'c3_hospital',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 대학병원 ───────────────────────────────
  c3_hospital: {
    id: 'c3_hospital',
    chapter: 3,
    location: 'hospital',
    scene: 'hospital',
    title: '나이트 근무는 끝나지 않았다',
    body: [
      '대학병원 응급실 자동문이 반쯤 열린 채 멈춰 있다. 번호표 기계만 혼자 살아서 "대기 인원 312명"을 뱉는다. 대기실엔 아무도 없다.',
      '복도 끝 초록 비상등 아래, 간호사 한 명이 카트를 밀고 온다. 명찰엔 "정지수". 눈 밑이 새까맣다. "외래 아니면 돌아가세요. 농담 아니고."',
      '유리창 너머 격리병동. 반쯤 걷힌 커튼 뒤 실루엣들이 느리게 흔들린다. 문엔 빨간 테이프로 커다란 X.',
      {
        when: { infected: true },
        text: '정지수의 걸음이 멈춘다. 이마의 땀, 번들거리는 눈, 소매 밑 상처를 차례로 본다. "…열나죠, 지금."',
      },
    ],
    choices: [
      {
        id: 'ask',
        label: '같이 가자고 한다',
        hint: '의료진이다. 입도 하나 는다',
        tags: ['kind'],
        outcomes: [
          {
            when: { infected: true },
            effects: { addCompanions: ['nurse'], hp: 5, mental: -5, hours: 1 },
            result: [
              '"같이 가요." 정지수가 대답 대신 손목을 잡는다. 맥박을 재고, 소매를 걷는다. 붕대 밑을 보고 오래 말이 없다.',
              '"갈게요. 대신 열은 제가 재요. 한 시간마다." 가운을 벗어 카트에 던진다. 부탁한 건 이쪽인데, 감시당하는 것도 이쪽이다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            when: { companions: ['grandma'] },
            effects: { addCompanions: ['nurse'], addItems: ['medkit'], hp: 10, mental: 10, hours: 1 },
            result: [
              '정지수가 할머니를 보더니 한숨을 쉰다. "어머님, 혈압약 드시죠. 얼굴 보니까 어제부터 못 드셨네."',
              '카트에서 약 봉투와 구급상자를 챙기고 가운을 벗는다. "어르신 혼자 두면 제가 잠을 못 자요. 어차피 퇴근도 못 했는데."',
              '3교대 나이트 근무가 서른 시간째 이어진다. 이번엔 병원 밖에서.',
            ],
            next: 'c3_checkpoint',
          },
          {
            chance: 0.6,
            effects: { addCompanions: ['nurse'], addItems: ['medkit'], hp: 10, hours: 1 },
            result: [
              '정지수가 격리병동 쪽을 한참 본다. "저 안에 제 동기가 있어요. 어젯밤까지는 동기였어요."',
              '구급상자를 챙겨 들고 명찰을 뗀다. "가요. 여기 있으면 저도 저렇게 돼요."',
              '복도를 나서며 상처 난 데를 소독해 준다. 따갑다. 살아 있다는 뜻이다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { addItems: ['medkit'], mental: -5, hours: 1 },
            result: [
              '"환자가 아직 열한 명 있어요. 저 안 말고, 이 층에." 정지수가 고개를 젓는다.',
              '구급상자 하나를 쥐여 준다. "대피소 가면 여기 사람 있다고 말해 줘요. 구급차 한 대만 보내 달라고." 약속한다. 지킬 수 있을지는 모른다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
      {
        id: 'pharmacy',
        label: '격리병동 약제실을 턴다',
        hint: '약은 많다. 문은 약하다',
        tags: ['brave'],
        outcomes: [
          {
            when: { items: ['extinguisher'] },
            effects: { addItems: ['medkit'], removeItems: ['extinguisher'], hp: 10, hours: 1 },
            result: [
              '빨간 X 테이프를 뜯는다. 커튼이 일제히 흔들린다.',
              '달려드는 첫 번째 얼굴에 소화기를 뿜는다. 하얀 구름. 그 사이로 약제실 선반을 훑는다. 붕대, 항생제, 진통제.',
              '빈 소화기통으로 마지막 문을 괸다. 문 너머가 조용해질 때까지 기다리지 않는다. 뒷문으로 나선다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            chance: 0.5,
            effects: { addItems: ['medkit'], hp: 15, hours: 1 },
            result: [
              'X 테이프 밑으로 기어 들어간다. 커튼 뒤 실루엣들이 코를 킁킁거린다. 숨을 참는다.',
              '약제실 선반에서 구급상자와 진통제를 챙긴다. 복도 벽에 기대 진통제 두 알을 삼킨다. 몸이 조금 풀린다.',
              '나올 때까지 아무도 돌아보지 않았다. 운이다. 순전히.',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { addItems: ['medkit'], hp: -15, mental: -10, hours: 1 },
            result: [
              '약제실 문을 여는 순간 경보가 울린다. 병원 시스템은 아직 살아 있다. 친절하게도.',
              '커튼이 일제히 젖혀진다. 구급상자 하나만 낚아채고 복도 끝 비상구로 뛴다. 휠체어를 걷어차고 들것을 뛰어넘는다. 응급실 복도가 이렇게 길었던가.',
              '뒷문 밖으로 나왔을 때, 경보를 들은 것들이 거리 곳곳에서 고개를 들고 있다.',
            ],
            next: 'c3_horde',
          },
        ],
      },
      {
        id: 'confess',
        label: '물렸다고 털어놓는다',
        hint: '숨겨 봐야 열은 오른다',
        requires: { infected: true },
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.35,
            effects: { cure: true, addCompanions: ['nurse'], hp: -10, mental: 15, hours: 2 },
            result: [
              '정지수가 말없이 처치실로 끌고 간다. 냉장고에서 라벨 없는 앰풀을 꺼낸다. "임상 중이던 항바이러스제예요. 사람한테 들어가는 건 처음이고요."',
              '바늘이 들어간다. 온몸이 불타는 것 같다가, 얼어붙는 것 같다가, 두 시간 뒤. 열이 내린다.',
              '정지수가 체온계를 두 번 본다. 그리고 처음으로 웃는다. "퇴원은 같이 하죠."',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { addCompanions: ['nurse'], hp: 10, mental: 10, hours: 2 },
            result: [
              '정지수가 상처를 보고, 체온을 재고, 오래 말이 없다. "해열제로 몇 시간은 벌어요. 그 이상은 저도 못 해요."',
              '붕대를 감아 주며 말한다. "숨기지 말아요. 같이 가요. 그때가 오면 제가 먼저 말해 줄게요."',
              '거짓말을 안 하는 사람이다. 그래서 무섭고, 그래서 고맙다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
      {
        id: 'pass',
        label: '인사만 하고 지나간다',
        hint: '빠르다. 빈손이다',
        tags: ['cold'],
        outcomes: [
          {
            when: { infected: true },
            effects: { mental: -10, hours: 1, setFlags: ['hiddenBite'] },
            result: [
              '소매를 끌어내려 상처를 덮는다. "괜찮아요. 그냥 감기." 정지수의 시선이 등에 꽂힌다.',
              '병원 뒷문을 나서며 이마를 짚는다. 뜨겁다. 모른 척한다. 아직은.',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { hours: 1 },
            result: [
              '고개만 꾸벅하고 병원 뒷문으로 빠져나간다. 정지수는 벌써 다음 병실로 카트를 민다.',
              '뒷문 너머는 강변으로 이어지는 도로다. 멀리 군 트럭이 보인다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 좀비 떼 ───────────────────────────────
  c3_horde: {
    id: 'c3_horde',
    chapter: 3,
    location: 'station',
    scene: 'horde',
    title: '떼',
    body: [
      '거리의 공기가 바뀐다. 멀리서 들리던 비명이 뚝 끊기고, 대신 발소리가 가까워진다. 수십 개가, 한 박자로.',
      '사거리 너머 버스정류장 쪽에서 떼가 쏟아진다. 앞줄은 벌써 뛰고 있다. 초등학교까지 1킬로미터. 뛰어서 5분. 저것들은 3분이면 따라잡는다.',
      {
        when: { companions: ['grandma'] },
        text: '할머니 무릎으로는 못 뛴다. 할머니도 안다. 그래서 아무 말도 안 한다.',
      },
      {
        when: { companions: ['kongi'], items: ['bike'] },
        text: '바구니 속 콩이가 몸을 잔뜩 웅크린다. 귀가 뒤로 납작해진다. 떨림이 핸들을 타고 손바닥까지 올라온다.',
      },
      {
        when: { companions: ['kongi'], noItems: ['bike'] },
        text: '콩이가 목줄을 팽팽하게 당긴다. 입을 꾹 다문 채, 꼬리를 다리 사이에 말아 넣고.',
      },
    ],
    choices: [
      {
        id: 'molotov',
        label: '소주 화염병을 던진다',
        hint: '불이 붙으면 길이 열린다',
        requires: { items: ['soju'] },
        lockedHint: '소주 한 병만 있었다면…',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            chance: 0.6,
            effects: { removeItems: ['soju'], hp: -5, mental: 10, hours: 1 },
            result: [
              '소주병 입구에 손수건을 쑤셔 넣는다. 라이터를 켠다. 16도짜리가 불이 붙을까. 댓글에서 안 된다고 했던 것 같다.',
              '붙는다. 댓글이 틀렸다. 앞줄 한가운데서 파란 불꽃이 번진다. 떼가 불 쪽으로 엉키는 사이 반대쪽으로 뛴다. 머리카락 끝이 그슬린다.',
              {
                when: { companions: ['minjun'] },
                text: '민준이 뛰면서 중얼거린다. "와, 이건 생기부에 못 쓰겠다."',
              },
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { removeItems: ['soju'], hp: -12, mental: -5, hours: 1 },
            result: [
              '손수건에 불을 붙여 던진다. 병이 깨진다. 불은 안 붙는다. 16도는 16도다. 아스팔트에 소주 냄새만 퍼진다.',
              '그래도 유리 깨지는 소리에 앞줄 고개가 그쪽으로 꺾인다. 그 반 박자에 뛴다. 옆구리를 스친 손톱이 셔츠를 찢는다.',
              '종말에도 소주는 마시는 거였다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
      {
        id: 'spray',
        label: '소화기를 뿌리며 뚫는다',
        hint: '연막이다. 거리가 짧다',
        requires: { items: ['extinguisher'] },
        lockedHint: '소화기가 있었다면…',
        tags: ['brave'],
        outcomes: [
          {
            when: { items: ['gasmask'] },
            effects: { removeItems: ['extinguisher'], hp: -3, mental: 10, hours: 1 },
            result: [
              '방독면 끈부터 조인다. 안전핀을 뽑는다. 하얀 분말이 앞줄을 덮는다.',
              '구름 속에서 저것들은 눈을 비비고 기침 비슷한 소리를 낸다. 이쪽은 숨이 쉬어진다. 방독면 렌즈 너머로 빈틈이 보인다. 그 사이로 걸어서 지나간다. 뛸 필요도 없다.',
              '구름 밖에서 방독면을 벗는다. 얼굴에 고무 자국이 동그랗게 남았다. 살아 있는 사람한테만 생기는 자국이다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { removeItems: ['extinguisher'], hp: -10, mental: 5, hours: 1 },
            result: [
              '안전핀을 뽑는다. 하얀 분말이 앞줄을 덮는다. 저것들이 기침인지 뭔지 모를 소리를 낸다.',
              '하얀 구름 속으로 뛰어든다. 부딪히는 것마다 소화기통으로 머리를 친다. 통이 찌그러지고, 팔이 저린다.',
              '구름 밖으로 빠져나와 빈 통을 던져 버린다. 온몸이 밀가루를 뒤집어쓴 것처럼 하얗다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
      {
        id: 'scatter',
        label: '무작정 골목으로 뛴다',
        hint: '각자도생. 늦으면 물린다',
        tags: ['cold'],
        outcomes: [
          {
            when: { companions: ['grandma'] },
            effects: { removeCompanions: ['grandma'], removeItems: ['bike'], hp: -5, mental: -20, hours: 1, setFlags: ['abandonedSomeone'] },
            result: [
              {
                when: { items: ['bike'], noCompanions: ['kongi'] },
                text: '따릉이는 골목 입구에 내던진다. 이 골목들은 페달로는 못 빠진다. 반납은 틀렸다.',
              },
              {
                when: { items: ['bike'], companions: ['kongi'] },
                text: '따릉이는 골목 입구에 내던진다. 바구니에서 콩이를 낚아채 품에 안는다. 반납은 틀렸다.',
              },
              '"흩어져!" 소리치고 뛴다. 몇 걸음 가다 돌아본다. 할머니가 반대쪽 골목으로 방향을 튼다. 느린 걸음으로, 일부러 지팡이로 셔터를 두드리면서.',
              '떼의 절반이 그쪽으로 몰려간다. 골목 끝 슈퍼 셔터가 내려가는 소리. 할머니가 그 안에 들어갔는지는 확인하지 못한다.',
              '살았다. 할머니 덕에. 그 문장이 한동안 입안에서 쓰다.',
            ],
            next: 'c3_checkpoint',
          },
          {
            chance: 0.5,
            effects: { removeItems: ['bike'], hp: -10, mental: -5, hours: 1 },
            result: [
              {
                when: { items: ['bike'], noCompanions: ['kongi'] },
                text: '따릉이는 골목 입구에 내던진다. 이 골목들은 페달로는 못 빠진다. 반납은 틀렸다.',
              },
              {
                when: { items: ['bike'], companions: ['kongi'] },
                text: '따릉이는 골목 입구에 내던진다. 바구니에서 콩이를 낚아채 품에 안는다. 반납은 틀렸다.',
              },
              '골목, 담장, 주차된 트럭 밑. 숨이 턱에 닿도록 뛴다.',
              {
                when: { companions: ['kongi'], noItems: ['bike'] },
                text: '콩이 목줄을 손목에 감고 뛴다. 콩이가 더 빠르다. 거의 끌려간다.',
              },
              {
                when: { companions: ['kongi'], items: ['bike'] },
                text: '콩이가 품 안에서 버둥거린다. 내려 주자 목줄 끝에서 앞장선다. 콩이가 더 빠르다. 거의 끌려간다.',
              },
              {
                when: { anyCompanions: ['minjun', 'rider', 'nurse'] },
                text: '초등학교 담장 앞에서 일행이 하나둘 다시 모인다. 누가 어디로 왔는지 아무도 말하지 않는다. 다 왔다. 그거면 됐다.',
              },
              '담장에 등을 대고 주저앉는다. 숨이 목구멍에서 쇳소리를 낸다. 해는 아직 머리 위다. 담장 너머 강당까지 들어가는 길이 이렇게 멀 줄은 몰랐다.',
            ],
            next: 'c3_dusk',
          },
          {
            effects: { removeItems: ['bike'], hp: -20, mental: -10, infect: true, hours: 1 },
            result: [
              {
                when: { items: ['bike'], noCompanions: ['kongi'] },
                text: '따릉이는 골목 입구에 내던진다. 이 골목들은 페달로는 못 빠진다. 반납은 틀렸다.',
              },
              {
                when: { items: ['bike'], companions: ['kongi'] },
                text: '따릉이는 골목 입구에 내던진다. 바구니에서 콩이를 낚아채 품에 안는다. 반납은 틀렸다.',
              },
              '모퉁이를 도는 순간 정면에서 하나가 튀어나온다. 팔을 들어 막는다. 팔뚝에 이빨이 박힌다.',
              '뿌리치고 뛴다. 소매가 젖어 온다. 보지 않아도 안다.',
              '초등학교 담장이 보인다. 팔이 벌써 뜨겁다.',
            ],
            next: 'c3_dusk',
          },
        ],
      },
      {
        id: 'bait',
        label: '미끼가 되어 떼를 끈다',
        hint: '체력 없으면 못 버틴다',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            when: { companions: ['rider'] },
            effects: { hp: -5, mental: 5, hours: 2 },
            result: [
              '용석이 헬멧 끈을 조인다. "이 동네 골목, 제가 제일 잘 알아요. 30분 배달 보장." 대답하기도 전에 뛰쳐나간다.',
              '떼가 용석의 휘파람을 따라 골목으로 빨려 들어간다. 그 사이 반대쪽으로 뛴다.',
              '초등학교 담장 앞에서 20분을 기다린다. 담 위에서 용석이 떨어진다. 숨이 넘어간다. "…배달 시간, 안 넘겼죠?"',
            ],
            next: 'c3_dusk',
          },
          {
            when: { companions: ['minjun'] },
            effects: { mental: -5, hours: 2 },
            result: [
              '민준이 가방을 벗어 던진다. "오래달리기 1등이라니까요." 말릴 틈도 없이 떼 앞을 가로질러 뛴다. 수능 D-48의 다리가 아스팔트를 박찬다.',
              '담장 밑에서 기다리는 30분이 서른 시간 같다. 그러다 골목 끝에서 절뚝이는 실루엣이 나타난다. 무릎이 까졌다. 이빨 자국은 없다.',
              '"체력장 만점 받을걸." 민준이 웃는다. 웃는 얼굴이 하얗게 질려 있다. 등을 한 번 세게 두드려 준다. 그 이상은 말이 안 나온다.',
            ],
            next: 'c3_dusk',
          },
          {
            when: { max: { hp: 30 } },
            effects: { hp: -30, hours: 1 },
            result: [
              '직접 뛰쳐나간다. 소리를 지르며 반대쪽 골목으로. 떼가 따라온다. 좋다.',
              '세 번째 골목에서 다리가 풀린다. 이미 바닥난 몸이었다. 담장을 넘으려고 뻗은 손이 미끄러진다.',
              '마지막으로 떠오르는 건 대피소 강당의 불빛이다. 저기까지였는데.',
            ],
            next: 'end:dead',
          },
          {
            chance: 0.5,
            effects: { hp: -15, mental: 10, hours: 2, setFlags: ['savedStranger'] },
            result: [
              '직접 뛰쳐나간다. 버스정류장 광고판을 발로 차며 소리를 지른다. 떼의 고개가 일제히 이쪽으로 돌아간다. 정류장 부스 뒤에 숨어 있던 사람들이 그 틈에 빠져나간다.',
              '골목 세 개, 담장 두 개, 편의점 파라솔 하나. 폐가 터질 것 같다. 떼가 방향을 잃는다.',
              {
                when: { anyCompanions: ['kongi', 'grandma', 'minjun', 'nurse'] },
                text: '강변 쪽 약속 장소에서 일행이 기다리고 있다. 다들 무사하다. 그걸로 폐가 조금 덜 아프다.',
              },
            ],
            next: 'c3_checkpoint',
          },
          {
            effects: { hp: -25, mental: -5, hours: 2 },
            result: [
              '직접 뛰쳐나간다. 떼가 따라온다. 너무 잘 따라온다.',
              '막다른 골목. 쓰레기통을 밟고 담장을 넘는다. 바지가 찢어지고, 정강이가 찢어진다. 담 너머로 굴러떨어진다.',
              '살았다. 겨우. 담 너머는 강변 쪽이다.',
            ],
            next: 'c3_checkpoint',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 검문소·주유소 ───────────────────────────────
  c3_checkpoint: {
    id: 'c3_checkpoint',
    chapter: 3,
    location: 'checkpoint',
    scene: 'checkpoint',
    title: '강변 검문소',
    alert: {
      kind: 'radio',
      from: '국군 재난방송',
      text: '관내 초등학교 임시 대피소는 자정에 정문을 폐쇄합니다. 이후 도착 인원은 강변 검문소 통제에 따르십시오. 반복합니다.',
    },
    body: [
      '강변 진입로. 군 트럭 두 대와 철조망. 탐조등은 아직 꺼져 있다. 발전기를 아끼는 모양이다.',
      '검문소 옆 셀프주유소는 무인이다. 주유기 화면엔 "카드를 넣어 주세요". 넣을 카드는 있다. 받아 줄 은행이 없을 뿐.',
      '철조망 바깥 벤치에 군복 입은 청년이 앉아 있다. 계급장은 병장. 총은 없다. 빈 담뱃갑만 만지작거린다.',
      {
        when: { flags: ['c3_drove'] },
        text: '차는 진입로 앞에 세워 둔다. 버려진 버스 두 대가 길을 막았다. 여기서부터는 걸어야 한다. 차 키는 주머니에.',
      },
    ],
    choices: [
      {
        id: 'fuel',
        label: '주유기에서 기름을 뺀다',
        hint: '기름 냄새는 멀리 간다',
        tags: ['careful', 'cold'],
        outcomes: [
          {
            chance: 0.6,
            effects: { addItems: ['fuel'], hours: 1 },
            result: [
              '주유기 옆 비상 수동 레버를 찾는다. 세차장 물통에 휘발유를 받는다. 콸콸 소리가 너무 크게 들린다.',
              '한 통 가득. 무겁고, 냄새가 지독하다. 차가 있다면 멀리 간다. 없다면, 불이다.',
              {
                when: { items: ['carKey'] },
                text: '주머니 속 차 키가 짤랑거린다. 반 칸에 한 통. 서울을 빠져나갈 수 있는 양이다.',
              },
            ],
            next: 'c3_dusk',
          },
          {
            effects: { addItems: ['fuel'], hp: -10, mental: -5, hours: 1 },
            result: [
              '레버를 당기는 순간 주유기가 삐익 삐익 운다. "셀프 주유 오류. 직원을 호출합니다." 직원은 없다. 다른 것들이 온다.',
              '반쯤 찬 통을 들고 뛴다. 휘발유가 바지에 튄다. 벤치의 병장이 벌떡 일어나 소리친다. "그쪽 말고 왼쪽!"',
              '왼쪽으로 뛴다. 산다.',
            ],
            next: 'c3_dusk',
          },
        ],
      },
      {
        id: 'soldier',
        label: '병장에게 말을 건다',
        hint: '군인이다. 명령은 끊겼다',
        tags: ['kind'],
        outcomes: [
          {
            when: { items: ['radio'] },
            effects: { addCompanions: ['soldier'], mental: 10, hours: 1, setFlags: ['knowsBroadcast'] },
            result: [
              '무전기를 본 병장의 눈빛이 바뀐다. "그거 잠깐만요." 채널을 몇 번 돌리더니 군 재난망을 잡는다.',
              {
                when: { noFlags: ['knowsBroadcast'] },
                text: '"잠실 종합운동장 헬기 거점, 인천항 해군 수송선. 이거 민간엔 아직 안 풀렸어요."',
              },
              {
                when: { flags: ['knowsBroadcast'] },
                text: '간밤에 들었던 그 이름들이 흘러나온다. 잠실, 인천. 병장이 고개를 끄덕인다. "그거 진짜예요. 루머 아니에요." 반신반의하던 게 처음으로 믿긴다.',
              },
              '병장이 벤치에서 일어난다. "김 병장입니다. 전역 D-30. 복귀 명령이 안 와요. 그럼 제 맘대로 해도 되는 거죠."',
            ],
            next: 'c3_dusk',
          },
          {
            chance: 0.5,
            effects: { addCompanions: ['soldier'], mental: 5, hours: 1 },
            result: [
              '"부대 복귀 명령만 18시간째 기다리는 중이에요." 병장이 빈 담뱃갑을 구긴다. "전역 D-30인데."',
              '한참 강을 보다가 일어선다. "대피소까지 모셔다 드릴게요. 그게 제 마지막 임무인 걸로 하죠. 김 병장입니다."',
            ],
            next: 'c3_dusk',
          },
          {
            effects: { mental: 5, hours: 1, setFlags: ['c3_soldierTip'] },
            result: [
              '"여기 있으라는 게 마지막 명령이라서요." 병장이 고개를 젓는다. 규정 앞에서 사람이 작아진다.',
              '대신 목소리를 낮춘다. "대피소 정문 줄, 세 시간 걸려요. 급식실 쪽 뒷문이 있어요. 제가 말했다고 하지 마시고."',
            ],
            next: 'c3_dusk',
          },
        ],
      },
      {
        id: 'official',
        label: '검문소에 대피를 요청한다',
        hint: '공식 루트다. 검사가 있다',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 2 },
            result: [
              '체온계가 이마에 닿는다. 삑. 38.9. 군인의 표정이 굳는다. 소매를 걷으라고 한다.',
              '그다음은 빠르다. 방호복, 들것, 철창이 달린 트럭. 발버둥 칠 기운도 없다.',
              {
                when: { companions: ['kongi'] },
                text: '마지막으로 보이는 건 철조망 너머에서 짖는 콩이다. 군인 하나가 목줄을 잡고 쪼그려 앉는다. 쓰다듬는다. 그거면 됐다.',
              },
            ],
            next: 'end:quarantine',
          },
          {
            effects: { hp: 5, supply: 5, mental: 10, hours: 2 },
            result: [
              '체온계가 이마에 닿는다. 삑. 36.6. 군인이 고개를 끄덕인다. "저쪽 길로. 뛰지 마시고, 소리 내지 마시고."',
              '생수 한 병과 건빵 한 봉지를 받는다. 봉지 안에 별사탕이 들어 있다. 이게 뭐라고 눈물이 핑 돈다.',
            ],
            next: 'c3_dusk',
          },
        ],
      },
      {
        id: 'tune',
        label: '무전 주파수를 맞춘다',
        hint: '정보가 곧 생존이다',
        requires: { items: ['radio'] },
        lockedHint: '무전기가 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['knowsBroadcast'] },
            effects: { mental: 10, hours: 1 },
            result: [
              '벤치 뒤에 쪼그려 앉아 다이얼을 돌린다. 잡음, 잡음, 트로트, 잡음. 그리고 간밤에 들었던 그 이름들.',
              '"…잠실 구조 헬기 거점 운영 중…" 여전하다. 밤사이 사라지지 않았다. 헛소문이 아니었다는 것만으로 어깨가 조금 내려간다.',
            ],
            next: 'c3_dusk',
          },
          {
            effects: { mental: 5, hours: 1, setFlags: ['knowsBroadcast'] },
            result: [
              '벤치 뒤에 쪼그려 앉아 다이얼을 돌린다. 잡음, 잡음, 트로트, 잡음. 그리고 딱딱한 목소리.',
              '"…잠실 종합운동장 구조 헬기 거점 운영 중… 인천항 해군 수송선 탑승 대기… 반복한다…" 손바닥에 받아 적는다.',
              '대피소에 가면 이걸 아는 사람이 몇이나 될까. 모르는 편이 나을까.',
            ],
            next: 'c3_dusk',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 대피소 앞 ───────────────────────────────
  c3_dusk: {
    id: 'c3_dusk',
    chapter: 3,
    location: 'shelter',
    scene: 'street_chaos',
    title: '강당 불빛',
    clock: 44,
    body: [
      '강당까지 남은 길은 얼마 안 됐다. 그런데 큰길은 떼가 막고, 골목은 바리케이드가 막았다. 담장 그늘에 숨어 발소리가 지나가길 기다리고, 돌아가고, 또 숨었다. 그렇게 오후가 통째로 사라졌다.',
      '해가 졌다. 강당 창문이 희미하게 빛난다. 후문 담장을 따라 줄이 두 겹으로 섰다. 여기선 명부만 받고, 신체검사는 정문에서 따로 한단다. 줄을 서기 위한 줄이다. 밤이면 저것들은 더 빨라지는데, 줄은 한 뼘씩 준다.',
      {
        when: { infected: false },
        text: '확성기가 운다. "명부 먼저! 가방 열고! 물린 데 있으면 먼저 말씀하세요!" 앞사람이 괜히 소매를 걷어 보인다.',
      },
      {
        when: { infected: true },
        text: '확성기가 운다. "물린 데 있으면 먼저 말씀하세요!" 열 때문에 그 소리가 물속처럼 먹먹하다. 상처가 맥박에 맞춰 욱신거린다.',
      },
      {
        when: { companions: ['soldier'] },
        text: '김 병장이 정문 쪽 군인들을 보더니 모자를 푹 눌러쓴다. "탈영 아니고 자율 복귀 중입니다. 대충 그렇습니다."',
      },
      {
        when: { companions: ['kongi'] },
        text: '앞사람 이동장 속에서 고양이가 운다. 누군가 혀를 찬다. 콩이가 품으로 파고든다.',
      },
      {
        when: { flags: ['c3_soldierTip'] },
        text: '병장 말이 떠오른다. 급식실 쪽 뒷문.',
      },
    ],
    choices: [
      {
        id: 'queue',
        label: '줄을 서서 기다린다',
        hint: '정직하게, 오래',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            effects: { mental: -10, hours: 2, setFlags: ['hiddenBite'] },
            result: [
              '소매를 끝까지 끌어내린다. 앞사람들이 하나씩 명부에 이름을 적는다. 명부 담당은 지쳤다. 가방만 본다.',
              '"물린 데 없죠?" "…네." 목소리가 생각보다 멀쩡하다. 그게 더 무섭다.',
              '진짜 검사는 정문에서라고 한다. 두 시간 뒤다. 거짓말을 두 시간 더 버텨야 한다.',
            ],
            next: 'c4_start',
          },
          {
            effects: { mental: 5, hours: 2 },
            result: [
              '두 시간을 선다. 앞뒤 사람들과 어디서 왔는지 이야기한다. 다들 비슷한 하루였다. 다들 누군가를 두고 왔다.',
              '명부에 이름을 적자 손등에 매직으로 동그라미를 그려 준다. "정문 가서 이거 보여 주세요. 검사는 거기서." 줄은 끝난 게 아니라 옮겨 갔을 뿐이다. 담 너머로 난로 냄새가 넘어온다.',
            ],
            next: 'c4_start',
          },
        ],
      },
      {
        id: 'backdoor',
        label: '뒷문으로 들어간다',
        hint: '명부 줄은 건너뛴다',
        tags: ['cold', 'meme'],
        outcomes: [
          {
            when: { infected: true },
            effects: { mental: -5, hours: 1, setFlags: ['hiddenBite'] },
            result: [
              '담을 따라 돌아 급식실 뒷문을 찾는다. 검사도, 체온계도 없다. 지금 이 몸엔 그게 다행이다.',
              '배식대 뒤 구석에 쪼그려 앉아 숨을 고른다. 이마가 불덩이다. 순찰 손전등에 걸려 "줄 서세요!" 소리와 함께 정문 쪽으로 쫓겨난다. 상처는 아무도 못 봤다. 아직은.',
            ],
            next: 'c4_start',
          },
          {
            when: { flags: ['c3_soldierTip'] },
            effects: { supply: 10, mental: 5, hours: 1 },
            result: [
              '급식실 뒷문. 병장 말대로 빗장이 반쯤 풀려 있다. 안에선 조리실 이모님이 솥을 젓고 있다.',
              '"줄 안 섰제?" 들켰다. "…밥은 묵었나?" 국 한 그릇이 먼저 나온다. 병장 이야기는 끝까지 하지 않는다.',
              '엄마랑 똑같은 억양이다. 국물을 한 숟갈 뜨다가, 목이 막혀서 한참을 못 삼킨다.',
              '"다 묵었으면 정문 가서 줄 서래이. 밥은 줘도 검사는 몬 빼 준다." 빈 그릇을 받아 가는 손까지 엄마 같다.',
            ],
            next: 'c4_start',
          },
          {
            chance: 0.5,
            effects: { supply: 10, hours: 1 },
            result: [
              '담을 따라 돌다 급식실 뒷문을 찾는다. 열려 있다. 조리실 이모님과 눈이 마주친다.',
              '한참을 보더니 턱짓으로 들어오라 한다. "새치기한 거 아무한테도 말하지 마." 국 한 그릇이 나온다.',
              '"다 먹었으면 정문 줄로 가. 밥은 줘도 검사는 못 빼 줘." 규정은 국그릇보다 단단하다.',
            ],
            next: 'c4_start',
          },
          {
            effects: { hp: -15, mental: -5, hours: 1 },
            result: [
              '뒷문 옆 쓰레기장. 음식물 통 사이에서 뭔가 일어선다. 급식실 앞치마를 두른 채.',
              '문을 몸으로 밀고 들어가 닫는다. 어깨가 빠질 것 같다. 복도 끝에서 누군가 소리친다. "거기 누구예요!"',
              '운영위원 둘에게 양팔을 잡혀 정문 줄 맨 뒤로 끌려간다. 새치기 벌칙은 줄 맨 뒤. 초등학교다운 벌이다.',
            ],
            next: 'c4_start',
          },
        ],
      },
      {
        id: 'help',
        label: '줄 선 사람들을 돕는다',
        hint: '짐을 든다. 체력이 든다',
        tags: ['kind'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hp: -10, mental: -5, hours: 2, setFlags: ['hiddenBite'] },
            result: [
              '노부부의 보따리를 대신 든다. 팔이 욱신거린다. 물린 쪽 팔이다. 반대쪽으로 바꿔 든다.',
              '운영위원이 다가와 체온계를 이마에 댄다. 삑. 38.4. "어머, 열이 좀 있으시네. 짐 나르느라 그런가 보다. 정문 가시면 앞쪽으로 넣어 드릴게요."',
              '고개를 끄덕인다. 선의가 첫 번째 검사를 대신했다. 두 번째는 정문에 있다. 그쪽으로 가는 발이 무겁다.',
            ],
            next: 'c4_start',
          },
          {
            effects: { hp: -5, mental: 15, hours: 2 },
            result: [
              '보따리를 든 노부부, 아이 둘을 안은 아빠, 휠체어 탄 청년. 짐을 나르고 줄을 정리한다. 누가 시킨 것도 아닌데.',
              {
                when: { companions: ['grandma'] },
                text: '할머니는 벌써 줄 선 아주머니들과 김장 얘기를 하고 있다. 종말도 김장철은 못 이긴다.',
              },
              {
                when: { companions: ['nurse'] },
                text: '정지수가 줄을 따라 걸으며 상처 난 사람들을 하나하나 본다. 퇴근은 또 미뤄졌다.',
              },
              '확성기를 든 운영위원이 다가와 이름을 묻는다. "이런 분이 안에 필요해요. 정문 가시면 앞쪽으로 넣어 드릴게요."',
            ],
            next: 'c4_start',
          },
        ],
      },
      {
        id: 'confess',
        label: '물린 걸 먼저 말한다',
        hint: '살 길일지도 모른다',
        requires: { infected: true },
        tags: ['kind'],
        outcomes: [
          {
            effects: { mental: 10, hours: 1 },
            result: [
              '줄에서 빠져나와 손을 든다. "저 물렸어요." 주변이 순식간에 비워진다. 동그랗게.',
              '검사원이 무전을 친다. 오 분 뒤 군 트럭이 온다. 철창 달린. 등 뒤에서 누군가 "용기 있네요"라고 말한다. 칭찬인지 조문인지 모르겠다.',
            ],
            next: 'end:quarantine',
          },
        ],
      },
    ],
  },
};
