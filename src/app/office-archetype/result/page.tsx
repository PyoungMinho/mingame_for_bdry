"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OA_STORAGE_KEYS } from "../lib/types";
import configData from "../data/config.json";
import type { OaConfig } from "../lib/types";

const config = configData as OaConfig;

/**
 * `/office-archetype/result` (무파라미터) 리다이렉터 (design-final D5).
 * sessionStorage에 본인 결과 slug(`oa-result`)가 있으면 `/result/[typeSlug]`로 replace,
 * 없으면(직접 URL 접근·세션 만료 등) 랜딩으로 replace하며 "결과 없음" 토스트를 잠깐 보여준다.
 */
export default function OfficeArchetypeResultRedirectPage() {
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    let resultSlug: string | null = null;
    try {
      resultSlug = window.sessionStorage.getItem(OA_STORAGE_KEYS.result);
    } catch {
      resultSlug = null;
    }

    if (resultSlug) {
      router.replace(`${config.resultBasePath}/${resultSlug}`);
      return;
    }

    setShowToast(true);
    const t = window.setTimeout(() => {
      router.replace("/office-archetype");
    }, 1500);
    return () => window.clearTimeout(t);
  }, [router]);

  return (
    <div className="oa-container">
      <div className="oa-loading" role="status" aria-live="polite">
        <div className="oa-loading-track" />
        <p className="oa-loading-text">
          {showToast ? config.labels.toastNoResult ?? "결과가 없어요. 테스트부터 시작해볼까요?" : " "}
        </p>
      </div>
    </div>
  );
}
