import type { CompanionId, Condition, ItemId, StoryNode } from '../types';

/**
 * 5장 "탈출" (D+2 20:00 ~ D+3 07:00)
 *
 * 루트 A 한강대교 → 잠실 헬기:  c5_bridge → c5_bridge_check → c5_bridge_horde → c5_stadium → c5_heli_seat
 * 루트 B 인천항 수송선:          c5_harbor → c5_harbor_road → c5_harbor_gate → c5_harbor_boat
 * 루트 C 북한산 산악회:          c5_mountain → c5_mountain_gate → c5_mountain_camp → c5_mountain_night
 *
 * 챕터 로컬 플래그: c5_hidKongi, c5_kongiShelter, c5_navyList, c5_clubMember, c5_sawRaiders
 */

/** 사람 동료(콩이 제외) */
const PEOPLE: CompanionId[] = ['grandma', 'minjun', 'nurse', 'rider', 'soldier'];
/** 전 동행 */
const EVERYONE: CompanionId[] = ['kongi', ...PEOPLE];
/** 휘두를 수 있는 것 */
const WEAPONS: ItemId[] = ['bat', 'crowbar', 'extinguisher'];

/**
 * savedStranger 는 여러 챕터가 공유하는 범용 플래그라 "누구를" 구했는지 모른다.
 * - SAVED_KID: 1장 12층에서 소리쳐 놀이터 아이를 경비실로 보낸 경우 → 경비아저씨로 특정
 * - SAVED_OTHER: 그 밖의 구출. 구해 준 사람이 지금 동행(민준·용석)일 수 있으면 '다른 곳의 그 사람'이 성립하지 않으므로 제외
 */
const SAVED_KID: Condition = { flags: ['c1_shouted', 'savedStranger'] };
const SAVED_OTHER: Condition = { flags: ['savedStranger'], noFlags: ['c1_shouted'], noCompanions: ['minjun', 'rider'] };

export const c5: Record<string, StoryNode> = {
  // ═══════════════════════════════ 루트 A — 한강대교 → 잠실 ═══════════════════════════════

  c5_bridge: {
    id: 'c5_bridge',
    chapter: 5,
    location: 'bridge',
    scene: 'han_bridge',
    title: '한강대교 북단',
    clock: 68,
    alert: {
      kind: 'radio',
      from: '국군 재난방송',
      text: '한강 이남 이동 인원은 한강대교 북단 검문소로 집결 바람. 체온·교상 검사 후 통과. 잠실 구조 거점 최종 수송은 내일 새벽. 반복한다.',
    },
    body: [
      '밤 아홉 시. 한강대교 북단은 버려진 차로 꽉 막혀 있다. 트렁크가 열린 SUV, 비상등이 아직 깜빡이는 택시, 조수석 문이 열린 채 멈춘 학원 버스.',
      '다리 입구엔 모래주머니와 철조망. 탐조등 두 줄기가 검은 강물을 번갈아 훑는다. 검문소 앞 줄은 백 미터가 넘는다. 다들 등산 가방 하나씩 메고, 다들 말이 없다.',
      {
        when: { flags: ['bridgeTimer'] },
        text: '06시 폭파. 머릿속에서 숫자가 똑딱거린다. 지금이 21시, 남은 건 아홉 시간. 넉넉한 것 같다가도 이 줄을 보면 아니다.',
      },
      {
        when: { noFlags: ['bridgeTimer'] },
        text: '교각마다 초록색 상자가 청테이프로 칭칭 감겨 있다. 군인들이 그 옆을 지날 때마다 걸음이 빨라진다. 무슨 상자인지 아무도 말해 주지 않는다.',
      },
      {
        when: { flags: ['knowsBroadcast'] },
        text: '방송에서 들은 잠실 헬기. 이 다리만 건너면 된다. 말로 하면 한 줄이다. 걸으면 한 밤이다.',
      },
      {
        when: { companions: ['kongi'] },
        text: '콩이가 강바람에 귀를 납작하게 붙인다. 접힌 쪽 귀만 바람에 팔랑거린다.',
      },
    ],
    choices: [
      {
        id: 'queue',
        label: '검문소 줄 끝에 선다',
        hint: '확실하지만 느리다',
        tags: ['careful'],
        outcomes: [
          {
            when: { companions: ['soldier'] },
            effects: { hours: 1, mental: 5 },
            result: [
              '김 병장이 줄을 벗어나 초소로 성큼성큼 간다. 경례, 소속, 군번. 초병이 무전기에 대고 뭐라 하더니 고개를 끄덕인다.',
              '"민간인 인솔 중이랍니다." 줄 맨 앞으로 불려 간다. 뒤에서 욕이 날아온다. 김 병장이 들은 척도 안 한다. "전역 D-29입니다. 이 정도는 해야죠."',
            ],
            next: 'c5_bridge_check',
          },
          {
            effects: { hours: 3, supply: -5 },
            result: [
              '두 시간 반. 앞사람 배낭에 달린 곰돌이 키링만 쳐다본다. 줄은 한 번에 세 걸음씩 줄어든다.',
              '누가 컵라면을 뜯는다. 뜨거운 물도 없이 생라면을 씹는다. 오도독, 오도독. 그 소리가 이상하게 위로가 된다.',
              {
                when: { min: { supply: 10 } },
                text: '가방 바닥에서 건빵 몇 알을 찾아 씹는다. 아껴 먹으려 했는데 입이 먼저 움직인다.',
              },
              {
                when: { max: { supply: 9 } },
                text: '가방을 뒤진다. 빈 과자 봉지만 나온다. 부스러기를 털어 입에 넣는다. 짠맛이 난다. 그걸로 됐다.',
              },
            ],
            next: 'c5_bridge_check',
          },
        ],
      },
      {
        id: 'pass',
        label: '통행증을 들고 초소로 간다',
        hint: '검사를 건너뛴다',
        requires: { items: ['pass'] },
        lockedHint: '군 통행증이 있었다면…',
        tags: ['cold'],
        outcomes: [
          {
            effects: { hours: 1, mental: 5 },
            result: [
              '초병이 통행증 도장을 손전등으로 비춘다. 한 번, 두 번. 그리고 턱짓. "통과. 뒤돌아보지 말고 쭉 가세요."',
              '줄 선 사람들의 시선이 등에 꽂힌다. 종이 한 장이 두 시간 반을 산다. 미안한데, 발은 멈추지 않는다.',
            ],
            next: 'c5_bridge_horde',
          },
        ],
      },
      {
        id: 'sneak',
        label: '차 사이로 몰래 다리에 오른다',
        hint: '검문 없이, 보호도 없이',
        tags: ['brave'],
        outcomes: [
          {
            chance: 0.6,
            effects: { hours: 2, hp: -5 },
            result: [
              '탐조등이 지나가는 박자를 센다. 여덟, 아홉, 지금. 학원 버스 밑으로 기고, 택시 보닛을 넘는다. 무릎이 아스팔트에 쓸린다.',
              '철조망 끝을 돌아 다리 위로 올라선다. 아무도 부르지 않는다. 대신 아무도 지켜 주지 않는다.',
            ],
            next: 'c5_bridge_horde',
          },
          {
            effects: { hours: 2, hp: -10, mental: -10 },
            result: [
              '탐조등이 정확히 얼굴에 멈춘다. 확성기. "거기! 엎드려!" 머리 위로 경고사격이 지나간다. 귀가 멍하다.',
              '병사 둘에게 양팔을 붙잡혀 초소로 끌려간다. "새치기는 격리 대상입니다. 농담 아니고요." 줄 선 사람들이 고소하다는 얼굴로 본다.',
            ],
            next: 'c5_bridge_check',
          },
        ],
      },
      {
        id: 'harbor',
        label: '줄을 버리고 인천항으로 간다',
        hint: '멀다. 대신 배가 있다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 1, mental: -5 },
            result: [
              '다리를 등지고 서쪽으로 돈다. 뒤에서 누가 "저 사람 미쳤나" 한다. 백 미터 줄을 버리는 사람은 흔치 않다.',
              '확성기 소리가 멀어진다. 40킬로. 머릿속으로 계산하다 그만둔다. 계산하면 못 간다.',
            ],
            next: 'c5_harbor',
          },
        ],
      },
    ],
  },

  c5_bridge_check: {
    id: 'c5_bridge_check',
    chapter: 5,
    location: 'bridge',
    scene: 'checkpoint',
    title: '체온 37.5',
    body: [
      '초소 천막 안. 이마에 체온계가 닿는다. 삑. 병사가 숫자를 부르고, 옆 병사가 받아 적는다. 둘 다 눈이 빨갛다. 이틀째 안 잔 얼굴이다.',
      '"소매 걷으세요. 양팔 다. 목도 보겠습니다." 앞사람이 소매를 걷다가 멈칫한다. 병사 둘이 그 사람 양팔을 잡고 천막 뒤로 데려간다. 아무도 쳐다보지 않는다.',
      '천막 기둥에 A4 한 장. 37.5도 이상 또는 교상 발견 시 격리. 예외 없음. 누가 그 밑에 볼펜으로 써 놨다. 엄마 보고 싶다.',
      {
        when: { infected: true },
        text: '소매 아래 물린 자리가 화끈거린다. 이마도 뜨겁다. 저 체온계 앞에 서면 37.5는 가볍게 넘긴다.',
      },
      {
        when: { infected: true, companions: ['nurse'] },
        text: '정지수 간호사가 병사 손의 체온계를 흘끗 본다. 그리고 낮게 말한다. "비접촉식이에요. 이마만 식히면 1도는 떨어져요. 저는 아무 말도 안 했어요."',
      },
      {
        when: { companions: ['kongi'] },
        text: '병사가 콩이를 내려다본다. "개는 다리까지는 괜찮아요. 근데 헬기는 안 태워 줄 거예요." 그 말을 너무 쉽게 한다.',
      },
    ],
    choices: [
      {
        id: 'honest',
        label: '소매를 걷고 검사받는다',
        hint: '거짓 없는 길',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 1, mental: -15 },
            result: [
              '삑. 38.4. 병사가 숫자를 부르지 않는다. 대신 무전기를 든다. "교상 의심 한 명."',
              '소매를 걷기도 전에 양팔이 잡힌다. 천막 뒤, 컨테이너 문이 열린다. 안에서 누가 기침을 한다. 문이 닫힌다.',
            ],
            next: 'end:quarantine',
          },
          {
            effects: { hours: 2, mental: 5 },
            result: [
              '삑. 36.6. 양팔, 목, 종아리까지. 병사가 손등에 파란 도장을 쾅 찍는다. 통과.',
              '도장 잉크가 번진다. 살아 있다는 증명서가 고작 이거다. 그래도 몇 번이고 손등을 본다.',
            ],
            next: 'c5_bridge_horde',
          },
        ],
      },
      {
        id: 'coolHead',
        label: '이마를 강물에 적시고 선다',
        hint: '들키면 끝이다',
        requires: { infected: true },
        tags: ['cold'],
        outcomes: [
          {
            when: { companions: ['nurse'] },
            chance: 0.7,
            effects: { hours: 2, mental: -5, setFlags: ['hiddenBite'] },
            result: [
              '정지수 간호사가 물병에 적신 손수건을 이마에 대 준다. 삼십 초, 일 분. "지금요." 삑. 37.2.',
              '도장이 찍힌다. 손이 떨려서 병사가 손목을 한 번 잡아 준다. "추우세요?" "네, 좀." 거짓말이 쉬워서 무섭다.',
            ],
            next: 'c5_bridge_horde',
          },
          {
            chance: 0.35,
            effects: { hours: 2, mental: -10, setFlags: ['hiddenBite'] },
            result: [
              '둔치 계단 끝에서 강물을 퍼 이마에 끼얹는다. 얼음물이다. 이가 딱딱 부딪힌다.',
              '삑. 37.4. 병사가 한 번 더 잴까 망설이다가 뒤를 본다. 줄이 길다. 도장. 통과. 다리가 풀린다.',
            ],
            next: 'c5_bridge_horde',
          },
          {
            effects: { hours: 1, mental: -15 },
            result: [
              '삑. 38.1. 강물 냄새가 나는 이마를 병사가 이상하게 본다. "소매."',
              '걷을 필요도 없다. 소매 끝에 배어 나온 색이 전부 말해 준다. 컨테이너 문이 열리고, 닫힌다.',
            ],
            next: 'end:quarantine',
          },
        ],
      },
      {
        id: 'feverPill',
        label: '구급상자 해열제를 삼킨다',
        hint: '약효가 돌 때까지 기다린다',
        requires: { items: ['medkit'] },
        lockedHint: '해열제라도 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            chance: 0.6,
            effects: { hours: 2, removeItems: ['medkit'], setFlags: ['hiddenBite'] },
            result: [
              '줄 뒤로 슬쩍 빠져 두 알을 삼킨다. 물도 없이. 한 시간을 벽에 기대 기다린다.',
              '삑. 37.0. 도장이 찍힌다. 약이 열을 누르는 동안에도 소매 밑 상처는 계속 욱신거린다. 시간을 샀을 뿐, 병을 이긴 게 아니다.',
            ],
            next: 'c5_bridge_horde',
          },
          {
            when: { infected: true },
            effects: { hours: 2, removeItems: ['medkit'], mental: -15 },
            result: [
              '약이 돌기 전에 차례가 온다. 삑. 38.0. 병사가 가방을 뒤지다 빈 해열제 껍질을 찾아 든다.',
              '"약 먹고 오는 분들 꼭 있어요." 목소리에 화도 없다. 컨테이너 쪽으로 걷는다. 스스로 걷는다는 게 그나마 위안이다.',
            ],
            next: 'end:quarantine',
          },
          {
            effects: { hours: 2, hp: 10, removeItems: ['medkit'] },
            result: [
              '혹시 몰라 두 알 삼킨다. 열은 원래 없었다. 그래도 체온계 앞에서 심장이 덜 뛴다. 상자를 연 김에 까진 무릎에 소독약도 붓고 붕대를 감는다.',
              '삑. 36.4. 도장. 구급상자는 줄 뒤에서 기침하던 아이 엄마에게 넘긴다. 들고 다니기엔 이제 너무 가볍다.',
            ],
            next: 'c5_bridge_horde',
          },
        ],
      },
      {
        id: 'descend',
        label: '완강기로 둔치까지 내려간다',
        hint: '검문도 없고 발판도 없다',
        requires: { items: ['descender'] },
        lockedHint: '완강기가 있었다면…',
        tags: ['brave', 'careful'],
        outcomes: [
          {
            when: { items: ['flashlight'] },
            effects: { hours: 4, hp: -5, removeItems: ['descender'] },
            result: [
              '난간에 완강기 고리를 건다. 손전등을 입에 물고 로프 끝을 비춘다. 둔치 콘크리트까지 딱 닿는다. 12층 베란다에서 한 번도 안 써 본 걸 여기서 쓴다.',
              '둔치 계류장에 한강 순찰용 고무보트가 묶여 있다. 열쇠는 꽂혀 있다. 강물을 거슬러 동쪽으로. 엔진 소리를 줄이고, 다리 밑으로만. 잠실 선착장이 보일 때 하늘이 조금 밝아진다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이는 가방 안에서 한 번도 짖지 않는다. 보트 바닥에 내려놓자 제일 먼저 뱃머리로 가서 앉는다. 선장 같다.',
              },
            ],
            next: 'c5_stadium',
          },
          {
            chance: 0.5,
            effects: { hours: 4, hp: -15, removeItems: ['descender'] },
            result: [
              '깜깜하다. 로프가 어디서 끝나는지 모른 채 내려간다. 발이 허공을 찬다. 끝. 이 미터 아래로 떨어진다. 발목이 꺾인다.',
              '절뚝거리며 둔치를 따라 걷다 순찰용 고무보트를 찾는다. 강 위로 동쪽. 다리 밑 그림자만 골라 탄다. 잠실에 닿을 때쯤 발목이 두 배가 돼 있다.',
            ],
            next: 'c5_stadium',
          },
          {
            effects: { hours: 4, hp: -30, removeItems: ['descender'] },
            result: [
              '로프가 짧다. 알아챘을 땐 이미 늦다. 사 미터 아래 둔치 잔디로 떨어진다. 한동안 숨이 안 쉬어진다. 갈비뼈 어딘가가 이상한 소리를 낸다.',
              '기다시피 보트까지 간다. 엔진 줄을 당기는 데 세 번, 우는 데 한 번. 그래도 강은 사람보다 조용하다. 잠실까지 흘러간다.',
            ],
            next: 'c5_stadium',
          },
        ],
      },
    ],
  },

  c5_bridge_horde: {
    id: 'c5_bridge_horde',
    chapter: 5,
    location: 'bridge',
    scene: 'horde',
    title: '다리 한가운데',
    body: [
      '다리 중간. 아치 아래로 멈춘 차들이 끝도 없이 이어진다. 누군가 버스 지붕에 올라가 휴대폰 플래시를 흔들다가, 황급히 끈다.',
      '남단 쪽에서 소리가 번진다. 뛰는 발소리. 수십 개. 차 사이로 머리들이 튀어 오른다. 사람 머리 높이로, 사람보다 빠르게.',
      {
        when: { flags: ['bridgeTimer'] },
        text: '시계를 본다. 06시까지는 시간이 있다. 숨어서 떼가 지나가길 기다려도 된다. 너무 오래만 아니면.',
      },
      {
        when: { noFlags: ['bridgeTimer'] },
        text: '교각의 초록 상자에서 빨간 불이 깜빡이기 시작한다. 아까는 꺼져 있던 불이다. 다리 위에 오래 있으면 안 될 것 같은, 설명할 수 없는 기분.',
      },
      {
        when: { companions: ['kongi'] },
        text: '콩이가 품 안에서 이를 드러낸다. 짖기 직전의 떨림이 가슴팍으로 전해진다.',
      },
      {
        when: { companions: ['minjun'] },
        text: '민준이 속삭인다. "수능 두 달도 안 남았는데 이게 맞나." 농담인데 목소리가 떨린다.',
      },
      {
        when: { companions: ['grandma'] },
        text: '할머니가 무릎을 짚고 숨을 고른다. "나 신경 쓰지 말어. 기어서라도 따라가." 기어서 갈 수 있는 거리가 아니다.',
      },
      {
        when: { companions: ['nurse'] },
        text: '정지수 간호사가 일행 쪽으로 몸을 붙인다. 떼 쪽을 보는 눈이 응급실에서 환자 수를 세던 눈이다.',
      },
      {
        when: { companions: ['rider'] },
        text: '용석이 헬멧 끈을 조인다. "뛸 거면 말해요. 저 발은 빨라요."',
      },
      {
        when: { companions: ['soldier'] },
        text: '김 병장이 가드레일 쇠막대를 뽑아 쥔다. "명령만 주십쇼. 아, 제가 명령하는 쪽인가."',
      },
    ],
    choices: [
      {
        id: 'hide',
        label: '버스 밑에 숨어 떼를 보낸다',
        hint: '떼는 피한다. 시간은 못 피한다',
        tags: ['careful'],
        outcomes: [
          {
            when: { flags: ['bridgeTimer'] },
            effects: { hours: 4, mental: -5 },
            result: [
              '시계 알람을 04:00에 맞추고 진동으로 돌린다. 버스 밑 기름 냄새 속에서 발소리가 머리 위로 지나간다. 한 무리, 또 한 무리.',
              '04:00. 손목이 떤다. 조용하다. 기어 나와 남단으로 걷는다. 06시까지 두 시간. 폭파를 알고 있다는 건, 기다려도 되는 시간을 안다는 뜻이다.',
            ],
            next: 'c5_stadium',
          },
          {
            when: { companions: ['kongi'] },
            chance: 0.6,
            effects: { hours: 4, mental: 5 },
            result: [
              '버스 밑에서 깜빡 잠이 든다. 뭔가 뜨뜻하고 축축한 게 얼굴을 쓸어 댄다. 콩이 혀다. 새벽 네 시 반.',
              '콩이가 교각 쪽을 보고 낑낑거린다. 빨간 불이 아까보다 빨리 깜빡인다. 눈치가 사람보다 낫다. 콩이를 안고 남단까지 뛴다.',
            ],
            next: 'c5_stadium',
          },
          {
            chance: 0.4,
            effects: { hours: 4, mental: -10 },
            result: [
              '잠든 줄도 몰랐다. 눈을 뜨니 하늘이 희뿌옇다. 교각의 빨간 불이 미친 듯이 깜빡인다.',
              '생전 처음 그렇게 뛴다. 남단 철조망을 넘을 때 등 뒤로 확성기가 울린다. "폭파 30분 전. 교량 위 인원은 즉시…" 다리가 후들거린다. 늦지 않았다. 아슬아슬하게.',
            ],
            next: 'c5_stadium',
          },
          {
            effects: { hours: 4 },
            result: [
              {
                when: { anyCompanions: PEOPLE },
                text: '버스 밑은 한 사람 자리다. 같이 온 사람들은 먼저 남단으로 보낸다. "금방 따라갈게." 그 말이 마지막이 된다.',
              },
              '떼가 지나간 뒤에도 무서워서 나오지 못한다. 조금만 더. 조금만 더. 눈꺼풀이 무거워진다.',
              '확성기 소리가 꿈처럼 들린다. 무슨 카운트다운 같다. 빨간 불빛이 버스 밑까지 번진다. 06:00.',
              {
                when: { companions: ['kongi'] },
                text: '그 직전, 콩이가 버스 밑을 빠져나가 남단으로 내달린다. 부르지 않는다. 가. 뛰어. 접힌 귀가 새벽빛 속으로 작아진다.',
              },
            ],
            next: 'end:bridge',
          },
        ],
      },
      {
        id: 'molotov',
        label: '소주로 화염병을 만든다',
        hint: '길은 열리지만 시끄럽다',
        requires: { items: ['soju'] },
        lockedHint: '소주 한 병만 있었다면…',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            chance: 0.7,
            effects: { hours: 2, hp: -5, removeItems: ['soju'] },
            result: [
              '양말 한 짝을 병 주둥이에 쑤셔 넣는다. 라이터. 떼 한가운데로 던진다. 병 깨지는 소리, 그리고 불.',
              '초록 병이 이렇게 잘 탈 줄 몰랐다. 떼가 불을 향해 몰리는 사이 반대쪽 난간을 따라 뛴다. 뒤에서 누가 외친다. "그거 빨간 뚜껑이에요, 파란 뚜껑이에요?" 대답할 여유는 없다.',
            ],
            next: 'c5_stadium',
          },
          {
            effects: { hours: 2, hp: -15, removeItems: ['soju'] },
            result: [
              '던지는 순간 손이 미끄러진다. 병이 코앞 트럭 보닛에서 터진다. 불이 번진다. 눈썹이 탄다.',
              '그래도 불은 불이다. 떼가 불길에 머뭇거리는 틈에 연기 속을 기침하며 빠져나온다. 머리카락 탄 냄새가 잠실까지 따라온다.',
            ],
            next: 'c5_stadium',
          },
        ],
      },
      {
        id: 'charge',
        label: '떼를 뚫고 남단으로 뛴다',
        hint: '빠르지만 물릴 수도 있다',
        tags: ['brave'],
        outcomes: [
          {
            when: { anyItems: WEAPONS },
            effects: { hours: 1, hp: -10, mental: -5 },
            result: [
              '앞을 막는 것의 머리만 노린다. 한 번, 두 번. 손목이 저릿하다. 민방위 교육 네 시간이 인생 최고의 투자였던 것 같다.',
              {
                when: { items: ['bat'] },
                text: '방망이 그립 테이프가 땀에 미끄러진다. 사흘 동안 이 손잡이만큼 오래 잡은 손이 없다.',
              },
              '남단 철조망에 도착했을 때 손에 쥔 게 무엇이었는지 기억도 안 난다. 그냥 놓지 않았다는 것만.',
            ],
            next: 'c5_stadium',
          },
          {
            when: { companions: ['soldier'] },
            effects: { hours: 1, hp: -12 },
            result: [
              '김 병장이 앞에 선다. "제 뒤에 붙으십쇼. 오와 열!" 가드레일 뜯은 쇠막대로 길을 연다. 교본에 없는 자세인데 이상하게 믿음직하다.',
              '남단까지 뛰는 동안 김 병장 등만 본다. 도착해서야 그 등에 긁힌 자국이 세 줄 난 걸 본다. "괜찮습니다. 전역하면 다 낫습니다."',
            ],
            next: 'c5_stadium',
          },
          {
            chance: 0.5,
            effects: { hours: 1, hp: -20 },
            result: [
              '무작정 뛴다. 어깨로 부딪히고, 차 지붕을 밟고 넘는다. 누가 발목을 잡는다. 걷어찬다.',
              '남단 철조망에 몸을 던지듯 넘는다. 온몸이 멍투성이다. 그래도 이빨은 안 닿았다. 몇 번이고 팔을 확인한다.',
            ],
            next: 'c5_stadium',
          },
          {
            effects: { hours: 1, hp: -25, infect: true },
            result: [
              '세 걸음 남기고 넘어진다. 무언가가 팔에 매달린다. 뜯어낸다. 뛴다.',
              '남단에 도착해 소매를 걷는다. 반달 모양 자국. 피가 번진다. 아무에게도, 아직, 보여 주지 않는다.',
            ],
            next: 'c5_stadium',
          },
        ],
      },
      {
        id: 'jump',
        label: '난간을 넘어 강으로 뛴다',
        hint: '물리진 않는다. 대신 강이다',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            chance: 0.55,
            effects: { hours: 3, hp: -25, supply: -10 },
            result: [
              '난간을 넘는다. 생각하면 못 한다. 낙하는 짧고 물은 길다. 차가워서 심장이 멎는 줄 안다.',
              '노들섬 쪽 모래톱으로 떠밀려 간다. 가방 속 보급이 절반은 젖었다. 남쪽 둔치를 따라 동쪽으로 걷는다. 잠실까지 젖은 운동화가 찌걱거린다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이는 물에 닿자마자 개헤엄을 친다. 배운 적도 없는데. 모래톱에서 몸을 털어 물을 전부 이쪽으로 뿌린다.',
              },
            ],
            next: 'c5_stadium',
          },
          {
            chance: 0.6,
            effects: { hours: 3, hp: -35, supply: -10 },
            result: [
              '물이 숨을 가져간다. 가라앉았다 떠오르기를 몇 번. 교각 기둥에 부딪혀 옆구리가 찢어진다.',
              '어떻게 남쪽 둔치까지 왔는지 모른다. 모래 위에 엎드려 물을 토한다. 한참을 누워 있다가 일어난다. 걷는 게 아니라 버티는 거다.',
              {
                when: { companions: ['kongi'] },
                text: '눈을 뜨니 콩이가 얼굴을 핥고 있다. 먼저 나와서 기다렸다. 털이 다 젖어서 반쪽만 하다.',
              },
            ],
            next: 'c5_stadium',
          },
          {
            effects: { hours: 1 },
            result: [
              '물은 생각보다 깊고, 생각보다 검다. 위가 어딘지 모르겠다.',
              {
                when: { companions: ['kongi'] },
                text: '품에서 버둥거리는 게 느껴진다. 팔을 푼다. 작은 몸이 물살을 가르며 모래톱 쪽으로 멀어진다. 저 녀석은 헤엄칠 줄 안다. 다행이다.',
              },
              '마지막으로 보이는 건 다리 위 탐조등 불빛이 물속에서 번지는 모양이다. 예쁘다고 생각한다. 그게 마지막 생각이다.',
            ],
            next: 'end:dead',
          },
        ],
      },
    ],
  },

  c5_stadium: {
    id: 'c5_stadium',
    chapter: 5,
    location: 'stadium',
    scene: 'helicopter',
    title: '잠실 구조 거점',
    clock: 73,
    body: [
      '잠실 주경기장. 인조잔디 위에 헬기 두 대가 로터를 천천히 돌린다. 서치라이트가 텅 빈 관중석을 핥고 지나간다. 전광판엔 아직 지난주 경기 점수가 떠 있다.',
      '확성기가 같은 말을 반복한다. "1인 1가방, 5킬로 이하! 반려동물 탑승 불가! 체온 검사 후 탑승!" 줄 옆에 버려진 캐리어가 산처럼 쌓여 있다. 맨 위에 골프백 하나. 누군가는 여기까지 그걸 메고 왔다.',
      '줄 옆 천막에 매직으로 쓴 글씨. 반려동물 임시보호소, 이름·연락처 기재. 안에서 개 수십 마리가 한꺼번에 짖는다.',
      {
        when: { companions: ['kongi'] },
        text: '콩이는 정확히 5킬로다. 지난달 동물병원 체중계가 그랬다. 5킬로 이하, 콩이는 딱 그 선 위에 있다. 문제는 콩이가 가방이 아니라는 거다.',
      },
      {
        when: { flags: ['leftDog'], noCompanions: ['kongi'] },
        text: '임시보호소 천막 쪽으로 저도 모르게 걸음이 간다. 접힌 귀를 찾는다. 없다. 있을 리가 없다. 12층 현관에 두고 왔으니까.',
      },
      {
        when: { noFlags: ['leftDog'], noCompanions: ['kongi'] },
        text: '천막 안 수십 마리 짖는 소리 속에서 저도 모르게 콩이 목소리를 찾는다. 있을 리 없는데도.',
      },
      {
        when: { infected: true },
        text: '줄 끝에 체온계를 든 의무병이 서 있다. 이마가 뜨겁다. 팔이 욱신거린다.',
      },
      {
        when: SAVED_KID,
        text: '줄 앞쪽에서 경비실 제복을 입은 아저씨가 손을 흔든다. 옆에 모래 삽을 쥔 아이. 첫날 놀이터에서 12층 창문을 올려다보던 그 얼굴이다. 입 모양이 크다. 여기, 여기.',
      },
      {
        when: SAVED_OTHER,
        text: '줄 앞쪽에서 누가 이쪽을 보고 손을 흔든다. 알아보는 데 한참 걸린다. 지난 사흘 중 어느 날, 한 번 손을 잡아 끌어 줬던 얼굴이다. 입 모양이 크다. 여기, 여기.',
      },
    ],
    choices: [
      {
        id: 'alone',
        label: '규칙대로 심사를 받는다',
        hint: '규칙은 규칙이다',
        tags: ['careful', 'cold'],
        outcomes: [
          {
            when: { infected: true, companions: ['kongi'] },
            effects: { hours: 1, mental: -15, removeCompanions: ['kongi'], setFlags: ['c5_kongiShelter'] },
            result: [
              '삑. 의무병이 숫자를 읽고 바로 손목을 잡는다. 소매가 걷힌다. 거기 있다. 반달 모양.',
              '콩이 목줄은 자원봉사자 손으로 넘어간다. 17번 번호표. 격리실로 내려가는 계단 위에서 콩이가 한 번 짖는다. 대답하지 못한다.',
              {
                when: { flags: ['hiddenBite'], anyCompanions: PEOPLE },
                text: '같이 온 사람들이 그 장면을 전부 본다. 여기까지 숨겨 온 걸 이렇게 들킨다. 누구 눈도 마주치지 못한다.',
              },
            ],
            next: 'end:quarantine',
          },
          {
            when: { infected: true },
            effects: { hours: 1, mental: -10 },
            result: [
              '삑. 의무병이 숫자를 읽고 바로 손목을 잡는다. 소매가 걷힌다. 거기 있다. 반달 모양.',
              {
                when: { flags: ['hiddenBite'], anyCompanions: PEOPLE },
                text: '뒤에서 같이 온 사람들이 본다. 여기까지 숨겨 온 걸 이렇게 들킨다. 누구 눈도 마주치지 못한다.',
              },
              '헬기 로터 소리가 멀어진다. 경기장 지하, 선수 대기실을 개조한 격리실로 내려간다. 사물함에 아직 등번호 스티커가 붙어 있다.',
            ],
            next: 'end:quarantine',
          },
          {
            when: { companions: ['kongi'] },
            effects: { hours: 1, mental: -25, removeCompanions: ['kongi'], setFlags: ['c5_kongiShelter'] },
            result: [
              '임시보호소 천막. 자원봉사자가 콩이 목줄에 번호표를 건다. 17번. "상황 정리되면 찾으러 오세요. 연락처 적어 주시고요." 그 말을 믿는 척한다.',
              '콩이가 따라오려다 목줄에 걸려 멈춘다. 뒤돌아보지 않으려고 했는데 돌아본다. 접힌 귀가 이쪽을 향해 있다. 천막 안 수십 마리 사이에서 콩이 소리만 들린다.',
              '연락처 칸에 번호를 적는다. 폰이 죽어 있어도 번호는 적는다.',
            ],
            next: 'c5_heli_seat',
          },
          {
            effects: { hours: 2, supply: -5, mental: -5 },
            result: [
              '줄은 세 걸음 가고 오 분 선다. 두 시간 만에 심사대. 삑. 36.5. 가방 무게를 잰다. 4.8킬로. 병사가 가방을 돌려준다. "통과."',
              '남은 헬기는 한 대. 줄은 헬기 앞까지 빽빽하다. 앞에서 몇 명 남았는지 세다가 그만둔다. 발이 퉁퉁 부었다.',
            ],
            next: 'c5_heli_seat',
          },
        ],
      },
      {
        id: 'jacket',
        label: '콩이를 점퍼 안에 숨긴다',
        hint: '짖으면 끝이다',
        requires: { companions: ['kongi'] },
        lockedHint: '콩이가 곁에 있었다면…',
        tags: ['dog', 'brave'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 1, mental: -15, removeCompanions: ['kongi'], setFlags: ['c5_kongiShelter'] },
            result: [
              '점퍼 속 콩이보다 이마가 먼저 들킨다. 삑. 의무병이 손목을 잡는다.',
              '콩이는 자원봉사자 품으로 넘어간다. 격리실로 내려가는 계단에서 뒤를 본다. 17번 번호표를 단 접힌 귀가 버둥거린다.',
            ],
            next: 'end:quarantine',
          },
          {
            when: { flags: ['smuggledDog'] },
            chance: 0.75,
            effects: { hours: 1, mental: 5, setFlags: ['c5_hidKongi'] },
            result: [
              '대피 버스에서 해 본 거다. 콩이도 안다. 점퍼 지퍼를 올리자 콩이가 알아서 몸을 동그랗게 만다. 숨소리까지 줄인다.',
              '가방은 저울 위, 콩이는 가슴 위. 의무병이 체온계를 이마에 대는 동안 콩이 심장이 쿵쿵 뛴다. 삑. 통과. 5킬로짜리 비밀이 헬기 앞까지 간다.',
            ],
            next: 'c5_heli_seat',
          },
          {
            chance: 0.45,
            effects: { hours: 1, setFlags: ['c5_hidKongi'] },
            result: [
              '점퍼 속에서 콩이가 꿈틀거린다. 배가 불룩하다. 의무병이 배를 본다. "배가 좀…" "라면을 많이 먹어서요." 의무병이 웃는다. 이틀 만에 처음 웃는 얼굴이다.',
              '통과. 점퍼 안쪽이 따뜻하게 젖는다. 콩이가 긴장해서 실수했다. 괜찮다. 전혀 괜찮다.',
            ],
            next: 'c5_heli_seat',
          },
          {
            effects: { hours: 1, mental: -5 },
            result: [
              '의무병이 체온계를 드는 순간, 점퍼 속에서 낑. 딱 한 번. 경기장이 조용해진 것 같다.',
              '"개는 안 된다니까요." 화내지도 않는다. 줄 밖으로 밀려난다. 점퍼 지퍼를 내리자 콩이가 고개를 내민다. 미안하다는 얼굴이다. 미안할 게 하나도 없는데.',
              '콩이를 안고 경기장 출구로 걷는다. 등 뒤에서 로터 소리가 커진다. 뒤돌아보지 않는다.',
            ],
            next: 'end:dogbond',
          },
        ],
      },
      {
        id: 'walkAway',
        label: '콩이를 안고 줄에서 나온다',
        hint: '헬기는 포기한다',
        requires: { companions: ['kongi'] },
        tags: ['dog', 'kind'],
        outcomes: [
          {
            when: { flags: ['promisedMom'] },
            effects: { hours: 1, mental: 15 },
            result: [
              '줄에서 한 발 나온다. 엄마 목소리가 들린다. 명절마다 하던 말. "개도 데꼬 온나. 니 그 개 두고 오면 엄마 얼굴 볼 생각 마라."',
              {
                when: { flags: ['leftDog'] },
                text: '한 번은 두고 나왔었다. 엄마가 알면 등짝이다. 두 번은 없다.',
              },
              '웃음이 나온다. 콩이를 고쳐 안는다. 살아서 가겠다고 했지, 헬기 타고 가겠다고는 안 했다.',
            ],
            next: 'end:dogbond',
          },
          {
            effects: { hours: 1, mental: 5 },
            result: [
              '줄에서 한 발 나온다. 뒤에서 사람들이 빈자리로 우르르 당겨 선다. 아무도 붙잡지 않는다.',
              {
                when: { anyCompanions: PEOPLE },
                text: '같이 온 사람들이 줄 안에서 이쪽을 본다. 먼저 가라고 손짓한다. 따라 나올지 말지는 그 사람들 몫이다.',
              },
              '콩이가 품 안에서 고개를 든다. 접힌 귀가 코끝을 간지럽힌다. 헬기 소리를 등지고 경기장 밖으로 걷는다. 이상하게 발이 가볍다.',
            ],
            next: 'end:dogbond',
          },
        ],
      },
      {
        id: 'cutLine',
        label: '아는 얼굴을 찾아 새치기한다',
        hint: '줄은 줄지만 욕을 먹는다',
        requires: { noCompanions: ['kongi'] },
        tags: ['cold', 'meme'],
        outcomes: [
          {
            when: SAVED_KID,
            effects: { hours: 1, mental: 10 },
            result: [
              '경비아저씨가 아이 손을 잡은 채 자리를 비켜 준다. "12층 그 양반 아이가. 그때 소리 안 질렀으면 얘 여기 없어요." 뒤에서 누가 투덜댄다. 아저씨가 돌아서서 호루라기를 한 번 분다. 삼십 년 경비 짬이다.',
              '아무도 더 말하지 않는다. 아이가 모래 삽으로 이쪽 신발을 톡톡 친다. 줄 앞으로 간다. 이런 걸 보답이라고 하나 보다.',
            ],
            next: 'c5_heli_seat',
          },
          {
            when: SAVED_OTHER,
            effects: { hours: 1, mental: 10 },
            result: [
              '손 흔들던 그 사람이 자기 자리를 비켜 준다. "그때 아니었으면 저 여기 없어요." 뒤에서 누가 투덜댄다. 그 사람이 뒤를 돌아 쏘아붙인다. "이 사람한테 목숨 빚진 사람 있으면 나와 봐요."',
              '아무도 안 나온다. 줄 앞으로 간다. 이런 걸 보답이라고 하나 보다.',
            ],
            next: 'c5_heli_seat',
          },
          {
            chance: 0.4,
            effects: { hours: 1, mental: -5 },
            result: [
              '"어? 김 대리님! 여기 계셨어요?" 전혀 모르는 사람 어깨를 친다. 그 사람도 얼떨결에 "아, 네네" 한다. 한국인의 예의가 한 칸을 산다.',
              '뒤통수가 따갑다. 모른 척한다. 종말에도 부끄러운 건 부끄럽다.',
            ],
            next: 'c5_heli_seat',
          },
          {
            effects: { hours: 2, hp: -10, mental: -10 },
            result: [
              '어깨를 비집고 들어가다 등산화에 정강이를 차인다. "줄 서요, 줄! 좀비 사태에도 새치기냐!"',
              '맨 뒤로 밀려난다. 한 시간 반을 다시 선다. 앞사람이 계속 돌아보며 째려본다. 할 말이 없다.',
            ],
            next: 'c5_heli_seat',
          },
        ],
      },
    ],
  },

  c5_heli_seat: {
    id: 'c5_heli_seat',
    chapter: 5,
    location: 'stadium',
    scene: 'helicopter',
    title: '마지막 한 자리',
    clock: 76,
    body: [
      '마지막 헬기다. 로터 바람에 모래가 얼굴을 때린다. 탑승 담당 부사관이 손가락 하나를 세운다. "한 명! 한 명 더!"',
      '줄 맨 앞이다. 바로 뒤에서 아이를 안은 여자가 운다. 아이는 여섯 살쯤. 잠옷 위에 어른 패딩을 걸쳤다. 아이는 울지도 않고 헬기만 본다. 로터 소리에 익숙해진 얼굴이다. 여섯 살이 익숙해질 소리가 아니다.',
      {
        when: { anyCompanions: PEOPLE },
        text: '같이 온 사람들이 뒤에서 이쪽만 본다. 한 자리. 셀 필요도 없는 숫자다. 아무도 먼저 입을 떼지 않는다.',
      },
      {
        when: { companions: ['grandma'] },
        text: '할머니가 손을 휘휘 젓는다. "나는 됐어. 살 만큼 살았어. 너 타, 얼른 타여."',
      },
      {
        when: { companions: ['minjun'] },
        text: '민준이 아무렇지 않은 척 웃는다. "고3 수학여행 취소됐는데, 헬기를 먼저 타 보네요." 눈은 헬기에 가 있다.',
      },
      {
        when: { flags: ['c5_hidKongi'], companions: ['kongi'] },
        text: '점퍼 안에서 콩이 심장이 빠르게 뛴다. 아직 아무도 모른다. 헬기 안에서까지 모를지는 모르겠다.',
      },
      {
        when: { infected: true },
        text: '열이 오른다. 헬기 안은 좁다. 저기서 변하면 저 아이가 제일 가깝다.',
      },
    ],
    choices: [
      {
        id: 'board',
        label: '내가 탄다',
        hint: '살아야 할 이유가 있다',
        tags: ['cold'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 1, mental: -20 },
            result: [
              '헬기에 오른다. 이륙. 서울이 발밑에서 작아진다. 이마의 열이 점점 오른다. 옆자리 아이가 자꾸 이쪽을 본다.',
              '착륙장에서 방호복 입은 사람들이 한 명씩 체온을 잰다. 삑. 손목이 잡힌다. 헬기에서 내린 사람 중 혼자만 다른 방향으로 걷는다. 뒤에서 아이가 손을 흔든다. 다행이다. 아무 일도 없었다.',
              {
                when: { companions: ['kongi'] },
                text: '점퍼 속 콩이는 방호복 입은 사람 품으로 넘어간다. 개는 격리 대상이 아니란다. 그 말이 이렇게 고마울 줄 몰랐다.',
              },
            ],
            next: 'end:quarantine',
          },
          {
            when: { anyCompanions: PEOPLE },
            effects: { hours: 1, mental: -25, removeCompanions: PEOPLE, setFlags: ['abandonedSomeone'] },
            result: [
              '발을 올린다. 뒤를 보지 않는다. 부사관이 문을 닫는다. 창문 너머로 같이 온 얼굴들이 작아진다. 누군가 손을 흔든 것 같다. 확인하지 않는다.',
              '헬기가 한강 위를 지난다. 밤새 매달렸던 한강대교가 장난감처럼 작다. 살았다. 그 말을 속으로 몇 번 한다. 몇 번을 해도 모자란다.',
              {
                when: { companions: ['kongi'], flags: ['c5_hidKongi'] },
                text: '점퍼 안에서 콩이가 턱을 쇄골에 올린다. 그거 하나로 버틴다.',
              },
              {
                when: { flags: ['c5_kongiShelter'] },
                text: '임시보호소 천막이 발밑에서 점이 된다. 17번. 그 숫자를 입안에서 몇 번이고 굴린다.',
              },
            ],
            next: 'end:heli',
          },
          {
            effects: { hours: 1, mental: -10 },
            result: [
              '헬기에 오른다. 아이 엄마의 울음이 로터 소리에 묻힌다. 문이 닫힌다. 창밖은 보지 않으려 한다.',
              '고도가 오르자 서울이 저절로 눈에 들어온다. 곳곳에서 불이 탄다. 12층 우리 집이 저 어디쯤이다.',
              {
                when: { flags: ['promisedMom'] },
                text: '엄마한테 한 약속이 생각난다. 꼭 살아서 간다고. 약속은 지켰다. 대가는 저 아래 두고 왔다.',
              },
              {
                when: { companions: ['kongi'], flags: ['c5_hidKongi'] },
                text: '이륙하고 삼 분 뒤, 점퍼 속에서 콩이가 재채기를 한다. 부사관이 돌아본다. 한참 보다가, 못 들은 척 앞을 본다.',
              },
              {
                when: { flags: ['c5_kongiShelter'] },
                text: '경기장 한쪽 임시보호소 천막이 발밑에서 점이 된다. 저 안 어딘가에 17번이 있다. 짖는 소리가 들릴 리 없는데, 들린다.',
              },
            ],
            next: 'end:heli',
          },
        ],
      },
      {
        id: 'yieldChild',
        label: '아이에게 자리를 양보한다',
        hint: '다음은 없을지도',
        tags: ['kind'],
        outcomes: [
          {
            effects: { hours: 1, mental: 20 },
            result: [
              '옆으로 비킨다. "타세요." 아이 엄마가 무슨 말을 하려다 못 한다. 아이를 먼저 밀어 올리고, 자기도 오른다. 부사관이 이쪽을 한 번 본다. 경례 같은 걸 한다.',
              '문이 닫힌다. 창문에 작은 손바닥이 붙는다. 헬기가 뜬다. 모래바람 속에서 끝까지 손을 흔든다.',
              {
                when: { companions: ['kongi'] },
                text: '점퍼 지퍼를 내린다. 콩이가 고개를 쏙 내민다. 이제 숨길 이유가 없다.',
              },
              {
                when: { anyCompanions: PEOPLE },
                text: '돌아보니 같이 온 사람들이 그대로 서 있다. 누가 먼저랄 것도 없이 웃는다. 바보들이다. 전부.',
              },
              {
                when: { noCompanions: EVERYONE },
                text: '경기장이 텅 빈다. 전광판의 지난주 점수만 남는다. 혼자라도, 이 선택은 내 거다.',
              },
            ],
            next: 'end:hero',
          },
        ],
      },
      {
        id: 'yieldFriend',
        label: '동료를 태워 보낸다',
        hint: '남는 건 나다',
        requires: { anyCompanions: PEOPLE },
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['minjun'] },
            effects: { hours: 1, mental: 15, removeCompanions: ['minjun'] },
            result: [
              '민준의 등을 떠민다. "야, 수능 봐야지." "그거 아마 연기될…" "그러니까 공부할 시간 생겼네. 타."',
              '민준이 헬기 안에서 뭐라 소리친다. 로터 소리에 안 들린다. 입 모양이 층간소음 죄송했어요, 같다. 헬기가 뜬다.',
            ],
            next: 'end:hero',
          },
          {
            when: { companions: ['nurse'] },
            effects: { hours: 1, mental: 15, removeCompanions: ['nurse'] },
            result: [
              '"선생님이 가셔야 해요. 저쪽엔 다친 사람이 수천 명이에요." 정지수 간호사가 한참 이쪽을 본다. 그리고 가방에서 붕대 한 롤을 꺼내 손에 쥐여 준다.',
              '"나이트 근무 끝났으면 인수인계는 하고 가야죠." 그 말을 남기고 오른다. 헬기가 뜬다. 붕대가 따뜻하다.',
            ],
            next: 'end:hero',
          },
          {
            when: { companions: ['grandma'] },
            effects: { hours: 1, mental: 15, removeCompanions: ['grandma'] },
            result: [
              '할머니가 한사코 손사래를 친다. 그냥 번쩍 안아 올린다. 가볍다. 김장 김치 한 통보다 가볍다.',
              '"너 이러면 내 김치 다시는 안 줄겨!" 할머니가 헬기 안에서 소리친다. 우는 소리다. 헬기가 뜬다. 내년 김장까지 살아 있어야겠다.',
            ],
            next: 'end:hero',
          },
          {
            when: { companions: ['rider'] },
            effects: { hours: 1, mental: 15, removeCompanions: ['rider'] },
            result: [
              '용석이 고개를 젓는다. 그 등을 떠민다. "배달은 빨리 가는 사람이 하는 거예요."',
              '용석이 헬기 문에 매달려 소리친다. "별점 다섯 개 드릴게요!" 헬기가 뜬다. 웃다가 운다.',
            ],
            next: 'end:hero',
          },
          {
            effects: { hours: 1, mental: 15, removeCompanions: ['soldier'] },
            result: [
              '김 병장이 버틴다. "민간인 먼저입니다." "전역 D-28이잖아. 살아서 전역해야지." 결국 부사관이 김 병장 팔을 잡아끈다. 명령엔 약하다.',
              '헬기 안에서 김 병장이 경례를 한다. 각이 정확하다. 헬기가 뜬다. 모래바람 속에서 어설프게 경례를 받는다.',
            ],
            next: 'end:hero',
          },
        ],
      },
      {
        id: 'confess',
        label: '물린 자리를 보여 준다',
        hint: '마지막으로 할 수 있는 일',
        requires: { infected: true },
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { hours: 1, mental: 10, removeCompanions: ['kongi'], setFlags: ['c5_kongiShelter'] },
            result: [
              '소매를 걷어 부사관에게 보여 준다. 부사관 얼굴이 굳는다. "이 자리, 뒤에 아이한테 주세요."',
              '점퍼 속 콩이를 꺼내 자원봉사자 품에 안긴다. "이 개, 사람 잘 따라요. 겁은 많은데 코는 좋아요. 연어맛 좋아하고요." 끝까지 소개를 한다. 번호표를 받는 콩이 귀가 이쪽으로 접혀 있다.',
              '아이가 헬기에 오른다. 문이 닫힌다. 헬기가 뜨는 걸 끝까지 본다. 열 때문인지, 새벽 하늘이 이상하게 예쁘다.',
            ],
            next: 'end:hero',
          },
          {
            effects: { hours: 1, mental: 10 },
            result: [
              '소매를 걷어 부사관에게 보여 준다. 부사관 얼굴이 굳는다. "이 자리, 뒤에 아이한테 주세요."',
              '아이가 헬기에 오른다. 문이 닫힌다. 헬기가 뜨는 걸 끝까지 본다. 열 때문인지, 새벽 하늘이 이상하게 예쁘다.',
            ],
            next: 'end:hero',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════ 루트 B — 인천항 ═══════════════════════════════

  c5_harbor: {
    id: 'c5_harbor',
    chapter: 5,
    location: 'harbor',
    scene: 'street_chaos',
    title: '서쪽으로 40킬로',
    clock: 68,
    alert: {
      kind: 'disaster',
      from: '행정안전부',
      text: '[행정안전부] 인천항 제1부두 해군 수송선 내일 오전 출항 예정. 민간인 승선 가능. 반려동물 동반 가능(목줄 필수). 야간 이동 자제.',
    },
    body: [
      '인천항까지 40킬로. 걸으면 열 시간. 그것도 아무 일 없을 때 얘기다.',
      '경인로는 버려진 차로 막혀 있고, 가로등은 절반이 꺼졌다. 지하철은 끊긴 지 이틀. 멀리 서쪽 하늘에 함정 탐조등이 가끔 번쩍인다. 야간 이동 자제. 재난문자는 늘 불가능한 걸 권한다.',
      {
        when: { companions: ['kongi'] },
        text: '재난문자 마지막 줄을 두 번 읽는다. 반려동물 동반 가능. 콩이 머리를 쓰다듬는 손에 힘이 들어간다.',
      },
      {
        when: { items: ['carKey', 'fuel'] },
        text: '차 키와 기름통. 인천까지 갈 기름은 된다. 문제는 막힌 길과, 밤중의 엔진 소리다.',
      },
      {
        when: { items: ['carKey'], noItems: ['fuel'] },
        text: '차 키는 있는데 기름이 반 칸이다. 막힌 도로를 돌고 돌면 부평쯤에서 멈춘다. 기름통 하나만 있었어도.',
      },
      {
        when: { companions: ['rider'] },
        text: '용석이 운동화 끈을 다시 맨다. "여기서부터가 진짜 제 구역이에요. 부평까지 콜 뛰던 골목, 아직 다 기억나요."',
      },
    ],
    choices: [
      {
        id: 'drive',
        label: '차에 기름을 붓고 달린다',
        hint: '빠르지만 엔진이 시끄럽다',
        requires: { items: ['carKey', 'fuel'] },
        lockedHint: '차 키와 기름만 있었다면…',
        tags: ['brave'],
        outcomes: [
          {
            chance: 0.65,
            effects: { hours: 2, mental: 10, removeItems: ['fuel'] },
            result: [
              '액셀을 밟는다. 계기판 불빛이 반갑다 못해 눈물 난다. 라디오를 켜니 잡음 사이로 트로트가 흘러나온다. 누가 방송국에서 아직 틀고 있다.',
              '갓길, 인도, 중앙분리대 틈. 사이드미러 하나를 잃고 부평을 지난다. 인천항 크레인이 보일 때 기름 경고등이 켜진다. 딱 맞다.',
            ],
            next: 'c5_harbor_gate',
          },
          {
            effects: { hours: 3, hp: -10, mental: -5, removeItems: ['fuel', 'carKey'] },
            result: [
              '부천 톨게이트. 차단기 앞에 차들이 엉켜 있다. 헤드라이트를 본 것들이 한꺼번에 고개를 돌린다. 엔진 소리가 초대장이었다.',
              '후진하다 가드레일에 박는다. 차를 버리고 뛴다. 키는 꽂힌 채다. 누가 잘 쓰길. 여기서부턴 발이다.',
            ],
            next: 'c5_harbor_road',
          },
        ],
      },
      {
        id: 'riderAlley',
        label: '골목 지름길로 간다',
        hint: '좁고 어둡지만 빠르다',
        requires: { companions: ['rider'] },
        lockedHint: '동네 지름길을 아는 사람이 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 4, supply: -5, hp: -5, mental: 5 },
            result: [
              '용석은 지도를 안 본다. 저 편의점 끼고 왼쪽, 세탁소 뒤 계단, 주차장 관통. "여기 치킨집 사장님이 콜 빨리 줬거든요." 이 사람 머릿속엔 배달 앱 지도가 통째로 있다.',
              '막다른 골목 담장을 넘을 때 손을 잡아 끌어 준다. "도착 예정 시간 04시요. 늦으면 리뷰 쓰세요." 인천항 크레인 불빛이 골목 끝에 걸린다.',
            ],
            next: 'c5_harbor_gate',
          },
        ],
      },
      {
        id: 'bike',
        label: '따릉이로 서쪽을 달린다',
        hint: '조용하고 빠르다',
        tags: ['brave'],
        outcomes: [
          {
            when: { items: ['bike'], anyCompanions: PEOPLE },
            effects: { hours: 4, supply: -10, mental: -5 },
            result: [
              '따릉이는 한 대, 사람은 여럿. 결국 짐만 싣고 끌고 걷는다. 바구니 속 배낭이 덜컹거린다.',
              '그래도 짐이 가벼우니 발이 빠르다. 서울시 자전거가 서울시 경계를 넘는다. 반납은 못 할 것 같다.',
            ],
            next: 'c5_harbor_road',
          },
          {
            when: { items: ['bike'] },
            effects: { hours: 3, supply: -5, removeItems: ['bike'] },
            result: [
              '체인 소리만 난다. 차 사이로 미끄러지듯 빠진다. 좀비 셋이 뒤늦게 고개를 돌렸을 땐 이미 두 블록 앞이다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이는 앞 바구니에 들어가 앉는다. 귀가 바람에 뒤로 넘어간다. 접힌 쪽까지 펴진다. 신이 났다. 이 와중에.',
              },
              '부평 고가 아래서 체인이 빠진다. 고맙다, 서울시. 여기서부턴 걷는다.',
            ],
            next: 'c5_harbor_road',
          },
          {
            chance: 0.45,
            effects: { hours: 3, supply: -5, hp: -5 },
            result: [
              '정류장 옆 따릉이 거치대. 다 뽑혀 나갔는데 맨 끝 한 대만 자물쇠가 풀려 있다. 안장이 찢어졌다. 상관없다.',
              '짐을 바구니에 몰아 싣는다. 어깨가 가벼우니 발이 빨라진다. 부평 고가 아래서 체인이 빠진다. 거기서부턴 다시 걷는다.',
            ],
            next: 'c5_harbor_road',
          },
          {
            effects: { hours: 4, supply: -15, hp: -10 },
            result: [
              '거치대 세 곳을 돈다. 전부 비었다. 마지막 거치대 옆 정류장 의자에 누가 앉아 있다. 고개가 이상한 각도로 꺾여 있다. 사람이 아니다.',
              '뛴다. 한 시간을 버렸고 무릎이 까졌다. 결국 걷는다. 뭘 구하러 다니는 사이 다리가 먼저 닳는다.',
            ],
            next: 'c5_harbor_road',
          },
        ],
      },
      {
        id: 'walk',
        label: '걸어서 서쪽으로 간다',
        hint: '보급이 크게 든다',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 4, supply: -15, hp: -5 },
            result: [
              '경인로를 따라 걷는다. 차 사이로, 버스 정류장 뒤로. 한 시간에 한 번 물 한 모금. 두 시간에 한 번 가방에 남은 걸 한 입.',
              '발바닥에 물집이 잡혔다가 터진다. 부평 표지판이 보인다. 아직 반도 못 왔다.',
            ],
            next: 'c5_harbor_road',
          },
        ],
      },
    ],
  },

  c5_harbor_road: {
    id: 'c5_harbor_road',
    chapter: 5,
    location: 'harbor',
    scene: 'bike_street',
    title: '부평 밤길',
    body: [
      '부평 지나 어딘가. 불 꺼진 주유소 캐노피 아래, 편의점 간판이 반쯤 깨져 매달려 있다. 도로엔 줄지어 멈춘 차들. 문이 전부 열려 있다.',
      '고가도로 아래에서 소리가 난다. 뭔가 모여 있다. 밤이라 저것들이 더 날뛴다. 발소리 하나에도 고개가 돌아간다.',
      {
        when: { flags: ['promisedMom'] },
        text: '엄마 목소리가 귀에 맴돈다. "니 꼭 살아서 온나. 알겠제?" 발이 무거워질 때마다 그 말을 곱씹는다.',
      },
      {
        when: { companions: ['kongi'] },
        text: '콩이가 고가 쪽을 보고 낮게 으르렁거린다. 코가 먼저 안다.',
      },
      {
        when: { companions: ['grandma'] },
        text: '할머니가 주유소 쪽을 가리킨다. "저런 데는 꼭 뭐가 남아 있다. 난리 때는 다들 비싼 것만 들고 튀거든."',
      },
    ],
    choices: [
      {
        id: 'rest',
        label: '주유소 편의점에서 쉬어 간다',
        hint: '배는 차지만 발이 묶인다',
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.55,
            effects: { hours: 3, supply: 20, mental: 10 },
            result: [
              '진열대는 털렸는데 창고 문은 잠겨 있다. 안에 컵라면 한 박스, 생수 두 팩, 유통기한 D+1 삼각김밥. 오늘이 D+2다. 괜찮다. 전혀 괜찮다.',
              '계산대 뒤에 앉아 온수기 남은 물로 컵라면을 먹는다. 국물까지 다 마신다. 두 시간 눈을 붙인다. 세상이 끝나도 컵라면은 맛있다.',
            ],
            next: 'c5_harbor_gate',
          },
          {
            effects: { hours: 3, supply: 10, hp: -15 },
            result: [
              '창고에서 생수 한 팩을 꺼내는데 유리문 너머로 그림자가 선다. 하나, 둘, 여섯. 고가 밑에 있던 것들이다.',
              '뒷문으로 빠진다. 문틀에 옆구리를 긁힌다. 생수 한 팩은 끝까지 안 놓는다. 인간은 이상한 데서 고집을 부린다.',
            ],
            next: 'c5_harbor_gate',
          },
        ],
      },
      {
        id: 'march',
        label: '쉬지 않고 밤새 걷는다',
        hint: '빨리 닿지만 몸이 먼저 지친다',
        tags: ['brave'],
        outcomes: [
          {
            when: { flags: ['promisedMom'] },
            effects: { hours: 2, hp: -10, mental: 15, setFlags: ['c5_earlyBird'] },
            result: [
              '걷는다. 다리가 멈추려 할 때마다 엄마 말투를 흉내 낸다. 니 꼭 살아서 온나. 혼자 중얼거리다 혼자 웃는다.',
              '새벽 공기에 짠 냄새가 섞인다. 바다다. 엄마한테 가려면 바다를 건너야 한다. 그래도 방향은 맞다.',
            ],
            next: 'c5_harbor_gate',
          },
          {
            effects: { hours: 2, hp: -15, mental: -10, setFlags: ['c5_earlyBird'] },
            result: [
              '걷는다. 생각을 멈추고 걷는다. 발가락 감각이 사라진다. 한 시간쯤은 걸으면서 존 것 같다.',
              '짠 냄새가 날 때쯤 무릎이 한 번 꺾인다. 일어난다. 항구까지 3킬로. 표지판이 거짓말이 아니길 빈다.',
            ],
            next: 'c5_harbor_gate',
          },
        ],
      },
      {
        id: 'truck',
        label: '지나가는 트럭에 손을 흔든다',
        hint: '사람일까, 미끼일까',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: SAVED_OTHER,
            effects: { hours: 2, supply: 10, mental: 15 },
            result: [
              '1톤 트럭이 멈춘다. 운전석 창문이 내려간다. 알아보는 데 한참 걸린다. 지난 사흘 중 어느 날, 손을 잡아 끌어 줬던 그 사람이다. "타요! 살아 있었네!"',
              '짐칸에 사과 박스가 가득하다. 하나를 던져 준다. "그때 안 구해 줬으면 이 사과 다 썩었어요." 트럭이 항구로 달린다. 사과가 달다.',
            ],
            next: 'c5_harbor_gate',
          },
          {
            chance: 0.4,
            effects: { hours: 2, supply: -15 },
            result: [
              '트럭이 선다. 운전자가 웃는다. "항구? 태워 드리죠. 뱃삯 조금만." 조금이 가방 절반이다.',
              '항구 앞에 내려 준다. 가방이 가볍다. 그래도 발은 살았다. 공짜는 원래 없었다. 종말 전에도.',
            ],
            next: 'c5_harbor_gate',
          },
          {
            effects: { hours: 2, hp: -20, mental: -5 },
            result: [
              '트럭은 서지 않는다. 대신 경적을 길게 울리고 지나간다. 왜.',
              '고가 밑에서 대답이 온다. 수십 개의 발소리. 손 흔들던 자리가 좌표가 된다. 주유소 뒤편 담을 넘어 도망친다. 담 위 철사에 손바닥이 찢어진다.',
            ],
            next: 'c5_harbor_gate',
          },
        ],
      },
      {
        id: 'radio',
        label: '무전기로 해군 주파수를 잡는다',
        hint: '정보가 곧 자리다',
        requires: { items: ['radio'] },
        lockedHint: '무전기가 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 3, mental: 10, setFlags: ['c5_navyList'] },
            result: [
              '버스 정류장 뒤에 쪼그려 앉아 다이얼을 돌린다. 잡음, 트로트, 잡음. 그리고 딱딱한 목소리. "인천 제1부두, 사전 명단 접수 중. 성명, 인원, 반려동물 유무."',
              '송신 버튼을 누른다. 목소리가 떨린다. 이름을 두 번 말한다. "접수. 확인됐습니다." 확인됐다는 말이 이렇게 따뜻한 말인 줄 몰랐다.',
              {
                when: { companions: ['kongi'] },
                text: '"반려동물 한 마리, 5킬로, 믹스요. 귀 한쪽이 접혔어요." 그것까진 안 물어봤는데 말해 버린다.',
              },
            ],
            next: 'c5_harbor_gate',
          },
        ],
      },
    ],
  },

  c5_harbor_gate: {
    id: 'c5_harbor_gate',
    chapter: 5,
    location: 'harbor',
    scene: 'harbor',
    title: '제1부두 검문',
    clock: 75,
    body: [
      '인천항 제1부두. 컨테이너 크레인이 안개 속에 목을 빼고 서 있다. 부두 끝에 회색 수송선. 갑판 위로 손전등 불빛들이 오간다.',
      '입구엔 컨테이너로 쌓은 벽과 철문. 헌병이 확성기로 외친다. "체온 검사! 교상 검사! 반려동물은 목줄 채우고 품에 안으세요!" 부두 옆 작은 어선들이 파도에 끼익끼익 운다.',
      {
        when: { companions: ['kongi'] },
        text: '반려동물은 품에. 대피버스도 안 된다던 개를 배는 받아 준다. 콩이를 안은 팔에 힘이 들어간다.',
      },
      {
        when: { flags: ['abandonedSomeone'] },
        text: '줄 선 얼굴들을 저도 모르게 하나씩 훑는다. 두고 온 얼굴이 있을까 봐. 없다. 안도인지 뭔지 모르겠다.',
      },
      {
        when: { infected: true },
        text: '이마가 뜨겁다. 체온계 앞에 서면 끝이다. 어선 쪽을 흘끗 본다.',
      },
      {
        when: { flags: ['c5_navyList'] },
        text: '무전으로 불러 준 이름이 저 명단에 있을까. 헌병 손에 들린 클립보드만 본다.',
      },
    ],
    choices: [
      {
        id: 'line',
        label: '줄에 서서 검사받는다',
        hint: '정직하게, 느리게',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 1, mental: -15 },
            result: [
              '삑. 헌병이 숫자를 한 번 더 확인한다. "잠깐 이쪽으로."',
              '컨테이너 하나가 문을 연다. 안에 간이침대 여섯 개. 셋은 이미 찼다. 문이 닫히기 직전, 수송선 뱃고동이 한 번 운다.',
            ],
            next: 'end:quarantine',
          },
          {
            when: { flags: ['abandonedSomeone'] },
            effects: { hours: 2, mental: -10 },
            result: [
              '두 시간 내내 앞사람 뒤통수만 본다. 저 사람도 누군가를 두고 왔을 거다. 여기 선 사람 전부가 그렇다. 그렇게 생각해도 하나도 가벼워지지 않는다.',
              '삑. 36.7. 헌병이 손등에 번호를 쓴다. 통과. 살았다는 말이 목에 걸려서 안 나온다.',
            ],
            next: 'c5_harbor_boat',
          },
          {
            when: { flags: ['c5_earlyBird'] },
            effects: { hours: 1, supply: 10, mental: 5 },
            result: [
              '밤새 걸은 값이다. 줄이 아직 짧다. 앞에 스무 명. 삑. 36.8. 헌병이 손등에 번호를 쓴다. 38.',
              '일찍 온 사람한테는 생수 한 병과 주먹밥 하나가 돌아간다. 뒤에 올 수백 명 몫까진 없다. 부두 난간에 기대 주먹밥을 먹는다. 다리는 후들거리는데 밥알이 달다.',
            ],
            next: 'c5_harbor_boat',
          },
          {
            effects: { hours: 2 },
            result: [
              '두 시간을 선다. 삑. 36.7. 양팔, 목, 발목. 헌병이 손등에 번호를 매직으로 쓴다. 214.',
              '214번. 부두 안으로 들어선다. 배가 가깝다. 가까운데 트랩 앞 줄이 또 있다.',
            ],
            next: 'c5_harbor_boat',
          },
        ],
      },
      {
        id: 'pass',
        label: '통행증을 내민다',
        hint: '검사를 건너뛴다',
        requires: { items: ['pass'] },
        lockedHint: '군 통행증이 있었다면…',
        tags: ['cold'],
        outcomes: [
          {
            effects: { hours: 1, mental: 5 },
            result: [
              '헌병이 통행증을 보고 바로 철문 옆 쪽문을 연다. "육군 쪽 통행증이네. 들어가요." 해군과 육군 사이 어딘가의 예의다.',
              '줄 선 사람들 옆을 지난다. 눈을 마주치지 않는다. 부두 안은 조용하다. 조용해서 더 급하다.',
            ],
            next: 'c5_harbor_boat',
          },
        ],
      },
      {
        id: 'list',
        label: '명단에 올린 이름을 댄다',
        hint: '무전 덕을 본다',
        requires: { flags: ['c5_navyList'] },
        tags: ['careful'],
        outcomes: [
          {
            effects: { hours: 1, supply: 10, mental: 5 },
            result: [
              '헌병이 클립보드를 넘긴다. 손가락이 멈춘다. "사전 접수자. 이쪽." 별도 줄이다. 짧다.',
              '사전 접수자 줄에는 생수와 건빵이 한 봉지씩 나온다. 건빵 봉지 속 별사탕을 제일 먼저 찾는다. 군대 안 가 본 사람도 그건 안다.',
            ],
            next: 'c5_harbor_boat',
          },
        ],
      },
      {
        id: 'stowaway',
        label: '어선에 몰래 숨어든다',
        hint: '들키면 바다에 빠진다',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            chance: 0.45,
            effects: { hours: 2, mental: 5 },
            result: [
              '부두 옆 어선 그물 더미 밑으로 기어든다. 비린내가 코를 찌른다. 동이 틀 무렵, 엔진이 걸린다. 수송선 뒤를 따라 출항하는 배다.',
              '선장이 그물을 걷다 눈이 마주친다. 한참 본다. 담배를 문다. "제주까지 열 시간. 멀미하면 바다에 해라." 그게 뱃삯이다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이가 그물 속에서 멸치 한 마리를 찾아 먹는다. 선장이 처음으로 웃는다.',
              },
            ],
            next: 'end:ship',
          },
          {
            effects: { hours: 2, hp: -15 },
            result: [
              '어선으로 건너뛰다 발이 미끄러진다. 새벽 바다는 한강보다 짜고 차갑다. 부두 기둥 사이에서 허우적거린다.',
              '헌병 둘이 갈고리 장대로 건져 올린다. "밀항은 처음 봐요? 우리는 매일 봐요." 담요 한 장을 던져 주고 부두 안쪽에 앉힌다. 덕분에 검문은 건너뛰었다. 대가가 컸다.',
              {
                when: { max: { hp: 20 } },
                text: '담요 속에서 이가 딱딱 부딪힌다. 손끝 감각이 없다. 몸이 좀처럼 데워지지 않는다. 버틸 힘이 거의 남지 않았다.',
              },
            ],
            next: 'c5_harbor_boat',
          },
        ],
      },
    ],
  },

  c5_harbor_boat: {
    id: 'c5_harbor_boat',
    chapter: 5,
    location: 'harbor',
    scene: 'harbor',
    title: '승선 인원 제한',
    clock: 77,
    body: [
      '수송선 트랩 앞. 해군 부사관이 태블릿을 들여다본다. "정원 초과입니다. 남은 자리 하나."',
      '뒤에서 누가 욕을 한다. 누가 운다. 트랩 옆에서 선장 모자를 쓴 노인이 말없이 담배를 문다. 바닷바람에 라이터 불이 자꾸 꺼진다. 노인 뒤로 작은 어선 한 척이 밧줄에 묶여 흔들린다.',
      '부두 반대편 끝, 컨테이너 사이로 뛰는 그림자들. 밤새 모인 사람 냄새를 따라온 것들이다. 부사관이 외친다. "십 분 뒤 출항! 계류줄 푸는 인원은 부두에 남습니다!"',
      {
        when: { anyCompanions: PEOPLE },
        text: '같이 온 사람들을 돌아본다. 한 자리. 셀 필요도 없는 숫자다.',
      },
      {
        when: { companions: ['kongi'] },
        text: '"개는 사람 자리 안 쳐요. 안고 타세요." 부사관이 콩이를 보고 말한다. 개는 되는데 사람이 안 된다. 세상이 이렇게 공평하게 불공평하다.',
      },
      {
        when: { noCompanions: EVERYONE },
        text: '따라온 이가 없다. 이 한 자리는 온전히 내 것이다. 이상하게 그게 가볍지 않다.',
      },
    ],
    choices: [
      {
        id: 'board',
        label: '먼저 트랩에 오른다',
        hint: '한 자리는 내 것이다',
        tags: ['cold'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 1, mental: -15 },
            result: [
              '트랩 중간에서 의무병이 손목을 잡는다. 이마에 손등을 댄다. 표정이 바뀐다.',
              '선실 대신 선미 쪽 컨테이너로 옮겨진다. 배는 뜬다. 어쨌든 뜬다. 철창 사이로 인천 불빛이 멀어진다.',
            ],
            next: 'end:quarantine',
          },
          {
            when: { anyCompanions: PEOPLE, companions: ['kongi'] },
            effects: { hours: 1, mental: -25, removeCompanions: PEOPLE, setFlags: ['abandonedSomeone'] },
            result: [
              '콩이를 안고 트랩에 오른다. 뒤에서 이름을 부르는 소리가 들린다. 한 번. 두 번. 세 번째는 없다.',
              '갑판 난간에서 부두를 내려다본다. 같이 온 얼굴들이 작아진다. 콩이가 부두 쪽을 보고 짖는다. 입을 막지 않는다. 대신 짖어 줘서 고맙다.',
            ],
            next: 'end:ship',
          },
          {
            when: { anyCompanions: PEOPLE },
            effects: { hours: 1, mental: -25, removeCompanions: PEOPLE, setFlags: ['abandonedSomeone'] },
            result: [
              '트랩에 발을 올린다. 뒤를 보지 않는다. 뒤에서 아무도 부르지 않는다. 차라리 욕이라도 해 줬으면 싶다.',
              '배가 부두를 떠난다. 갑판에 쪼그려 앉는다. 살아남았다. 그것뿐이다.',
            ],
            next: 'end:alone',
          },
          {
            when: { companions: ['kongi'] },
            effects: { hours: 1, mental: 15 },
            result: [
              '콩이를 안고 트랩을 오른다. 트랩 한 칸마다 콩이 발톱이 팔뚝을 꽉 움켜쥔다. 부사관이 콩이 머리를 쓱 쓰다듬는다. "얘 이름이 뭐예요?" "콩이요."',
              '뱃고동이 운다. 콩이가 놀라 품으로 파고든다. 인천 불빛이 멀어진다. 제주까지 여덟 시간. 둘이면 금방이다.',
              {
                when: { flags: ['promisedMom'] },
                text: '엄마한테 문자를 쓴다. 전송은 안 된다. 그래도 쓴다. 엄마 콩이랑 배 탔어. 살아서 간다.',
              },
            ],
            next: 'end:ship',
          },
          {
            effects: { hours: 1, mental: -5 },
            result: [
              '혼자 트랩을 오른다. 아무도 배웅하지 않는다. 배웅할 사람이 없다.',
              '갑판 구석에 앉는다. 옆 사람들은 가족끼리 담요를 나눈다. 가방을 끌어안는다. 살아남았다. 그것뿐이다.',
            ],
            next: 'end:alone',
          },
        ],
      },
      {
        id: 'giveSeat',
        label: '내 자리를 일행에게 준다',
        hint: '떠나는 배를 본다',
        requires: { anyCompanions: PEOPLE },
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { hours: 1, mental: 15, removeCompanions: ['kongi'], setFlags: ['c5_kongiShip'] },
            result: [
              '부사관 태블릿에 내 이름 대신 같이 온 사람 이름을 불러 준다. 뭐라고 하기 전에 등을 떠민다. 그 품에 콩이를 안긴다. "개는 사람 자리 안 친다면서요."',
              {
                when: { companions: ['grandma'] },
                text: '할머니가 갑판에서 뭔가를 던진다. 비닐에 싼 주먹밥이다. 언제 만들었는지 모르겠다. 아직 따뜻하다.',
              },
              '트랩이 올라간다. 접힌 귀가 난간 너머로 보이다가, 안 보인다. 부두에 남은 사람들과 계류줄을 푼다. 뛰는 발소리가 가까워진다. 배가 멀어지는 걸 끝까지 본다.',
            ],
            next: 'end:hero',
          },
          {
            effects: { hours: 1, mental: 20 },
            result: [
              '부사관 태블릿에 내 이름 대신 같이 온 사람 이름을 불러 준다. 뭐라고 하기 전에 등을 떠민다. 트랩이 올라간다.',
              {
                when: { companions: ['grandma'] },
                text: '할머니가 갑판에서 뭔가를 던진다. 비닐에 싼 주먹밥이다. 언제 만들었는지 모르겠다. 아직 따뜻하다.',
              },
              '부두에 남은 사람들과 계류줄을 푼다. 뛰는 발소리가 가까워진다. 배가 부두를 떠나는 걸 끝까지 본다.',
            ],
            next: 'end:hero',
          },
        ],
      },
      {
        id: 'ramenFare',
        label: '라면·소주를 뱃삯으로 내민다',
        hint: '종말의 기축통화',
        requires: { anyItems: ['ramen', 'soju'] },
        lockedHint: '라면 한 박스면 뭐든 된다던데…',
        tags: ['meme'],
        outcomes: [
          {
            chance: 0.7,
            effects: { hours: 1, mental: 15, removeItems: ['ramen', 'soju'] },
            result: [
              '트랩 옆 선장 노인에게 간다. 노인이 담배를 뱉는다. "뭐 있노."',
              {
                when: { items: ['ramen'] },
                text: '라면 박스를 들어 보인다. 노인 눈썹이 올라간다. "몇 개들이고." "마흔 개요." "……타라."',
              },
              {
                when: { items: ['soju'] },
                text: '소주병을 두 손으로 내민다. 노인이 라벨부터 본다. "빨간 뚜껑이네. 뭘 좀 아네."',
              },
              '노인이 어선 밧줄을 턱짓한다. "다 타라. 제주 가서 같이 묵자." 수송선 뒤를 따라 작은 어선이 뜬다. 정원도, 명단도, 태블릿도 없는 배다.',
              {
                when: { items: ['ramen'] },
                text: '뱃머리에서 라면 박스가 흔들린다. 종말 이후 서울의 기축통화가 바다를 건넌다.',
              },
              {
                when: { companions: ['kongi'] },
                text: '콩이가 노인 무릎에 턱을 올린다. 노인이 멸치 한 줌을 꺼낸다. 이 배에서 제일 대우받는 승객이다.',
              },
            ],
            next: 'end:ship',
          },
          {
            effects: { hours: 1, mental: 5, removeItems: ['ramen', 'soju'] },
            result: [
              '노인이 받을 건 받는다. 그리고 밧줄을 가리킨다. "배는 띄워 주꾸마. 근데 저 줄은 누가 풀어야 된다. 배 안에서는 못 푼다."',
              '뛰는 발소리가 컨테이너 사이를 돌아 나온다. 누가 남아야 한다. 밧줄 앞에 선다. 뱃삯은 이미 냈다. 이왕 준 거, 끝까지 준다.',
            ],
            next: 'end:hero',
          },
        ],
      },
      {
        id: 'stay',
        label: '밧줄을 풀러 부두에 남는다',
        hint: '누군가는 남아야 한다',
        tags: ['kind', 'brave'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { hours: 1, mental: 15, removeCompanions: ['kongi'], setFlags: ['c5_kongiShip'] },
            result: [
              '부사관에게 손을 든다. "제가 풀게요. 대신 얘 좀." 콩이를 내민다. 부사관이 한참 보다가 콩이를 받아 안는다. 목장갑 한 켤레가 대신 날아온다.',
              '계류줄은 생각보다 굵고 무겁다. 손바닥이 탄다. 마지막 매듭이 풀린다. 갑판 위에서 콩이가 버둥거린다. 괜찮다고, 들리지도 않을 말을 한다. 접힌 귀. 그거 하나만 기억한다.',
              {
                when: { anyCompanions: PEOPLE },
                text: '같이 온 사람들이 옆에 와서 말없이 밧줄을 같이 잡는다. 아무도 배에 타겠다고 하지 않는다.',
              },
            ],
            next: 'end:hero',
          },
          {
            effects: { hours: 1, mental: 20 },
            result: [
              '부사관에게 손을 든다. "제가 풀게요." 부사관이 한참 본다. 그리고 목장갑 한 켤레를 던져 준다.',
              '계류줄은 생각보다 굵고 무겁다. 손바닥이 탄다. 마지막 매듭이 풀린다. 배가 부두에서 한 뼘, 두 뼘 멀어진다. 뒤에서 발소리가 들린다. 돌아보기 전에 한 번 더 배를 본다.',
              {
                when: { anyCompanions: PEOPLE },
                text: '같이 온 사람들이 옆에 와서 말없이 밧줄을 같이 잡는다. 아무도 배에 타겠다고 하지 않는다.',
              },
            ],
            next: 'end:hero',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════ 루트 C — 북한산 ═══════════════════════════════

  c5_mountain: {
    id: 'c5_mountain',
    chapter: 5,
    location: 'mountain',
    scene: 'mountain',
    title: '우이동 등산로 입구',
    clock: 68,
    body: [
      '우이동 등산로 입구. 등산용품 매장 셔터가 반쯤 뜯겨 있다. 마네킹이 고어텍스 재킷만 벗겨진 채 서 있다. 종말에도 고어텍스는 인기다.',
      '탐방로 안내판에 누가 매직으로 커다랗게 써 붙였다. "백운대 산장 — 산악회가 지킴. 사람 받음. 입단 조건 막걸리." 그 밑에 다른 글씨로 한 줄. 이거 실화냐.',
      '해 진 북한산은 검은 벽이다. 능선 어딘가에서 작은 불빛이 깜빡인다. 사람 불빛이다. 저기까지 세 시간.',
      '등산로 나무마다 산악회 리본이 매달려 있다. 사랑방산악회, 불암산우회, 매주토요일산악회. 오늘따라 그 리본들이 길 안내처럼 보인다.',
      {
        when: { companions: ['kongi'] },
        text: '콩이가 흙냄새를 맡고 꼬리를 번쩍 든다. 산책 코스 중에 산길을 제일 좋아하는 개다. 세상이 끝난 줄도 모르고.',
      },
      {
        when: { companions: ['grandma'] },
        text: '할머니가 지팡이 삼을 나뭇가지를 고른다. "산은 내가 너보다 잘 타여. 걱정 말어. 육이오 때도 탔어. 업혀서긴 했어도."',
      },
    ],
    choices: [
      {
        id: 'trail',
        label: '손전등 켜고 탐방로로 간다',
        hint: '안전하지만 불빛이 보인다',
        requires: { items: ['flashlight'] },
        lockedHint: '손전등이 있었다면…',
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.7,
            effects: { hours: 3, supply: 5 },
            result: [
              '데크 계단, 철 난간, 쇠사슬. 탐방로는 친절하다. 손전등 원 안의 세상만 보면 평범한 야간 산행이다.',
              '중간 쉼터 벤치에 누가 두고 간 오이 하나. 반 갈라 먹는다. 등산객이 오이를 싸 오는 이유를 오늘 처음 안다.',
            ],
            next: 'c5_mountain_gate',
          },
          {
            effects: { hours: 3, hp: -10 },
            result: [
              '불빛은 길을 비추고, 동시에 나를 비춘다. 아래 계곡에서 뭔가 고개를 든다. 불빛을 따라온다.',
              '손전등을 끄고 바위 뒤에 엎드린다. 발소리가 지나간다. 다시 켤 땐 손이 떨려서 무릎을 바위에 찧는다.',
            ],
            next: 'c5_mountain_gate',
          },
        ],
      },
      {
        id: 'moonlight',
        label: '달빛만 믿고 오른다',
        hint: '조용하지만 발밑이 안 보인다',
        tags: ['careful'],
        outcomes: [
          {
            chance: 0.5,
            effects: { hours: 4, mental: -5 },
            result: [
              '구름이 걷히고 화강암이 은색으로 빛난다. 달빛은 생각보다 밝다. 서울 하늘에 불이 꺼지니 별이 보인다. 이 도시에 이렇게 별이 많았나.',
              '예쁜 게 무섭다. 네 시간 동안 한 번도 뒤를 안 본 척한다.',
            ],
            next: 'c5_mountain_gate',
          },
          {
            effects: { hours: 4, hp: -15 },
            result: [
              '돌부리. 발목이 옆으로 꺾인다. 소리를 삼킨다. 삼켜야 한다.',
              '절뚝거리며 오른다. 스틱 대신 부러진 나뭇가지. 능선 불빛이 가까워졌다 멀어졌다 한다. 발목이 욱신거릴 때마다 불빛을 센다.',
            ],
            next: 'c5_mountain_gate',
          },
        ],
      },
      {
        id: 'kongiNose',
        label: '콩이 코를 따라 오른다',
        hint: '개를 믿어 본다',
        requires: { companions: ['kongi'] },
        lockedHint: '콩이가 곁에 있었다면…',
        tags: ['dog'],
        outcomes: [
          {
            effects: { hours: 3, mental: 10 },
            result: [
              '목줄을 느슨하게 쥔다. 콩이가 앞서 간다. 갈림길마다 코를 박고 킁킁, 한쪽을 고른다. 한 번은 멈춰 서서 으르렁거린다. 그 길은 안 간다.',
              '나중에 보니 그 길 아래 계곡에 뭔가 모여 있었다. 콩이한테 육포라도 주고 싶은데 없다. 대신 접힌 귀를 한참 문질러 준다.',
            ],
            next: 'c5_mountain_gate',
          },
        ],
      },
      {
        id: 'shortcut',
        label: '계곡 샛길로 질러간다',
        hint: '빠르지만 계곡엔 뭐가 있다',
        tags: ['brave'],
        outcomes: [
          {
            when: { anyItems: WEAPONS },
            effects: { hours: 2, hp: -5 },
            result: [
              '계곡 바위 사이, 등산복 입은 것 하나가 비틀거리며 일어난다. 한 번. 정확히 머리. 등산 가방 브랜드가 좋다. 슬프게도.',
              '물소리가 발소리를 덮어 준다. 한 시간을 벌었다.',
            ],
            next: 'c5_mountain_gate',
          },
          {
            chance: 0.5,
            effects: { hours: 2 },
            result: [
              '계곡 물소리가 크다. 덕분에 발소리도 묻힌다. 젖은 바위를 네 발로 기어오른다.',
              '출입금지 표지판을 세 개 넘는다. 벌금 50만 원. 종말엔 과태료도 안 나온다.',
            ],
            next: 'c5_mountain_gate',
          },
          {
            effects: { hours: 2, hp: -20, mental: -10 },
            result: [
              '계곡 소(沼) 옆에 등산복 무리가 서 있다. 사람인 줄 알고 손을 든다. 사람이 아니다.',
              '미끄러지고, 구르고, 뛴다. 바위에 정강이가 갈린다. 뒤에서 발소리가 물소리에 섞였다가 끊긴다. 한참을 숨죽이고 앉아 있다.',
            ],
            next: 'c5_mountain_gate',
          },
        ],
      },
    ],
  },

  c5_mountain_gate: {
    id: 'c5_mountain_gate',
    chapter: 5,
    location: 'mountain',
    scene: 'campfire',
    title: '어디 산악회요?',
    body: [
      '능선 아래 산장. 바위 틈에 등산 스틱을 거꾸로 꽂아 만든 울타리. 헤드랜턴 여섯 개가 한꺼번에 이쪽을 비춘다. 전부 형광 등산복이다. 눈이 부시다.',
      '맨 앞의 아저씨가 스틱으로 땅을 탁 친다. "어디 산악회요?" 대답을 기다린다. 진지하다. 세상에서 제일 진지하다.',
      '울타리 뒤에서 누가 막걸리 사발을 들어 보인다. "입단 심사는 간단해요. 한 사발, 한 번에. 그리고 인증."',
      {
        when: { flags: ['postedVideo'] },
        text: '뒤쪽 아저씨 하나가 눈을 가늘게 뜬다. "잠깐. 그 좀비 영상 올린 사람 아이가? 우리 단톡방에 그거 돌았는데."',
      },
      {
        when: { companions: ['minjun'] },
        text: '민준이 속삭인다. "저 미성년자인데요." 아무도 안 듣는다.',
      },
      {
        when: { companions: ['grandma'] },
        text: '할머니를 보자 아저씨들 자세가 바뀐다. "어머님, 이리 앉으세요." 산에서는 연장자가 왕이다.',
      },
    ],
    choices: [
      {
        id: 'makgeolli',
        label: '막걸리를 원샷한다',
        hint: '간은 나중 문제다',
        tags: ['meme', 'brave'],
        outcomes: [
          {
            when: { flags: ['postedVideo'] },
            effects: { hours: 1, mental: 15, supply: 5, setFlags: ['c5_clubMember'] },
            result: [
              '사발을 비우기도 전에 박수가 터진다. "800만 조회수님 오셨다!" 사진을 찍자고 한다. 산장 앞에서 형광 등산복 여섯 명과 브이.',
              '"영상 보고 우리가 여기 올라온 거예요. 은인이지 은인." 인생에서 제일 쓸데없던 짓이 여기서 입장권이 된다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            chance: 0.6,
            effects: { hours: 1, mental: 10, supply: 5, setFlags: ['c5_clubMember'] },
            result: [
              '꿀꺽, 꿀꺽, 꿀꺽. 목이 탄다. 사발을 거꾸로 들어 보인다. 한 방울도 안 떨어진다.',
              '아저씨들이 서로 쳐다보더니 동시에 외친다. "합격!" 누가 등을 퍽퍽 친다. 막걸리보다 등이 더 얼얼하다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            effects: { hours: 1, hp: -5, mental: 5 },
            result: [
              '세 모금째에 사레가 들린다. 막걸리가 코로 나온다. 정적. 그리고 폭소.',
              '"아이고, 요즘 젊은 사람들은." 회장이 등을 두드려 준다. "합격 보류. 일단 들어와요. 밖은 추워요."',
            ],
            next: 'c5_mountain_camp',
          },
        ],
      },
      {
        id: 'soju',
        label: '소주를 조용히 바친다',
        hint: '산에선 술이 신분증',
        requires: { items: ['soju'] },
        lockedHint: '소주 한 병만 있었다면…',
        tags: ['meme'],
        outcomes: [
          {
            effects: { hours: 1, mental: 10, supply: 10, removeItems: ['soju'], setFlags: ['c5_clubMember'] },
            result: [
              '말없이 소주병을 꺼내 두 손으로 내민다. 아저씨들 표정이 바뀐다. "이 사람, 뭘 좀 아네."',
              '막걸리는 면제. 누가 등산 손수건을 목에 매 준다. 입단식 끝. 소주 한 병이 여권보다 세다.',
            ],
            next: 'c5_mountain_camp',
          },
        ],
      },
      {
        id: 'app',
        label: '등산 앱 인증을 보여 준다',
        hint: '작년 가을에 한 번 갔다',
        requires: { items: ['powerbank'] },
        lockedHint: '폰 배터리만 살아 있었다면…',
        tags: ['meme', 'careful'],
        outcomes: [
          {
            chance: 0.6,
            effects: { hours: 1, mental: 10, setFlags: ['c5_clubMember'] },
            result: [
              '보조배터리를 꽂고 폰을 켠다. 등산 앱. 작년 10월, 북한산 백운대 정상 인증. 정상석 앞에서 찍은 셀카까지.',
              '아저씨들이 폰을 돌려 본다. "백운대 인증이면 인정이지." "사진 각도가 좋네." 입단 통과. 작년의 내가 오늘의 나를 살린다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            effects: { hours: 1, mental: 5 },
            result: [
              '폰을 켠다. 등산 앱 최근 기록. 관악산 둘레길 3.2킬로, 소요 시간 4시간 12분. 중간에 카페 들렀던 기록까지 남아 있다.',
              '정적. 그리고 폭소. "둘레길은 등산이 아니고 산책이지!" 그래도 문은 열어 준다. 웃겨 준 값이다.',
            ],
            next: 'c5_mountain_camp',
          },
        ],
      },
      {
        id: 'honest',
        label: '산은 처음이라고 털어놓는다',
        hint: '솔직함이 통할까',
        tags: ['careful', 'kind'],
        outcomes: [
          {
            when: { companions: ['grandma'] },
            effects: { hours: 1, mental: 10, supply: 5, setFlags: ['c5_clubMember'] },
            result: [
              '할머니가 대신 나선다. "야는 내 손주 같은 애여. 산은 몰라도 사람은 알어." 아저씨들이 서로 눈치를 본다.',
              '"어머님이 보증하시면야." 입단. 할머니가 윙크를 한다. 난리통 겪어 본 사람의 협상이다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            when: SAVED_KID,
            effects: { hours: 1, mental: 15, setFlags: ['c5_clubMember'] },
            result: [
              '대답하기도 전에 모닥불 옆에서 누가 벌떡 일어난다. 경비실 제복 위에 형광 등산복을 얻어 입었다. 우리 단지 경비아저씨다. "회장님! 이 양반이에요! 12층에서 소리 질러서 우리 동 꼬마 살린 사람!"',
              '회장이 스틱을 내린다. "애 살린 사람이면 우리 은인이지." 심사 면제. 막걸리 한 사발이 두 손으로 건네진다. 착하게 살고 볼 일이다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            when: SAVED_OTHER,
            effects: { hours: 1, mental: 15, setFlags: ['c5_clubMember'] },
            result: [
              '대답하기도 전에 모닥불 옆에서 누가 벌떡 일어난다. 형광 등산복을 얻어 입었다. 알아보는 데 한참 걸린다. 지난 사흘 중 어느 날, 손을 잡아 끌어 줬던 그 사람이다. "회장님! 이 사람이에요! 제 생명의 은인!"',
              '회장이 스틱을 내린다. "우리 회원 은인이면 우리 은인이지." 심사 면제. 막걸리 한 사발이 두 손으로 건네진다. 착하게 살고 볼 일이다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            when: { flags: ['abandonedSomeone'] },
            effects: { hours: 1, mental: -15 },
            result: [
              '"산은… 처음입니다." 목소리가 작다. 회장이 손전등을 내리고 이쪽 얼굴을 한참 본다. "뭘 두고 온 사람 얼굴이네." 산에서 삼십 년 사람 본 눈이다. 대답을 못 한다.',
              '"들어오긴 하세요. 산은 누구 편도 안 드니까." 모닥불 가장 먼 자리가 배정된다.',
            ],
            next: 'c5_mountain_camp',
          },
          {
            effects: { hours: 1, mental: -5 },
            result: [
              '"산은… 처음입니다. 그냥 살고 싶어서 왔어요." 아저씨들이 서로 본다. 회장이 한숨을 쉰다.',
              '"처음엔 다 그래요. 들어와요. 대신 규칙은 지키고." 막걸리 한 사발이 그냥 손에 쥐어진다. 심사 없이.',
            ],
            next: 'c5_mountain_camp',
          },
        ],
      },
    ],
  },

  c5_mountain_camp: {
    id: 'c5_mountain_camp',
    chapter: 5,
    location: 'mountain',
    scene: 'campfire',
    title: '산장의 규칙',
    clock: 72,
    body: [
      '산장 안은 따뜻하다. 버너 위에서 라면 물이 끓는다. 벽에는 매직으로 쓴 근무표. 1조 보초, 2조 취사, 3조 막걸리 관리. 3조가 제일 인원이 많다.',
      '회장이 수첩을 펴고 규칙을 읽는다. "신입은 창고에서 하룻밤. 물린 사람은 반나절이면 티가 나요. 서운해하지 마시고. 우리도 그렇게 들어왔어요."',
      {
        when: { flags: ['c5_clubMember'] },
        text: '"정회원 대우는 해 드리는데, 규칙은 규칙이라." 회장이 미안한 얼굴로 창고 열쇠를 흔든다. 창고 문에 누가 매직으로 써 놨다. 신입 대기실.',
      },
      {
        when: { infected: true },
        text: '창고. 하룻밤. 물린 자리가 욱신거린다. 반나절이면 티가 난다고 했다. 반나절도 안 남았다.',
      },
      {
        when: { flags: ['raidersDeal'] },
        text: '창밖 능선 아래로 불빛 몇 개가 움직인다. 등산객 걸음이 아니다. 거래했던 약탈자들의 드럼통 불과 색이 같다.',
      },
      {
        when: { companions: ['kongi'] },
        text: '콩이는 벌써 3조 아저씨 무릎 위에 있다. 누가 쥐포를 찢어 준다. 입단 심사 없이 정회원이 된 유일한 존재다.',
      },
    ],
    choices: [
      {
        id: 'quarantine',
        label: '창고 격리에 응한다',
        hint: '하룻밤만 참으면 된다',
        tags: ['careful'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 4, mental: -20 },
            result: [
              '창고 문이 잠긴다. 등산 스틱, 버너 가스통, 막걸리 박스 사이에 눕는다. 열이 오른다. 몸이 떨린다.',
              '새벽 어느 순간부터 생각이 짧아진다. 문 너머 사람 소리가 이상하게 크게, 이상하게 맛있게 들린다. 그게 이상하다는 것도 곧 모르게 된다.',
              {
                when: { companions: ['kongi'] },
                text: '문밖에서 콩이가 밤새 낑낑거린다. 누가 안아 가는 소리가 난다. 3조 아저씨 목소리다. "니는 우리랑 있자." 다행이다. 그게 마지막으로 또렷한 생각이다.',
              },
            ],
            next: 'end:turned',
          },
          {
            effects: { hours: 4, hp: 15, supply: 15, mental: 10 },
            result: [
              '창고라고 해서 긴장했는데 침낭이 깔려 있다. 문틈으로 라면 한 그릇이 들어온다. 김치까지. "신입 환영 라면이에요."',
              '막걸리 박스를 베고 잔다. 이틀 만에 처음으로 깊이 잔다. 꿈도 안 꾼다.',
            ],
            next: 'c5_mountain_night',
          },
        ],
      },
      {
        id: 'watch',
        label: '격리 대신 보초를 자원한다',
        hint: '믿음을 사지만 춥다',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            when: { flags: ['raidersDeal'] },
            effects: { hours: 3, hp: -5, mental: -5, setFlags: ['c5_sawRaiders'] },
            result: [
              '바위 위 보초 자리. 바람이 칼 같다. 능선 아래를 보다가 숨이 멎는다. 드럼통 불빛이 산장 쪽으로 천천히 올라온다. 그 사이사이 뛰는 그림자들.',
              '약탈자들이 떼를 몰고 오는 건지, 떼가 약탈자를 따라오는 건지 모르겠다. 확실한 건 하나다. 저쪽도 이 산장을 안다. 그리고 강당 창고 문을 열어 준 얼굴도 기억할 거다.',
            ],
            next: 'c5_mountain_night',
          },
          {
            when: { infected: true },
            effects: { hours: 3, hp: -10, mental: -15 },
            result: [
              '회장이 손전등으로 얼굴을 비춘다. "열 있네요? 보초 서다 쓰러지면 안 되는데." "감기예요." 믿는 눈치는 아니다. 그래도 바위 위 자리를 내준다.',
              '밤새 바위 위에서 떤다. 바람 때문인지 열 때문인지 모르겠다. 교대하러 온 아저씨가 한 발짝 떨어져 선다. 아무도 가까이 오지 않는다.',
            ],
            next: 'c5_mountain_night',
          },
          {
            effects: { hours: 3, supply: 10, mental: 5 },
            result: [
              '바위 위 보초 자리. 바람이 칼 같다. 1조 아저씨가 보온병 커피를 나눠 준다. 믹스커피다. 인생 최고의 믹스커피다.',
              '"우리 산악회 원래 스무 명이었어요. 지금 여섯." 아저씨가 서울 쪽 불빛을 본다. 더 묻지 않는다. 커피가 식을 때까지 같이 본다.',
            ],
            next: 'c5_mountain_night',
          },
        ],
      },
      {
        id: 'lie',
        label: '물린 적 없다고 둘러댄다',
        hint: '들키면 끝이다',
        requires: { infected: true },
        tags: ['cold'],
        outcomes: [
          {
            chance: 0.5,
            effects: { hours: 2, mental: -10, setFlags: ['hiddenBite'] },
            result: [
              '"긁힌 거예요. 철조망에." 소매를 반만 걷어 보인다. 회장이 손전등을 댄다. 한참 본다. "철조망 조심하시지."',
              '창고 대신 보초 자리를 받는다. 바람이 차가워서 열이 좀 가라앉는 것 같다. 착각이라는 걸 안다.',
            ],
            next: 'c5_mountain_night',
          },
          {
            effects: { hours: 2, mental: -20 },
            result: [
              '"긁힌 거예요." 회장이 손전등을 댄다. 소매를 끝까지 걷는다. 이빨 자국이 둥글게 드러난다. 모닥불 주변이 조용해진다.',
              '아무도 소리 지르지 않는다. 그냥 창고 문을 열고, 들어가라고 손짓한다. 문이 잠긴다. 열이 오른다. 그다음은 기억나지 않는다.',
              {
                when: { companions: ['kongi'] },
                text: '문이 닫히기 직전, 3조 아저씨가 콩이를 번쩍 안아 든다. 콩이가 발버둥 친다. 그 모습이 마지막 장면이라 다행이다.',
              },
            ],
            next: 'end:turned',
          },
        ],
      },
      {
        id: 'confess',
        label: '물린 걸 털어놓고 떠난다',
        hint: '남은 사람들을 위해',
        requires: { infected: true },
        tags: ['kind'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { hours: 2, mental: 10, removeCompanions: ['kongi'], setFlags: ['c5_kongiClub'] },
            result: [
              '소매를 걷는다. 모닥불 주변이 조용해진다. "밤이 가기 전에 내려갈게요. 여기서 변하면 안 되니까."',
              '"이 개는… 받아 주실 수 있어요?" 3조 아저씨가 콩이를 안아 든다. "우리 산악회 마스코트 할래요." 콩이가 따라오려 버둥거린다. 뒤돌아보지 않는다. 돌아보면 못 간다.',
              '회장이 모자를 벗는다. 누가 막걸리 한 사발을 따라 준다. 마지막 입단 심사다. 원샷한다. 사레도 안 들린다.',
            ],
            next: 'end:hero',
          },
          {
            effects: { hours: 2, mental: 15 },
            result: [
              '소매를 걷는다. 모닥불 주변이 조용해진다. "밤이 가기 전에 내려갈게요. 여기서 변하면 안 되니까."',
              '회장이 모자를 벗는다. 누가 막걸리 한 사발을 따라 준다. 마지막 입단 심사다. 원샷한다. 사레도 안 들린다.',
            ],
            next: 'end:hero',
          },
        ],
      },
    ],
  },

  c5_mountain_night: {
    id: 'c5_mountain_night',
    chapter: 5,
    location: 'mountain',
    scene: 'horde',
    title: '동트기 전의 능선',
    clock: 76,
    body: [
      '동트기 직전. 보초 호루라기가 짧게 세 번. 산장 전체가 벌떡 일어난다. 누군가 등산화를 짝짝이로 신는다.',
      '능선 아래 등산로를 따라 검은 줄이 올라온다. 산장 불빛을 봤다. 밤의 저것들은 지치지 않는다. 회장이 스틱을 든다. "바위 위로! 사다리 올려!"',
      {
        when: { flags: ['raidersDeal'] },
        text: '떼 뒤로 드럼통 불빛이 흔들린다. 약탈자들이다. 강당 창고 문을 열어 줬던 그 트럭이다. 창고 문 다음은 산장 문인가. 입안이 쓰다.',
      },
      {
        when: { companions: ['kongi'] },
        text: '콩이가 짖지 않는다. 대신 온몸을 떤다. 이 개가 짖지 않는다는 건, 너무 많다는 뜻이다.',
      },
      {
        when: { flags: ['promisedMom'] },
        text: '엄마 목소리. "니 꼭 살아서 온나." 스틱을 쥔 손에 힘이 들어간다.',
      },
      {
        when: { infected: true },
        text: '열이 머리끝까지 올라왔다. 손끝이 내 것 같지 않다. 사람들 목덜미가 자꾸 눈에 들어온다. 그게 무섭다.',
      },
    ],
    choices: [
      {
        id: 'holdRock',
        label: '바위 위에서 함께 버틴다',
        hint: '다 같이 살거나',
        tags: ['brave', 'kind'],
        outcomes: [
          {
            when: { infected: true },
            effects: { hours: 2 },
            result: [
              '바위를 오르다 손에 힘이 빠진다. 열이 머리끝까지 차오른다. 옆 아저씨가 손을 내민다. 그 손목이 너무 가깝다.',
              '손을 뿌리친다. 그게 마지막으로 스스로 한 선택이다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이가 처음으로 이쪽을 보고 짖는다. 누가 콩이를 안고 바위 위로 물러선다. 잘됐다. 그쪽이 맞다.',
              },
            ],
            next: 'end:turned',
          },
          {
            when: { flags: ['raidersDeal'] },
            effects: { hours: 2 },
            result: [
              '바위 위로 오른다. 사다리를 올리려는 순간, 아래에서 누가 사다리 끝을 잡는다. 드럼통 불빛. 약탈자 우두머리가 웃는다. "또 보네, 창고 문 열어 준 양반. 이번엔 안 열어 줘도 돼. 뒷문은 우리가 알아서 열었거든."',
              '뒷길 쪽 울타리가 열린다. 약탈자들이 연 거다. 떼가 그 문으로 쏟아진다. 산악회 사람들이 이쪽을 본다. 그 눈빛을 끝까지 피하지 못한다.',
              {
                when: { companions: ['kongi'] },
                text: '콩이 목줄을 풀어 바위 위 아저씨 손에 쥐여 준다. 그게 이 밤에 제대로 한 유일한 일이다.',
              },
            ],
            next: 'end:betrayed',
          },
          {
            when: { anyItems: WEAPONS },
            effects: { hours: 2, hp: -10, mental: 10 },
            result: [
              '바위 끝에 서서 올라오는 머리만 친다. 옆에서 아저씨들이 등산 스틱으로 찌른다. 누가 박자를 맞춰 "영차!" 한다. 산악회 구호다.',
              '해가 뜬다. 바위 아래가 조용하다. 회장이 막걸리를 딴다. 해 뜨자마자. 아무도 말리지 않는다.',
            ],
            next: 'end:mountain',
          },
          {
            when: { flags: ['promisedMom'] },
            effects: { hours: 2, hp: -15, mental: 15 },
            result: [
              '손이 떨린다. 엄마 목소리를 붙잡는다. 니 꼭 살아서 온나. 그 말을 구호처럼 되뇌며 스틱을 내리친다.',
              '해가 뜬다. 인수봉이 분홍색으로 물든다. 살아서 간다. 조금 늦게.',
            ],
            next: 'end:mountain',
          },
          {
            chance: 0.6,
            effects: { hours: 2, hp: -15 },
            result: [
              '바위 위에서 스틱을 휘두른다. 막걸리병도 던진다. 버너 가스통도 던진다. 산장 살림이 전부 무기가 된다.',
              '동이 틀 때 떼가 물러간다. 해가 뜨면 잠잠해지는 놈들이다. 누가 바위 위에 드러누워 웃는다. 따라 웃는다.',
            ],
            next: 'end:mountain',
          },
          {
            effects: { hours: 2, hp: -30 },
            result: [
              '사다리가 흔들린다. 떨어질 뻔한 아저씨 팔을 잡는다. 대신 내가 미끄러진다. 바위에 온몸이 긁힌다.',
              '누가 배낭끈을 잡아 올린다. 해가 뜬다. 숨이 붙어 있다. 그걸로 됐다.',
            ],
            next: 'end:mountain',
          },
        ],
      },
      {
        id: 'molotov',
        label: '소주병에 불을 붙인다',
        hint: '산불 조심, 오늘만 예외',
        requires: { items: ['soju'] },
        lockedHint: '소주 한 병만 있었다면…',
        tags: ['brave', 'meme'],
        outcomes: [
          {
            when: { flags: ['raidersDeal'] },
            effects: { hours: 2, hp: -10, mental: 5, removeItems: ['soju'] },
            result: [
              '떼보다 먼저 드럼통 불빛을 노린다. 병이 날아가 약탈자들 발밑에서 터진다. 비명. 불이 불을 부른다. 떼가 약탈자 쪽으로 돌아선다.',
              '거래는 거래로 갚는다. 해가 뜰 때 회장이 어깨를 두드린다. "저놈들 누가 불렀는지 몰라도, 누가 쫓았는지는 알아요."',
            ],
            next: 'end:mountain',
          },
          {
            effects: { hours: 2, hp: -5, removeItems: ['soju'] },
            result: [
              '양말을 쑤셔 넣고 불을 붙인다. 등산로 계단 위로 던진다. 불길이 길을 막는다. 떼가 멈춘다.',
              '회장이 소화기를 들고 뛰어간다. "산불 나면 다 죽어! 적당히!" 불을 끄는 사람과 불을 던진 사람이 새벽 내내 싸운다. 그러다 해가 뜬다.',
            ],
            next: 'end:mountain',
          },
        ],
      },
      {
        id: 'confessDeal',
        label: '약탈자와의 거래를 털어놓는다',
        hint: '욕먹고 살거나',
        requires: { flags: ['raidersDeal'] },
        tags: ['kind'],
        outcomes: [
          {
            when: { flags: ['c5_sawRaiders'] },
            effects: { hours: 2, hp: -10, mental: 10 },
            result: [
              '보초 설 때 본 걸 전부 말한다. 거래한 것까지. 회장이 한 대 칠 것 같은 얼굴을 한다. 대신 지도를 편다. "뒷길이 어디라고?"',
              '뒷길 울타리를 먼저 막는다. 약탈자들이 연 문은 이미 닫혀 있다. 떼는 정면 바위에서 막힌다. 해가 뜬다. 회장이 말한다. "막걸리 세 사발. 벌주."',
            ],
            next: 'end:mountain',
          },
          {
            chance: 0.5,
            effects: { hours: 2, hp: -15, mental: 5 },
            result: [
              '"저 사람들, 제가 알아요. 강당 창고 문 열어 준 게 저예요. 정면으로는 안 와요. 뒷길로 와요." 산장이 조용해진다. 회장이 스틱으로 땅을 한 번 친다. "뒷길 막아! 지금!"',
              '간발의 차로 뒷문이 닫힌다. 울타리 너머 약탈자 우두머리가 욕을 한다. 해가 뜰 때까지 버틴다. 누구도 이쪽과 눈을 맞추지 않지만, 아무도 내쫓지도 않는다.',
            ],
            next: 'end:mountain',
          },
          {
            effects: { hours: 2 },
            result: [
              '말을 꺼냈을 땐 이미 늦다. 뒷길 울타리가 열리는 소리가 들린다. 약탈자들이 먼저 왔다.',
              '"뭐 이제 와서." 회장이 등을 돌린다. 떼가 산장으로 쏟아진다. 털어놓는 게 조금만 빨랐다면.',
              {
                when: { companions: ['kongi'] },
                text: '3조 아저씨가 콩이를 품에 안고 바위 위로 뛴다. 그 등이 마지막으로 본 것이다. 콩이 하나는 살렸다. 그걸로 셈을 맞춰 본다. 안 맞는다.',
              },
            ],
            next: 'end:betrayed',
          },
        ],
      },
      {
        id: 'flee',
        label: '뒷능선으로 혼자 빠진다',
        hint: '살겠지만 혼자다',
        tags: ['cold'],
        outcomes: [
          {
            when: { companions: ['kongi'] },
            effects: { hours: 3, mental: -30, removeCompanions: EVERYONE, setFlags: ['abandonedSomeone', 'c5_kongiClub'] },
            result: [
              '뒷능선 바위를 미끄러져 내려간다. 어둠 속에서 목줄이 손에서 빠진다. 콩이가 산장 불빛 쪽으로 달려간다. 부를 수가 없다. 소리를 내면 끝이다.',
              {
                when: { anyCompanions: PEOPLE },
                text: '같이 온 사람들은 바위 위에 있다. 등 뒤에서 누가 이름을 부른다. 대답하지 않는다.',
              },
              '해가 뜰 때 반대편 계곡에 혼자 앉아 있다. 산장 쪽에서 연기가 오른다. 개 짖는 소리가 들린 것 같다. 들린 거라고 믿기로 한다. 저 사람들이 콩이는 거둬 줄 거다.',
            ],
            next: 'end:alone',
          },
          {
            when: { anyCompanions: PEOPLE },
            effects: { hours: 3, mental: -25, removeCompanions: PEOPLE, setFlags: ['abandonedSomeone'] },
            result: [
              '같이 온 사람들이 바위 위로 오르는 사이, 반대쪽으로 내려간다. 누가 이름을 부른다. 대답하지 않는다.',
              '해가 뜰 때 반대편 계곡에 혼자 있다. 살았다. 그 말이 입 밖으로 안 나온다.',
            ],
            next: 'end:alone',
          },
          {
            effects: { hours: 3, mental: -15 },
            result: [
              '바위 위로 오르는 사람들 등을 보며 반대쪽으로 내려간다. 아무도 부르지 않는다. 원래 혼자 왔다.',
              '해가 뜬다. 계곡 물로 얼굴을 씻는다. 산장 쪽에서 연기가 오른다. 저 연기가 아침밥 짓는 연기이길 빈다.',
            ],
            next: 'end:alone',
          },
        ],
      },
    ],
  },
};
