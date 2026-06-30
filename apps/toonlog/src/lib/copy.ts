/**
 * 마이크로카피 상수 — ux-spec §9 기반 i18n 분리.
 * 법무 문구(AI_DISCLOSURE_TEXT)는 constants.ts에서 관리.
 */

export const COPY = {
  /* 랜딩 */
  landing: {
    headline: "누구나 만화 작가가 될 수 있다",
    subheadline: "오늘 일기를 4컷 만화로",
    ctaGoogle: "구글로 시작하기",
    ctaKakao: "카카오로 시작하기",
    ctaFree: "무료로 먼저 써보기",
    loginHint: "이미 계정이 있나요?",
    loginLink: "로그인",
  },

  /* 온보딩 */
  onboarding: {
    avatarTitle: "만화 속 나는 어떤 모습인가요?",
    avatarHint: "나중에 언제든 바꿀 수 있어요",
    ctaNext: "다음 — 첫 일기 쓰기",
    step: (current: number, total: number) => `${current}/${total}`,
  },

  /* 일기 작성 */
  diaryNew: {
    placeholder:
      "오늘 퇴근길에 갑자기 비가 쏟아졌다...\n\n오늘 있었던 일을 50~300자로 써보세요.",
    counter: (current: number, max: number) => `${current}/${max}`,
    counterWarning: (current: number, max: number) =>
      `${current}/${max} — 300자를 초과했어요`,
    artStyleLabel: "화풍 선택",
    avatarLabel: "내 캐릭터",
    quotaFree: (remaining: number) =>
      remaining > 0
        ? `오늘 ${remaining}편 남음`
        : "오늘 한도를 모두 사용했어요",
    ctaCreate: "만화로 만들기",
    ctaCreateDisabled: "글을 50자 이상 써야 해요",
  },

  /* 한도 소진 바텀시트 */
  quota: {
    title: "오늘 만화 1편을 모두 썼어요",
    body: "무료 플랜은 하루 1편까지 만들 수 있어요.\n내일 다시 오거나, 더 많이 만들 수도 있어요.",
    ctaTomorrow: "내일 다시 올게요",
    ctaUpgrade: "더 많이 만들기",
    resetHint: (resetAt: string) => {
      const reset = new Date(resetAt);
      const h = reset.getHours().toString().padStart(2, "0");
      const m = reset.getMinutes().toString().padStart(2, "0");
      return `한도는 오늘 자정(${h}:${m})에 초기화돼요`;
    },
  },

  /* 생성 대기 */
  generating: {
    title: "쓱쓱, 만화 그리는 중!",
    panelLabel: (n: number) => `${n}컷 완성!`,
    skeletonAlt: (n: number) => `${n}컷 생성 중`,
    tipPrefix: "잠깐의 마법:",
    etaHint: "보통 10~60초 걸려요",
    backgroundHint: "다른 앱을 써도 완성되면 알려드려요",
    done: "완성!",
  },

  /* 결과 */
  diaryResult: {
    ctaEdit: "말풍선 추가",
    ctaShare: "공유하기",
    ctaSave: "저장",
    ctaRegenerate: "다시 만들기",
    regenerateConfirm: "다시 만들면 한도 1편이 차감돼요. 계속할까요?",
    regenerateConfirmCta: "네, 다시 만들게요",
  },

  /* 공유 */
  share: {
    title: "공유하기",
    ratioLabel: "비율",
    ratio11: "1:1 (인스타 피드)",
    ratio169: "16:9 (X/트위터)",
    ratio916: "9:16 (스토리/릴스)",
    ctaDownload: "이미지 저장",
    ctaShareNative: "공유",
    ctaShareInstagram: "인스타그램으로",
    ctaShareX: "X(트위터)로",
    ctaShareKakao: "카카오로",
    ctaCopyLink: "링크 복사",
    linkCopied: "링크가 복사됐어요",
    watermarkFreeHint: "워터마크 제거는 베이직/프로 구독 후 가능해요",
  },

  /* 아카이브 */
  archive: {
    title: "내 만화 아카이브",
    empty: "아직 만화가 없어요.\n첫 일기를 써볼까요?",
    emptyCta: "첫 만화 만들기",
    calendarTab: "캘린더",
    gridTab: "전체 보기",
    streak: (days: number) => `${days}일 연속 기록 중!`,
    totalCount: (n: number) => `총 ${n}편`,
  },

  /* 마이페이지 */
  mypage: {
    title: "마이페이지",
    ctaUpgrade: "업그레이드",
    ctaLogout: "로그아웃",
    ctaDeleteAccount: "계정 삭제",
    deleteConfirm: "정말 계정을 삭제할까요? 되돌릴 수 없어요.",
    themeLabel: "다크 모드",
    notificationLabel: "완성 알림",
  },

  /* 업그레이드 */
  upgrade: {
    title: "더 많은 만화를",
    billingMonthly: "월간",
    billingYearly: "연간 (2개월 무료)",
    ctaSelect: "시작하기",
    ctaCurrentPlan: "현재 플랜",
    creditPackTitle: "지금 바로 만들기",
    creditPackHint: "구독 없이 필요할 때만",
  },

  /* 공통 에러 */
  error: {
    generic: "오류가 발생했어요. 다시 시도해 주세요.",
    networkError: "네트워크 연결을 확인해 주세요.",
    notFound: "찾을 수 없는 페이지예요.",
    authRequired: "로그인이 필요해요.",
    generationFailed: "만화 생성에 실패했어요. 잠시 후 다시 시도해 주세요.",
    moderationBlocked: "일기 내용을 다시 확인해 주세요.",
    quotaExceeded: "오늘 한도를 모두 사용했어요.",
    ctaRetry: "다시 시도",
    ctaHome: "홈으로",
  },
} as const;
