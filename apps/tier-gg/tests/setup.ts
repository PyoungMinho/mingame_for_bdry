// 글로벌 테스트 셋업
// mock 모드 강제 + 어드민 이메일 기본값
process.env.USE_MOCK_DATA = "true";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.local";
// Supabase 키는 의도적으로 미설정 (mock 분기 유지)
