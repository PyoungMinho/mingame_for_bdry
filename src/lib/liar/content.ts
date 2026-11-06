import { LATE_EVENTS } from './late';
import type { CharId, Ending, EndingId, GameEvent, GameState, Line, Mood, Rank } from './types';

const n = (text: string): Line => ({ who: 'narr', text });
const me = (text: string): Line => ({ who: 'me', text });
const c = (who: CharId, text: string, mood?: Mood): Line => ({ who, text, mood });

const hasFlag = (f: string) => (s: GameState) => s.flags.includes(f);
const hasLie = (id: string) => (s: GameState) => s.lies.some((l) => l.id === id);

const BASE_NAME: Record<CharId, string> = {
  bujang: '박 부장',
  ogwajang: '오 과장',
  seoyun: '한서윤 (동기)',
  insa: '인사팀 정 차장',
  sangmu: '강 상무',
  client: '남 대표',
  junior: '후배 민재',
  it: '전산팀 윤 주임',
  chairman: '윤 회장',
  heir: '이수혁',
  director: '감사위원',
};

/** 내가 승진하는 동안 다른 사람들 직함도 같이 오른다. */
export function charName(id: CharId, rank: Rank): string {
  const high = rank === 'lead' || rank === 'exec' || rank === 'ceo';
  if (id === 'ogwajang') return high ? '오 전무' : rank === 'manager' ? '오 팀장' : BASE_NAME[id];
  if (id === 'seoyun') return high ? '한서윤 본부장' : BASE_NAME[id];
  if (id === 'junior') return high ? '민재 과장' : BASE_NAME[id];
  if (id === 'insa') return high ? '인사 담당 정 상무' : rank === 'manager' ? '인사팀 정 부장' : BASE_NAME[id];
  if (id === 'sangmu') return high ? '강 사장' : BASE_NAME[id];
  if (id === 'it') return high ? '전산팀 윤 부장' : BASE_NAME[id];
  if (id === 'heir') return rank === 'exec' ? '이수혁 부사장' : BASE_NAME[id];
  return BASE_NAME[id];
}

const SCHOOLS = ['수성제일고', '달구벌고', '팔공고'];
const MOUNTAINS = ['북한산', '관악산', '도봉산'];
const CLIENTS = ['세화물산', '동방상사', '남일기업'];

const school = (name: string) => ({
  id: `school_${name}`,
  kind: 'exaggerate' as const,
  text: `"${name} 나왔습니다."`,
  fx: { perf: 2, sus: 2 },
  lie: { id: 'school', label: '고향', claim: `대구 ${name} 출신`, value: name },
  reply: [
    c('bujang', `${name}! 거기 교장이 엄했잖아. 그치?`, 'happy'),
    me('"네... 아주 엄하셨습니다."'),
    n('청주에서 태어나 청주에서 자랐다. 오늘부터는 아니다.'),
  ],
});

const mountain = (name: string) => ({
  id: `mountain_${name}`,
  kind: 'exaggerate' as const,
  text: `"${name}이요."`,
  fx: { perf: 1, sus: 1 },
  lie: { id: 'mountain', label: '취미', claim: `주말마다 ${name} 오르는 등산 마니아`, value: name },
  reply: [
    c('bujang', `${name} 좋지! 젊은 사람이 기특하네.`, 'happy'),
    n('등산화는 없다. 마지막으로 오른 산은 초등학교 소풍 때였다.'),
  ],
});

const client = (name: string) => ({
  id: `client_${name}`,
  kind: 'excuse' as const,
  text: `"${name} 대표님과 미팅이었습니다."`,
  fx: { perf: 2, sus: 6 },
  lie: { id: 'client', label: '법카', claim: `토요일에도 ${name} 대표와 곱창 미팅`, value: name },
  flags: ['receipt_lie'],
  reply: [
    c('ogwajang', '토요일 밤 11시에 곱창으로요? 영업 열심히 하시네요.', 'sus'),
    n('오 과장이 영수증 사본을 파일에 끼웠다. 왜 끼우는 걸까.'),
  ],
});

const EARLY_EVENTS: GameEvent[] = [
  /* ───────── 인턴 ───────── */
  {
    type: 'choice',
    id: 'hoesik',
    year: 1,
    art: 'hoesik',
    title: '첫 회식',
    lines: [
      n('입사 첫 주 금요일. 삼겹살 연기와 함께 사회생활이 시작됐다.'),
      c('bujang', '이름이 김정직이라고? 이름 참 좋네!', 'happy'),
      c('bujang', '나는 대구 사람이라 동향 후배는 또 챙기거든. 정직이 고향은 어디야?'),
      n('내 고향은 청주다. 부장의 집게가 삼겹살 위에서 멈췄다.'),
    ],
    choices: [
      {
        id: 'daegu',
        kind: 'exaggerate',
        text: '"저도 대구입니다, 부장님!"',
        fx: { perf: 8, sus: 3 },
        flags: ['hometown'],
        reply: [c('bujang', '뭐어? 진작 말을 하지! 어느 학교 나왔어?', 'happy')],
      },
      {
        id: 'cheongju',
        kind: 'honest',
        text: '"청주입니다."',
        fx: { perf: 2 },
        reply: [c('bujang', '청주... 아, 청주. 그래. 고기 먹어.'), n('부장의 집게가 다른 사람 쪽으로 갔다.')],
      },
      {
        id: 'seat',
        kind: 'tact',
        text: '"제 고향은 오늘부터 부장님 옆자리입니다."',
        fx: { perf: 5 },
        reply: [c('bujang', '하하! 얘 봐라? 사회생활 할 줄 아네!', 'happy'), n('거짓말은 아니다. 다만 조금 부끄럽다.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'school',
    year: 1,
    art: 'hoesik',
    title: '첫 회식',
    when: hasFlag('hometown'),
    lines: [n('대구에 있는 고등학교 이름을 떠올려야 한다. 머리가 하얘진 채로 입을 열었다.')],
    choices: SCHOOLS.map(school),
  },
  {
    type: 'choice',
    id: 'weekend',
    year: 1,
    art: 'office',
    title: '월요일 아침',
    lines: [
      n('월요일 8시 52분. 9시 출근인데 이미 내가 꼴찌다.'),
      c('bujang', '정직이는 주말에 뭐 했어?'),
      n('토요일에 14시간 잤고, 일요일에도 14시간 잤다.'),
    ],
    choices: [
      {
        id: 'hike',
        kind: 'exaggerate',
        text: '"새벽에 산에 다녀왔습니다."',
        fx: { perf: 6, sus: 2 },
        flags: ['hiker'],
        reply: [c('bujang', '오, 산을 타? 어느 산?', 'happy')],
      },
      {
        id: 'farm',
        kind: 'excuse',
        text: '"부모님 농사일 도와드렸습니다."',
        fx: { perf: 4, sus: 2 },
        lie: { id: 'farm', label: '주말', claim: '주말마다 부모님 농사를 돕는 효자' },
        reply: [c('bujang', '요즘 보기 드문 친구네. 뭐 키우셔?', 'happy'), me('"...여러 가지 키우십니다."')],
      },
      {
        id: 'sleep',
        kind: 'honest',
        text: '"잤습니다. 이틀 내내요."',
        fx: { perf: 1 },
        reply: [c('ogwajang', '젊은 사람이 벌써 그러면 어떡해요.', 'sus'), n('그러는 오 과장의 눈 밑은 나보다 어둡다.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'mountain',
    year: 1,
    art: 'office',
    title: '월요일 아침',
    when: hasFlag('hiker'),
    lines: [n('서울에 있는 산 이름을 아는 대로 꺼내 본다.')],
    choices: MOUNTAINS.map(mountain),
  },
  {
    type: 'choice',
    id: 'excel',
    year: 1,
    art: 'excel',
    title: '엑셀 할 줄 알죠?',
    lines: [
      c('ogwajang', '정직 씨, 엑셀 할 줄 알죠? 이력서에 상급이라고 쓰셨던데.'),
      n('이력서의 그 칸은 다들 그렇게 쓰길래 따라 썼다. 할 줄 아는 건 칸에 글자 넣기다.'),
    ],
    choices: [
      {
        id: 'vlookup',
        kind: 'exaggerate',
        text: '"VLOOKUP은 눈 감고도 합니다."',
        fx: { perf: 10, sus: 4 },
        lie: { id: 'excel', label: '실력', claim: 'VLOOKUP을 눈 감고도 하는 엑셀 고수' },
        reply: [c('ogwajang', '다행이네요. 그럼 나중에 큰 건 하나 부탁할게요.', 'happy'), n('큰 건. 그 말이 오래 남았다.')],
      },
      {
        id: 'learn',
        kind: 'tact',
        text: '"과장님 방식대로 배워서 맞춰 드리겠습니다."',
        fx: { perf: 5 },
        reply: [c('ogwajang', '말은 예쁘게 하시네요. 일단 이 시트부터요.'), n('시트를 받아 들고 몰래 검색창을 열었다.')],
      },
      {
        id: 'cant',
        kind: 'honest',
        text: '"이름만 압니다. 배우겠습니다."',
        fx: { perf: 4 },
        reply: [c('ogwajang', '이력서에는 상급이던데요.', 'sus'), me('"저도 그 칸이 궁금합니다."')],
      },
    ],
  },
  {
    type: 'review',
    id: 'review_intern',
    year: 1,
    art: 'review',
    title: '정규직 전환 심사',
    threshold: 18,
    next: 'staff',
    failEnding: 'contract_end',
    lines: [n('인턴 3개월이 끝났다. 인사팀 정 차장이 내 평가서를 천천히 넘긴다.'), c('insa', '김정직 씨. 결과를 말씀드리겠습니다.')],
    pass: [c('insa', '정규직 전환을 축하드립니다. 앞으로도 지금처럼만 하세요.', 'happy'), n('지금처럼. 그게 제일 무서운 말이다.')],
    fail: [c('insa', '성실하고 정직하다는 평가입니다. 그래서 아쉽게 되었습니다.'), n('평가서에 적힌 칭찬은 분명 전부 사실이었다.')],
  },

  /* ───────── 사원 ───────── */
  {
    type: 'choice',
    id: 'leave1',
    year: 2,
    art: 'groupware',
    title: '연차 사유',
    lines: [
      n('어렵게 잡은 3박 4일 오사카 여행. 전자결재에 연차를 올렸더니 부장이 바로 불렀다.'),
      c('bujang', '금요일 연차네? 무슨 일 있어?', 'sus'),
      n('연차에 사유는 필요 없다. 법적으로는 그렇다. 여긴 무궁상사다.'),
    ],
    choices: [
      {
        id: 'grandma',
        kind: 'excuse',
        text: '"외할머니께서 돌아가셔서요."',
        fx: { sus: 5 },
        grandma: true,
        lie: { id: 'grandma1', label: '연차', claim: '외할머니 별세로 연차 사용' },
        reply: [c('bujang', '아이고... 얼른 가 봐. 이거 얼마 안 되지만 받아.', 'calm'), n('부조금 5만 원을 받았다. 외할머니는 지금 노래교실에 계신다.')],
      },
      {
        id: 'dentist',
        kind: 'excuse',
        text: '"치과 치료가 잡혀서요."',
        fx: { sus: 2 },
        lie: { id: 'dentist', label: '연차', claim: '금요일마다 치과 가는 사람' },
        reply: [c('bujang', '하루 종일? 치과를? 어금니를 새로 짓나?', 'sus')],
      },
      {
        id: 'private',
        kind: 'honest',
        text: '"개인 사정입니다."',
        fx: { perf: -3 },
        reply: [c('bujang', '개인 사정이라... 요즘 친구들은 참 편해서 좋겠어.', 'sus'), n('결재는 났다. 대신 금요일 오후에 할 일이 목요일 오후로 왔다.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'kakao',
    year: 2,
    art: 'phone',
    title: '잘못 보낸 카톡',
    lines: [
      n('동기 서윤에게 보낸다는 메시지가 팀 단톡방에 올라갔다.'),
      n('"부장님 오늘도 아들 서울대 얘기함. 이번 달 네 번째"'),
      n('읽음 표시가 7에서 6으로, 6에서 5로 떨어진다. 부장 프로필이 깜빡인다.'),
    ],
    choices: [
      {
        id: 'hack',
        kind: 'excuse',
        text: '"죄송합니다, 제 계정이 해킹당했습니다!"',
        fx: { sus: 12 },
        lie: { id: 'hack', label: '단톡', claim: '카톡을 해킹당한 사람' },
        reply: [c('ogwajang', '해커가 부장님 아드님 대학까지 아는군요.', 'sus'), n('보안팀에 신고 메일이 들어갔다. 전 직원 비밀번호가 초기화됐다.')],
      },
      {
        id: 'frame',
        kind: 'frame',
        text: '"서윤이가 제 폰으로 장난친 겁니다."',
        fx: { perf: 2, sus: 8 },
        lie: { id: 'framed', label: '모함', claim: '동기 서윤이 내 폰으로 장난쳤음' },
        flags: ['framed_seoyun'],
        reply: [c('seoyun', '...내가? 나 어제 휴가였는데?', 'angry'), n('서윤은 그날부터 점심을 따로 먹었다.')],
      },
      {
        id: 'sorry',
        kind: 'honest',
        text: '"제가 썼습니다. 죄송합니다."',
        fx: { perf: -3, sus: -5 },
        reply: [c('bujang', '네 번째가 아니고 다섯 번째야. 아들 얘기 또 해 줄까?', 'calm'), n('그날 아들 얘기를 처음부터 다시 들었다. 이상하게 마음은 편했다.')],
      },
    ],
  },
  {
    type: 'recall',
    id: 'hiking_return',
    year: 3,
    art: 'mountain',
    title: '전사 등산 워크숍',
    when: hasLie('mountain'),
    lieId: 'mountain',
    lines: [
      n('가을 전사 워크숍 공지. 조장 명단 맨 위에 내 이름이 있다.'),
      c('bujang', '우리 정직이가 산 잘 타잖아. 선두 맡아!', 'happy'),
      c('sangmu', '그래요? 나도 산 좋아하는데. 주로 어디 다닌다고 했지?', 'calm'),
    ],
    question: '내가 주말마다 어느 산에 간다고 했더라?',
    options: MOUNTAINS,
    correct: {
      fx: { perf: 8, sus: -3 },
      reply: [c('sangmu', '거기 좋지. 다음에 같이 가요.', 'happy'), n('무릎이 떨렸지만 선두 깃발은 끝까지 들었다. 정상에서 토했다.')],
    },
    wrong: {
      fx: { perf: -2, sus: 20 },
      reply: [c('bujang', '어? 저번엔 다른 산이라고 안 했나?', 'sus'), n('부장이 고개를 갸웃했다. 그날 내려오는 내내 뒤통수가 따가웠다.')],
    },
    dodge: {
      text: '"산은... 다 좋습니다. 산이니까요."',
      fx: { sus: 8 },
      reply: [c('sangmu', '철학적이네.', 'sus'), n('넘어갔다. 아마도.')],
    },
  },
  {
    type: 'choice',
    id: 'delivery',
    year: 3,
    art: 'meeting',
    title: '납품 사고',
    lines: [
      n('거래처 납품이 이틀 밀렸다. 회의실 공기가 빔프로젝터보다 뜨겁다.'),
      c('bujang', '이번 건 누가 챙겼어? 어떻게 수습한 거야?', 'angry'),
      n('수습은 사실 물류팀이 다 했다. 나는 메일을 참조로 받았다.'),
    ],
    choices: [
      {
        id: 'overnight',
        kind: 'exaggerate',
        text: '"제가 밤새워 막았습니다."',
        fx: { perf: 14, sus: 8 },
        lie: { id: 'overnight', label: '실적', claim: '납품 사고를 혼자 밤새워 막은 해결사' },
        reply: [c('bujang', '역시! 이런 친구가 있어야 돼.', 'happy'), n('복도에서 물류팀 사람이 나를 오래 봤다.')],
      },
      {
        id: 'report',
        kind: 'tact',
        text: '"물류팀이 막았고, 재발 방지안은 제가 정리해 왔습니다."',
        fx: { perf: 7 },
        reply: [c('bujang', '그래. 정리는 잘했네.'), n('밤 11시에 급히 쓴 한 장짜리였다. 그래도 내가 쓴 건 맞다.')],
      },
      {
        id: 'miss',
        kind: 'honest',
        text: '"제가 일정을 놓쳤습니다."',
        fx: { perf: 3, sus: -3 },
        reply: [c('ogwajang', '처음으로 맞는 말을 하시네요.', 'calm')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'wedding',
    year: 3,
    art: 'wedding',
    title: '부장님 따님 결혼식',
    lines: [
      n('토요일 낮 12시, 강남 예식장. 부장 따님 결혼식이다.'),
      n('따님을 본 적은 없다. 그날은 친구 집들이도 있다. 봉투를 앞에 두고 숫자를 고민한다.'),
    ],
    choices: [
      {
        id: 'ten',
        kind: 'tact',
        text: '직접 가서 10만 원을 낸다. 눈도장은 확실히.',
        fx: { perf: 5 },
        reply: [c('bujang', '왔어? 밥 꼭 먹고 가!', 'happy'), n('식권 한 장에 10만 원. 갈비탕은 맛있었다.')],
      },
      {
        id: 'ghost',
        kind: 'excuse',
        text: '서윤 편에 5만 원만 보내고 월요일에 "갔다"고 한다.',
        fx: { perf: 6, sus: 5 },
        lie: { id: 'wedding', label: '경조사', claim: '부장 따님 결혼식에 간 사람(안 감)' },
        reply: [c('bujang', '왔었어? 왜 인사를 안 했어!', 'calm'), me('"너무 바빠 보이셔서요. 신부가 참 고우시던데요."')],
      },
      {
        id: 'five',
        kind: 'honest',
        text: '못 간다고 말하고 5만 원을 보낸다.',
        fx: { perf: 1 },
        reply: [c('bujang', '그래, 바쁘면 어쩔 수 없지.', 'calm'), n('다음 달 팀 배치표에서 내 자리가 복사기 옆으로 옮겨졌다. 우연일 것이다.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'idea',
    year: 3,
    art: 'meeting',
    title: '이 기획 누구 거야?',
    lines: [
      c('bujang', '이번 절약 캠페인 기획 괜찮던데. 누구 아이디어야?', 'happy'),
      n('오 과장 아이디어다. 하필 오 과장은 지금 자리에 없다.'),
    ],
    choices: [
      {
        id: 'mine',
        kind: 'exaggerate',
        text: '"제가 냈습니다."',
        fx: { perf: 12, sus: 7 },
        lie: { id: 'idea', label: '실적', claim: '절약 캠페인 기획자' },
        reply: [c('bujang', '그럴 줄 알았어! 대리 달 때 됐네.', 'happy'), n('문이 열리며 오 과장이 들어왔다. 끝까지 들었을까.')],
      },
      {
        id: 'share',
        kind: 'tact',
        text: '"오 과장님이 방향을 잡아 주셨고, 제가 정리했습니다."',
        fx: { perf: 8 },
        reply: [c('ogwajang', '...정직 씨, 이번엔 고마워요.', 'happy')],
      },
      {
        id: 'ohs',
        kind: 'honest',
        text: '"전부 오 과장님 겁니다."',
        fx: { perf: 3 },
        reply: [c('bujang', '오 과장이? 그럼 정직이는 뭐 했는데?', 'sus'), me('"복사를... 했습니다."')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'leave2',
    year: 3,
    art: 'groupware',
    title: '또 연차',
    when: (s) => s.grandma >= 1,
    lines: [
      n('사촌 결혼식이 제주에서 열린다. 또 금요일이다. 결재 버튼을 누르기 전에 생각한다.'),
      c('bujang', '또 금요일이네? 이번엔 무슨 일이야?', 'sus'),
    ],
    choices: [
      {
        id: 'grandma2',
        kind: 'excuse',
        text: '"친할머니께서... 위독하십니다."',
        fx: { sus: 8 },
        grandma: true,
        lie: { id: 'grandma2', label: '연차', claim: '친할머니 위독으로 연차 사용' },
        reply: [c('bujang', '아이고, 그 집은 왜 이렇게 일이 많아.', 'sus'), n('두 번째 할머니. 부조금은 이번엔 없었다.')],
      },
      {
        id: 'jeju',
        kind: 'honest',
        text: '"사촌 결혼식입니다."',
        fx: { perf: -2, sus: -2 },
        reply: [c('bujang', '사촌까지 챙기고. 그래, 갔다 와.', 'calm')],
      },
    ],
  },
  {
    type: 'review',
    id: 'review_staff',
    year: 3,
    art: 'review',
    title: '대리 승진 심사',
    threshold: 33,
    next: 'senior',
    failEnding: 'stuck_staff',
    lines: [n('3년이 지났다. 동기들 명패가 하나둘 바뀐다. 오늘은 내 차례다.'), c('insa', '승진 심사 결과입니다.')],
    pass: [c('insa', '대리 승진을 축하드립니다, 김 대리님.', 'happy'), n('명패를 받았다. 이제 후배가 생기고, 거짓말을 지켜볼 눈도 늘어난다.')],
    fail: [c('insa', '이번에는 다음 기회를 보시죠. 내년에도 기회는 있습니다.'), n('후배가 먼저 대리를 달았다. 나는 그 후배 축하 회식의 예약을 맡았다.')],
  },

  /* ───────── 대리 ───────── */
  {
    type: 'choice',
    id: 'ppt',
    year: 4,
    art: 'meeting',
    title: '최종_진짜최종.pptx',
    lines: [
      n('오전 9시 임원 보고. 지금은 8시 40분이다. 파일 이름은 최종_진짜최종_수정3.pptx, 완성도는 40%다.'),
      c('ogwajang', '김 대리님, 자료 어디 있어요?', 'sus'),
    ],
    choices: [
      {
        id: 'corrupt',
        kind: 'excuse',
        text: '"서버에 올렸는데 파일이 깨진 것 같습니다."',
        fx: { perf: 3, sus: 8 },
        flags: ['corrupt'],
        lie: { id: 'corrupt', label: '보고', claim: '보고 자료가 서버에서 깨진 사람' },
        reply: [c('ogwajang', '그래요? 전산팀에 복구 요청해 둘게요.', 'calm'), n('요청하지 말라고 할 수는 없었다.')],
      },
      {
        id: 'three',
        kind: 'tact',
        text: '"핵심 세 장 먼저 드리고, 나머지는 오늘 안에 드리겠습니다."',
        fx: { perf: 6 },
        reply: [c('ogwajang', '임원들은 어차피 세 장도 안 봐요. 그걸로 가죠.', 'calm')],
      },
      {
        id: 'notdone',
        kind: 'honest',
        text: '"아직 못 끝냈습니다."',
        fx: { perf: -3 },
        reply: [c('ogwajang', '그 말을 한 시간 전에 하셨으면 좋았을 텐데요.', 'angry')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'excel_return',
    year: 4,
    art: 'excel',
    title: '큰 건 하나',
    when: hasLie('excel'),
    lines: [
      c('ogwajang', '김 대리님, 3년 전에 VLOOKUP은 눈 감고도 하신다고 했죠?', 'happy'),
      c('ogwajang', '전사 정산 자동화, 이번 주까지 부탁드려요. 눈은 뜨고 하셔도 됩니다.'),
      n('큰 건이 3년을 기다렸다가 돌아왔다.'),
    ],
    choices: [
      {
        id: 'macro',
        kind: 'exaggerate',
        text: '"이미 매크로 다 짜 놨습니다."',
        fx: { perf: 10, sus: 12 },
        lie: { id: 'macro', label: '실력', claim: '전사 정산 매크로 제작자(외주비 42만 원, 자비)' },
        reply: [n('주말 동안 몰래 외주를 맡겼다. 42만 원을 내 돈으로 냈다.'), c('ogwajang', '오, 진짜 되네요? 유지보수도 부탁드릴게요.', 'happy')],
      },
      {
        id: 'junior',
        kind: 'frame',
        text: '"민재가 요즘 엑셀을 배우는 중이라 맡겨 보겠습니다."',
        fx: { perf: 6, sus: 8 },
        lie: { id: 'pushjunior', label: '모함', claim: '후배 성장을 위해 일을 넘겨준 선배' },
        reply: [c('junior', '제가요? 왜요?', 'sus'), n('민재는 사흘 밤을 새워 해냈다. 보고서에는 내 이름이 먼저 올라갔다.')],
      },
      {
        id: 'confess',
        kind: 'honest',
        text: '"사실 VLOOKUP 못 합니다."',
        fx: { perf: -5, sus: -12 },
        reply: [c('ogwajang', '알고 있었어요. 3년 전에 제 시트 망가뜨리셨잖아요.', 'calm'), n('다 알고 있었다. 그런데 왜 시킨 걸까.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'corrupt_return',
    year: 4,
    art: 'hr',
    title: '전산팀의 전화',
    when: hasFlag('corrupt'),
    lines: [
      c('it', '김 대리님, 깨졌다는 파일 복구하려고 봤는데요.'),
      c('it', '서버에 올린 기록이 없고, 수정 시간은 보고 끝나고 2시간 뒤네요?', 'sus'),
    ],
    choices: [
      {
        id: 'clock',
        kind: 'excuse',
        text: '"제 PC 시계가 좀 이상해서요."',
        fx: { sus: 12 },
        lie: { id: 'clock', label: '보고', claim: 'PC 시계가 2시간 늦는 사람' },
        reply: [c('it', '그럼 PC 교체 신청 넣어 드릴게요. 팀장님 결재 필요합니다.', 'calm'), n('일이 또 커졌다.')],
      },
      {
        id: 'itblame',
        kind: 'frame',
        text: '"전산 시스템이 불안정한 거 아닙니까?"',
        fx: { perf: 1, sus: 10 },
        lie: { id: 'itblame', label: '모함', claim: '전산 시스템 불안정을 제보한 사람' },
        reply: [c('it', '네. 그럼 그대로 보고서에 적겠습니다.', 'angry'), n('전산팀은 오래 기억한다. 내 노트북 교체는 앞으로 영영 늦을 것이다.')],
      },
      {
        id: 'admit',
        kind: 'honest',
        text: '"죄송합니다. 그때 다 못 만들었습니다."',
        fx: { perf: -6, sus: -8 },
        reply: [c('it', '다들 그래요. 기록은 지워 드릴 수 없어요.', 'calm')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'leave3',
    year: 5,
    art: 'hr',
    title: '세 번째 할머니',
    when: (s) => s.grandma >= 2,
    lines: [
      n('또 연차가 필요하다. 결재 사유 칸에 손이 저절로 움직인다.'),
      c('insa', '김 대리님, 잠시 인사팀으로 오시죠. 경조 기록을 보다가요.', 'sus'),
    ],
    choices: [
      {
        id: 'grandma3',
        kind: 'excuse',
        text: '"이번엔 진외할머니께서..."',
        fx: { sus: 18 },
        grandma: true,
        lie: { id: 'grandma3', label: '연차', claim: '할머니가 세 분 넘게 계셨던 사람' },
        reply: [
          c('insa', '이번이 세 번째 할머니시네요.', 'sus'),
          c('insa', '보통은 두 분이십니다. 대리님 댁은 많으시네요.', 'sus'),
          n('정 차장이 메모지에 무언가 적었다. 글씨가 아주 천천히 쓰였다.'),
        ],
      },
      {
        id: 'cancel',
        kind: 'honest',
        text: '"죄송합니다. 그냥 쉬고 싶어서 그랬습니다."',
        fx: { perf: -2, sus: -10 },
        reply: [c('insa', '그렇게 쓰셔도 연차는 나옵니다. 원래요.', 'calm'), n('5년 만에 처음 들은 말이다.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'receipt',
    year: 5,
    art: 'receipt',
    title: '법카 영수증',
    lines: [
      n('분기 정산. 토요일 밤 11시, 곱창 2인분에 소주 3병, 8만 2천 원. 법인카드였다. 카드를 잘못 꺼냈다.'),
      c('ogwajang', '김 대리님, 이건 어떤 건이에요?', 'sus'),
    ],
    choices: [
      ...CLIENTS.map(client),
      {
        id: 'refund',
        kind: 'honest',
        text: '"잘못 긁었습니다. 환급하겠습니다."',
        fx: { perf: -2, sus: -4 },
        reply: [c('ogwajang', '곱창은 맛있었어요?', 'calm'), me('"...네."')],
      },
    ],
  },
  {
    type: 'recall',
    id: 'client_visit',
    year: 5,
    art: 'lobby',
    title: '로비의 손님',
    when: hasLie('client'),
    lieId: 'client',
    lines: [
      n('감사 기간. 오 과장이 거래처 대표 한 분을 모시고 로비로 왔다.'),
      c('ogwajang', '김 대리님, 그때 곱창 드신 거래처 대표님이 어디셨죠? 마침 오늘 여러 분 오셨거든요.', 'sus'),
    ],
    question: '그 영수증, 어느 거래처라고 했더라?',
    options: CLIENTS,
    correct: {
      fx: { sus: 2 },
      reply: [c('client', '그날이요? 제가 술을 많이 마셔서 기억이 잘...', 'happy'), n('운이 좋았다. 남 대표는 누구와 마셨는지 모르는 사람이었다.')],
    },
    wrong: {
      fx: { perf: -3, sus: 22 },
      reply: [c('client', '저는 처음 뵙는데요?', 'sus'), c('ogwajang', '장부에는 다른 회사로 적혀 있네요.', 'angry')],
    },
    dodge: {
      text: '"제가 지금 급한 전화가 와서요."',
      fx: { sus: 10 },
      reply: [n('울리지도 않은 전화를 귀에 대고 비상계단으로 뛰었다.'), c('ogwajang', '김 대리님 벨소리가 무음이던가요?', 'sus')],
    },
  },
  {
    type: 'recall',
    id: 'daegu_return',
    year: 5,
    art: 'dinner',
    title: '상무님과 저녁',
    when: hasLie('school'),
    lieId: 'school',
    lines: [
      n('임원 식사 자리에 불려 갔다. 부장이 신이 나서 나를 소개한다.'),
      c('bujang', '상무님, 이 친구 대구 출신입니다. 상무님 후배일 수도 있어요!', 'happy'),
      c('sangmu', '그래? 자네 대구 어느 고등학교 나왔다고 했지?', 'calm'),
    ],
    question: '5년 전 삼겹살집에서, 나는 어느 학교를 나왔다고 했더라?',
    options: SCHOOLS,
    correct: {
      fx: { perf: 15 },
      reply: [c('sangmu', '허허, 내 직속 후배네! 앞으로 자주 보자고.', 'happy'), n('한 번도 가 본 적 없는 학교의 교가를 함께 불렀다. 입 모양으로.')],
    },
    wrong: {
      fx: { sus: 25 },
      reply: [c('bujang', '어? 정직이 그 학교 아니었는데?', 'sus'), c('sangmu', '자네, 정말 대구 사람 맞나?', 'sus'), n('된장찌개가 식어 가는 소리가 들렸다.')],
    },
    dodge: {
      text: '"제가 학창 시절을 말하면 눈물이 나서요."',
      fx: { sus: 10 },
      reply: [c('sangmu', '뭐... 사정이 있었나 보네.', 'sus'), n('부장이 내 어깨를 두드렸다. 이제 슬픈 과거까지 생겼다.')],
    },
  },
  {
    type: 'choice',
    id: 'bigdeal',
    year: 6,
    art: 'meeting',
    title: '내년 매출 전망',
    lines: [
      c('sangmu', '김 대리 생각엔 이 사업, 내년 매출 얼마나 오를 것 같나?'),
      n('데이터로는 3%다. 다들 3%를 듣고 싶어 하는 얼굴이 아니다.'),
    ],
    choices: [
      {
        id: 'thirty',
        kind: 'exaggerate',
        text: '"30%는 무조건 갑니다."',
        fx: { perf: 15, sus: 8 },
        lie: { id: 'thirty', label: '실적', claim: '내년 매출 30% 상승 보장' },
        reply: [c('sangmu', '좋아, 자네 이름으로 올려!', 'happy'), n('내년의 내가 알아서 할 것이다. 내년의 나는 나를 원망할 것이다.')],
      },
      {
        id: 'range',
        kind: 'tact',
        text: '"보수적으로 3%, 신규 채널이 열리면 10%까지 봅니다."',
        fx: { perf: 10 },
        reply: [c('sangmu', '근거가 있어서 좋네. 신규 채널 자네가 맡아.', 'calm')],
      },
      {
        id: 'three',
        kind: 'honest',
        text: '"3%입니다."',
        fx: { perf: 6 },
        reply: [c('sangmu', '정직하네. 이름값 하는구먼.', 'calm'), n('칭찬인지 아닌지 끝내 알 수 없었다.')],
      },
    ],
  },
  {
    type: 'choice',
    id: 'why',
    year: 6,
    art: 'office',
    title: '왜요?',
    lines: [
      c('junior', '대리님, 이 보고서 왜 글꼴을 다 바꿔야 해요?', 'sus'),
      n('왜냐하면 부장이 그렇게 하라고 했기 때문이다. 왜인지는 나도 모른다.'),
    ],
    choices: [
      {
        id: 'mentor',
        kind: 'tact',
        text: '"오늘은 내가 바꿀게. 대신 왜인지 같이 물어보러 가자."',
        fx: { perf: 6 },
        reply: [c('junior', '대리님 멋있으신데요?', 'happy'), n('물어보러 갔다가 일이 두 배가 됐다. 민재는 그래도 웃었다.')],
      },
      {
        id: 'boss',
        kind: 'frame',
        text: '"부장님이 원래 이상하셔. 나도 싫은데 어쩌겠어."',
        fx: { perf: 4, sus: 3 },
        lie: { id: 'bossblame', label: '모함', claim: '후배 앞에서는 부장 편이 아닌 사람' },
        reply: [c('junior', '역시 대리님은 우리 편이시네요.', 'happy'), n('어제 부장 앞에서는 "지당하십니다"라고 했다.')],
      },
      {
        id: 'dunno',
        kind: 'honest',
        text: '"나도 몰라. 그냥 하는 거야."',
        fx: { perf: 3, sus: -3 },
        reply: [c('junior', '...네.', 'calm'), n('6년 전 내 표정이 후배 얼굴에 있었다.')],
      },
    ],
  },
  {
    type: 'review',
    id: 'review_senior',
    year: 6,
    art: 'review',
    title: '과장 승진 심사',
    threshold: 55,
    next: 'manager',
    failEnding: 'stuck_senior',
    lines: [n('입사 6년 차. 인사위원회 문 앞에서 넥타이를 다시 맸다.'), c('insa', '김정직 대리님, 들어오시죠.')],
    pass: [c('sangmu', '김 과장, 앞으로 잘해 보자고.', 'happy'), n('명패에 과장이라고 적혔다. 장부는 아직 덮이지 않았다.')],
    fail: [c('insa', '조직에 꼭 필요한 분입니다. 그 자리에요.'), n('내 자리 칸막이에 누군가 "터줏대감"이라고 써 붙였다.')],
  },
];

export const EVENTS: GameEvent[] = [...EARLY_EVENTS, ...LATE_EVENTS];

export const ENDINGS: Record<EndingId, Ending> = {
  caught: {
    id: 'caught',
    art: 'box',
    stamp: '들통',
    title: '장부가 먼저 터졌다',
    body: '의심도가 끝까지 찼다. 인사팀 회의실 책상 위에 내가 한 말들이 날짜순으로 정리되어 있었다. 정 차장이 물었다. "어느 것부터 말씀하시겠어요?"',
  },
  contract_end: {
    id: 'contract_end',
    art: 'box',
    stamp: '계약 만료',
    title: '정직하게 일했습니다',
    body: '인턴 3개월이 끝났다. 평가서에는 "성실함, 정직함"이라고 적혀 있었고, 전환 명단에 이름은 없었다. 회사가 원한 건 다른 재능이었나 보다.',
  },
  stuck_staff: {
    id: 'stuck_staff',
    art: 'dusty',
    stamp: '승진 누락',
    title: '만년 김 사원',
    body: '후배들이 차례로 나를 지나갔다. 복사기 토너 교체만큼은 이제 회사에서 내가 제일 빠르다.',
  },
  stuck_senior: {
    id: 'stuck_senior',
    art: 'dusty',
    stamp: '승진 누락',
    title: '영원한 김 대리',
    body: '일은 내가 다 아는데 결재는 내가 못 한다. 신입들은 나를 회사의 살아 있는 매뉴얼이라고 부른다.',
  },
  stuck_manager: {
    id: 'stuck_manager',
    art: 'dusty',
    stamp: '보임 탈락',
    title: '중간에 낀 김 과장',
    body: '위에서는 숫자를 달라 하고 아래에서는 왜요를 묻는다. 그 사이에서 정년까지 간다. 명함은 9년째 같은 디자인이다.',
  },
  stuck_lead: {
    id: 'stuck_lead',
    art: 'dusty',
    stamp: '지방 발령',
    title: '창고 2층 지사장',
    body: '직원은 나와 복사기 둘이다. 복사기는 거짓말을 안 해서 좋다. 가끔 본사에서 전화가 오면 일부러 세 번 울리고 받는다.',
  },
  arrested: {
    id: 'arrested',
    art: 'jail',
    stamp: '구속',
    title: '포토라인에 선 김정직',
    body: '이번에는 인사팀이 아니라 검찰이었다. 기자가 물었다. "혐의를 인정하십니까?" 입이 저절로 움직였다. "제가 오늘 연차인데요." 판사가 안경을 고쳐 썼다.',
  },
  chicken: {
    id: 'chicken',
    art: 'chicken',
    stamp: '퇴사',
    title: '정직치킨 개업',
    body: '치킨집 간판에 이름을 걸었다. 정직치킨. 손님이 묻는다. "이거 국내산이에요?" 입사 후 처음으로, 진짜 대답을 할 수 있어서 조금 울었다. 배달 앱 리뷰는 4.9점이다.',
  },
  ceo_liar: {
    id: 'ceo_liar',
    art: 'promotion',
    stamp: '대표 취임',
    title: '거짓말 대표이사',
    body: '취임사는 3분이었다. "저는 평생 정직하게 살아왔습니다." 박수가 쏟아졌다. 대표실 금고에 장부를 넣었다. 비밀번호는 존재하지 않는 할머니의 생일로 했다.',
  },
  ceo_confess: {
    id: 'ceo_confess',
    art: 'promotion',
    stamp: '대표 취임',
    title: '다 불고 대표가 된 사람',
    body: '이사회에서 거짓말을 줄줄이 인정하고도 표결을 통과했다. 이사 한 명이 말했다. "이 정도로 자기를 아는 사람은 처음이오." 취임 첫 지시는 연차 사유 칸을 없애는 것이었다.',
  },
  ceo_clean: {
    id: 'ceo_clean',
    art: 'promotion',
    stamp: '대표 취임',
    title: '거짓말 없이 대표가 된 사람',
    body: '장부는 18년 동안 빈 채로 있었다. 이사회는 끝까지 수상해했고, 직원들은 소문을 만들었다. "저 사람 진짜 이름이 뭐래?" 김정직이다. 정말로.',
  },
};
