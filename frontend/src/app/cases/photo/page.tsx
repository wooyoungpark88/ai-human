"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { CaseCard } from "@/components/CaseCard";
import { API_URL } from "@/lib/constants";
import type { CaseInfo } from "@/lib/types";

export default function PhotoCasesPage() {
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch(`${API_URL}/api/cases`);
        const json = await res.json();
        if (json.cases) {
          // 사진 모드 = avatar_type === "photo" 만
          setCases(json.cases.filter((c: CaseInfo) => c.avatar_type === "photo"));
        }
      } catch (err) {
        console.warn("케이스 목록 로드 실패:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCases();
  }, []);

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
              <span>텍스트·음성 케이스 실습</span>
            </div>
            <h1 className="tc-page-h text-[20px] sm:text-[22px] lg:text-[24px]">
              텍스트·음성 케이스 실습
            </h1>
            <p
              className="text-[12.5px] sm:text-[13px] mt-1.5 max-w-[780px] leading-relaxed"
              style={{ color: "var(--tc-text-sec)" }}
            >
              실시간 영상 AI 휴먼 없이, 내담자 감정에 따라 표정이 변하는{" "}
              <strong>정적 초상화</strong>로 진행하는 상담 실습. 음성·텍스트 대화는 동일하게
              지원되며, 표정 변화와 감정 흐름 관찰에 집중합니다.
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

        {loading ? (
          <div className="text-center py-16 text-[13px]" style={{ color: "var(--tc-text-sec)" }}>
            케이스 로딩 중...
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-16 text-[13px]" style={{ color: "var(--tc-text-sec)" }}>
            사진 모드 케이스가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {cases.map((c) => (
              <CaseCard key={c.id} caseInfo={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
