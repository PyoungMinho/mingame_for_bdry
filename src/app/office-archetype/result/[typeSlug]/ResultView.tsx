"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { ResultCard, ShareCta, ThemeToggle, TypeIcon } from "../../_components";
import { findMatchType, findTypeBySlug } from "../../lib/score";
import { OA_STORAGE_KEYS, type OaType } from "../../lib/types";
import { useOaTheme } from "../../lib/useOaTheme";
import configData from "../../data/config.json";
import typesData from "../../data/types.json";
import type { OaConfig, TypesData } from "../../lib/types";

const config = configData as OaConfig;
const types = (typesData as TypesData).types;

export interface ResultViewProps {
  type: OaType;
}

/**
 * 화면 3 — 결과 (design-final §1 화면3) 클라이언트 뷰.
 * sessionStorage(`oa-result`)와 현재 URL의 typeSlug를 비교해 "본인 결과" / "친구 결과 프리뷰"
 * 모드를 분기한다(design-final §1-0 딥링크 모드 분기).
 */
export default function ResultView({ type }: ResultViewProps) {
  const { theme, toggle } = useOaTheme();
  const [isOwnResult, setIsOwnResult] = useState<boolean | null>(null);
  const [matchPreviewId, setMatchPreviewId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedSlug = window.sessionStorage.getItem(OA_STORAGE_KEYS.result);
      setIsOwnResult(savedSlug === type.id);
    } catch {
      setIsOwnResult(false);
    }
  }, [type.id]);

  const indexInTypes = useMemo(() => types.findIndex((t) => t.id === type.id) + 1, [type.id]);
  const matchType = useMemo(() => findMatchType(type, types), [type]);
  const previewType = useMemo(
    () => (matchPreviewId ? findTypeBySlug(matchPreviewId, types) : undefined),
    [matchPreviewId],
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `${config.resultBasePath}/${type.id}`;
    return `${window.location.origin}${config.resultBasePath}/${type.id}`;
  }, [type.id]);

  function handleRestart() {
    try {
      window.sessionStorage.clear();
    } catch {
      // 무시 — 그래도 랜딩으로는 이동
    }
  }

  // sessionStorage 확인 전 깜빡임 방지: 확인될 때까지는 본인 결과 레이아웃으로 렌더(SSR과 동일 모습).
  const showFriendPreviewBadge = isOwnResult === false;

  return (
    <div className="oa-container">
      <header className="oa-header is-surface">
        <button
          type="button"
          className="oa-icon-btn touch-target"
          aria-label="공유하기"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({ title: type.name, text: type.tagline, url: shareUrl }).catch(() => {});
            }
          }}
        >
          <Share2 size={18} aria-hidden="true" />
        </button>
        <span className="oa-text-label">OFFICE ARCHETYPE</span>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <main style={{ flex: 1, paddingTop: 12, paddingBottom: 32 }}>
        {showFriendPreviewBadge ? (
          <div style={{ textAlign: "center" }}>
            <span className="oa-preview-badge">{config.labels.friendPreviewBadge}</span>
          </div>
        ) : null}

        <div className="oa-rise oa-rise-1">
          <ResultCard
            type={type}
            indexInTypes={indexInTypes}
            totalTypes={types.length}
            matchType={matchType}
            labels={{
              strengthLabel: config.labels.strengths,
              shadowLabel: config.labels.shadows,
              matchLabel: config.labels.match,
              matchCtaLabel: config.labels.matchCtaButton,
            }}
            onMatchCtaClick={matchType ? () => setMatchPreviewId(matchType.id) : undefined}
          />
        </div>

        <section className="oa-detail-section oa-rise oa-rise-2">
          <h2>💪 {config.labels.strengths}</h2>
          <ul className="oa-detail-list">
            {type.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="oa-detail-section oa-rise oa-rise-3">
          <h2>🌑 {config.labels.shadows}</h2>
          <ul className="oa-detail-list">
            {type.shadows.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        {showFriendPreviewBadge ? (
          <div style={{ marginTop: 32 }}>
            <Link href="/office-archetype" className="oa-btn-primary">
              {config.labels.friendPreviewCta}
            </Link>
          </div>
        ) : null}
      </main>

      {!showFriendPreviewBadge ? (
        <div className="oa-sticky-bottom pb-safe">
          <ShareCta
            shareUrl={shareUrl}
            shareTitle={type.name}
            shareText={type.tagline}
            imageDownloadUrl={`/office-archetype/og/${type.id}?ratio=9x16`}
            imageFileName={`office-archetype-${type.id}.png`}
            labels={{
              shareKakao: config.labels.shareKakao,
              shareStory: config.labels.shareStory,
              toastCopied: config.labels.toastCopied,
            }}
          />
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Link href="/office-archetype" className="oa-link-btn" onClick={handleRestart}>
              {config.labels.restart}
            </Link>
          </div>
        </div>
      ) : null}

      {previewType ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${previewType.name} 미리보기`}
          onClick={() => setMatchPreviewId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(28,35,51,0.45)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "var(--oa-surface)",
              borderTopLeftRadius: "var(--oa-radius-lg)",
              borderTopRightRadius: "var(--oa-radius-lg)",
              padding: "12px 24px 32px",
              boxShadow: "var(--oa-shadow-lg)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 4,
                borderRadius: "var(--oa-radius-full)",
                background: "var(--oa-border-strong)",
                margin: "0 auto 16px",
              }}
            />
            <div
              className="oa-result-card-badge"
              style={{ "--oa-type-tint": previewType.color.tint } as React.CSSProperties}
            >
              <TypeIcon icon={previewType.icon} size={36} color={previewType.color.solid} strokeWidth={2.5} />
            </div>
            <h2 className="oa-text-h1" style={{ textAlign: "center", marginTop: 12 }}>
              {previewType.name}
            </h2>
            <p className="oa-text-body-sm" style={{ textAlign: "center", marginTop: 4 }}>
              〈{previewType.alias}〉
            </p>
            <p className="oa-text-body" style={{ textAlign: "center", marginTop: 12 }}>
              &ldquo;{previewType.tagline}&rdquo;
            </p>
            <Link
              href={`${config.resultBasePath}/${previewType.id}`}
              className="oa-btn-primary"
              style={{ marginTop: 20 }}
            >
              {config.labels.matchCtaButton}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
