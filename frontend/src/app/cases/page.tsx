"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { CaseCard } from "@/components/CaseCard";
import { Badge } from "@/components/ui/badge";
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
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">내담자 케이스</h2>
          <p className="text-muted-foreground">
            연습하고 싶은 상담 케이스를 선택하세요.
          </p>
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* 카테고리 필터 */}
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === "all" ? "전체" : (CATEGORY_LABELS[cat] || cat)}
              </Badge>
            ))}
          </div>

          {/* 난이도 필터 */}
          <div className="flex flex-wrap gap-1.5 border-l pl-4">
            {ALL_DIFFICULTIES.map((diff) => (
              <Badge
                key={diff}
                variant={selectedDifficulty === diff ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedDifficulty(diff)}
              >
                {DIFFICULTY_LABEL_MAP[diff]}
              </Badge>
            ))}
          </div>
        </div>

        {/* 케이스 그리드 */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            케이스 로딩 중...
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
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
