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
          <h1 className="tc-page-h text-[26px] sm:text-[32px]">
            실습 모드를 선택하세요
          </h1>
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
                  영상 기반 훈련
                </div>
                <div
                  className="text-[11px] mt-1.5"
                  style={{ color: "rgba(255,246,234,0.75)" }}
                >
                  실제 사람처럼 움직이는 내담자
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p
                className="text-[13px] leading-relaxed mb-3"
                style={{ color: "var(--tc-text)" }}
              >
                내담자가 영상으로 마주 보며 말하고 표정·시선·입 모양이 실시간으로 반응합니다.
                대면 상담과 가장 가까운 환경으로, 비언어적 소통까지 연습할 수 있습니다.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="tc-tag tc-tag-cream">이준호</span>
                <span className="tc-tag tc-tag-cream">김서연</span>
                <span className="tc-tag tc-tag-cream">박지영</span>
                <span className="tc-tag tc-tag-cream">한지유</span>
                <span className="tc-tag tc-tag-cream">오은정</span>
              </div>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-4"
                style={{
                  background: "var(--tc-soft-bg)",
                  color: "var(--tc-text-sec)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                💰 50분 회기 약 <strong style={{ color: "var(--tc-accent-deep)" }}>₩10,000</strong>
                <span className="opacity-60 ml-0.5">(엔진 ₩2,000~₩15,000)</span>
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
                <div className="text-[64px] sm:text-[72px] leading-none mb-3">🖼️</div>
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
                  이미지 기반 훈련
                </div>
                <div
                  className="text-[11px] mt-1.5"
                  style={{ color: "var(--tc-text-muted)" }}
                >
                  표정이 바뀌는 사진 + 실시간 음성
                </div>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p
                className="text-[13px] leading-relaxed mb-3"
                style={{ color: "var(--tc-text)" }}
              >
                내담자의 감정에 따라 표정이 바뀌는 사진과 함께 실시간으로 음성·텍스트 상담을
                진행합니다. 가볍게 빠르게 반복 연습할 수 있어 회기 초기 라포 형성이나 경청 훈련에
                적합합니다.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="tc-tag tc-tag-cream">박지영</span>
                <span className="tc-tag tc-tag-cream">한지유</span>
                <span className="tc-tag tc-tag-cream">박준영</span>
              </div>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-4"
                style={{
                  background: "var(--tc-soft-bg)",
                  color: "var(--tc-text-sec)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                💰 50분 회기 약 <strong style={{ color: "var(--tc-accent-deep)" }}>₩2,000</strong>
                <span className="opacity-60 ml-0.5">(영상 비용 없음)</span>
              </div>
              <div
                className="flex items-center justify-between text-[12px] font-semibold"
                style={{ color: "var(--tc-text-sec)" }}
              >
                <span>이미지 모드 실습 시작</span>
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
