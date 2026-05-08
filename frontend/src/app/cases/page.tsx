"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { CaseCard } from "@/components/CaseCard";
import { API_URL, CATEGORY_LABELS } from "@/lib/constants";
import type { CaseInfo } from "@/lib/types";

const ALL_CATEGORIES = ["all", ...Object.keys(CATEGORY_LABELS)];
const ALL_DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"];
const DIFFICULTY_LABEL_MAP: Record<string, string> = {
  all: "전체",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

export default function CasesPage() {
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch(`${API_URL}/api/cases`);
        const json = await res.json();
        if (json.cases) setCases(json.cases);
      } catch (err) {
        console.warn("케이스 목록 로드 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, []);

  const filteredCases = cases.filter((c) => {
    if (selectedCategory !== "all" && c.category !== selectedCategory)
      return false;
    if (selectedDifficulty !== "all" && c.difficulty !== selectedDifficulty)
      return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />

      <main className="max-w-6xl mx-auto px-9 py-8">
        {/* 페이지 헤더 */}
        <div className="mb-7">
          <div
            className="text-[11.5px] flex gap-1.5 mb-1.5"
            style={{ color: "var(--tc-text-sec)" }}
          >
            <span>훈련</span>
            <span style={{ color: "var(--tc-text-muted)" }}>›</span>
            <span>케이스 탐색</span>
          </div>
          <h1 className="tc-page-h">내담자 케이스</h1>
          <p
            className="text-[13px] mt-1.5 max-w-[780px]"
            style={{ color: "var(--tc-text-sec)" }}
          >
            연습하고 싶은 상담 케이스를 골라 시작하세요. 각 내담자는 고유한 호소 문제와
            저항도를 가지고 있어, 다양한 상담 상황을 시뮬레이션할 수 있습니다.
          </p>
        </div>

        {/* 필터 */}
        <div
          className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-[14px] border"
          style={{
            background: "var(--tc-card-white)",
            borderColor: "var(--tc-border)",
          }}
        >
          {/* 카테고리 */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.16em] uppercase"
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
                      background: active
                        ? "var(--tc-accent-dark)"
                        : "var(--tc-soft-bg)",
                      color: active ? "#fff" : "var(--tc-text-sec)",
                      border: `1px solid ${
                        active ? "var(--tc-accent-dark)" : "var(--tc-border)"
                      }`,
                    }}
                  >
                    {cat === "all" ? "전체" : CATEGORY_LABELS[cat] || cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 난이도 */}
          <div
            className="flex items-center gap-2 pl-3 ml-1 border-l"
            style={{ borderColor: "var(--tc-border)" }}
          >
            <span
              className="text-[10px] font-bold tracking-[0.16em] uppercase"
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
                      background: active
                        ? "var(--tc-accent-dark)"
                        : "var(--tc-soft-bg)",
                      color: active ? "#fff" : "var(--tc-text-sec)",
                      border: `1px solid ${
                        active ? "var(--tc-accent-dark)" : "var(--tc-border)"
                      }`,
                    }}
                  >
                    {DIFFICULTY_LABEL_MAP[diff]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 케이스 그리드 */}
        {loading ? (
          <div
            className="text-center py-16 text-[13px]"
            style={{ color: "var(--tc-text-sec)" }}
          >
            케이스 로딩 중...
          </div>
        ) : filteredCases.length === 0 ? (
          <div
            className="text-center py-16 text-[13px]"
            style={{ color: "var(--tc-text-sec)" }}
          >
            조건에 맞는 케이스가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCases.map((c) => (
              <CaseCard key={c.id} caseInfo={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
