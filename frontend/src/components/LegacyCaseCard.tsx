"use client";

import Link from "next/link";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/constants";
import type { CaseInfo } from "@/lib/types";

interface CaseCardProps {
  caseInfo: CaseInfo;
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
  flashhead: { label: "OpenAvatarChat", cls: "tc-tag-green" },
  deepbrain: { label: "DeepBrain", cls: "tc-tag-blue" },
};

/**
 * 옛날 버전 케이스 카드 — 초상화 사진 없이 텍스트 위주.
 * /cases/photo 페이지(B 모드)에서 사용.
 */
export function LegacyCaseCard({ caseInfo }: CaseCardProps) {
  const categoryLabel = CATEGORY_LABELS[caseInfo.category] || caseInfo.category;
  const categoryCls = CATEGORY_TAG_CLASS[caseInfo.category] || "tc-tag-gray";
  const difficultyLabel =
    DIFFICULTY_LABELS[caseInfo.difficulty] || caseInfo.difficulty;
  const difficultyCls =
    DIFFICULTY_TAG_CLASS[caseInfo.difficulty] || "tc-tag-gray";

  const avatarType = caseInfo.avatar_type || "vrm";
  const avatar = AVATAR_TAG_CONFIG[avatarType];

  return (
    <article
      className="flex flex-col h-full bg-[var(--tc-card-white)] border border-[var(--tc-border)] rounded-[14px] p-[22px] transition-all hover:border-[var(--tc-border-warm)] hover:shadow-[0_8px_24px_rgba(60,40,23,0.08)]"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-[60px] h-[60px] rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            background: "var(--tc-soft-bg)",
            border: "1px solid var(--tc-border)",
            color: "var(--tc-text-muted)",
            fontSize: 22,
          }}
        >
          👤
        </div>
        <div className="flex-1 min-w-0 flex flex-wrap items-start gap-1.5 pt-0.5">
          <span className={`tc-tag ${categoryCls}`}>{categoryLabel}</span>
          <span className={`tc-tag ${difficultyCls}`}>{difficultyLabel}</span>
          {avatar && <span className={`tc-tag ${avatar.cls}`}>{avatar.label}</span>}
        </div>
      </div>

      <h3
        className="text-[16px] font-bold leading-snug"
        style={{
          fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
          color: "var(--tc-accent-dark)",
          letterSpacing: "-0.02em",
        }}
      >
        {caseInfo.name}{" "}
        <span
          className="text-[13px] font-normal"
          style={{ color: "var(--tc-text-sec)" }}
        >
          ({caseInfo.age}세 · {caseInfo.gender})
        </span>
      </h3>
      <p className="text-[12.5px] mt-1" style={{ color: "var(--tc-text-sec)" }}>
        {caseInfo.occupation}
      </p>

      <div
        className="mt-4 pt-4 border-t"
        style={{ borderColor: "var(--tc-border)" }}
      >
        <p
          className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5"
          style={{ color: "var(--tc-text-muted)" }}
        >
          호소 문제
        </p>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--tc-text)" }}
        >
          {caseInfo.presenting_issue}
        </p>
      </div>

      {caseInfo.description && (
        <p
          className="text-[12px] mt-3 line-clamp-3 leading-relaxed"
          style={{ color: "var(--tc-text-sec)" }}
        >
          {caseInfo.description}
        </p>
      )}

      {caseInfo.session_goals.length > 0 && (
        <div className="mt-3">
          <p
            className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5"
            style={{ color: "var(--tc-text-muted)" }}
          >
            세션 목표
          </p>
          <ul
            className="text-[12px] space-y-1"
            style={{ color: "var(--tc-text-sec)" }}
          >
            {caseInfo.session_goals.map((goal, i) => (
              <li key={i} className="flex gap-1.5">
                <span style={{ color: "var(--tc-accent-light)" }}>·</span>
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-5 grid grid-cols-[1fr_auto] gap-2">
        {caseInfo.external_url ? (
          <a
            href={caseInfo.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center py-2.5 px-4 rounded-full text-[12.5px] font-bold transition-opacity hover:opacity-90"
            style={{
              background: "var(--tc-accent-dark)",
              color: "#fff",
            }}
          >
            데모 열기
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
    </article>
  );
}
