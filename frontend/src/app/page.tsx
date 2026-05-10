"use client";

import Link from "next/link";
import { Navigation } from "@/components/Navigation";

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-9 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-12">
          <p
            className="text-[11px] font-bold tracking-[0.2em] uppercase mb-2"
            style={{ color: "var(--tc-text-muted)" }}
          >
            Terraco · AI 상담 훈련
          </p>
          <h1 className="tc-page-h text-[26px] sm:text-[32px] mb-3">
            실습 모드를 선택하세요
          </h1>
          <p
            className="text-[13px] sm:text-[14px] max-w-[640px] mx-auto leading-relaxed"
            style={{ color: "var(--tc-text-sec)" }}
          >
            영상 AI 휴먼과 대화하거나, 표정이 변하는 사진 기반 케이스로 상담 실습을 진행할 수 있습니다.
            각 모드는 서로 다른 상담 시뮬레이션 환경을 제공합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
          {/* A: 영상 AI 휴먼 */}
          <Link
            href="/cases/video"
            className="group block rounded-[18px] overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(60,40,23,0.18)]"
            style={{
              background: "var(--tc-card-white)",
              border: "1.5px solid var(--tc-border)",
            }}
          >
            <div
              className="aspect-[16/10] flex items-center justify-center relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, var(--tc-accent-dark) 0%, var(--tc-accent-deep) 50%, var(--tc-accent) 100%)",
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 30% 40%, rgba(251,220,201,0.3) 0%, transparent 60%)",
                }}
              />
              <div className="relative text-center px-6">
                <div className="text-[64px] sm:text-[72px] leading-none mb-3">🎥</div>
                <div
                  className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
                  style={{ color: "var(--tc-peach)" }}
                >
                  Mode A
                </div>
                <div
                  className="text-[20px] sm:text-[22px] font-bold leading-tight"
                  style={{
                    color: "#fff",
                    fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  실시간 영상 AI 휴먼
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p
                className="text-[13px] leading-relaxed mb-3"
                style={{ color: "var(--tc-text)" }}
              >
                실제로 움직이고 말하는 AI 휴먼과 음성·텍스트로 상담합니다. VRM·DeepBrain Web SDK 등
                실시간 립싱크·표정 엔진과 연동됩니다.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="tc-tag tc-tag-cream">박지영 (15세)</span>
                <span className="tc-tag tc-tag-cream">한지유 (29세)</span>
              </div>
              <div
                className="flex items-center justify-between text-[12px] font-semibold"
                style={{ color: "var(--tc-accent-deep)" }}
              >
                <span>실습 시작하기</span>
                <span className="text-[16px] transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* B: 사진 AI 휴먼 (옛날 버전) */}
          <Link
            href="/cases/photo"
            className="group block rounded-[18px] overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(60,40,23,0.18)]"
            style={{
              background: "var(--tc-card-white)",
              border: "1.5px solid var(--tc-border)",
            }}
          >
            <div
              className="aspect-[16/10] flex items-center justify-center relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, var(--tc-bg-2) 0%, var(--tc-cream) 50%, var(--tc-soft-bg) 100%)",
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 70% 50%, rgba(192,138,62,0.18) 0%, transparent 60%)",
                }}
              />
              <div className="relative text-center px-6">
                <div className="text-[64px] sm:text-[72px] leading-none mb-3">💬</div>
                <div
                  className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5"
                  style={{ color: "var(--tc-text-muted)" }}
                >
                  Mode B
                </div>
                <div
                  className="text-[20px] sm:text-[22px] font-bold leading-tight"
                  style={{
                    color: "var(--tc-accent-dark)",
                    fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
                    letterSpacing: "-0.02em",
                  }}
                >
                  텍스트·음성 케이스 실습
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p
                className="text-[13px] leading-relaxed mb-3"
                style={{ color: "var(--tc-text)" }}
              >
                초상화 사진 없이 표준 텍스트 카드로 표시되는 케이스 라이브러리. 영상 AI 휴먼이
                연동되어 있어도 정적 사진은 표시하지 않으며, 대화·감정 평가 위주로 진행합니다.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="tc-tag tc-tag-gray">이준호</span>
                <span className="tc-tag tc-tag-gray">김서연</span>
                <span className="tc-tag tc-tag-gray">오은정</span>
              </div>
              <div
                className="flex items-center justify-between text-[12px] font-semibold"
                style={{ color: "var(--tc-text-sec)" }}
              >
                <span>케이스 라이브러리 열기</span>
                <span className="text-[16px] transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 sm:mt-12 text-center">
          <Link
            href="/cases/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[12.5px] font-semibold transition-colors hover:bg-[var(--tc-soft-bg)]"
            style={{
              background: "var(--tc-card-white)",
              color: "var(--tc-accent-dark)",
              border: "1.5px solid var(--tc-border-warm)",
            }}
          >
            <span className="text-[14px] leading-none">+</span>
            새 페르소나 만들기
          </Link>
        </div>
      </main>
    </div>
  );
}
