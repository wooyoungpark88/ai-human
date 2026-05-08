"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface SessionDashboardProps {
  sessionGoals: string[];
  messages: ChatMessage[];
  sessionStartedAt: Date | null;
  isSessionActive: boolean;
}

/** 한국어 상담 기법 키워드 — 단순 휴리스틱 기반 */
const SKILL_PATTERNS: Array<{
  key: string;
  label: string;
  test: (text: string) => boolean;
}> = [
  {
    key: "reflection",
    label: "감정 반영",
    test: (t) =>
      /(그러셨군요|느끼셨군요|마음이|기분이|속상|답답|힘드셨)/.test(t),
  },
  {
    key: "open_q",
    label: "개방 질문",
    test: (t) => t.trim().endsWith("?") && /(어떻게|왜|무엇|어떠|어떤)/.test(t),
  },
  {
    key: "clarify",
    label: "명료화",
    test: (t) => /(정리하면|다시 말하면|그러니까|말씀이|뜻이)/.test(t),
  },
  {
    key: "empathy",
    label: "공감 표현",
    test: (t) => /(이해|공감|충분히|그럴 수 있|당연)/.test(t),
  },
];

/** 세션 목표 달성 추정 — 매우 단순한 키워드 매칭 */
function estimateGoalProgress(
  goal: string,
  counselorMessages: string[]
): { reached: boolean; hint: string } {
  const allText = counselorMessages.join(" ");
  const lc = goal.toLowerCase();

  if (/(경청|들|들어주)/.test(goal)) {
    const longMsgs = counselorMessages.filter((m) => m.length >= 30).length;
    return {
      reached: longMsgs >= 3,
      hint: `긴 응답 ${longMsgs}회`,
    };
  }
  if (/(감정|반영|명명)/.test(goal)) {
    const hits = counselorMessages.filter((m) =>
      SKILL_PATTERNS[0].test(m)
    ).length;
    return { reached: hits >= 2, hint: `반영 ${hits}회` };
  }
  if (/(공감|신뢰|관계)/.test(goal)) {
    const hits = counselorMessages.filter((m) =>
      SKILL_PATTERNS[3].test(m)
    ).length;
    return { reached: hits >= 2, hint: `공감 ${hits}회` };
  }
  if (/(질문|개방|탐색)/.test(goal)) {
    const hits = counselorMessages.filter((m) =>
      SKILL_PATTERNS[1].test(m)
    ).length;
    return { reached: hits >= 2, hint: `개방 질문 ${hits}회` };
  }
  if (/(조언|성급|판단)/.test(goal)) {
    // 부정 목표: 조언/판단 없이 진행 중인지 — 단순화: 5문장 이상이면 OK
    return {
      reached: counselorMessages.length >= 5,
      hint: `발화 ${counselorMessages.length}회`,
    };
  }
  // 기본: 발화량으로 추정
  return {
    reached: counselorMessages.length >= 4,
    hint: lc.length > 0 ? `발화 ${counselorMessages.length}회` : "",
  };
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionDashboard({
  sessionGoals,
  messages,
  sessionStartedAt,
  isSessionActive,
}: SessionDashboardProps) {
  // 1초 틱으로 진행 시간 갱신
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isSessionActive || !sessionStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isSessionActive, sessionStartedAt]);

  const elapsedSec = sessionStartedAt
    ? Math.max(0, Math.floor((now - sessionStartedAt.getTime()) / 1000))
    : 0;

  const counselorMsgs = useMemo(
    () => messages.filter((m) => m.role === "user").map((m) => m.text),
    [messages]
  );
  const clientMsgs = useMemo(
    () => messages.filter((m) => m.role === "assistant").map((m) => m.text),
    [messages]
  );

  const avgCounselorLen = counselorMsgs.length
    ? Math.round(
        counselorMsgs.reduce((s, m) => s + m.length, 0) / counselorMsgs.length
      )
    : 0;

  // 기법 카운트
  const skillCounts = useMemo(() => {
    return SKILL_PATTERNS.map((p) => ({
      ...p,
      count: counselorMsgs.filter((m) => p.test(m)).length,
    }));
  }, [counselorMsgs]);

  // 목표 진행 상태
  const goalProgress = useMemo(
    () => sessionGoals.map((g) => ({ goal: g, ...estimateGoalProgress(g, counselorMsgs) })),
    [sessionGoals, counselorMsgs]
  );
  const reachedCount = goalProgress.filter((g) => g.reached).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
      {/* === 세션 목표 카드 === */}
      <section
        className="rounded-[14px] border p-4"
        style={{
          background: "var(--tc-card-white)",
          borderColor: "var(--tc-border)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.16em] uppercase"
              style={{ color: "var(--tc-text-muted)" }}
            >
              회기 목표
            </span>
            <span
              className="tc-tag tc-tag-cream"
              title={`${reachedCount} / ${sessionGoals.length}`}
            >
              {reachedCount}/{sessionGoals.length}
            </span>
          </div>
          <div
            className="text-[11px]"
            style={{ color: "var(--tc-text-sec)" }}
          >
            진행률{" "}
            <span style={{ color: "var(--tc-accent-deep)", fontWeight: 700 }}>
              {sessionGoals.length
                ? Math.round((reachedCount / sessionGoals.length) * 100)
                : 0}
              %
            </span>
          </div>
        </div>

        {/* 진행률 바 */}
        <div
          className="h-1.5 rounded-full overflow-hidden mb-3"
          style={{ background: "var(--tc-soft-bg)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${
                sessionGoals.length
                  ? (reachedCount / sessionGoals.length) * 100
                  : 0
              }%`,
              background:
                "linear-gradient(90deg, var(--tc-accent-light), var(--tc-accent))",
            }}
          />
        </div>

        {sessionGoals.length === 0 ? (
          <p
            className="text-[12px]"
            style={{ color: "var(--tc-text-muted)" }}
          >
            이 케이스에 등록된 목표가 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {goalProgress.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: g.reached
                      ? "var(--tc-green-soft)"
                      : "var(--tc-soft-bg)",
                    color: g.reached
                      ? "var(--tc-green-deep)"
                      : "var(--tc-text-muted)",
                    border: `1px solid ${
                      g.reached ? "var(--tc-green)" : "var(--tc-border)"
                    }`,
                  }}
                >
                  {g.reached ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[12.5px] leading-snug"
                    style={{
                      color: g.reached
                        ? "var(--tc-text)"
                        : "var(--tc-text-sec)",
                      textDecoration: g.reached ? "none" : "none",
                    }}
                  >
                    {g.goal}
                  </p>
                  {g.hint && (
                    <p
                      className="text-[10.5px] mt-0.5"
                      style={{ color: "var(--tc-text-muted)" }}
                    >
                      {g.hint}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* === 수행 현황 카드 === */}
      <section
        className="rounded-[14px] border p-4"
        style={{
          background: "var(--tc-card-white)",
          borderColor: "var(--tc-border)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[10px] font-bold tracking-[0.16em] uppercase"
            style={{ color: "var(--tc-text-muted)" }}
          >
            수행 현황
          </span>
          {isSessionActive ? (
            <span className="tc-tag tc-tag-green flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "var(--tc-green)" }}
              />
              진행 중
            </span>
          ) : (
            <span className="tc-tag tc-tag-gray">대기</span>
          )}
        </div>

        {/* KPI 그리드 */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <KPI label="진행 시간" value={formatDuration(elapsedSec)} display />
          <KPI
            label="내 발화"
            value={String(counselorMsgs.length)}
            unit="회"
          />
          <KPI
            label="평균 길이"
            value={avgCounselorLen ? String(avgCounselorLen) : "—"}
            unit={avgCounselorLen ? "자" : ""}
          />
        </div>

        {/* 핵심 기법 사용 */}
        <div>
          <p
            className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2"
            style={{ color: "var(--tc-text-muted)" }}
          >
            핵심 기법 사용
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {skillCounts.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md"
                style={{
                  background:
                    s.count > 0 ? "var(--tc-cream)" : "var(--tc-soft-bg)",
                  border: `1px solid ${
                    s.count > 0 ? "var(--tc-border-warm)" : "var(--tc-border)"
                  }`,
                }}
              >
                <span
                  className="text-[11.5px]"
                  style={{
                    color:
                      s.count > 0
                        ? "var(--tc-accent-dark)"
                        : "var(--tc-text-sec)",
                    fontWeight: s.count > 0 ? 600 : 400,
                  }}
                >
                  {s.label}
                </span>
                <span
                  className="text-[12px] font-bold tabular-nums"
                  style={{
                    color:
                      s.count > 0
                        ? "var(--tc-accent-deep)"
                        : "var(--tc-text-muted)",
                    fontFamily: s.count > 0
                      ? "'Gowun Batang', serif"
                      : "inherit",
                  }}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 내담자 응답 요약 */}
        <div
          className="mt-3 pt-3 border-t flex items-center justify-between text-[11px]"
          style={{
            borderColor: "var(--tc-border)",
            color: "var(--tc-text-sec)",
          }}
        >
          <span>내담자 응답</span>
          <span
            style={{
              color: "var(--tc-text)",
              fontFamily: "'Gowun Batang',serif",
              fontWeight: 700,
            }}
          >
            {clientMsgs.length}회
          </span>
        </div>
      </section>
    </div>
  );
}

function KPI({
  label,
  value,
  unit,
  display,
}: {
  label: string;
  value: string;
  unit?: string;
  display?: boolean;
}) {
  return (
    <div
      className="rounded-[10px] px-2.5 py-2"
      style={{
        background: "var(--tc-soft-bg)",
        border: "1px solid var(--tc-border)",
      }}
    >
      <p
        className="text-[10px] font-semibold mb-1"
        style={{ color: "var(--tc-text-sec)" }}
      >
        {label}
      </p>
      <p
        className="leading-none tabular-nums"
        style={{
          fontFamily: display
            ? "'Gowun Batang', serif"
            : "'Gowun Batang', serif",
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--tc-accent-dark)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
        {unit && (
          <span
            className="text-[11px] font-medium ml-0.5"
            style={{ color: "var(--tc-text-sec)", fontFamily: "inherit" }}
          >
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
