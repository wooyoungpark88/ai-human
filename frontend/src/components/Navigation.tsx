"use client";

import Link from "next/link";

export function Navigation() {
  return (
    <header
      className="sticky top-0 z-50 h-[54px] flex items-center px-6 gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.14)]"
      style={{ background: "var(--tc-accent-dark)", color: "#F5E8D6" }}
    >
      <Link href="/cases" className="flex items-center gap-2.5 no-underline text-inherit">
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-black"
          style={{
            background: "var(--tc-peach)",
            color: "var(--tc-accent-dark)",
            fontFamily: "'Archivo Black', sans-serif",
          }}
        >
          T
        </span>
        <span
          className="text-[16px] font-black tracking-tight text-white"
          style={{ fontFamily: "'Archivo Black','Pretendard Variable',sans-serif" }}
        >
          Terraco
        </span>
        <span className="text-[12px] opacity-70 ml-1">AI 상담 훈련</span>
      </Link>

      <nav className="ml-6 flex items-center gap-1">
        <Link
          href="/cases"
          className="px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors hover:bg-white/10"
          style={{ color: "#F5E8D6" }}
        >
          케이스 탐색
        </Link>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="flex items-center gap-2 pl-1.5 pr-2.5 py-[5px] rounded-full cursor-default"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <span
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{
              background: "var(--tc-peach)",
              color: "var(--tc-accent-dark)",
              fontFamily: "'Gowun Batang',serif",
            }}
          >
            상
          </span>
          <div className="leading-tight">
            <div className="text-[12px] font-semibold text-white">상담사</div>
            <div className="text-[10px]" style={{ color: "rgba(245,232,214,0.65)" }}>
              훈련 모드
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
