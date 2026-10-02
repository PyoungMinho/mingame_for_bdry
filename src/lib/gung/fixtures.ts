/**
 * 테스트 전용 작은 픽스처 사건 — 실제 사건 본문(gung-case.md)과 무관한 자리표시 텍스트.
 * 원고 구조를 전부 흉내 낸다: 역할 6(우선순위) · 범인 = priority 2 · 장소 4 · 라운드별 열린 장소 차등 ·
 * 교체 카드(onlyWhen players/npcs, forCount) · 자리별 배분 카드(한 장소 2장) · 공용 카드 · NPC 증언(5·6번) ·
 * 기본/카드 연동/역할 전용 용어 · 보너스 문항 · 미션 판정 6종 · 인원별 덮어쓰기.
 *
 * 앱 번들에서 import 하지 말 것(테스트·스토리 전용).
 */
import type { GungCase, RoleSheet } from './types';

function role(id: string, priority: number, icon: RoleSheet['icon'], extra: Partial<RoleSheet> = {}): RoleSheet {
  return {
    id,
    priority,
    name: `역할${priority}`,
    shortName: `역${priority}`,
    icon,
    profile: `[픽스처] 역할${priority}의 공개 프로필`,
    glance: [`역할${priority} 한눈에 1`, `역할${priority} 한눈에 2`, `역할${priority} 한눈에 3`],
    secrets: [`역할${priority} 비밀 ①`, `역할${priority} 비밀 ②`],
    motive: `역할${priority} 동기`,
    night: [
      { time: '해시 초(밤 9시)', text: `역할${priority} 동선 1` },
      { time: '자시 초(밤 11시)', text: `역할${priority} 동선 2` },
      { text: `역할${priority} 시각 없는 줄` },
    ],
    canLie: [`역할${priority} 둘러대도 되는 것`],
    mustTell: [`역할${priority} 물으면 사실대로`],
    missions: [{ id: 'secret', tag: '[비밀]', text: `역할${priority} 비밀을 지켜라`, check: { kind: 'manual' } }],
    speech: [`역할${priority} 말투 1`, `역할${priority} 말투 2`],
    secretLine: `역할${priority} 비밀 한 줄`,
    ...extra,
  };
}

export function makeFixtureCase(): GungCase {
  return {
    id: 'fixture-case',
    version: 3,
    title: '픽스처 사건',
    rolesPublicAfterIntro: true,
    briefing: {
      heading: '그날 밤',
      paragraphs: ['[픽스처] 그날 밤 일이 있었다.', '모인 이들: {{cast}}', '그리고 이 자리에 없으나 증언을 남긴 이: {{npcs}}.', '규칙 하나.'],
      hostCue: '모두 들으시오',
    },
    roles: [
      role('queen', 1, 'crown', {
        missions: [
          { id: 'secret', tag: '[비밀]', text: '비밀 유지', check: { kind: 'manual' } },
          { id: 'ambition', tag: '[야망]', text: '역할2 가 2표 이상', points: 1, check: { kind: 'votesAtLeast', target: 'consort', min: 2 } },
        ],
        asCulprit: { crime: '[변주] 역할1 이 범인일 때의 범행' },
      }),
      role('consort', 2, 'flower', {
        crime: '[픽스처] 꿀단지에 독을 넣었다.',
        lieTips: ['변명 1', '변명 2'],
        missions: [
          { id: 'secret', tag: '[비밀]', text: '탈출 시 비밀 유지', check: { kind: 'manual' }, onlyIfEscaped: true },
          { id: 'drag', tag: '[물귀신]', text: '역할4 가 2표 이상', points: 1, check: { kind: 'votesAtLeast', target: 'physician', min: 2 }, onlyIfEscaped: true },
        ],
      }),
      role('eunuch', 3, 'scroll', {
        missions: [
          { id: 'secret', text: '비밀 유지', check: { kind: 'manual' } },
          { id: 'zero', text: '0표', points: 1, check: { kind: 'votesAtMost', target: 'self', max: 0 } },
        ],
        asCulprit: { crime: '[변주] 역할3 이 범인일 때의 범행' },
      }),
      role('physician', 4, 'pill', {
        terms: ['t-pulse'],
        missions: [
          { id: 'secret', text: '비밀 유지', check: { kind: 'manual' } },
          { id: 'q1', text: '보너스 1 정답', points: 1, check: { kind: 'bonusCorrect', questionId: 'q1' } },
        ],
        byCount: { 4: { secrets: ['4인 판 전용 비밀'] } },
      }),
      role('courtLady', 5, 'key', {
        missions: [
          { id: 'secret', text: '비밀 유지', check: { kind: 'manual' } },
          { id: 'loyal', text: '역할1 이 최다 득표가 아님', points: 1, check: { kind: 'notTopVoted', target: 'queen' } },
        ],
      }),
      role('crownPrincess', 6, 'person', {
        missions: [
          { id: 'secret', text: '비밀 유지', check: { kind: 'manual' } },
          { id: 'avenge', text: '진범 지목', points: 2, check: { kind: 'votedCulprit' } },
        ],
      }),
    ],
    culprit: 'consort',
    places: [
      { id: 'hall', name: '전각', sub: '침소', icon: 'bed' },
      { id: 'kitchen', name: '부엌', icon: 'pot' },
      { id: 'clinic', name: '약방', icon: 'flask' },
      { id: 'pond', name: '연못', icon: 'waves' },
    ],
    rounds: [
      {
        no: 1,
        title: '첫째 조사',
        placeIds: ['hall', 'kitchen', 'clinic', 'pond'],
        clues: {
          hall: [{ id: 'F1-HALL', title: '머리맡', body: '[픽스처] 사발이 있다.', terms: ['t-poison'] }],
          kitchen: [{ id: 'F1-KIT', title: '목록', body: '[픽스처] 다과 목록.' }],
          clinic: [
            { id: 'F1-CLI-A', title: '장부 가', body: '[픽스처] 장부 가.' },
            { id: 'F1-CLI-B', title: '장부 나', body: '[픽스처] 장부 나.' },
          ],
          pond: [
            { id: 'F1-POND', title: '부적', body: '[픽스처] 6인 판 연못 카드.', onlyWhen: { players: ['crownPrincess'] } },
            { id: 'F1-POND-B', title: '독초', body: '[픽스처] 4·5인 판 대체 카드.', onlyWhen: { npcs: ['crownPrincess'] } },
          ],
        },
        publicCards: [{ id: 'PB-1', title: '검시', body: '[픽스처] 독이옵니다.' }],
        npcCards: [
          { id: 'N5-1', roleId: 'courtLady', title: '역할5 진술 ①', body: '[픽스처] 역할5 진술 1' },
          { id: 'N6-1', roleId: 'crownPrincess', title: '역할6 진술 ①', body: '[픽스처] 역할6 진술 1' },
        ],
        hostCue: { select: '한 곳만 고르시오' },
      },
      {
        no: 2,
        placeIds: ['hall', 'kitchen', 'pond'],
        clues: {
          hall: [{ id: 'F2-HALL', title: '다과상', body: '[픽스처] 꿀단지.' }],
          kitchen: [
            { id: 'F2-KIT', title: '증언', body: '[픽스처] 5·6인 판 증언.', forCount: [5, 6] },
            { id: 'F2-KIT-4', title: '증언(4인)', body: '[픽스처] 4인 판 증언.', forCount: [4] },
          ],
          pond: [{ id: 'F2-POND', title: '약봉지', body: '[픽스처] 약봉지.' }],
        },
        publicCards: [{ id: 'PB-2', title: '출입 기록', body: '[픽스처] 출입 기록.', terms: ['t-honey'] }],
        npcCards: [
          { id: 'N5-2', roleId: 'courtLady', title: '역할5 진술 ②', body: '[픽스처] 역할5 진술 2' },
          { id: 'N6-2', roleId: 'crownPrincess', title: '역할6 진술 ②', body: '[픽스처] 역할6 진술 2' },
        ],
      },
      {
        no: 3,
        placeIds: ['hall', 'kitchen', 'clinic', 'pond'],
        clues: {
          hall: [{ id: 'F3-HALL', title: '편지', body: '[픽스처] 편지.' }],
          kitchen: [{ id: 'F3-KIT', title: '궁녀', body: '[픽스처] 궁녀.' }],
          clinic: [{ id: 'F3-CLI', title: '의녀', body: '[픽스처] 의녀.' }],
          pond: [{ id: 'F3-POND', title: '꽃님', body: '[픽스처] 꽃님.' }],
        },
        publicCards: [{ id: 'PB-3', title: '출입 기록 2', body: '[픽스처] 출입 기록 2.' }],
        npcCards: [
          { id: 'N5-3', roleId: 'courtLady', title: '역할5 진술 ③', body: '[픽스처] 역할5 진술 3' },
          { id: 'N6-3', roleId: 'crownPrincess', title: '역할6 진술 ③', body: '[픽스처] 역할6 진술 3' },
        ],
      },
    ],
    truth: {
      beats: [
        { time: '해시 초(밤 9시)', text: '[픽스처] 비트 1' },
        { time: '해시 정(밤 10시)', text: '[픽스처] 비트 2' },
        { text: '[픽스처] 비트 3' },
      ],
      culpritLine: '꿀단지에 독을 넣은 자는…',
      confession: '[픽스처] 자백',
      summary: '[픽스처] 정리',
      epilogue: '[픽스처] 에필로그',
      timeline: [{ time: '해시', text: '[픽스처] 요약' }],
    },
    glossary: [
      { id: 't-base', term: '기본 용어', desc: '처음부터 보임' },
      { id: 't-poison', term: '독초', desc: 'F1-HALL 연동' },
      { id: 't-honey', term: '석청', desc: 'PB-2 연동' },
      { id: 't-pulse', term: '활맥', desc: '역할4 전용' },
    ],
    baseTerms: ['t-base'],
    bonusQuestions: [
      { id: 'q1', prompt: '독이 든 음식은?', options: ['탕약', '석청', '정과', '찻물'], answer: 1 },
      { id: 'q2', prompt: '독이 노린 사람은?', options: ['피해자', '역할6', '역할1', '역할2'], answer: 1 },
    ],
    scoring: { correctVote: 3, teamCatch: 0, mission: 2, culpritEscape: 5, bonusCorrect: 1 },
    npcHeading: '추가 증언',
  };
}

/** 범인 변주(배열) — 시드로 1명 */
export function makeVariantCase(): GungCase {
  return { ...makeFixtureCase(), id: 'fixture-variant', culprit: ['queen', 'consort', 'eunuch'] };
}
