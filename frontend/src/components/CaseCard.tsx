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
}

const CATEGORY_TAG_CLASS: Record<string, string> = {
  burnout: "tc-tag-gold",
  anxiety: "tc-tag-cream",
  relationship: "tc-tag-red",
  depression: "tc-tag-blue",
  self_esteem: "tc-tag-green",
};

const DIFFICULTY_TAG_CLASS: Record<string, string> = {
  beginner: "tc-tag-green",
  intermediate: "tc-tag-gold",
  advanced: "tc-tag-red",
};

const AVATAR_TAG_CONFIG: Record<string, { label: string; cls: string }> = {
  vrm: { label: "VRM", cls: "tc-tag-green" },
  heygen: { label: "HeyGen Interactive", cls: "tc-tag-cream" },
  simli: { label: "Simli", cls: "tc-tag-cream" },
  flashhead: { label: "OpenAvatarChat", cls: "tc-tag-green" },
  deepbrain: { label: "DeepBrain AI Human", cls: "tc-tag-blue" },
};

export function CaseCard({ caseInfo }: CaseCardProps) {
  const categoryLabel = CATEGORY_LABELS[caseInfo.category] || caseInfo.category;
  const categoryCls = CATEGORY_TAG_CLASS[caseInfo.category] || "tc-tag-gray";
  const difficultyLabel = DIFFICULTY_LABELS[caseInfo.difficulty] || caseInfo.difficulty;
  const difficultyCls = DIFFICULTY_TAG_CLASS[caseInfo.difficulty] || "tc-tag-gray";

  const avatarType = caseInfo.avatar_type || "vrm";
  const avatar = AVATAR_TAG_CONFIG[avatarType];

  // OAC(FlashHead) 사이드카 도달 가능성 — 마운트 시 1회 체크
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
        setOacReachable({
          reachable: !!data.reachable,
          reason: data.reason,
        });
      })
      .catch(() => {
        if (!aborted) setOacReachable({ reachable: false, reason: "fetch_error" });
      });
    return () => {
      aborted = true;
    };
  }, [isOac]);

  return (
    <article
      className="flex flex-col h-full bg-[var(--tc-card-white)] border border-[var(--tc-border)] rounded-[14px] p-[22px] transition-all hover:border-[var(--tc-border-warm)] hover:shadow-[0_8px_24px_rgba(60,40,23,0.08)]"
    >
      {/* 태그 영역 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className={`tc-tag ${categoryCls}`}>{categoryLabel}</span>
        <span className={`tc-tag ${difficultyCls}`}>{difficultyLabel}</span>
        {avatar && <span className={`tc-tag ${avatar.cls}`}>{avatar.label}</span>}
      </div>

      {/* 이름 / 인적사항 */}
      <h3
        className="text-[16px] font-bold leading-snug"
        style={{
          fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
          color: "var(--tc-accent-dark)",
          letterSpacing: "-0.02em",
        }}
      >
        {caseInfo.name}{" "}
        <span className="text-[13px] font-normal" style={{ color: "var(--tc-text-sec)" }}>
          ({caseInfo.age}세 · {caseInfo.gender})
        </span>
      </h3>
      <p className="text-[12.5px] mt-1" style={{ color: "var(--tc-text-sec)" }}>
        {caseInfo.occupation}
      </p>

      {/* 호소 문제 */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--tc-border)" }}>
        <p
          className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5"
          style={{ color: "var(--tc-text-muted)" }}
        >
          호소 문제
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--tc-text)" }}>
          {caseInfo.presenting_issue}
        </p>
      </div>

      {/* 설명 */}
      {caseInfo.description && (
        <p
          className="text-[12px] mt-3 line-clamp-3 leading-relaxed"
          style={{ color: "var(--tc-text-sec)" }}
        >
          {caseInfo.description}
        </p>
      )}

      {/* 세션 목표 */}
      {caseInfo.session_goals.length > 0 && (
        <div className="mt-3">
          <p
            className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5"
            style={{ color: "var(--tc-text-muted)" }}
          >
            세션 목표
          </p>
          <ul className="text-[12px] space-y-1" style={{ color: "var(--tc-text-sec)" }}>
            {caseInfo.session_goals.map((goal, i) => (
              <li key={i} className="flex gap-1.5">
                <span style={{ color: "var(--tc-accent-light)" }}>·</span>
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* OAC 사이드카 상태 인디케이터 */}
      {isOac && oacReachable && (
        <div
          className="mt-3 p-2.5 rounded-lg text-[11.5px] flex items-start gap-2"
          style={{
            background: oacReachable.reachable
              ? "var(--tc-green-soft)"
              : "var(--tc-red-soft)",
            color: oacReachable.reachable
              ? "var(--tc-green-deep)"
              : "var(--tc-red)",
            border: `1px solid ${
              oacReachable.reachable ? "var(--tc-green)" : "var(--tc-red)"
            }`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
            style={{
              background: oacReachable.reachable
                ? "var(--tc-green)"
                : "var(--tc-red)",
            }}
          />
          <span className="leading-snug">
            {oacReachable.reachable ? (
              <>사이드카 연결 가능 ({caseInfo.external_url})</>
            ) : (
              <>
                사이드카 미연결 — WSL2에서 OpenAvatarChat을 실행한 뒤 다시 시도하세요.
                {oacReachable.reason && (
                  <span className="opacity-70"> ({oacReachable.reason})</span>
                )}
              </>
            )}
          </span>
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-5 space-y-2">
        {caseInfo.external_url ? (
          <a
            href={caseInfo.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-2.5 px-4 rounded-full text-[12.5px] font-semibold transition-all"
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
              ? "사이드카 시작 후 재시도"
              : "데모 열기 (새 탭)"}
          </a>
        ) : (
          <Link
            href={`/session/${caseInfo.id}`}
            className="block w-full text-center py-2.5 px-4 rounded-full text-[12.5px] font-semibold transition-colors hover:opacity-90"
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
          className="block w-full text-center py-1.5 px-4 rounded-full text-[11.5px] font-medium transition-colors hover:bg-[var(--tc-soft-bg)]"
          style={{
            background: "transparent",
            color: "var(--tc-text-sec)",
            border: "1px solid var(--tc-border)",
          }}
        >
          명세 보기
        </Link>
      </div>
    </article>
  );
}
