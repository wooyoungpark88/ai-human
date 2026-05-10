"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { CaseCard } from "@/components/CaseCard";
import { API_URL, CATEGORY_LABELS } from "@/lib/constants";
import type { CaseInfo } from "@/lib/types";

// 영상 AI 휴먼 모드 = avatar_type이 "photo"가 아닌 모든 케이스
// (이준호 simli, 김서연 heygen, 박지영 vrm, 한지유 deepbrain, 오은정 flashhead)
const isVideoCase = (avatar_type?: string) =>
  !!avatar_type && avatar_type !== "photo";

const ALL_CATEGORIES = ["all", ...Object.keys(CATEGORY_LABELS)];
const ALL_DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"];
const DIFFICULTY_LABEL_MAP: Record<string, string> = {
  all: "전체",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

export default function VideoCasesPage() {
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch(`${API_URL}/api/cases`);
        const json = await res.json();
        if (json.cases) {
          // photo 모드 제외 = 영상 AI 휴먼이 연동된 모든 케이스
          setCases(json.cases.filter((c: CaseInfo) => isVideoCase(c.avatar_type)));
        }
      } catch (err) {
        console.warn("케이스 목록 로드 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    if (selectedCategory !== "all" && c.category !== selectedCategory) return false;
    if (selectedDifficulty !== "all" && c.difficulty !== selectedDifficulty) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-9 py-5 sm:py-7 lg:py-8">
        <div className="mb-5 sm:mb-7 flex items-end justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div
              className="text-[11.5px] flex gap-1.5 mb-1.5"
              style={{ color: "var(--tc-text-sec)" }}
            >
              <Link href="/" className="hover:underline">홈</Link>
              <span style={{ color: "var(--tc-text-muted)" }}>›</span>
              <span>실시간 영상 AI 휴먼 실습</span>
            </div>
            <h1 className="tc-page-h text-[20px] sm:text-[22px] lg:text-[24px]">
              실시간 영상 AI 휴먼 실습
            </h1>
            <p
              className="text-[12.5px] sm:text-[13px] mt-1.5 max-w-[780px] leading-relaxed"
              style={{ color: "var(--tc-text-sec)" }}
            >
              움직이는 AI 휴먼(VRM / DeepBrain Web SDK)과 실시간으로 음성·텍스트 상담을
              실습합니다. 내담자의 감정에 따라 카드와 세션 헤더의 사진도 함께 변합니다.
            </p>
          </div>
          <Link
            href="/cases/new"
            className="px-4 py-2 rounded-full text-[12.5px] font-bold transition-opacity hover:opacity-90 flex items-center gap-1.5 whitespace-nowrap shadow-[0_3px_10px_rgba(60,40,23,0.15)]"
            style={{ background: "var(--tc-accent-dark)", color: "#fff" }}
          >
            <span className="text-[14px] leading-none">+</span>
            신규 페르소나
          </Link>
        </div>

        {/* 필터 */}
        <div
          className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5 sm:mb-6 p-3 sm:p-4 rounded-[14px] border"
          style={{ background: "var(--tc-card-white)", borderColor: "var(--tc-border)" }}
        >
          <div className="flex items-start sm:items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-bold tracking-[0.16em] uppercase pt-1.5 sm:pt-0 flex-shrink-0"
              style={{ color: "var(--tc-text-muted)" }}
            >
              카테고리
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors"
                    style={{
                      background: active ? "var(--tc-accent-dark)" : "var(--tc-soft-bg)",
                      color: active ? "#fff" : "var(--tc-text-sec)",
                      border: `1px solid ${active ? "var(--tc-accent-dark)" : "var(--tc-border)"}`,
                    }}
                  >
                    {cat === "all" ? "전체" : CATEGORY_LABELS[cat] || cat}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="flex items-start sm:items-center gap-2 flex-wrap pt-3 sm:pt-0 sm:pl-3 sm:ml-1 border-t sm:border-t-0 sm:border-l"
            style={{ borderColor: "var(--tc-border)" }}
          >
            <span
              className="text-[10px] font-bold tracking-[0.16em] uppercase pt-1.5 sm:pt-0 flex-shrink-0"
              style={{ color: "var(--tc-text-muted)" }}
            >
              난이도
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DIFFICULTIES.map((diff) => {
                const active = selectedDifficulty === diff;
                return (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors"
                    style={{
                      background: active ? "var(--tc-accent-dark)" : "var(--tc-soft-bg)",
                      color: active ? "#fff" : "var(--tc-text-sec)",
                      border: `1px solid ${active ? "var(--tc-accent-dark)" : "var(--tc-border)"}`,
                    }}
                  >
                    {DIFFICULTY_LABEL_MAP[diff]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-[13px]" style={{ color: "var(--tc-text-sec)" }}>
            케이스 로딩 중...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-16 text-[13px]" style={{ color: "var(--tc-text-sec)" }}>
            조건에 맞는 케이스가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredCases.map((c) => (
              <CaseCard key={c.id} caseInfo={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
