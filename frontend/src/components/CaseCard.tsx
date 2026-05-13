"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  API_URL,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/constants";
import type { CaseInfo } from "@/lib/types";

interface CaseCardProps {
  caseInfo: CaseInfo;
  /** true면 초상화 사진을 숨기고 영상 휴먼임을 강조하는 placeholder 표시 */
  hidePortrait?: boolean;
}

const CATEGORY_TAG_CLASS: Record<string, string> = {
  burnout: "tc-tag-gold",
  anxiety: "tc-tag-cream",
  relationship: "tc-tag-red",
  depression: "tc-tag-blue",
  self_esteem: "tc-tag-green",
  bullying: "tc-tag-red",
};

const DIFFICULTY_TAG_CLASS: Record<string, string> = {
  beginner: "tc-tag-green",
  intermediate: "tc-tag-gold",
  advanced: "tc-tag-red",
};

const AVATAR_TAG_CONFIG: Record<string, { label: string; cls: string }> = {
  vrm: { label: "VRM", cls: "tc-tag-green" },
  heygen: { label: "HeyGen", cls: "tc-tag-cream" },
  simli: { label: "Simli", cls: "tc-tag-cream" },
  flashhead: { label: "OAC", cls: "tc-tag-green" },
  deepbrain: { label: "DeepBrain", cls: "tc-tag-blue" },
};

export function CaseCard({ caseInfo, hidePortrait = false }: CaseCardProps) {
  const categoryLabel = CATEGORY_LABELS[caseInfo.category] || caseInfo.category;
  const categoryCls = CATEGORY_TAG_CLASS[caseInfo.category] || "tc-tag-gray";
  const difficultyLabel = DIFFICULTY_LABELS[caseInfo.difficulty] || caseInfo.difficulty;
  const difficultyCls = DIFFICULTY_TAG_CLASS[caseInfo.difficulty] || "tc-tag-gray";

  const avatarType = caseInfo.avatar_type || "vrm";
  const avatar = AVATAR_TAG_CONFIG[avatarType];

  const portraitSrc = hidePortrait
    ? null
    : (caseInfo.portrait_variants?.neutral || caseInfo.portrait_url || null);

  const [oacReachable, setOacReachable] = useState<
    null | { reachable: boolean; reason?: string }
  >(null);
  const isOac = avatarType === "flashhead";

  useEffect(() => {
    if (!isOac) return;
    let aborted = false;
    fetch(`${API_URL}/api/sidecar/oac/health`)
      .then((r) => r.json())
      .then((data) => {
        if (aborted) return;
        setOacReachable({ reachable: !!data.reachable, reason: data.reason });
      })
      .catch(() => {
        if (!aborted) setOacReachable({ reachable: false, reason: "fetch_error" });
      });
    return () => {
      aborted = true;
    };
  }, [isOac]);

  // 호소 문제는 카드에 단어 단위로 표시 (참조 사이트처럼)
  const issueTags = (caseInfo.presenting_issue || "")
    .split(/[,··]\s*|\s*\/\s*|\s*•\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);

  return (
    <article
      className="flex flex-col h-full rounded-[14px] overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(60,40,23,0.15)]"
      style={{
        background: "var(--tc-card-white)",
        border: "1px solid var(--tc-border)",
      }}
    >
      {/* === 큰 인물 사진 또는 영상 placeholder === */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "4 / 5",
          background: hidePortrait
            ? "linear-gradient(135deg, var(--tc-accent-dark) 0%, var(--tc-accent-deep) 60%, var(--tc-accent) 100%)"
            : "linear-gradient(180deg, var(--tc-soft-bg) 0%, var(--tc-bg-2) 100%)",
        }}
      >
        {portraitSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_URL}${portraitSrc}`}
            alt={caseInfo.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : hidePortrait ? (
          // 영상 휴먼 placeholder — 짙은 갈색 그라디언트 + 영상 아이콘 + 이름 + 엔진명
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 30% 35%, rgba(251,220,201,0.25) 0%, transparent 55%)",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <div className="text-[64px] leading-none mb-3">🎥</div>
              <div
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
                style={{ color: "var(--tc-peach)" }}
              >
                Live AI Human
              </div>
              <div
                className="text-[22px] font-bold leading-tight"
                style={{
                  color: "#fff",
                  fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {caseInfo.name}
              </div>
              {avatar && (
                <div
                  className="text-[11px] mt-2 px-2.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(255,246,234,0.18)",
                    color: "var(--tc-peach)",
                  }}
                >
                  {avatar.label} 엔진
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="text-center px-3"
              style={{ color: "var(--tc-text-muted)" }}
            >
              <div
                className="font-black text-[60px] leading-none mb-2"
                style={{ fontFamily: "'Archivo Black', sans-serif", opacity: 0.5 }}
              >
                {(caseInfo.name || "?").charAt(0)}
              </div>
              <p className="text-[11px]">초상화 없음</p>
            </div>
          </div>
        )}

        {/* 호소 문제 태그 — 사진 위에 오버레이 */}
        {issueTags.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            {issueTags.map((tag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md"
                style={{
                  background: "rgba(255, 246, 234, 0.92)",
                  color: "var(--tc-accent-deep)",
                  border: "1px solid rgba(176, 74, 47, 0.25)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 우상단 카테고리/난이도 칩 */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
          <span className={`tc-tag ${categoryCls}`}>{categoryLabel}</span>
          <span className={`tc-tag ${difficultyCls}`}>{difficultyLabel}</span>
        </div>
        {avatar && (
          <span
            className={`tc-tag ${avatar.cls} absolute top-3 right-3`}
            title={`아바타: ${avatar.label}`}
          >
            {avatar.label}
          </span>
        )}
      </div>

      {/* === 본문 === */}
      <div className="flex flex-col flex-1 p-4">
        <h3
          className="text-[17px] font-bold leading-tight"
          style={{
            fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
            color: "var(--tc-accent-dark)",
            letterSpacing: "-0.02em",
          }}
        >
          {caseInfo.name}
        </h3>
        <p
          className="text-[12px] mt-0.5"
          style={{ color: "var(--tc-text-sec)" }}
        >
          {caseInfo.age}세 · {caseInfo.gender} · {caseInfo.occupation}
        </p>

        {caseInfo.description && (
          <p
            className="text-[12px] mt-2 line-clamp-2 leading-relaxed"
            style={{ color: "var(--tc-text-sec)" }}
          >
            {caseInfo.description}
          </p>
        )}

        {/* OAC 사이드카 상태 */}
        {isOac && oacReachable && !oacReachable.reachable && (
          <div
            className="mt-2 px-2 py-1.5 rounded text-[11px] flex items-center gap-1.5"
            style={{
              background: "var(--tc-red-soft)",
              color: "var(--tc-red)",
              border: "1px solid var(--tc-red)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--tc-red)" }}
            />
            사이드카 미연결
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-4 grid grid-cols-[1fr_auto] gap-2">
          {caseInfo.external_url ? (
            <a
              href={caseInfo.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center py-2.5 px-4 rounded-full text-[12.5px] font-bold transition-all"
              style={{
                background:
                  isOac && oacReachable && !oacReachable.reachable
                    ? "var(--tc-text-muted)"
                    : "var(--tc-accent-dark)",
                color: "#fff",
                opacity:
                  isOac && oacReachable && !oacReachable.reachable ? 0.6 : 1,
                pointerEvents:
                  isOac && oacReachable && !oacReachable.reachable
                    ? "none"
                    : "auto",
              }}
            >
              {isOac && oacReachable && !oacReachable.reachable
                ? "사이드카 시작 후"
                : "데모 열기"}
            </a>
          ) : (
            <Link
              href={`/session/${caseInfo.id}`}
              className="text-center py-2.5 px-4 rounded-full text-[12.5px] font-bold transition-opacity hover:opacity-90"
              style={{
                background: "var(--tc-accent-dark)",
                color: "#fff",
              }}
            >
              상담 시작
            </Link>
          )}
          <Link
            href={`/cases/${caseInfo.id}`}
            className="flex items-center justify-center px-3 rounded-full text-[12px] font-medium transition-colors hover:bg-[var(--tc-soft-bg)]"
            style={{
              color: "var(--tc-text-sec)",
              border: "1px solid var(--tc-border)",
            }}
            aria-label="명세 보기"
          >
            명세
          </Link>
        </div>
      </div>
    </article>
  );
}
