// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// 로그인 페이지 — 이메일 + 카카오/애플 소셜 로그인
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이메일 매직링크 요청 (Supabase Auth)
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("이메일 주소를 입력해주세요.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Supabase signInWithOtp 연동 (백엔드팀 Supabase Auth 설정 후)
      // await supabase.auth.signInWithOtp({ email })
      // Mock: 0.8초 후 성공 처리
      await new Promise((r) => setTimeout(r, 800));
      alert(`${email}로 로그인 링크를 보냈습니다.`);
    } catch {
      setError("로그인에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  // 카카오 소셜 로그인
  async function handleKakaoLogin() {
    setIsLoading(true);
    try {
      // TODO: Supabase signInWithOAuth({ provider: 'kakao' }) 연동
      router.push("/onboarding");
    } catch {
      setError("카카오 로그인에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  // 애플 로그인
  async function handleAppleLogin() {
    setIsLoading(true);
    try {
      // TODO: Supabase signInWithOAuth({ provider: 'apple' }) 연동
      router.push("/onboarding");
    } catch {
      setError("Apple 로그인에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 이메일 폼 */}
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-label text-primary-800 font-medium">
            이메일
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "email-error" : undefined}
            className={[
              "w-full h-11 px-4 rounded-lg border bg-white",
              "text-body-l text-primary-800 placeholder:text-gray-400",
              "outline-none transition-all duration-fast",
              "focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
              error
                ? "border-error"
                : "border-gray-200 focus-visible:border-accent-500",
            ].join(" ")}
          />
          {error && (
            <p id="email-error" role="alert" className="flex items-center gap-1 text-caption text-error">
              <span aria-hidden="true">✕</span>
              {error}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary" size="lg" loading={isLoading} className="w-full">
          이메일로 계속하기
        </Button>
      </form>

      {/* 구분선 */}
      <div className="flex items-center gap-3">
        <hr className="flex-1 border-gray-200" />
        <span className="text-caption text-gray-400">또는</span>
        <hr className="flex-1 border-gray-200" />
      </div>

      {/* 소셜 로그인 */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleKakaoLogin}
          disabled={isLoading}
          className={[
            "w-full h-11 rounded-lg flex items-center justify-center gap-2",
            "bg-[#FEE500] text-[#191919] font-medium text-body-m",
            "touch-target transition-all duration-fast",
            "hover:brightness-95 active:scale-[0.97]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          ].join(" ")}
          aria-label="카카오로 로그인"
        >
          카카오로 계속하기
        </button>

        <button
          type="button"
          onClick={handleAppleLogin}
          disabled={isLoading}
          className={[
            "w-full h-11 rounded-lg flex items-center justify-center gap-2",
            "bg-black text-white font-medium text-body-m",
            "touch-target transition-all duration-fast",
            "hover:brightness-110 active:scale-[0.97]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          ].join(" ")}
          aria-label="Apple로 로그인"
        >
          Apple로 계속하기
        </button>
      </div>

      {/* 약관 안내 */}
      <p className="text-center text-caption text-gray-400">
        계속 진행하면{" "}
        <a href="/terms" className="underline hover:text-primary-800">
          이용약관
        </a>{" "}
        및{" "}
        <a href="/privacy" className="underline hover:text-primary-800">
          개인정보처리방침
        </a>
        에 동의하는 것으로 간주합니다.
      </p>
    </div>
  );
}
