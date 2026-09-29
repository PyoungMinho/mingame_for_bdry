import type { Condition, StoryNode } from '../types';

/**
 * 4장 "생존자들" — D+1 22:00 ~ D+2 20:00
 * 초등학교 대피소 입소 → 강당의 밤(콩이 재회 / 철문 밖 가족) → 배급 회의 → 물린 사람
 * → 강변 검문소(김 병장·군 방송·통행증) → 약탈자 트럭 → 대피소 붕괴 → 최종 목적지 결정
 *
 * 챕터 로컬 플래그(c4_):
 *  c4_dogHidden   콩이를 강당 안에 몰래 들였다
 *  c4_kongiShed   콩이가 운동장 체육 창고에 있다
 *  c4_guardDog    콩이가 대피소 공식 경보견이 됐다
 *  c4_reunited    대피소 밖에서 콩이와 재회했다 (leftDog 루트)
 *  c4_sneaked     검사를 건너뛰고 뒷담을 넘었다
 *  c4_nightWatch  첫날 밤 불침번을 섰다
 *  c4_knowsStorage 식량 창고 위치를 안다
 *  c4_suspect     운영위에 찍혔다
 *  c4_celebrity   "그 영상 올린 사람"으로 유명해졌다
 *  c4_savedChild  철문 밖 아이만 받았다
 *  c4_leaderTrust 문을 열지 않아 교감의 신임을 얻었다
 *  c4_votedElder / c4_workCrew / c4_speech  배급 회의 선택
 *  c4_toldLeader / c4_letOut / c4_didIt / c4_nurseCare  물린 사람 처리 방식
 *  c4_riderMap    용석이 인천항 가는 지도를 남겼다
 *  c4_nurseWatch  간호사가 물린 사실을 알고 곁을 지킨다
 *  c4_ramenTrade / c4_raiderIntel / c4_repelled  약탈자 대응
 */

/**
 * 콩이와 떨어진 채 대피소에 왔다 → 첫날 밤 재회 장면으로.
 * 1~3장에서 콩이가 빠지는 경로는 둘뿐이다:
 *  - 1장 집에 두고 떠남(leftDog)
 *  - 2B 대피 버스 앞에서 SUV 아이에게 맡김 — 그 가족은 "초등학교 대피소"로 갔다(2B 본문).
 *    챕터 로컬 플래그(c2b_dogGiven)를 읽지 않고 "콩이 없음 + leftDog 아님"으로 판별한다.
 */
const REUNION: Condition = { noCompanions: ['kongi'] };
/** 2B 에서 아이에게 맡긴 경우 */
const GIVEN: Condition = { noCompanions: ['kongi'], noFlags: ['leftDog'] };

export const c4: Record<string, StoryNode> = {
  // ─────────────────────────────── 1. 입소 검사 ───────────────────────────────
  c4_start: {
    id: 'c4_start',
    chapter: 4,
    location: 'shelter',
    scene: 'checkpoint',
    title: '입소 검사',
    clock: 46,
    alert: {
      kind: 'disaster',
      from: '서울특별시',
      text: '[서울특별시] 강북구 ○○초등학교 임시대피소 운영 중. 입소 시 신체검사 필수. 발열·상처가 있는 분은 별도 격리됩니다.',
    },
    body: [
      '밤 10시. 초등학교 정문 앞 줄이 운동장 끝까지 늘어져 있다. 탐조등이 줄을 훑고 지나갈 때마다 누군가 손등으로 눈을 가린다.',
      { when: { flags: ['stayedHome'] }, text: '어젯밤까지는 12층이 세상의 전부였다. 하루 만에 서울 한복판을 가로질러 여기까지 왔다. 다리가 그 거리를 전부 기억한다.' },
      { when: { flags: ['evacuated'] }, text: '대피 버스 줄에서 봤던 얼굴이 몇 보인다. 구민회관으로 간다던 사람들이다. 다들 돌고 돌아 같은 운동장으로 흘러왔다.' },
      '입구엔 군인 둘, 그리고 형광 조끼 등판에 매직으로 "운영위원장"이라 쓴 남자. 이마에 체온계, 소매 걷기, 목덜미 확인. 앞사람이 팔 안쪽을 보이다가 운동장 구석 흰 텐트로 끌려간다.',
      { when: { companions: ['kongi'] }, text: '"개는 안 됩니다." 앞줄에서 푸들을 안은 사람이 옆으로 밀려난다. 품 안의 콩이가 귀를 납작하게 눕힌다.' },
      { when: GIVEN, text: '정문 옆 철창에서 개 몇 마리가 짖는다. 그중 한 목소리가 이상하게 귀에 걸린다. 돌아보려는데 탐조등이 지나가고, 줄이 앞으로 밀린다.' },
      { when: { infected: true }, text: '팔의 상처가 욱신거린다. 오는 길에 소매 끝을 찢어 칭칭 감아 둔 자리, 그 붕대 밑이 뜨겁다. 체온계는 세 사람 앞에 있다.' },
    ],
    choices: [
      {
        id: 'inspect',
        label: '소매를 걷고 검사받는다',
        hint: '정석이지만 숨길 수 없다',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            effects: { mental: -10, hours: 1 },
            result: [
              '체온계가 삑 울린다. 37.9. 군인이 소매를 걷자 붕대가 드러나고, 줄 전체가 한 발짝 뒤로 물러난다.',
              '"이쪽으로 오시죠." 말투가 갑자기 정중해진다. 대학병원 수납 창구 말투다.',
            ],
            next: 'c4_isolation',
          },
          {
            when: { companions: ['kongi'] },
            effects: { hours: 1 },
            result: [
              '체온 36.5. 팔도 목도 깨끗하다. 위원장이 고개를 끄덕이다가 발밑을 내려다본다.',
              '"아, 개는 안 돼요. 규정이에요."',
            ],
            next: 'c4_dog_gate',
          },
          {
            effects: { mental: 5, hours: 1 },
            result: [
              '체온 36.5. 팔도 목도 깨끗하다. 위원장이 담요 한 장과 번호표를 건넨다. 147번.',
              '"화장실은 복도 끝, 소등은 11시. 떠들면 나가셔야 합니다." 이 와중에 학교 규칙 같은 말투다.',
            ],
            next: 'c4_hall',
          },
        ],
      },
      {
        id: 'hide_bite',
        label: '상처를 붕대째 숨긴다',
        hint: '들키면 그대로 끝이다',
        requires: { infected: true },
        tags: ['cold'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            chance: 0.5,
            effects: { mental: -10, setFlags: ['hiddenBite'], hours: 1 },
            result: [
              '반대쪽 소매만 걷는다. 체온계가 삑. 37.4. 군인이 한 번 더 쏜다. "밖이 추워서요." 입이 먼저 움직인다.',
              '통과. 등줄기로 식은땀이 흐른다. 그런데 위원장 눈이 이번엔 콩이에게 가 있다.',
            ],
            next: 'c4_dog_gate',
          },
          {
            when: { companions: ['kongi'] },
            effects: { mental: -15, hours: 1 },
            result: [
              '콩이가 상처 난 팔에 코를 박고 낑낑댄다. 하필 지금. 군인의 시선이 콩이를 따라 팔로 내려온다.',
              '"소매, 이쪽도 걷어 보세요." 붕대가 드러난다. 누구도 소리 지르지 않는다. 다들 조용히 물러설 뿐이다.',
            ],
            next: 'c4_isolation',
          },
          {
            chance: 0.5,
            effects: { mental: -10, setFlags: ['hiddenBite'], hours: 1 },
            result: [
              '반대쪽 소매만 걷는다. 체온계가 삑. 37.4. 군인이 한 번 더 쏜다. "밖이 추워서요." 입이 먼저 움직인다.',
              '통과. 번호표 147번을 받아 드는 손이 떨린다. 떨림도 추위 탓이라고 하면 된다.',
            ],
            next: 'c4_hall',
          },
          {
            effects: { mental: -15, hours: 1 },
            result: [
              '체온계가 삑. 38.1. 군인이 말없이 반대쪽 소매까지 걷는다. 붕대 끝의 검붉은 얼룩.',
              '"...이쪽으로." 줄 뒤에서 누가 "저 사람 물렸대" 하고 속삭인다. 소문은 좀비보다 빠르다.',
            ],
            next: 'c4_isolation',
          },
        ],
      },
      {
        id: 'confess',
        label: '먼저 물린 걸 털어놓는다',
        hint: '정직의 대가는 철창',
        requires: { infected: true },
        tags: ['kind', 'careful'],
        outcomes: [
          {
            effects: { mental: 5, hours: 1 },
            result: [
              '줄 밖으로 나와 붕대를 푼다. 군인이 반사적으로 총구를 든다. 위원장이 그 총구를 손으로 지그시 누른다.',
              '"...말해 줘서 고마워요." 이 난리가 터진 뒤 처음 듣는 고맙다는 말이다.',
            ],
            next: 'c4_isolation',
          },
        ],
      },
      {
        id: 'wall',
        label: '뒷담을 넘어 몰래 들어간다',
        hint: '검사는 없지만 철사가 있다',
        tags: ['brave'],
        outcomes: [
          {
            when: { infected: true },
            chance: 0.6,
            effects: { hp: -12, setFlags: ['hiddenBite', 'c4_sneaked', 'c4_dogHidden'], hours: 1 },
            result: [
              '급식실 뒤 담장. 가시철사를 옷소매로 감고 넘는다. 물린 팔이 철사에 한 번 더 긁힌다. 이를 악문다.',
              { when: { companions: ['kongi'] }, text: '담 위에서 몸을 돌려 콩이를 화단으로 받아 내린다. 짖지 않는다. 이런 때만 착하다.' },
              { when: { companions: ['grandma'] }, text: '1203호 할머니는 잔반통을 딛고 올라선다. 담 위에서 손을 잡아 끌어 넘긴다. "내 칠십 평생 담치기는 처음이여."' },
              '아무도 모른다. 이 팔에 대해서는, 이제 아무도.',
            ],
            next: 'c4_hall',
          },
          {
            when: { infected: true },
            effects: { hp: -15, mental: -10, hours: 1 },
            result: [
              '철사에 소매가 걸린다. 버둥대는 사이 붕대가 풀려 담장 위에 매달린다. 하얀 깃발처럼.',
              '손전등 세 개가 동시에 이쪽을 비춘다. 누가 붕대를 집어 들고 냄새를 맡더니 얼굴을 구긴다. "...물린 사람이다."',
              { when: { companions: ['kongi'] }, text: '담 안쪽 화단에서 콩이가 미친 듯 짖는다. 손전등 하나가 그쪽으로 돌아간다.' },
            ],
            next: 'c4_isolation',
          },
          {
            chance: 0.6,
            effects: { hp: -5, setFlags: ['c4_sneaked', 'c4_dogHidden'], hours: 1 },
            result: [
              '급식실 뒤 담장. 가시철사를 점퍼로 덮고 한 번에 넘는다. 착지한 곳은 잔반통 옆이다. 냄새는 최악, 결과는 최고.',
              { when: { companions: ['kongi'] }, text: '담 위에서 몸을 돌려 콩이를 받아 내린다. 짖지 않는다. 검사도 규정도 콩이에겐 해당 없다.' },
              { when: { companions: ['grandma'] }, text: '1203호 할머니는 잔반통을 딛고 올라선다. 담 위에서 손을 잡아 끌어 넘긴다. "내 칠십 평생 담치기는 처음이여."' },
            ],
            next: 'c4_hall',
          },
          {
            effects: { hp: -15, mental: -5, setFlags: ['c4_sneaked', 'c4_dogHidden'], hours: 1 },
            result: [
              '바짓단이 철사에 걸린다. 매달린 채 버둥대다 떨어진다. 허벅지에 길게 긁힌 자국, 옷은 너덜너덜.',
              { when: { companions: ['kongi'] }, text: '먼저 넘어간 콩이가 쓰러진 얼굴을 핥는다. 놀란 눈이다.' },
              { when: { companions: ['grandma'] }, text: '1203호 할머니는 잔반통을 딛고 담에 올라, 누가 도와줄 새도 없이 엉덩이로 미끄러져 내려온다. "내 칠십 평생 담치기는 처음이여." 할머니가 나보다 멀쩡하다.' },
              '그래도 떨어진 곳은 담 안쪽이다. 절뚝이며 강당 뒷문으로 스며든다.',
            ],
            next: 'c4_hall',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 1-a. 격리 텐트 ───────────────────────────────
  c4_isolation: {
    id: 'c4_isolation',
    chapter: 4,
    location: 'shelter',
    scene: 'checkpoint',
    title: '흰 텐트',
    body: [
      '운동장 구석 흰 텐트. 간이침대 여섯 개 중 넷이 차 있다. 아무도 서로를 보지 않는다.',
      '입구엔 병사 하나가 의자에 앉아 있다. 스무 살이나 됐을까. 무릎 위 소총을 쥔 손가락이 계속 떨린다.',
      '"내일 아침 군 격리시설로 이송합니다. 거기선... 치료제 연구도 한대요." 본인도 안 믿는 목소리다.',
      { when: { companions: ['kongi'] }, text: '텐트 밖 말뚝에 콩이가 묶여 있다. 천막 너머로 낑낑대는 소리가 끊이지 않는다.' },
    ],
    choices: [
      {
        id: 'accept',
        label: '이송을 받아들인다',
        hint: '살지만 자유는 없다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: 5, hours: 2 },
            result: [
              '간이침대에 눕는다. 천막이 바람에 부풀었다 꺼진다. 숨 쉬는 것 같다.',
              { when: { companions: ['kongi'] }, text: '병사에게 부탁한다. "밖에 묶인 개, 이름은 콩이예요. 천둥 치면 이불 속에 들어가요." 병사가 수첩에 받아 적는다. 콩, 이. 약속을 지킬 얼굴이다.' },
              '살아서 철창에 들어가는 것도 선택이라면, 오늘은 그걸 고른다.',
            ],
            next: 'end:quarantine',
          },
        ],
      },
      {
        id: 'escape',
        label: '텐트 뒤 철조망을 넘는다',
        hint: '들키면 총구가 돌아온다',
        tags: ['brave'],
        outcomes: [
          {
            chance: 0.5,
            effects: { hp: -12, mental: -5, setFlags: ['hiddenBite', 'c4_dogHidden', 'c4_sneaked'], hours: 1 },
            result: [
              '병사가 꾸벅 조는 틈. 텐트 자락을 들추고 기어 나온다. 철조망에 손바닥이 찢긴다. 소리는 안 낸다.',
              { when: { companions: ['kongi'] }, text: '말뚝에서 콩이 줄을 푼다. 콩이가 품에 파고든다. 강당 뒷문까지 스물세 걸음.' },
              '강당 매트 이백 장 사이에 섞이면 아무도 모른다. 적어도 열이 오르기 전까지는.',
            ],
            next: 'c4_hall',
          },
          {
            effects: { hp: -15, mental: -10, hours: 2 },
            result: [
              '철조망에 걸린 소매를 떼어 내는 사이, 탐조등이 정확히 등에 멈춘다.',
              '"엎드려!" 개머리판이 어깨를 찍는다. 이번엔 텐트가 아니라 트럭 짐칸이다. 손목엔 케이블타이.',
            ],
            next: 'end:quarantine',
          },
        ],
      },
      {
        id: 'nurse',
        label: '간호사에게 상처를 보인다',
        hint: '마지막 시간을 번다',
        requires: { companions: ['nurse'] },
        lockedHint: '간호사가 곁에 있었다면…',
        tags: ['kind', 'careful'],
        outcomes: [
          {
            effects: { mental: 10, hp: 5, setFlags: ['c4_nurseWatch', 'c4_dogHidden'], hours: 2 },
            result: [
              '정지수 간호사가 병사 앞에 선다. 병원 사원증을 내민다. "발열 전 단계예요. 격리해도 의미 없어요. 제가 옆에서 봅니다. 제 책임이에요."',
              '병사가 한참 사원증을 보다가 비켜선다. 지수가 해열제와 새 붕대를 건넨다.',
              { when: { companions: ['kongi'] }, text: '나오는 길에 지수가 말뚝에서 콩이 줄까지 푼다. 병사가 뭐라 하기 전에 먼저 말한다. "치료 보조견이에요." 병사는 더 묻지 않는다.' },
              '"39도 넘으면 저한테 제일 먼저 말해요. 그땐... 제가 할게요." 목소리가 흔들리지 않는다. 그게 고맙다.',
            ],
            next: 'c4_hall',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 1-b. 개는 안 됩니다 ───────────────────────────────
  c4_dog_gate: {
    id: 'c4_dog_gate',
    chapter: 4,
    location: 'shelter',
    scene: 'dog_kongi',
    title: '개는 안 됩니다',
    body: [
      '"규정이에요. 알레르기 있는 분도 있고, 짖으면 저것들이 몰려와요." 위원장 말이 틀린 건 아니다. 그래서 더 답답하다.',
      '정문 옆 철창엔 이미 개 세 마리. 누가 두고 간 사료 봉지가 이슬에 젖어 있다. 콩이가 발등 위로 올라와 앉는다. 접힌 귀가 파르르 떨린다.',
      { when: { flags: ['smuggledDog'], noFlags: ['c2b_walked'] }, text: '대피 버스에서도 이랬다. 그때도 가방 하나였고, 콩이는 숨죽이는 법을 배웠다.' },
      { when: { flags: ['smuggledDog', 'c2b_walked'] }, text: '대피 버스에서도 이랬다. 그때도 가방 하나였고, 결국 둘이서 내려야 했다. 이번엔 내릴 버스도 없다.' },
    ],
    choices: [
      {
        id: 'backpack',
        label: '백팩에 넣어 몰래 들인다',
        hint: '한 번 짖으면 들킨다',
        tags: ['dog', 'careful'],
        outcomes: [
          {
            when: { flags: ['smuggledDog'] },
            effects: { mental: 5, setFlags: ['c4_dogHidden'], hours: 1 },
            result: [
              '한 번 해 본 일이다. 지퍼를 콩이 코끝만 남기고 닫는다. 콩이도 안다. 가방 속에서 숨소리까지 줄인다.',
              '검사대를 지나 강당 문턱을 넘는다. 경력직 밀반입이다.',
            ],
            next: 'c4_hall',
          },
          {
            chance: 0.5,
            effects: { setFlags: ['c4_dogHidden'], hours: 1 },
            result: [
              '화장실 가는 척 줄에서 빠져 콩이를 백팩에 넣는다. 지퍼 틈으로 코끝만 내놓은 콩이가 숨을 참는 것 같다. 개가 숨을 참을 줄 아는지는 모르겠다.',
              '검사대 앞에서 가방이 한 번 꿈틀한다. 기침으로 덮는다. 통과.',
            ],
            next: 'c4_hall',
          },
          {
            effects: { mental: -10, setFlags: ['c4_kongiShed'], hours: 1 },
            result: [
              '검사대 앞에서 가방이 낑, 하고 운다. 위원장이 한숨을 쉰다. "...가방 열어 보세요."',
              '타협안은 운동장 체육 창고다. 뜀틀과 매트 사이에 콩이를 앉힌다. 문이 닫히는데 콩이가 짖지 않는다. 그게 더 아프다.',
            ],
            next: 'c4_hall',
          },
        ],
      },
      {
        id: 'persuade',
        label: '경보견으로 쓰자고 설득한다',
        hint: '말발이 필요하다',
        tags: ['brave', 'dog'],
        outcomes: [
          {
            when: { companions: ['grandma'] },
            effects: { mental: 10, setFlags: ['c4_guardDog'], hours: 1 },
            result: [
              '말을 꺼내기도 전에 1203호 할머니가 나선다. "이 개가 저것들 냄새를 제일 먼저 맡아. 우리 층 사람 여럿 이 개 덕에 살았어."',
              '위원장이 할머니를 보고, 콩이를 보고, 다시 할머니를 본다. 노인 공경은 이 사람 인생의 규정이다. "...정문 불침번 옆에 두세요."',
            ],
            next: 'c4_hall',
          },
          {
            when: { companions: ['soldier'] },
            effects: { mental: 10, setFlags: ['c4_guardDog'], hours: 1 },
            result: [
              '김 병장이 경례부터 붙인다. "군견도 경계 근무 섭니다. 소형견은 청각이 더 좋습니다." 반은 지어낸 말이다.',
              '군인 말이라 그런지 위원장이 수긍한다. 콩이는 오늘부로 대피소 경보견이다. 계급은 아마 이병.',
            ],
            next: 'c4_hall',
          },
          {
            when: { items: ['dogfood'] },
            chance: 0.8,
            effects: { mental: 10, setFlags: ['c4_guardDog'], hours: 1 },
            result: [
              '가방에서 연어맛 사료 한 포대를 꺼내 검사대 위에 올린다. "얘 밥은 얘가 가져왔어요. 배급 한 톨 안 축냅니다. 대신 밤에 저것들 냄새 맡으면 제일 먼저 짖어요."',
              '위원장이 사료 포대를 한참 본다. 이 대피소에서 자기 식량을 들고 온 첫 번째 입소자다. "...정문 불침번 옆에 두세요." 콩이가 포대에 코를 박는다. 자기 짐인 줄 안다.',
            ],
            next: 'c4_hall',
          },
          {
            chance: 0.4,
            effects: { mental: 10, setFlags: ['c4_guardDog'], hours: 1 },
            result: [
              '"얘가 좀비 냄새 맡으면 으르렁거려요. 사람보다 1분 빨라요. 그 1분에 여기 몇 명이 살지 생각해 보세요."',
              '말하고 나니 그럴듯하다. 위원장이 수첩에 뭔가 적는다. "...정문 쪽에 두세요. 짖으면 책임지시고."',
            ],
            next: 'c4_hall',
          },
          {
            effects: { mental: -10, setFlags: ['c4_kongiShed'], hours: 1 },
            result: [
              '"좀비 탐지견이요? 그럼 우리 집 고양이는 미사일 탐지묘게?" 뒷줄에서 웃음이 터진다. 망했다.',
              '결국 운동장 체육 창고다. 뜀틀 옆에 콩이를 앉히고 문을 닫는다. 틈으로 콩이 코끝이 보인다.',
            ],
            next: 'c4_hall',
          },
        ],
      },
      {
        id: 'shed',
        label: '운동장 창고에 맡긴다',
        hint: '곁엔 없지만 안전하다',
        tags: ['careful', 'cold'],
        outcomes: [
          {
            effects: { mental: -10, setFlags: ['c4_kongiShed'], hours: 1 },
            result: [
              '체육 창고. 석회 가루 냄새, 공 바구니, 뜀틀. 매트 사이에 콩이를 앉히고 담요를 덮어 준다.',
              '"아침에 올게." 문을 닫는데 콩이가 짖지 않는다. 기다리는 게 제일 익숙한 애라서.',
            ],
            next: 'c4_hall',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 2. 강당의 밤 ───────────────────────────────
  c4_hall: {
    id: 'c4_hall',
    chapter: 4,
    location: 'shelter',
    scene: 'shelter',
    title: '강당의 밤',
    clock: 47,
    body: [
      '강당 바닥에 매트 이백 장. 농구 골대 밑엔 아기 엄마들, 무대 위엔 어르신들. 코 고는 소리, 우는 소리, 누가 몰래 뜯는 컵라면 냄새.',
      '벽 게시판엔 쪽지가 빽빽하다. "3동 1402호 김○○ 찾습니다", "초록 등산복 입은 아버지 보신 분". 쪽지 위에 쪽지가 겹쳐 붙는다.',
      '호루라기. 전직 교감 선생님이라는 운영위원장이 마이크도 없이 외친다. "내일 아침 8시 배급 회의! 전원 참석!" 목소리 하나로 강당이 조용해진다.',
      { when: { flags: ['postedVideo'] }, text: '옆 매트 중학생이 휴대폰과 이쪽 얼굴을 번갈아 본다. "저기... 혹시 그 영상 올린 분 아니세요? 조회수 800만 넘었는데."' },
      { when: { companions: ['minjun'] }, text: '민준이 매트에 대자로 눕는다. "학교 강당에서 자니까 수련회 같네요. 수능 D-48인데."' },
      { when: { companions: ['kongi'], flags: ['c4_dogHidden'] }, text: '백팩 속, 점퍼 속, 어딘가에서 콩이가 꼼지락댄다. 옆 매트 할아버지가 못 본 척 등을 돌려 눕는다.' },
      { when: { companions: ['kongi'], flags: ['c4_guardDog'] }, text: '정문 불침번 의자 밑에 콩이가 엎드려 있다. 누가 매직으로 쓴 이름표를 목줄에 달아 줬다. "경보견 콩이. 만지지 마세요(물지는 않음)."' },
      { when: { flags: ['c4_kongiShed'] }, text: '운동장 건너 체육 창고는 캄캄하다. 창고 쪽으로 난 창문을 자꾸 보게 된다.' },
      { when: { flags: ['c4_sneaked'] }, text: '번호표도 담요도 없다. 비어 있는 매트 끝에 슬쩍 눕는다. 명단에 없는 사람은 이 강당에 없는 사람이다.' },
      { when: { noCompanions: ['nurse'] }, text: '무대 옆 구석에선 병원 가운 위에 패딩을 걸친 사람이 어르신 혈압을 잰다. 명찰엔 "정지수". 대학병원이 넘어가고 여기로 왔단다. 이틀째 못 잔 얼굴이다.' },
    ],
    choices: [
      {
        id: 'sleep',
        label: '매트 깔고 일단 눈을 붙인다',
        hint: '몸은 돌아온다',
        tags: ['careful'],
        outcomes: [
          {
            when: REUNION,
            effects: { hp: 15, mental: 5, hours: 2 },
            result: [
              '눈을 감자마자 잠이 쏟아진다. 사태가 터지고 처음 자는 잠다운 잠이다. 옆 매트 코 고는 소리마저 층간소음보다 정겹다.',
              '얼마나 잤을까. 철문 쪽에서 가느다란 소리가 난다. 바람 소리가 아니다.',
            ],
            next: 'c4_reunion',
          },
          {
            effects: { hp: 15, mental: 5, hours: 2 },
            result: [
              '눈을 감자마자 잠이 쏟아진다. 사태가 터지고 처음 자는 잠다운 잠이다. 옆 매트 코 고는 소리마저 층간소음보다 정겹다.',
              '얼마나 잤을까. 철문을 두드리는 소리에 강당 절반이 동시에 눈을 뜬다.',
            ],
            next: 'c4_door',
          },
        ],
      },
      {
        id: 'watch',
        label: '불침번을 자원한다',
        hint: '피곤하지만 신임을 얻는다',
        tags: ['kind'],
        outcomes: [
          {
            when: REUNION,
            effects: { hp: -5, supply: 10, setFlags: ['c4_nightWatch'], hours: 2 },
            result: [
              '교감이 호루라기를 넘기고, 불침번용 랜턴을 문 옆 못에 걸어 준다. "새벽 3시까지. 졸면 다 죽어요." 불침번 몫으로 컵라면이 하나 더 나온다.',
              '한밤중. 정문 철문 너머에서 소리가 난다. 낑, 낑. 짧게 두 번, 쉬고, 또 두 번.',
            ],
            next: 'c4_reunion',
          },
          {
            effects: { hp: -5, supply: 10, setFlags: ['c4_nightWatch'], hours: 2 },
            result: [
              '교감이 호루라기를 넘기고, 불침번용 랜턴을 문 옆 못에 걸어 준다. "새벽 3시까지. 졸면 다 죽어요." 불침번 몫으로 컵라면이 하나 더 나온다.',
              '한밤중. 철문 너머에서 누가 문을 두드린다. 사람 목소리다. 아이 울음소리도 섞여 있다.',
            ],
            next: 'c4_door',
          },
        ],
      },
      {
        id: 'storage',
        label: '식량 창고 위치를 봐 둔다',
        hint: '들키면 도둑 취급',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            when: REUNION,
            chance: 0.6,
            effects: { supply: 5, setFlags: ['c4_knowsStorage'], hours: 2 },
            result: [
              '화장실 가는 척 복도를 돈다. 과학실 문에 자물쇠 두 개. 틈으로 생수 팩과 쌀 포대가 보인다. 창문 걸쇠는 헐겁다. 기억해 둔다.',
              '돌아오는 길, 철문 너머에서 소리가 난다. 낑, 낑. 발이 저절로 멈춘다.',
            ],
            next: 'c4_reunion',
          },
          {
            when: REUNION,
            effects: { mental: -10, setFlags: ['c4_suspect'], hours: 2 },
            result: [
              '과학실 자물쇠를 만지는 순간 등 뒤에서 손전등이 켜진다. 교감이다. "화장실은 반대쪽인데요." 이름과 매트 번호를 적어 간다.',
              '한밤중, 찍힌 기분으로 뒤척이는데 철문 너머에서 소리가 난다. 낑, 낑.',
            ],
            next: 'c4_reunion',
          },
          {
            chance: 0.6,
            effects: { supply: 5, setFlags: ['c4_knowsStorage'], hours: 2 },
            result: [
              '화장실 가는 척 복도를 돈다. 과학실 문에 자물쇠 두 개. 틈으로 생수 팩과 쌀 포대가 보인다. 창문 걸쇠는 헐겁다. 기억해 둔다.',
              '주머니에는 복도에 떨어져 있던 초코파이 하나. 이것도 기억해 둔다. 한밤중, 철문을 두드리는 소리가 난다.',
            ],
            next: 'c4_door',
          },
          {
            effects: { mental: -10, setFlags: ['c4_suspect'], hours: 2 },
            result: [
              '과학실 자물쇠를 만지는 순간 등 뒤에서 손전등이 켜진다. 교감이다. "화장실은 반대쪽인데요." 이름과 매트 번호를 적어 간다.',
              '한밤중, 찍힌 기분으로 뒤척이는데 철문을 두드리는 소리가 들린다.',
            ],
            next: 'c4_door',
          },
        ],
      },
      {
        id: 'video',
        label: '영상 올린 사람이라고 밝힌다',
        hint: '유명세는 양날의 검',
        requires: { flags: ['postedVideo'] },
        lockedHint: '그날 영상을 올렸다면…',
        tags: ['meme'],
        outcomes: [
          {
            when: REUNION,
            effects: { supply: 15, mental: 10, setFlags: ['c4_celebrity'], hours: 2 },
            result: [
              '"네, 접니다." 강당 절반이 고개를 든다. "그 영상 보고 우리 애 학원에서 데려왔어요." 누가 귤을 쥐여 주고, 누가 핫팩을 건넨다. 한 명은 사인을 해 달란다. 종이는 배급표 뒷면이다.',
              '팬 미팅이 끝나고 한참 뒤. 철문 너머에서 소리가 난다. 낑, 낑. 그 박자를 안다.',
            ],
            next: 'c4_reunion',
          },
          {
            effects: { supply: 15, mental: 10, setFlags: ['c4_celebrity'], hours: 2 },
            result: [
              '"네, 접니다." 강당 절반이 고개를 든다. "그 영상 보고 우리 애 학원에서 데려왔어요." 누가 귤을 쥐여 주고, 누가 핫팩을 건넨다. 한 명은 사인을 해 달란다. 종이는 배급표 뒷면이다.',
              '"근데 그거 조작 아니죠?" 하는 사람도 하나 있다. 대댓글은 종말에도 있다. 한밤중, 철문을 두드리는 소리가 들린다.',
            ],
            next: 'c4_door',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 2-a. ★콩이 재회 ───────────────────────────────
  c4_reunion: {
    id: 'c4_reunion',
    chapter: 4,
    location: 'shelter',
    scene: 'dog_kongi',
    title: '낑, 낑',
    clock: 50,
    body: [
      '새벽. 철문 틈으로 소리가 새어 든다. 낑, 낑. 짧게 두 번, 쉬고, 또 두 번.',
      '그 박자를 안다. 퇴근길에 현관 비밀번호를 누르면, 삑 소리보다 먼저 문 너머에서 들리던 소리다. 여섯 자리를 다 누르기도 전에.',
      '쪽창에 얼굴을 댄다. 가로등 아래 작은 몸 하나가 앉아 있다. 털은 흙투성이, 네 발이 다 젖었다. 한쪽 귀가 접혀 있다.',
      {
        when: { flags: ['leftDog'] },
        text: '콩이다. 12층 현관에 두고 온 콩이. 그 문을 어떻게 나왔는지, 몇 킬로미터를 어떻게 걸었는지는 모른다. 냄새 하나 붙들고 여기까지 왔다.',
      },
      {
        when: { flags: ['leftDog'] },
        text: '"금방 올게." 그날 현관에서 그렇게 말했다. 약속을 지킨 건 콩이 쪽이다.',
      },
      {
        when: GIVEN,
        text: '콩이다. 목줄은 끊어져 반만 남았고, 목에 낯선 리본이 매여 있다. 그 아이가 묶어 줬을 것이다. 초, 등, 학, 교. 그 엄마가 입 모양으로 알려 준 곳이 바로 여기였다.',
      },
      {
        when: GIVEN,
        text: '개는 안 된다는 규정에 밀려 정문 밖 철창에 있었을 것이다. 줄을 끊고, 운동장을 가로질러, 이 철문 앞까지 왔다. 이백 명 중에 딱 한 사람 냄새를 골라서.',
      },
      '콩이는 아직 짖지 않는다. 쪽창을 올려다보며 꼬리를 한 번, 천천히 흔든다. 들어가도 되냐고 묻는 얼굴이다.',
    ],
    choices: [
      {
        id: 'run_out',
        label: '빗장을 풀고 달려 나간다',
        hint: '지금은 아무도 못 막는다',
        tags: ['dog', 'brave'],
        outcomes: [
          {
            effects: { addCompanions: ['kongi'], mental: 30, hp: -5, setFlags: ['c4_reunited', 'c4_dogHidden'], hours: 1 },
            result: [
              '빗장을 올리는 손이 떨린다. 누가 뒤에서 소리치는데 들리지 않는다. 무릎을 꿇자마자 콩이가 품으로 뛰어든다.',
              '얼굴을 핥고, 또 핥고, 낑낑대다가, 결국 가슴팍에 머리를 박고 가만히 있다. 발바닥이 다 까져 있다. 미안해. 미안해. 그 말밖에 안 나온다.',
              { when: { companions: ['grandma'] }, text: '1203호 할머니가 담요를 들고 따라 나와 콩이를 덮어 준다. "개가 사람보다 낫다." 코를 훌쩍인다.' },
            ],
            next: 'c4_vote',
          },
        ],
      },
      {
        id: 'call_name',
        label: '쪽창으로 이름을 부른다',
        hint: '조용하지만 확실하진 않다',
        tags: ['careful', 'dog'],
        outcomes: [
          {
            chance: 0.6,
            effects: { addCompanions: ['kongi'], mental: 30, setFlags: ['c4_reunited', 'c4_dogHidden'], hours: 1 },
            result: [
              '"콩아." 속삭임인데, 가로등 아래 접힌 귀가 번쩍 선다. 콩이가 쪽창 틈으로 머리를, 어깨를, 엉덩이를 비집어 넣는다. 5킬로그램이라서 다행이다.',
              '품에 떨어진 콩이가 떨고 있다. 심장이 너무 빨리 뛴다. 둘 다.',
              { when: { companions: ['minjun'] }, text: '민준이 옆에서 고개를 돌린다. "먼지가 들어가서요." 강당엔 먼지가 많다.' },
            ],
            next: 'c4_vote',
          },
          {
            effects: { addCompanions: ['kongi'], mental: 25, hp: -10, setFlags: ['c4_reunited', 'c4_kongiShed'], hours: 1 },
            result: [
              '목소리를 들은 콩이가 반가워서 짖는다. 크게, 세 번. 골목 끝 어둠에서 뭔가가 이쪽으로 방향을 튼다.',
              '빗장을 풀고 뛰쳐나가 콩이를 낚아채 돌아온다. 철문에 팔꿈치가 찢긴다. 문이 닫히는 순간 바깥에서 뭔가 철문을 들이받는다.',
              '교감이 잠옷 바람으로 달려온다. "개는 창고로! 당장!" 그래도 괜찮다. 콩이가 여기 있다.',
            ],
            next: 'c4_vote',
          },
        ],
      },
      {
        id: 'shed_sleep',
        label: '콩이와 체육 창고에서 잔다',
        hint: '춥지만 같이 있다',
        tags: ['dog', 'kind'],
        outcomes: [
          {
            when: { items: ['dogfood'] },
            effects: { addCompanions: ['kongi'], mental: 40, hp: -5, setFlags: ['c4_reunited', 'c4_kongiShed'], hours: 2 },
            result: [
              '콩이를 안고 강당이 아니라 운동장 체육 창고로 간다. 뜀틀 옆 매트 두 장. 규정 따위는 아침에 생각한다.',
              '마트에서 챙긴 연어맛 사료 포대를 뜯는다. 바스락 소리에 접힌 귀까지 선다. 콩이가 코를 박고 먹는다. 허겁지겁, 굶은 이틀 치를 한 번에. 다시 만나면 주려고 챙긴 거였다. 만났다.',
              '다 먹은 콩이가 등에 코를 묻는다. 집 냄새가 아직 난다. 석회 가루 냄새 속에서, 사태가 터지고 처음으로 운다. 콩이가 대신 낑낑댄다.',
            ],
            next: 'c4_vote',
          },
          {
            effects: { addCompanions: ['kongi'], mental: 35, hp: -8, setFlags: ['c4_reunited', 'c4_kongiShed'], hours: 2 },
            result: [
              '콩이를 안고 강당이 아니라 운동장 체육 창고로 간다. 뜀틀 옆 매트 두 장. 규정 따위는 아침에 생각한다.',
              '주머니 속 비스킷을 반으로 쪼갠다. 콩이는 먹지도 않고 손바닥만 핥는다. 등에 코를 묻는다. 집 냄새가 아직 난다.',
              '석회 가루 냄새 속에서, 사태가 터지고 처음으로 운다. 소리는 안 낸다. 콩이가 대신 낑낑댄다.',
            ],
            next: 'c4_vote',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 2-b. 철문 밖의 가족 ───────────────────────────────
  c4_door: {
    id: 'c4_door',
    chapter: 4,
    location: 'shelter',
    scene: 'horde',
    title: '철문 밖의 가족',
    clock: 50,
    body: [
      '새벽. 철문 너머에 부부가 서 있다. 남자 등에 업힌 아이는 곰돌이 잠옷 차림이다. "제발요, 애만이라도."',
      '그 뒤로 50미터. 가로등 불빛 끝에서 뭔가 달려온다. 하나, 둘... 세다가 그만둔다. 빗장을 풀고 다시 거는 데 30초.',
      { when: { flags: ['c4_nightWatch'] }, text: '목에 호루라기가 걸려 있다. 오늘 밤 불침번이다. 결정은 내 몫이다.' },
      { when: { companions: ['kongi'], flags: ['c4_guardDog'] }, text: '제일 먼저 짖은 건 콩이다. 경보견 첫 출근이다.' },
      { when: { flags: ['openedDoor'] }, text: '첫날에도 문을 열었다. 피 흘리던 옆집 아저씨. 그때 문을 연 손이 지금 빗장 위에 있다.' },
      { when: { flags: ['abandonedSomeone'] }, text: '누군가를 두고 온 게 벌써 한 번이다. 그 얼굴이 철문 밖 얼굴에 겹친다.' },
    ],
    choices: [
      {
        id: 'open',
        label: '빗장을 풀고 문을 연다',
        hint: '30초면 충분할까',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { anyItems: ['bat', 'crowbar'] },
            effects: { hp: -5, mental: 10, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '빗장이 올라간다. 부부가 몸을 밀어 넣는 순간, 맨 앞의 그것이 문틈에 어깨를 끼운다.',
              '손에 쥔 것을 머리 높이로 휘두른다. 한 번. 문틈이 비고, 빗장이 떨어진다. 강당에서 누군가 박수를 치다가 멈춘다.',
            ],
            next: 'c4_vote',
          },
          {
            when: { companions: ['soldier'] },
            effects: { hp: -5, mental: 10, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '김 병장이 철문 옆에 붙는다. "제가 셋 세면 닫습니다. 하나." 부부가 들어온다. "둘." 아이가 들어온다. "셋."',
              '빗장이 떨어지고 철문에 뭔가 부딪힌다. 병장이 숨을 몰아쉰다. "훈련소에서 배운 거 처음 써 봅니다."',
            ],
            next: 'c4_vote',
          },
          {
            chance: 0.5,
            effects: { mental: 10, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '빗장이 올라가고, 부부가 굴러 들어오고, 빗장이 떨어진다. 28초. 철문 바깥에서 쾅, 쾅, 쾅.',
              '아이 엄마가 매트 위에 무너져 운다. 아이는 영문도 모르고 곰돌이 잠옷 소매로 코를 닦는다.',
            ],
            next: 'c4_vote',
          },
          {
            effects: { hp: -20, mental: -10, setFlags: ['savedStranger', 'c4_breach'], hours: 1 },
            result: [
              '부부가 들어오고, 하나가 따라 들어온다. 누가 비명을 지른다. 매트가 뒤집히고, 의자가 날고, 소화기가 터진다.',
              { when: { companions: ['rider'] }, text: '맨 앞에서 몸으로 막아선 건 용석이다. 헬멧으로 그것의 머리를 찍고, 또 찍는다. 끝나고 나서 소매를 급하게 내린다.' },
              '끝났을 땐 팔에 긴 긁힘과 멍투성이다. 물리진 않았다. 강당 구석에서 누군가 팔을 부여잡고 있는 게 보인다. 모르는 척한다. 지금은.',
            ],
            next: 'c4_vote',
          },
        ],
      },
      {
        id: 'child_only',
        label: '쪽창으로 아이만 받는다',
        hint: '아이는 산다',
        tags: ['cold'],
        outcomes: [
          {
            effects: { mental: -20, setFlags: ['c4_savedChild', 'savedStranger'], hours: 1 },
            result: [
              '쪽창으로 아이가 넘어온다. 엄마가 마지막으로 아이 손에 뭔가를 쥐여 준다. 분홍색 머리끈이다.',
              '"먼저 가 있어." 부부는 아이가 안쪽으로 들어가는 걸 끝까지 보고, 반대 방향으로 뛴다. 일부러 소리를 지르며. 떼가 그 소리를 따라간다.',
              '아이는 울지 않는다. 그게 제일 오래 남는다.',
            ],
            next: 'c4_vote',
          },
        ],
      },
      {
        id: 'keep_shut',
        label: '문을 열지 않는다',
        hint: '이백 명은 안전하다',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            effects: { mental: -20, supply: 5, setFlags: ['abandonedSomeone', 'c4_leaderTrust'], hours: 1 },
            result: [
              '빗장에서 손을 뗀다. 부부가 철문을 흔든다. 그리고 소리가 멀어진다. 어느 쪽으로 갔는지는 모른다. 모르기로 한다.',
              { when: { noFlags: ['c4_sneaked'] }, text: '아침에 교감이 어깨를 두드리며 배급 빵을 하나 더 얹어 준다. "잘했어요. 원칙대로." 칭찬이 이렇게 무거울 수가 없다.' },
              { when: { flags: ['c4_sneaked'] }, text: '아침에 교감이 어깨를 두드린다. "잘했어요. 원칙대로." 빵을 얹어 주려던 손이 멈춘다. "근데 댁은 번호가...?" 대답 대신 고개를 숙인다. 원칙은 이쪽에도 똑같이 적용된다.' },
            ],
            next: 'c4_vote',
          },
        ],
      },
      {
        id: 'alarm',
        label: '폰 알람을 반대편에 던진다',
        hint: '소리로 떼를 돌린다',
        requires: { items: ['powerbank'] },
        lockedHint: '폰 배터리만 살아 있었다면…',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            effects: { removeItems: ['powerbank'], mental: 15, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '보조배터리를 꽂은 폰에 알람을 맞춘다. 최대 음량. 벨소리는 하필 출근용 "기상나팔". 담장 너머 반대편 골목으로 힘껏 던진다.',
              '떼가 일제히 고개를 돌려 소리를 쫓는다. 그 틈에 부부가 들어온다. 멀리서 기상나팔이 세 번 울리고 멈춘다. 월요일 아침이 이렇게 고마운 적은 없었다.',
              '폰은 잃었다. 엄마 번호는 외우고 있다. 그거면 된다.',
            ],
            next: 'c4_vote',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 3. 배급 회의 ───────────────────────────────
  c4_vote: {
    id: 'c4_vote',
    chapter: 4,
    location: 'shelter',
    scene: 'shelter',
    title: '배급 회의',
    clock: 56,
    body: [
      '아침 8시. 교감이 무대에 선다. 뒤편 칠판에 분필로 크게 적혀 있다. "배급 50% 감축. 우선순위 투표."',
      '"안건은 둘. 하나, 노약자 우선. 둘, 일할 수 있는 사람 우선. 추가 안건, 반려동물 배급 중단." 이백 명이 동시에 웅성인다.',
      { when: { companions: ['kongi'], noFlags: ['c4_kongiShed', 'c4_dogHidden'] }, text: '반려동물이라는 말에 시선 몇 개가 이쪽으로 꽂힌다. 콩이는 영문도 모르고 꼬리를 흔든다.' },
      { when: { companions: ['kongi'], flags: ['c4_dogHidden'], noFlags: ['c4_kongiShed'] }, text: '반려동물이라는 말에 숨겨 둔 콩이가 움찔한다. 옆 매트 할아버지가 헛기침을 크게 해서 덮어 준다.' },
      { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '반려동물이라는 말이 나오자마자 운동장 창고 쪽에서 콩이가 한 번 짖는다. 타이밍이 기가 막힌다.' },
      { when: { companions: ['grandma'] }, text: '1203호 할머니가 숟가락을 슬그머니 내려놓는다. "늙은이 밥은 반만 줘도 된다." 아무도 대답하지 않는다.' },
      { when: { flags: ['c4_savedChild'] }, text: '곰돌이 잠옷 아이가 매트 끝에 앉아 분홍 머리끈을 만지작거린다. 명단에 그 아이 이름은 없다.' },
      {
        when: { flags: ['c4_reunited'], noFlags: ['leftDog'] },
        text: '회의 전, 아홉 살쯤 된 여자아이가 매트 사이를 헤집고 온다. 콩이를 보자마자 운다. "밤에 철창에서 없어져서요." 콩이 귀를 한 번 접었다 펴더니 또박또박 말한다. "천둥 치면 이불 속에 들어가요. 연어맛 좋아해요." 그날 버스 앞에서 한 말이 고스란히 돌아온다.',
      },
      { when: { flags: ['c4_sneaked'] }, text: '배급 명단이 벽에 붙는다. 번호 순서대로 147개. 담 넘어 들어온 사람의 번호는 없다.' },
    ],
    choices: [
      {
        id: 'elder',
        label: '노약자 우선에 손을 든다',
        hint: '양심은 편하고 배는 고프다',
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['grandma'] },
            effects: { supply: -10, mental: 15, setFlags: ['c4_votedElder'], hours: 2 },
            result: [
              '손을 든다. 옆에서 할머니가 그 손을 잡아 내린다. "내 밥 때문이면 안 그래도 된다." 다시 든다. 할머니가 더는 말리지 않는다.',
              '노약자 우선, 근소한 차로 통과. 배급 줄에서 할머니가 자기 주먹밥을 반 뚝 떼어 건넨다. "고마워, 1201호." 거절할 수가 없다.',
            ],
            next: 'c4_bitten',
          },
          {
            effects: { supply: -10, mental: 5, setFlags: ['c4_votedElder'], hours: 2 },
            result: [
              '손을 든다. 무대 위 어르신들 쪽에서 박수, 농구 골대 밑 젊은 아빠들 쪽에서 혀 차는 소리.',
              '노약자 우선, 근소한 차로 통과. 오늘 점심은 주먹밥 반 개. 배는 고프고 마음은 편하다. 둘 다 오래가진 않는다.',
            ],
            next: 'c4_bitten',
          },
        ],
      },
      {
        id: 'work',
        label: '일할 사람 우선, 경비조에 든다',
        hint: '배는 부르고 밤은 길다',
        tags: ['cold'],
        outcomes: [
          {
            when: { companions: ['minjun'] },
            effects: { supply: 20, hp: -8, setFlags: ['c4_workCrew'], hours: 2 },
            result: [
              '경비조 명단에 이름을 올린다. 민준이 옆에서 손을 번쩍 든다. "저도요. 체대 입시 준비했었어요." 처음 듣는 얘기다.',
              '둘이서 담장 보수, 물 긷기, 쓰레기 소각까지. 대신 배급은 곱빼기다. 무대 쪽 어르신들 시선은 곱빼기로 차갑다.',
            ],
            next: 'c4_bitten',
          },
          {
            effects: { supply: 15, hp: -8, mental: -5, setFlags: ['c4_workCrew'], hours: 2 },
            result: [
              '경비조 명단에 이름을 올린다. 담장 보수, 물 긷기, 쓰레기 소각. 대신 배급은 곱빼기다.',
              '배급 줄에서 한 할아버지가 빈 식판을 들고 돌아선다. 주먹밥이 목에 걸린다. 그래도 삼킨다.',
            ],
            next: 'c4_bitten',
          },
        ],
      },
      {
        id: 'speech',
        label: '단상에 올라 반대 연설을 한다',
        hint: '말발 싸움이다',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            when: { flags: ['c4_celebrity'] },
            effects: { mental: 15, setFlags: ['c4_speech'], hours: 2 },
            result: [
              '단상에 오르자 누가 "영상 그분이다!" 하고 외친다. 조회수 800만의 무게가 마이크 없는 강당을 채운다.',
              '"줄 세우지 말고 다 같이 반씩 먹읍시다. 개도 반, 사람도 반." 박수가 터진다. 교감이 분필을 내려놓는다. 인플루언서가 대피소를 이겼다.',
            ],
            next: 'c4_bitten',
          },
          {
            when: { companions: ['grandma'] },
            effects: { mental: 15, setFlags: ['c4_speech'], hours: 2 },
            result: [
              '떨리는 목소리로 두 문장쯤 했을 때 1203호 할머니가 일어선다. "난리통에 사람 줄 세우는 거, 그거 전쟁 때도 안 했어. 다 같이 반씩 먹어."',
              '강당이 조용해진다. 교감이 할머니 앞에서 처음으로 목소리를 낮춘다. 안건은 "전원 균등 배분"으로 바뀐다. 연설은 할머니가 했는데 박수는 이쪽으로 온다.',
            ],
            next: 'c4_bitten',
          },
          {
            chance: 0.4,
            effects: { mental: 15, setFlags: ['c4_speech'], hours: 2 },
            result: [
              '"여기 계신 분 중에 노약자랑 일할 사람 딱 잘라 구분되는 분 손 들어 보세요." 아무도 안 든다. "그럼 다 같이 반씩 먹읍시다."',
              '웃음 반, 박수 반. 교감이 한참 칠판을 보다가 안건을 지운다. 인생 첫 연설이 종말 중에 먹혔다.',
            ],
            next: 'c4_bitten',
          },
          {
            effects: { mental: -15, setFlags: ['c4_suspect'], hours: 2 },
            result: [
              '"저기, 제 생각에는..." 첫 문장부터 목소리가 갈라진다. 뒷줄에서 "밥이나 먹게 내려와요!" 한 명이 외치자 다들 웃는다.',
              '교감이 정중하게 마이크 대신 호루라기를 분다. "의견 감사합니다." 이름이 수첩에 적힌다. 종말에도 발표 공포증은 있다.',
            ],
            next: 'c4_bitten',
          },
        ],
      },
      {
        id: 'lottery',
        label: '추첨으로 하자고 제안한다',
        hint: '공정하지만 모두 불만',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c4_sneaked'] },
            effects: { supply: -15, mental: -10, hours: 2 },
            result: [
              '"추첨으로 하죠." 교감이 번호표를 모자에 넣고 흔들다가 멈춘다. "제안하신 분, 번호가 몇 번이에요?"',
              '대답을 못 한다. 교감이 명단을 두 번 훑는다. 강당이 조용해진다. "...명단에 없는 분은 추첨 대상도 아닙니다." 공정함은 명단 안쪽에만 있다. 오늘 점심은 없다.',
            ],
            next: 'c4_bitten',
          },
          {
            chance: 0.5,
            effects: { supply: 10, mental: -5, hours: 2 },
            result: [
              '"추첨으로 하죠." 제비뽑기는 교감이 교단에서 쓰던 방식 그대로다. 번호표를 모자에 넣고 흔든다.',
              '첫 번째로 뽑힌 번호가 하필 내 번호다. 제안자가 당첨됐다. 강당 전체가 이쪽을 노려본다. 주먹밥이 유난히 맛있다.',
            ],
            next: 'c4_bitten',
          },
          {
            when: { items: ['dogfood'] },
            effects: { supply: -5, mental: -5, hours: 2 },
            result: [
              '"추첨으로 하죠." 공정하다는 데는 다들 동의한다. 결과에 동의하는 사람은 없다. 내 번호는 끝내 불리지 않는다.',
              '점심시간, 가방 속 연어맛 사료 포대를 연다. 사람도 급하면 먹는다는 소문, 오늘 검증한다. 짜다. 생각보다 먹을 만해서 더 슬프다.',
              { when: { companions: ['kongi'] }, text: '콩이가 이쪽 입과 자기 포대를 번갈아 본다. 세상이 끝났다는 걸 콩이는 지금 처음 실감하는 얼굴이다.' },
            ],
            next: 'c4_bitten',
          },
          {
            effects: { supply: -10, mental: -5, hours: 2 },
            result: [
              '"추첨으로 하죠." 공정하다는 데는 다들 동의한다. 결과에 동의하는 사람은 없다.',
              '내 번호는 끝내 불리지 않는다. 오늘 점심은 건빵 다섯 알. 공정함의 맛은 퍽퍽하다.',
            ],
            next: 'c4_bitten',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 4. 물린 사람 ───────────────────────────────
  c4_bitten: {
    id: 'c4_bitten',
    chapter: 4,
    location: 'shelter',
    scene: 'shelter',
    title: '긴소매',
    clock: 60,
    body: [
      { when: { companions: ['rider'], flags: ['c4_breach'] }, text: '정오. 용석이 아까부터 소매를 끝까지 내리고 있다. 강당이 이렇게 더운데. 이마에 땀이 맺혀 있다.' },
      { when: { companions: ['rider'], flags: ['c4_breach'] }, text: '"저기요..." 용석이 목소리를 낮춘다. 소매 밑 붕대에 검붉은 얼룩. "새벽에 철문에서요. 그냥 긁힌 거예요. 진짜로."' },
      { when: { noCompanions: ['rider'] }, text: '정오. 화장실 세면대 앞에서 교감의 아들 태호와 마주친다. 스물둘, 경비조. 어제 해 질 녘 물 길으러 나갔다 온 조다. 팔뚝 붕대를 새로 감고 있다.' },
      { when: { companions: ['rider'], noFlags: ['c4_breach'] }, text: '정오. 화장실 세면대 앞에서 교감의 아들 태호와 마주친다. 스물둘, 경비조. 어제 해 질 녘 물 길으러 나갔다 온 조다. 팔뚝 붕대를 새로 감고 있다.' },
      { when: { noCompanions: ['rider'] }, text: '거울 속에서 눈이 마주친다. "아버지한테는... 말하지 말아 주세요. 긁힌 거예요." 붕대 끝이 검붉다.' },
      { when: { companions: ['rider'], noFlags: ['c4_breach'] }, text: '거울 속에서 눈이 마주친다. "아버지한테는... 말하지 말아 주세요. 긁힌 거예요." 붕대 끝이 검붉다.' },
      { when: { companions: ['rider'], noFlags: ['c4_breach'] }, text: '붕대를 먼저 알아본 건 용석이다. "저거 긁힌 거 아니에요. 배달하면서 별걸 다 봤어요."' },
      '물리면 몇 시간 안에 열이 오른다. 그다음은 다들 안다. 이 강당에 이백 명이 있다.',
      { when: { infected: true }, text: '남 얘기 같지 않다. 내 소매 밑도 뜨겁다.' },
    ],
    choices: [
      {
        id: 'report',
        label: '운영위원회에 알린다',
        hint: '규칙은 규칙이다',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            when: { companions: ['rider'], flags: ['c4_breach'] },
            effects: { removeCompanions: ['rider'], mental: -20, setFlags: ['c4_toldLeader', 'abandonedSomeone'], hours: 2 },
            result: [
              '군인 둘이 용석의 양팔을 잡는다. 용석은 저항하지 않는다. 흰 텐트로 걸어가다가 한 번 돌아본다.',
              '"인천 쪽 가게 되면요, 제2경인 말고 해안도로요." 마지막 말까지 길 안내다. 배달 3년 차의 직업병이다.',
            ],
            next: 'c4_checkpoint',
          },
          {
            effects: { mental: -10, supply: 5, setFlags: ['c4_toldLeader'], hours: 2 },
            result: [
              '교감은 한참 말이 없다. 그러다 목에 건 호루라기를 벗어 탁자에 내려놓는다. "규칙대로 하세요. 내 아들이라도."',
              '태호가 흰 텐트로 걸어간다. 교감은 텐트 앞 의자에 앉아 한참을 일어나지 않는다. 원칙을 지킨 사람의 뒷모습이 이렇게 작다.',
              '늦은 점심 배급 줄에서 운영위원 하나가 이쪽 식판에 주먹밥을 하나 더 얹는다. 고맙다는 건지, 무섭다는 건지 모르겠다.',
            ],
            next: 'c4_checkpoint',
          },
        ],
      },
      {
        id: 'let_out',
        label: '몰래 뒷문으로 내보낸다',
        hint: '들키면 공범이다',
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['rider'], flags: ['c4_breach'] },
            chance: 0.6,
            effects: { removeCompanions: ['rider'], mental: -10, setFlags: ['c4_riderMap'], hours: 2 },
            result: [
              '용석이 배급표 뒷면에 볼펜으로 지도를 그린다. 인천항까지. 막힌 길엔 X, 문 연 편의점엔 동그라미. "배달 3년이면 서울이 손바닥이에요."',
              '급식실 뒷문. 용석이 헬멧 끈을 조인다. "사람 많은 데선 안 변할게요. 약속." 그리고 뛴다. 여전히 빠르다.',
            ],
            next: 'c4_checkpoint',
          },
          {
            when: { companions: ['rider'], flags: ['c4_breach'] },
            effects: { removeCompanions: ['rider'], supply: -15, mental: -15, setFlags: ['c4_suspect'], hours: 2 },
            result: [
              '급식실 뒷문 앞에서 교감의 손전등이 켜진다. 용석은 그대로 담을 넘어 사라진다. 인사할 틈도 없다.',
              '남은 사람이 책임을 진다. 오늘 배급 없음. 강당 사람들이 이쪽 매트를 비켜 지나간다.',
            ],
            next: 'c4_checkpoint',
          },
          {
            chance: 0.6,
            effects: { mental: -5, setFlags: ['c4_letOut'], hours: 2 },
            result: [
              '급식실 뒷문. 태호가 신발 끈을 두 번 묶는다. "아버지한텐, 보급 구하러 갔다고 해 주세요." 고개를 끄덕인다.',
              '늦은 점심 배급 때 교감이 태호 몫 주먹밥을 따로 챙겨 둔다. 거짓말은 이 강당에서 제일 무거운 짐이 된다.',
            ],
            next: 'c4_checkpoint',
          },
          {
            effects: { supply: -15, mental: -10, setFlags: ['c4_suspect'], hours: 2 },
            result: [
              '뒷문 빗장을 올리는 순간 경비조 둘에게 걸린다. 태호는 그 자리에서 텐트로 끌려가고, 이쪽 이름은 교감 수첩에 두 번째로 적힌다.',
              '"우리 애를 내보내려고 한 거예요, 살리려고 한 거예요?" 교감이 묻는다. 대답을 못 한다. 오늘 배급 없음.',
            ],
            next: 'c4_checkpoint',
          },
        ],
      },
      {
        id: 'finish',
        label: '변하기 전에 직접 끝낸다',
        hint: '누군가는 해야 한다',
        requires: { anyItems: ['bat', 'crowbar', 'extinguisher'] },
        lockedHint: '손에 쥘 무언가가 있었다면…',
        tags: ['cold', 'brave'],
        outcomes: [
          {
            when: { companions: ['rider'], flags: ['c4_breach'] },
            effects: { removeCompanions: ['rider'], mental: -30, setFlags: ['c4_didIt'], hours: 2 },
            result: [
              '운동장 뒤편 소각장. 용석이 헬멧을 벗어 건넨다. "변하면 저 누군지 모를 거잖아요. 지금이 나아요."',
              '눈을 감는 건 용석이 먼저다. 한 번이면 된다. 한 번으로 끝낸다.',
              '헬멧은 가져간다. 버릴 수가 없다.',
            ],
            next: 'c4_checkpoint',
          },
          {
            effects: { mental: -25, supply: 5, setFlags: ['c4_didIt'], hours: 2 },
            result: [
              '오후 1시, 화장실 맨 끝 칸에서 이상한 울음소리가 난다. 문을 열었을 때 태호의 눈은 이미 탁하다. 강당까지 스무 걸음.',
              '한 번. 소리가 멈춘다. 경비조가 달려오고, 누구도 이쪽을 탓하지 않는다. 교감은 강당 구석에 쪼그려 앉아 아들 운동화를 닦는다. 한참을, 말없이.',
            ],
            next: 'c4_checkpoint',
          },
        ],
      },
      {
        id: 'nurse_care',
        label: '간호사를 불러 맡긴다',
        hint: '존엄하지만 시간이 든다',
        tags: ['kind', 'careful'],
        outcomes: [
          {
            when: { companions: ['nurse', 'rider'], flags: ['c4_breach'] },
            effects: { removeCompanions: ['rider'], mental: -5, setFlags: ['c4_nurseCare'], hours: 2 },
            result: [
              '지수가 용석의 붕대를 풀고 동공을 본다. 한참 뒤 조용히 말한다. "혼자 두지는 않을게요."',
              '격리 텐트로 들어가는 용석 옆에 지수가 의자를 끌고 앉는다. 용석이 웃는다. "간호사님이 제 마지막 손님이네요. 별 다섯 개 주세요."',
            ],
            next: 'c4_checkpoint',
          },
          {
            when: { companions: ['nurse'] },
            effects: { mental: -5, supply: 10, setFlags: ['c4_nurseCare'], hours: 2 },
            result: [
              '지수가 태호를 데리고 교감에게 간다. 사실을, 증상을, 남은 시간을 차근차근 설명한다. 교감의 무릎이 꺾인다. 지수가 붙잡는다.',
              '태호는 격리 텐트에서 아버지 손을 잡고 마지막 시간을 보낸다. 한 시간쯤 뒤, 텐트에서 나온 교감이 창고 열쇠로 생수 한 팩을 꺼내 온다. "간호사 선생 일행 몫이에요."',
            ],
            next: 'c4_checkpoint',
          },
          {
            when: { companions: ['rider'], flags: ['c4_breach'] },
            chance: 0.5,
            effects: { removeCompanions: ['rider'], addCompanions: ['nurse'], mental: -10, setFlags: ['c4_nurseCare'], hours: 3 },
            result: [
              '무대 옆 구석의 정지수 간호사를 데려온다. 지수가 용석의 동공을 보고, 맥을 짚고, 짧게 고개를 젓는다. "혼자 두지는 않을게요."',
              '격리 텐트로 들어가며 용석이 웃는다. "간호사님이 제 마지막 손님이네요. 별 다섯 개 주세요." 지수는 한참을 그 곁에 앉아 있다.',
              '텐트에서 나온 지수가 이쪽 매트 앞에 가방을 내려놓는다. "그쪽 일행에 끼워 줘요. 여기서 더 보내면, 저도 버틸 자신이 없어요."',
            ],
            next: 'c4_checkpoint',
          },
          {
            when: { companions: ['rider'], flags: ['c4_breach'] },
            effects: { removeCompanions: ['rider'], mental: -10, setFlags: ['c4_nurseCare'], hours: 3 },
            result: [
              '무대 옆 구석의 정지수 간호사를 데려온다. 지수가 용석의 동공을 보고, 맥을 짚고, 짧게 고개를 젓는다. "혼자 두지는 않을게요."',
              '격리 텐트로 들어가며 용석이 웃는다. "간호사님이 제 마지막 손님이네요. 별 다섯 개 주세요." 지수는 그 곁을 지키느라 이쪽을 다시 돌아보지 않는다. 여기엔 아픈 사람이 이백 명이다.',
            ],
            next: 'c4_checkpoint',
          },
          {
            chance: 0.5,
            effects: { addCompanions: ['nurse'], mental: -5, setFlags: ['c4_nurseCare'], hours: 3 },
            result: [
              '무대 옆 구석의 정지수 간호사를 데려온다. 지수가 태호를 데리고 교감에게 간다. 사실을, 증상을, 남은 시간을 차근차근 설명한다. 교감의 무릎이 꺾인다. 지수가 붙잡는다.',
              '태호는 격리 텐트에서 아버지 손을 잡고 마지막 시간을 보낸다. 텐트에서 나온 지수가 이쪽 매트 앞에 가방을 내려놓는다. "그쪽 일행에 끼워 줘요. 여기서 한 명 더 보내면, 저도 못 버텨요."',
            ],
            next: 'c4_checkpoint',
          },
          {
            effects: { mental: -10, setFlags: ['c4_nurseCare'], hours: 3 },
            result: [
              '무대 옆 구석의 정지수 간호사를 데려온다. 지수가 태호를 데리고 교감에게 간다. 사실을, 증상을, 남은 시간을 차근차근 설명한다. 교감의 무릎이 꺾인다. 지수가 붙잡는다.',
              '태호는 격리 텐트에서 아버지 손을 잡고 마지막 시간을 보낸다. 지수는 그 곁을 지키느라 점심 배급도 거른다. 부탁한 건 이쪽인데, 짐은 지수가 다 졌다.',
            ],
            next: 'c4_checkpoint',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 5. 강변 검문소 ───────────────────────────────
  c4_checkpoint: {
    id: 'c4_checkpoint',
    chapter: 4,
    location: 'checkpoint',
    scene: 'checkpoint',
    title: '강변 검문소',
    clock: 62,
    alert: {
      kind: 'radio',
      from: '국군 재난방송',
      text: '치직... 전 시민께 알립니다... 내일 06시... 잠실... 치지직... 인천항... 수송... 한강대... 치직... 반복합니다...',
    },
    body: [
      '점심이 지나고, 교감이 대피소 대표 몇을 강변 검문소로 보낸다. 손에 쥔 건 보급 요청서 한 장, 그리고 "되는 대로 받아 와요."',
      '검문소는 철수 중이다. 트럭 두 대가 시동을 건 채 짐을 싣는다. 모래주머니 옆 무전기에서 잡음 섞인 방송이 끊겼다 이어진다.',
      { when: { noCompanions: ['soldier'], noFlags: ['c3_soldierTip'] }, text: '초소 안에 병사 하나가 남아 있다. 명찰엔 "김", 계급장은 병장. "저는 명단에 없답니다. 휴가자라서." 웃는데 웃는 얼굴이 아니다.' },
      { when: { noCompanions: ['soldier'], flags: ['c3_soldierTip'] }, text: '초소 안에 어제 그 병장이 남아 있다. 명찰엔 "김". 이쪽을 알아보고 목소리를 낮춘다. "뒷문으로 들어가셨어요? 다행이네." 그러고는 덧붙인다. "저는 철수 명단에 없답니다. 휴가자라서." 웃는데 웃는 얼굴이 아니다.' },
      { when: { companions: ['soldier'] }, text: '김 병장이 걸음을 멈춘다. 철수 트럭 문짝에 자기 부대 마크가 붙어 있다. 전투모를 눌러 쓴다. 알아볼까 봐 겁나는 얼굴인지, 알아봐 주길 바라는 얼굴인지 모르겠다.' },
      { when: { flags: ['c4_workCrew'] }, text: '경비조라서 차출됐다. 곱빼기 배급에는 이런 것도 포함이다.' },
      { when: { flags: ['c4_suspect'] }, text: '교감이 명단 끝에 이쪽 이름을 굳이 적어 넣었다. "감시 겸." 들으라고 한 말이다.' },
    ],
    choices: [
      {
        id: 'recruit',
        label: '남겨진 병장에게 손을 내민다',
        hint: '보급 상자는 포기한다',
        requires: { noCompanions: ['soldier'] },
        tags: ['kind'],
        outcomes: [
          {
            effects: {
              addCompanions: ['soldier'],
              mental: 10,
              supply: -10,
              setFlags: ['knowsBroadcast', 'bridgeTimer'],
              hours: 2,
            },
            result: [
              '"같이 가요. 밥은 반 나누고." 김 병장이 잠깐 멍하다가 전투모를 고쳐 쓴다. "전역 D-30... 아, 29네요." 날짜 세는 것도 잊었다.',
              '병장이 무전기에 귀를 대고 잡음 사이 숫자를 받아 적는다. "내일 06시 잠실 헬기 마지막 수송. 07시 인천항 해군 수송선. 그리고... 06시 한강대교 폭파." 볼펜이 멈춘다.',
              '"그러니까 다리는 6시 전에 건너야 합니다. 1분이라도 늦으면요."',
              '받아 적는 사이 보급 트럭이 먼저 떠난다. 빈손으로, 입 하나를 더 달고 돌아간다. 교감에게 뭐라고 할지는 가면서 생각한다.',
            ],
            next: 'c4_raiders',
          },
        ],
      },
      {
        id: 'radio',
        label: '무전기로 군 주파수를 잡는다',
        hint: '정보가 곧 생존',
        requires: { items: ['radio'] },
        lockedHint: '무전기가 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            effects: { mental: 5, setFlags: ['knowsBroadcast', 'bridgeTimer'], hours: 1 },
            result: [
              '검문소 안테나 옆에서 주파수를 한 칸씩 돌린다. 잡음이 걷히고 또렷한 목소리가 반복된다. 손바닥에 볼펜으로 받아 적는다.',
              '"D+3 06시 잠실 구조 거점 헬기 최종 수송. 07시 인천항 해군 수송선 출항. 06시 한강대교 폭파, 이후 통행 불가." 세 줄이 손바닥에 남는다. 지워지면 안 된다.',
            ],
            next: 'c4_raiders',
          },
        ],
      },
      {
        id: 'drawer',
        label: '통행증 서랍을 뒤진다',
        hint: '걸리면 곤란하다',
        tags: ['cold', 'brave'],
        outcomes: [
          {
            when: { companions: ['soldier'] },
            effects: { addItems: ['pass'], setFlags: ['knowsBroadcast', 'bridgeTimer'], hours: 1 },
            result: [
              '김 병장이 먼저 서랍을 연다. "이거 원래 제 담당이었습니다." 빈 통행증에 직인을 쾅 찍는다. 날짜는 내일.',
              '나오는 길에 병장이 무전을 엿듣고 받아 적는다. "06시 잠실 헬기, 07시 인천항 수송선, 06시 한강대교 폭파." 군대에서 배운 것 중 제일 쓸모 있는 필체다.',
            ],
            next: 'c4_raiders',
          },
          {
            chance: 0.5,
            effects: { addItems: ['pass'], mental: -5, hours: 1 },
            result: [
              '트럭에 짐 싣는 소리를 방패 삼아 초소 서랍을 연다. 직인이 찍힌 임시 통행증 한 장. 주머니에 넣는다.',
              '심장이 귀에서 뛴다. 나오는 길에 아무도 부르지 않는다. 철수하는 군대는 서랍까지 세지 않는다.',
            ],
            next: 'c4_raiders',
          },
          {
            effects: { hp: -10, supply: -10, hours: 1 },
            result: [
              '서랍을 여는 순간 뒤에서 군홧발 소리. "민간인이 여기서 뭐 해!" 중사가 어깨를 거칠게 밀친다. 모래주머니에 넘어진다.',
              '보급 요청서는 찢겨 바닥에 떨어진다. 빈손으로, 멍든 어깨로 돌아간다.',
            ],
            next: 'c4_raiders',
          },
        ],
      },
      {
        id: 'supply',
        label: '보급 상자만 받아 돌아간다',
        hint: '확실한 것만 챙긴다',
        tags: ['careful'],
        outcomes: [
          {
            when: { companions: ['soldier'] },
            effects: { supply: 20, setFlags: ['knowsBroadcast', 'bridgeTimer'], hours: 2 },
            result: [
              '전투식량 한 상자와 생수 두 팩. 트럭에 짐 싣던 상병이 김 병장을 알아보고 한 상자를 더 얹는다. "선임님, 살아 계셨네요."',
              '상병이 속삭인다. "내일 06시 잠실 헬기 마지막, 07시 인천항 배. 한강대교는 06시에 폭파합니다. 저희도 방금 들었습니다."',
            ],
            next: 'c4_raiders',
          },
          {
            effects: { supply: 20, hours: 2 },
            result: [
              '전투식량 한 상자와 생수 두 팩. 대피소 몫으로는 모자라지만 빈손보다 낫다.',
              { when: { noFlags: ['knowsBroadcast'] }, text: '떠나기 직전, 모래주머니 옆 무전기 잡음 속에서 "내일 06시"라는 말만 귀에 걸린다. 무엇이 06시인지는 모른다.' },
              { when: { flags: ['knowsBroadcast'] }, text: '떠나기 직전, 모래주머니 옆 무전기 잡음 속에서 "내일 06시"라는 말이 귀에 걸린다. 받아 적어 둔 잠실, 인천항 옆에 숫자 하나가 붙는다. 어느 쪽이 06시인지는 아직 모른다.' },
            ],
            next: 'c4_raiders',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 6. 약탈자 트럭 ───────────────────────────────
  c4_raiders: {
    id: 'c4_raiders',
    chapter: 4,
    location: 'shelter',
    scene: 'raiders',
    title: '정문의 트럭',
    clock: 65,
    body: [
      '오후 5시. 해가 기울 무렵, 정문 앞에 1톤 트럭 한 대와 오토바이 넷. 짐칸엔 라면 박스, 생수, 기름통이 산처럼 쌓여 있다.',
      '가죽조끼 차림의 남자가 드럼통에 불을 붙인다. 목엔 어느 아파트 경비실에서 챙겨 온 호루라기. "장사하러 왔어요. 술, 라면 받습니다. 없으면... 뭐, 다른 걸로도 받고."',
      '"같이 갈 사람은 트럭에 태워 줍니다. 조건은 하나. 오늘 밤 창고 문 좀 열어 두세요." 운영위원들이 서로 눈치를 본다.',
      { when: { flags: ['c4_suspect'] }, text: '교감이 이쪽을 본다. 도둑 취급받던 사람이 약탈자랑 눈을 맞추는 그림이다. 억울하다.' },
      { when: { flags: ['ateRamen'] }, text: '짐칸의 라면 박스에 눈이 먼저 간다. 첫날 재난문자에 젓가락을 멈추고 반쯤 남긴 그 라면이다. 국물은 끝내 못 마셨다. 그게 아직도 아깝다.' },
    ],
    choices: [
      {
        id: 'ramen',
        label: '라면 박스로 거래한다',
        hint: '라면은 배신하지 않는다',
        requires: { items: ['ramen'] },
        lockedHint: '라면 한 박스만 있었어도…',
        tags: ['meme', 'careful'],
        outcomes: [
          {
            effects: { removeItems: ['ramen'], addItems: ['fuel'], mental: 10, setFlags: ['c4_ramenTrade'], hours: 1 },
            result: [
              '라면 박스를 드럼통 옆에 내려놓는다. 가죽조끼가 박스를 열어 유통기한부터 본다. 진짜 장사꾼이다.',
              '"...기름 한 통." 종말 이후 서울의 환율이 방금 정해졌다. 라면 한 박스는 휘발유 20리터.',
              { when: { flags: ['ateRamen'] }, text: '"라면은 봉지째 부숴 먹어도 맛있죠." 한마디에 가죽조끼가 처음으로 웃는다. 라면에 진심인 사람끼리는 통한다.' },
            ],
            next: 'c4_horde',
          },
        ],
      },
      {
        id: 'soju',
        label: '소주를 건네고 말을 튼다',
        hint: '술자리엔 정보가 돈다',
        requires: { items: ['soju'] },
        lockedHint: '소주 한 병이면 말이 통할 텐데…',
        tags: ['kind', 'meme'],
        outcomes: [
          {
            effects: { removeItems: ['soju'], addItems: ['pass'], mental: 5, setFlags: ['c4_raiderIntel'], hours: 2 },
            result: [
              '소주 뚜껑을 비틀어 딴다. 잔은 없다. 종이컵 두 개. 가죽조끼가 원샷하고 얼굴을 찡그린다. "캬. 사흘 만이다."',
              '석 잔째에 입이 풀린다. 원래 산악회 총무였단다. "북한산 백운대 밑에 형님들 요새 있어. 진짜로. 발전기에 김치냉장고까지."',
              '주머니에서 구겨진 종이를 꺼내 던진다. 직인 찍힌 군 통행증. "철수 트럭에서 떨어진 거. 나 같은 인상은 써도 안 통해."',
            ],
            next: 'c4_horde',
          },
        ],
      },
      {
        id: 'deal',
        label: '그들의 제안을 받아들인다',
        hint: '편하지만 찜찜하다',
        tags: ['cold'],
        outcomes: [
          {
            when: { flags: ['c4_knowsStorage'] },
            effects: { supply: 25, mental: -15, setFlags: ['raidersDeal'], hours: 1 },
            result: [
              '과학실 위치, 헐거운 창문 걸쇠까지 불어 준다. 가죽조끼가 휘파람을 분다. "정보 좋네. 선불." 생수 한 팩과 라면이 건너온다.',
              '"해 지면, 저녁 7시. 트럭 헤드라이트 세 번. 그게 신호야." 등 뒤 강당에서 아이 웃음소리가 들린다. 못 들은 척한다.',
            ],
            next: 'c4_horde',
          },
          {
            effects: { supply: 20, mental: -10, setFlags: ['raidersDeal'], hours: 1 },
            result: [
              '고개를 끄덕인다. 가죽조끼가 이를 드러내며 웃는다. "말 통하네. 선불." 생수 한 팩과 라면 몇 봉지가 건너온다.',
              '"해 지면, 저녁 7시. 트럭 헤드라이트 세 번. 그게 신호야. 창고 문 잊지 말고." 약속이란 게 이렇게 가벼운 소리였나.',
            ],
            next: 'c4_horde',
          },
        ],
      },
      {
        id: 'fight',
        label: '정문을 막고 맞선다',
        hint: '맨손이면 죽을 수도 있다',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            when: { anyItems: ['bat', 'crowbar'] },
            effects: { hp: -10, mental: 10, setFlags: ['c4_repelled'], hours: 1 },
            result: [
              '손에 쥔 걸 들고 정문 한가운데 선다. 오토바이 하나가 돌진하다 급정거한다. 서로 누가 더 미쳤는지 재는 몇 초.',
              '가죽조끼가 먼저 침을 뱉는다. "재수 없게." 트럭이 돌아간다. 강당에서 박수가 터진다. 어깨가 빠질 것처럼 아프다.',
            ],
            next: 'c4_horde',
          },
          {
            when: { companions: ['soldier'] },
            effects: { hp: -10, mental: 10, setFlags: ['c4_repelled'], hours: 1 },
            result: [
              '김 병장이 옆에 선다. 총은 없는데 군복이 있다. "여기 군 관리 시설입니다. 3분 뒤 1개 분대 복귀합니다." 새빨간 거짓말이다.',
              '가죽조끼가 병장 얼굴을 한참 본다. 그리고 손을 든다. 트럭이 돌아간다. 병장이 주저앉는다. "분대는... 어디 있는지 저도 모릅니다."',
            ],
            next: 'c4_horde',
          },
          {
            when: { flags: ['c4_workCrew'] },
            effects: { hp: -15, mental: 5, setFlags: ['c4_repelled'], hours: 1 },
            result: [
              '경비조 호루라기를 분다. 담장 보수하던 동료들이 삽과 대걸레를 들고 달려온다. 꼴은 우스운데 숫자는 이쪽이 많다.',
              '밀고 밀리는 몇 분. 이마가 찢기고 트럭이 물러난다. 경비조 곱빼기 배급이 오늘 제값을 한다.',
            ],
            next: 'c4_horde',
          },
          {
            when: { items: ['soju'] },
            effects: { removeItems: ['soju'], hp: -10, mental: 10, setFlags: ['c4_repelled'], hours: 1 },
            result: [
              '소주병 주둥이에 손수건을 쑤셔 넣고 드럼통 불에 댄다. 마시면 용기, 던지면 화염병. 오늘은 후자다.',
              '트럭 앞바퀴 앞에서 병이 깨지고 불길이 번진다. 오토바이들이 먼저 뒷걸음친다. 가죽조끼가 욕을 하며 트럭을 뺀다. "미친 거 아냐?" 맞다. 오늘만.',
            ],
            next: 'c4_horde',
          },
          {
            chance: 0.4,
            effects: { hp: -25, mental: 5, setFlags: ['c4_repelled'], hours: 1 },
            result: [
              '맨손으로 정문에 선다. 쇠파이프가 옆구리를 스친다. 숨이 멎는다. 그래도 안 비킨다.',
              '강당에서 사람들이 하나둘 나와 뒤에 선다. 스무 명, 서른 명. 가죽조끼가 숫자를 세고 트럭을 돌린다. 갈비뼈에 금이 간 것 같다.',
            ],
            next: 'c4_horde',
          },
          {
            when: { max: { hp: 40 } },
            effects: { hp: -40, hours: 1 },
            result: [
              '맨손이다. 알고 있었다. 이미 너무 많이 다친 몸이라는 것도. 쇠파이프가 한 번, 두 번. 흙바닥이 뺨에 닿는다.',
              '트럭 헤드라이트가 눈을 찌른다. 누가 이름을 부르는 것 같은데, 소리가 점점 멀어진다.',
            ],
            next: 'end:dead',
          },
          {
            effects: { hp: -30, supply: -15, mental: -10, removeItems: ['ramen', 'soju', 'fuel'], hours: 1 },
            result: [
              '맨손이다. 알고 있었다. 쇠파이프가 한 번, 두 번. 흙바닥이 뺨에 닿는다. 일어나려는데 누가 등을 발로 짓누른다.',
              '가죽조끼가 이쪽 가방을 뒤집어 털고 먹을 것, 마실 것, 기름 냄새 나는 것부터 챙긴다. "영웅 놀이 값." 트럭이 떠날 때까지 아무도 강당에서 나오지 않는다. 그게 제일 아프다.',
            ],
            next: 'c4_horde',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 7. 대피소 붕괴 ───────────────────────────────
  c4_horde: {
    id: 'c4_horde',
    chapter: 4,
    location: 'shelter',
    scene: 'horde',
    title: '무너지는 밤',
    clock: 67,
    alert: {
      kind: 'disaster',
      from: '행정안전부',
      text: '[행정안전부] 강북 일대 대피소 3곳 감염자 유입. 인근 주민은 한강 방향으로 즉시 이동 바랍니다. 야간 이동 시 소음 자제.',
    },
    body: [
      '저녁 7시. 해가 지자마자 운동장 철망이 먼저 운다. 하나가 달려와 부딪힌다. 둘, 다섯, 그다음은 셀 수 없다.',
      { when: { flags: ['raidersDeal'] }, text: '창고 쪽이다. 열어 두기로 한 그 문으로, 약탈자보다 저것들이 먼저 들어왔다. 정문 밖에서 트럭 헤드라이트가 세 번 깜빡인다.' },
      { when: { companions: ['kongi'], flags: ['c4_guardDog'] }, text: '철망보다 콩이가 먼저 운다. 경보견 두 번째 출근, 이번에도 1분 빠르다. 그 1분 사이에 강당 절반이 신발을 신는다.' },
      { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '운동장 한가운데 체육 창고에서 콩이가 미친 듯 짖는다. 창고와 강당 사이, 저것들이 달리고 있다.' },
      { when: { flags: ['c4_letOut'] }, text: '철망에 제일 먼저 매달린 것은 파란 운동화를 신고 있다. 낮에 급식실 뒷문에서 끈을 두 번 묶던 그 운동화다.' },
      '누가 호루라기를 분다. 아무도 듣지 않는다. 강당 불이 나간다.',
    ],
    choices: [
      {
        id: 'storage',
        label: '창고 보급을 챙겨 뛴다',
        hint: '빠르게, 무겁게',
        requires: { flags: ['c4_knowsStorage'] },
        lockedHint: '과학실 창문 걸쇠까지 봐 뒀다면…',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            effects: { supply: 25, hp: -5, mental: -10, hours: 1 },
            result: [
              '과학실 창문 걸쇠. 어젯밤 봐 둔 그대로다. 생수 두 팩, 참치캔, 쌀 한 봉지를 가방에 쑤셔 넣는다. 이백 명 몫의 창고에서 한 사람 몫만 챙길 시간이 있다.',
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '창고로 달려가 문을 걷어찬다. 콩이가 품으로 뛰어든다. 심장 두 개가 같이 뛴다.' },
              '창밖으로 뛰어내릴 때 복도 끝에서 뭔가 이쪽으로 방향을 튼다. 한 번도 돌아보지 않고 담을 넘는다.',
            ],
            next: 'c4_exit',
          },
        ],
      },
      {
        id: 'lead',
        label: '사람들을 뒷문으로 이끈다',
        hint: '느리지만 여럿이 산다',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { companions: ['soldier'] },
            effects: { hp: -5, mental: 15, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '김 병장이 소리친다. "두 줄로! 앞사람 어깨 잡고! 뛰지 말고 걸어!" 이상하게 다들 말을 듣는다. 군대 목소리는 따로 있다.',
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '줄이 창고 앞을 지날 때 문을 열어 콩이를 안아 든다. 콩이가 줄 맨 앞에서 길을 찾는다.' },
              '급식실 뒷문으로 마흔 명이 빠져나간다. 마지막 사람이 나가고 문이 닫힐 때, 누가 이쪽 손을 꽉 잡았다 놓는다.',
            ],
            next: 'c4_exit',
          },
          {
            when: { items: ['gasmask'] },
            effects: { hp: -5, mental: 15, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '난로가 넘어졌는지 강당 복도에 매운 연기가 깔린다. 방독면 끈을 조이고 맨 앞에 선다. 연기 속에서 제대로 숨 쉬는 사람은 나 하나다.',
              '"이쪽!" 방독면 안에서 목소리가 웅웅 울린다. 그게 무슨 방송처럼 들렸는지 다들 따라온다. 휴대폰 불빛 수십 개가 연기 속에서 한 줄로 흔들린다.',
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '줄이 창고 앞을 지날 때 문을 걷어찬다. 콩이가 튀어나와 발목에 붙는다. 연기 속에서도 냄새로 나를 찾는다.' },
              '급식실 뒷문으로 마흔 명 가까이 빠져나간다. 운동장에서 방독면을 벗는다. 아이 하나가 "우주인인 줄 알았어요" 한다. 오늘 밤은 우주인이어도 된다.',
            ],
            next: 'c4_exit',
          },
          {
            chance: 0.5,
            effects: { hp: -10, mental: 10, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '"이쪽! 급식실!" 목이 찢어져라 외친다. 휴대폰 불빛 수십 개가 이쪽으로 흔들리며 따라온다.',
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '가는 길에 창고 문을 걷어찬다. 콩이가 튀어나와 발목에 붙는다. 이번엔 안 놓친다.' },
              '서른 명 넘게 빠져나간다. 무릎이 까지고 목이 쉬었다. 그래도 세어 본 숫자가 줄지 않았다.',
            ],
            next: 'c4_exit',
          },
          {
            effects: { hp: -25, mental: -10, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '"이쪽!" 외치는 순간 그 소리를 저것들도 듣는다. 뒷문 앞에서 줄이 엉킨다. 누가 넘어지고, 누가 밟히고, 누가 뒤로 끌려간다.',
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '창고 문을 열자 콩이가 다리 사이로 뛰어든다. 그것 하나만은 제대로 됐다.' },
              '빠져나간 건 열 몇 명. 다 데려오지 못했다. 등 뒤에서 들리던 이름 하나가 오래 귀에 남는다.',
            ],
            next: 'c4_exit',
          },
        ],
      },
      {
        id: 'hero',
        label: '남아서 강당 문을 막는다',
        hint: '돌아올 수 없을지도 모른다',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            // "~지도 모른다" — 힌트대로 확정 사망이 아니다. 버텨 낸 사람만 5장에 간다.
            chance: 0.4,
            effects: { hp: -30, mental: 10, setFlags: ['savedStranger'], hours: 1 },
            result: [
              '강당 쌍여닫이 문 손잡이에 대걸레 자루를 끼우고 등으로 막는다. 문이 등 뒤에서 쿵, 쿵 울린다.',
              { when: { anyCompanions: ['grandma', 'minjun', 'nurse', 'rider', 'soldier'] }, text: '일행을 뒷문으로 떠민다. "먼저 가. 금방 따라갈게." 거짓말인 줄 알았다. 말하는 사람도.' },
              '서른을 센다. 서른한 번째에 경첩이 먼저 비명을 지른다. 등을 떼고 무대 위로 뛴다. 무대 뒤 환기창, 어깨가 겨우 들어가는 크기다. 유리에 팔뚝이 길게 긁힌다.',
              '운동장 흙바닥에 떨어져 한참을 못 일어난다. 담장 너머에서 손전등 하나가 이쪽을 비춘다. 먼저 간 줄 알았던 사람들이, 기다리고 있었다.',
              { when: { companions: ['kongi', 'grandma'], noFlags: ['c4_kongiShed'] }, text: '할머니 조끼 자락 밑에서 콩이가 버둥거리다 뛰어내린다. 절뚝이는 발목에 코를 박고 떨어지지 않는다. "이놈이 내내 문 쪽만 봤다." 할머니가 코를 훌쩍인다.' },
              { when: { companions: ['kongi'], noCompanions: ['grandma'], noFlags: ['c4_kongiShed'] }, text: '교감 품에서 콩이가 버둥거리다 뛰어내린다. 절뚝이는 발목에 코를 박고 떨어지지 않는다.' },
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '손전등 든 사람 발치에 콩이가 있다. 누군가 창고 문을 열어 준 것이다. 부탁하지도 않은 걸, 누가 해 줬다.' },
            ],
            next: 'c4_exit',
          },
          {
            effects: { hours: 1 },
            result: [
              '강당 쌍여닫이 문 손잡이에 대걸레 자루를 끼우고 등으로 막는다. 문이 등 뒤에서 쿵, 쿵 울린다.',
              { when: { anyCompanions: ['grandma', 'minjun', 'nurse', 'rider', 'soldier'] }, text: '일행을 뒷문으로 떠민다. "먼저 가. 금방 따라갈게." 거짓말이 이렇게 쉽게 나온다.' },
              { when: { companions: ['kongi', 'grandma'], noFlags: ['c4_kongiShed'] }, text: '콩이를 할머니 품에 떠안긴다. "추울라." 할머니가 조끼 자락으로 콩이를 덮는다. 콩이는 안겨 가면서도 끝까지 이쪽을 본다. 접힌 귀가, 마지막까지 보인다.' },
              { when: { companions: ['kongi'], noCompanions: ['grandma'], noFlags: ['c4_kongiShed'] }, text: '콩이를 교감 품에 떠안긴다. 콩이는 안겨 가면서도 끝까지 이쪽을 본다. 접힌 귀가, 마지막까지 보인다.' },
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '뛰어가는 등마다 대고 외친다. "체육 창고! 개 한 마리 있어요! 콩이예요!" 누군가 돌아보고 고개를 끄덕인다. 창고 쪽으로 손전등 하나가 꺾인다. 그걸로 됐다.' },
              '쿵, 쿵. 등 뒤 문이 울릴 때마다 숫자를 센다. 뒷문으로 빠져나가는 발소리가 하나라도 더 들리도록.',
            ],
            next: 'end:hero',
          },
        ],
      },
      {
        id: 'window',
        label: '일행만 챙겨 창문으로 뛴다',
        hint: '빠르지만 돌아보지 말 것',
        tags: ['cold', 'careful'],
        outcomes: [
          {
            effects: { hp: -5, mental: -15, setFlags: ['abandonedSomeone'], hours: 1 },
            result: [
              '강당 뒤편 창문. 매트를 깔고 넘는다. 등 뒤에서 누가 "같이 가요!" 한다. 대답 대신 걸음이 빨라진다.',
              { when: { companions: ['kongi'], flags: ['c4_kongiShed'] }, text: '담장으로 가는 길에 체육 창고 문을 연다. 이건 절대 두고 가지 않는다. 콩이가 품으로 뛰어든다.' },
              '담 위에서 딱 한 번 돌아본다. 강당 창문마다 휴대폰 불빛이 흔들린다. 다시는 돌아보지 않는다.',
            ],
            next: 'c4_exit',
          },
        ],
      },
    ],
  },

  // ─────────────────────────────── 8. 최종 목적지 ───────────────────────────────
  c4_exit: {
    id: 'c4_exit',
    chapter: 4,
    location: 'checkpoint',
    scene: 'campfire',
    title: '갈림길의 모닥불',
    clock: 68,
    body: [
      '밤 8시. 강변 둑 아래, 누가 버리고 간 캠핑 의자 몇 개와 드럼통 불. 등 뒤로 학교 강당이 주황색으로 타오른다.',
      { when: { flags: ['bridgeTimer'] }, text: '받아 적은 숫자를 다시 본다. 06시 잠실 헬기 마지막. 07시 인천항 수송선. 06시 한강대교 폭파. 남은 시간은 열 시간.' },
      { when: { flags: ['knowsBroadcast'], noFlags: ['bridgeTimer'] }, text: '받아 적은 두 줄을 다시 본다. 잠실 헬기 거점, 인천항 수송선. 언제까지인지는 어디에도 적혀 있지 않다.' },
      { when: { noFlags: ['knowsBroadcast'] }, text: '헬기가 뜬다는 말, 배가 온다는 말, 산에 요새가 있다는 말. 전부 누가 누구한테 들은 얘기다. 확인된 건 하나도 없다.' },
      { when: { companions: ['kongi'] }, text: '콩이가 무릎에 턱을 올린다. 접힌 귀에 재가 앉아 있다. 털어 준다. 콩이가 눈을 감는다.' },
      { when: { flags: ['promisedMom'] }, text: '엄마한테 살아서 가겠다고 했다. "밥은 묵었나" 소리를 한 번만 더 들으면 된다.' },
    ],
    choices: [
      {
        id: 'bridge',
        label: '한강대교 건너 잠실로 간다',
        hint: '헬기, 단 다리가 관건',
        tags: ['brave'],
        outcomes: [
          {
            when: { flags: ['bridgeTimer'] },
            effects: { mental: 5, hours: 1 },
            result: [
              '06시 전에 다리를 건넌다. 잠실까지 걸어서 몇 시간, 헬기 마지막 편. 계산은 끝났다.',
              { when: { companions: ['soldier'] }, text: '김 병장이 시계를 맞춘다. "다리 위에선 멈추지 않습니다. 무슨 일이 있어도."' },
              '둑 위로 올라선다. 강 건너 불빛이 멀다. 그래도 저기 있다.',
            ],
            next: 'c5_bridge',
          },
          {
            effects: { mental: -5, hours: 1 },
            result: [
              { when: { noFlags: ['knowsBroadcast'] }, text: '잠실에서 헬기가 뜬다는 소문 하나. 언제인지, 다리가 멀쩡한지는 모른다.' },
              { when: { flags: ['knowsBroadcast'] }, text: '잠실 헬기 거점. 손바닥에 적힌 건 거기까지다. 언제까지인지, 다리가 멀쩡한지는 모른다.' },
              '모르는 채로 둑 위로 올라선다. 모르는 게 약일 때도 있다. 대개는 아니다.',
            ],
            next: 'c5_bridge',
          },
        ],
      },
      {
        id: 'harbor',
        label: '인천항 수송선을 노린다',
        hint: '멀지만 배는 크다',
        tags: ['careful'],
        outcomes: [
          {
            when: { items: ['carKey', 'fuel'] },
            effects: { mental: 10, hours: 2 },
            result: [
              '어둠을 틈타 마지막으로 차를 세워 둔 곳까지 되돌아간다. 내 차는 그 자리에 있다. 기름통을 들이붓자 반 칸이던 바늘이 끝까지 올라간다. 시동이 한 번에 걸린다. 울 뻔한다.',
              '헤드라이트를 끄고 강변북로를 서쪽으로. 인천까지, 기름은 충분하다.',
            ],
            next: 'c5_harbor',
          },
          {
            when: { companions: ['rider'] },
            effects: { mental: 5, hours: 2 },
            result: [
              '용석이 앞장선다. "해안도로요. 제2경인은 막혔어요. 배달 콜 오던 길로 가면 돼요."',
              '골목, 담벼락, 주차장 개구멍. 서울 지도에 없는 길로 서쪽을 향한다.',
            ],
            next: 'c5_harbor',
          },
          {
            when: { flags: ['c4_riderMap'] },
            effects: { mental: 5, hours: 2 },
            result: [
              '배급표 뒷면 지도를 펼친다. X는 피하고 동그라미에서 쉰다. 용석의 볼펜 자국이 그대로 길이 된다.',
              '세 번째 동그라미 편의점 문에 누가 매직으로 써 놨다. "인천 가는 분 물 챙겨 가세요." 글씨가 용석 것 같다. 아닐 수도 있다.',
            ],
            next: 'c5_harbor',
          },
          {
            when: { items: ['bike'] },
            effects: { hp: -5, hours: 2 },
            result: [
              '따릉이 페달을 밟는다. 대여 시간 초과 알림은 이미 수백 건일 것이다. 서쪽으로, 40킬로미터.',
              '허벅지가 타들어 간다. 출퇴근 때 이걸 탔으면 지금쯤 허벅지가 달랐을 거다. 종말이 와서야 운동 루틴이 생겼다.',
            ],
            next: 'c5_harbor',
          },
          {
            when: { items: ['medkit'] },
            effects: { hp: -8, supply: -10, hours: 3 },
            result: [
              { when: { noItems: ['powerbank'] }, text: '걸어서 인천까지. 지도 앱은 "도보 10시간"이라고 했다가 배터리와 함께 꺼진다.' },
              { when: { items: ['powerbank'] }, text: '걸어서 인천까지. 지도 앱이 "도보 10시간"이라고 한다. 보조배터리를 아끼려고 화면을 끈다. 10시간은 외워 두면 된다.' },
              '세 시간째에 발뒤꿈치가 터진다. 구급상자를 연다. 소독약, 거즈, 붕대로 발을 칭칭 감는다. 물린 상처엔 소용없다던 상자가 물집엔 기가 막히게 듣는다. 다시 걷는다.',
            ],
            next: 'c5_harbor',
          },
          {
            effects: { hp: -15, supply: -10, hours: 3 },
            result: [
              { when: { noItems: ['powerbank'] }, text: '걸어서 인천까지. 지도 앱은 "도보 10시간"이라고 했다가 배터리와 함께 꺼진다.' },
              { when: { items: ['powerbank'] }, text: '걸어서 인천까지. 지도 앱이 "도보 10시간"이라고 한다. 보조배터리를 아끼려고 화면을 끈다. 10시간은 외워 두면 된다.' },
              '세 시간을 걷는다. 발바닥이 먼저 항복하고, 그다음 무릎이 항복한다. 마음만 아직 버틴다. 표지판은 아직도 인천 40km라고 우긴다.',
            ],
            next: 'c5_harbor',
          },
        ],
      },
      {
        id: 'mountain',
        label: '북한산 요새로 올라간다',
        hint: '헬기도 배도 없는 곳',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['c4_raiderIntel'] },
            effects: { mental: 10, hours: 2 },
            result: [
              '가죽조끼가 말한 백운대 밑. 발전기에 김치냉장고까지. 소주 석 잔에 받은 정보를 믿어 보기로 한다.',
              '도시가 불타는 반대 방향, 북쪽으로. 어둠 속 능선이 생각보다 가깝다.',
            ],
            next: 'c5_mountain',
          },
          {
            effects: { hp: -5, mental: -5, hours: 2 },
            result: [
              '"등산복 아저씨들이 산에 요새를 만들었대." 대피소에서 세 사람한테 들은 소문이다. 셋 다 누구한테 들었는지는 몰랐다.',
              '그래도 산에는 사람이 적고, 저것들은 사람 많은 곳에 모인다. 그거 하나 믿고 북쪽으로 걷는다.',
            ],
            next: 'c5_mountain',
          },
        ],
      },
      {
        id: 'truck',
        label: '약탈자 트럭에 올라탄다',
        hint: '약속을 믿을 수 있나',
        requires: { flags: ['raidersDeal'] },
        tags: ['cold'],
        outcomes: [
          {
            chance: 0.4,
            effects: { mental: -10, supply: 10, hours: 2 },
            result: [
              '헤드라이트 세 번. 트럭 짐칸에 올라탄다. 가죽조끼가 뒤를 돌아보며 턱짓한다. "인천. 배 탄다며. 약속은 약속이니까."',
              '짐칸에서 누가 라면 한 봉지를 던져 준다. 강당에서 가져온 것이다. 목에 걸려도 삼킨다.',
              '트럭은 서울 서쪽 끝 공장 지대 입구에서 선다. "여기까지. 기름 아껴야 돼. 인천은 알아서 가." 약속의 절반은 지켜졌다. 이 사람들 기준으로는 후한 편이다.',
            ],
            next: 'c5_harbor',
          },
          {
            effects: { hours: 2 },
            result: [
              '헤드라이트 세 번. 짐칸에 올라타자마자 트럭이 출발한다. 강변북로가 아니라 공장 지대 쪽이다.',
              '"인천 가는 거 맞죠?" 짐칸에서 소리쳐 묻는다. "아, 그거." 가죽조끼가 담배에 불을 붙인다. "창고 문 열어 준 사람을 어떻게 믿어. 한 번 판 사람은 두 번도 팔지."',
            ],
            next: 'end:betrayed',
          },
        ],
      },
    ],
  },
};
