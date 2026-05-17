"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { SessionFeedback } from "@/lib/types";
import { EMOTION_MAP } from "@/lib/constants";

interface StoredMessage {
  role: "user" | "assistant";
  text: string;
  emotion?: string;
  timestamp?: string;
}

interface SessionMeta {
  case_id: string;
  case_name: string;
  case_age?: number | null;
  case_gender?: string;
  case_occupation?: string;
  presenting_issue?: string;
  started_at?: string | null;
  ended_at?: string | null;
  message_count?: number;
}

/** Date 포맷 hh:mm:ss */
function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}
function fmtDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}
function fmtDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}분 ${String(s).padStart(2, "0")}초`;
}

function buildMarkdown(meta: SessionMeta, msgs: StoredMessage[]): string {
  const lines: string[] = [];
  lines.push(`# 상담 세션 대화록`);
  lines.push("");
  lines.push(`- **내담자**: ${meta.case_name || "(미상)"}${meta.case_age ? ` · ${meta.case_age}세` : ""}${meta.case_gender ? ` · ${meta.case_gender}` : ""}`);
  if (meta.case_occupation) lines.push(`- **직업**: ${meta.case_occupation}`);
  if (meta.presenting_issue) lines.push(`- **호소 문제**: ${meta.presenting_issue}`);
  if (meta.started_at) lines.push(`- **시작**: ${fmtDate(meta.started_at)}`);
  if (meta.ended_at) lines.push(`- **종료**: ${fmtDate(meta.ended_at)}`);
  const dur = fmtDuration(meta.started_at, meta.ended_at);
  if (dur) lines.push(`- **세션 시간**: ${dur}`);
  lines.push(`- **메시지 수**: ${msgs.length}회 (상담사 ${msgs.filter((m) => m.role === "user").length} / 내담자 ${msgs.filter((m) => m.role === "assistant").length})`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 대화");
  lines.push("");

  msgs.forEach((m) => {
    const t = fmtTime(m.timestamp);
    const speaker = m.role === "user" ? "상담사" : "내담자";
    const emo = m.emotion ? ` (${m.emotion})` : "";
    const header = `**[${t}] ${speaker}${emo}**`;
    lines.push(header);
    m.text.split("\n").forEach((line) => lines.push(`> ${line}`));
    lines.push("");
  });

  return lines.join("\n");
}

function buildTxt(meta: SessionMeta, msgs: StoredMessage[]): string {
  const lines: string[] = [];
  lines.push("=".repeat(50));
  lines.push("상담 세션 대화록");
  lines.push("=".repeat(50));
  lines.push("");
  lines.push(`내담자: ${meta.case_name || "(미상)"}${meta.case_age ? ` · ${meta.case_age}세` : ""}`);
  if (meta.presenting_issue) lines.push(`호소 문제: ${meta.presenting_issue}`);
  if (meta.started_at) lines.push(`시작: ${fmtDate(meta.started_at)}`);
  const dur = fmtDuration(meta.started_at, meta.ended_at);
  if (dur) lines.push(`세션 시간: ${dur}`);
  lines.push("");
  lines.push("-".repeat(50));
  lines.push("");

  msgs.forEach((m) => {
    const t = fmtTime(m.timestamp);
    const speaker = m.role === "user" ? "상담사" : "내담자";
    const emo = m.emotion ? ` (${m.emotion})` : "";
    lines.push(`[${t}] ${speaker}${emo}`);
    lines.push(m.text);
    lines.push("");
  });

  return lines.join("\n");
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ScoreCircle({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "text-green-500"
      : score >= 60
        ? "text-yellow-500"
        : score >= 40
          ? "text-orange-500"
          : "text-red-500";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{Math.round(score)}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export default function FeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  const [caseId, setCaseId] = useState<string>("");
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("lastFeedback");
    const storedCaseId = sessionStorage.getItem("lastCaseId");
    const storedTranscript = sessionStorage.getItem("lastTranscript");
    const storedMeta = sessionStorage.getItem("lastSessionMeta");
    if (stored) {
      try { setFeedback(JSON.parse(stored)); } catch { /* ignore */ }
    }
    if (storedCaseId) setCaseId(storedCaseId);
    if (storedTranscript) {
      try { setMessages(JSON.parse(storedTranscript)); } catch { /* ignore */ }
    }
    if (storedMeta) {
      try { setMeta(JSON.parse(storedMeta)); } catch { /* ignore */ }
    }
  }, []);

  const transcriptFilename = useMemo(() => {
    const date = meta?.started_at ? new Date(meta.started_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const safeName = (meta?.case_name || caseId || "session").replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
    return `transcript_${date}_${safeName}`;
  }, [meta, caseId]);

  const downloadMd = () => {
    if (!messages.length || !meta) return;
    downloadFile(`${transcriptFilename}.md`, buildMarkdown(meta, messages), "text/markdown");
  };
  const downloadTxt = () => {
    if (!messages.length || !meta) return;
    downloadFile(`${transcriptFilename}.txt`, buildTxt(meta, messages), "text/plain");
  };
  const downloadJson = () => {
    if (!messages.length || !meta) return;
    downloadFile(
      `${transcriptFilename}.json`,
      JSON.stringify({ meta, messages, feedback }, null, 2),
      "application/json"
    );
  };
  const copyMd = async () => {
    if (!messages.length || !meta) return;
    await navigator.clipboard.writeText(buildMarkdown(meta, messages));
  };

  if (!feedback) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-4xl mx-auto px-6 py-12 text-center">
          <p className="text-muted-foreground mb-4">
            피드백 데이터를 찾을 수 없습니다.
          </p>
          <Link href="/cases">
            <Button>케이스 목록으로</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">상담 피드백</h2>
          <p className="text-muted-foreground">
            AI 수퍼바이저의 상담 수행 평가 결과입니다.
          </p>
        </div>

        {/* 종합 점수 */}
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <ScoreCircle score={feedback.overall_score} />
            <p className="text-center text-sm text-muted-foreground max-w-lg">
              {feedback.summary}
            </p>
          </CardContent>
        </Card>

        {/* 항목별 점수 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">항목별 평가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedback.categories.map((cat) => (
              <div key={cat.name_en} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-sm font-bold">{Math.round(cat.score)}</span>
                </div>
                <Progress
                  value={cat.score}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">{cat.comment}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 잘한 점 / 개선할 점 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedback.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-green-600">
                  잘한 점
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-green-500 shrink-0">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {feedback.improvements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-orange-600">
                  개선할 점
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feedback.improvements.map((s, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-orange-500 shrink-0">-</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 추천 학습 */}
        {feedback.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">추천 학습</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {feedback.recommendations.map((r, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-blue-500 shrink-0">&rarr;</span>
                    {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 대화록 (있을 때만) */}
        {messages.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">대화록</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="default" onClick={downloadMd}>
                    📄 Markdown
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadTxt}>
                    TXT
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadJson}>
                    JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyMd} title="Markdown 클립보드 복사">
                    📋 복사
                  </Button>
                </div>
              </div>
              {meta && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {meta.case_name}
                  {meta.case_age ? ` · ${meta.case_age}세` : ""}
                  {meta.started_at && ` · ${fmtDate(meta.started_at)}`}
                  {(() => {
                    const d = fmtDuration(meta.started_at, meta.ended_at);
                    return d ? ` · ${d}` : "";
                  })()}
                  {" · "}
                  상담사 {messages.filter((m) => m.role === "user").length}회 / 내담자{" "}
                  {messages.filter((m) => m.role === "assistant").length}회
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTranscript((s) => !s)}
                className="mb-3"
              >
                {showTranscript ? "▾ 본문 접기" : "▸ 본문 펼치기"}
              </Button>
              {showTranscript && (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                  {messages.map((m, i) => {
                    const isUser = m.role === "user";
                    const emoji = m.emotion
                      ? EMOTION_MAP[m.emotion as keyof typeof EMOTION_MAP]?.emoji
                      : null;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`text-[10px] mb-1 ${
                            isUser ? "text-right" : "text-left"
                          }`}
                          style={{ color: "var(--tc-text-muted)" }}
                        >
                          {isUser ? "상담사" : "내담자"}
                          {emoji && !isUser ? ` ${emoji}` : ""}
                          {m.timestamp ? ` · ${fmtTime(m.timestamp)}` : ""}
                        </div>
                        <div
                          className="max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed"
                          style={{
                            background: isUser
                              ? "var(--tc-accent-dark)"
                              : "var(--tc-soft-bg)",
                            color: isUser ? "#fff" : "var(--tc-text)",
                            borderBottomRightRadius: isUser ? "4px" : undefined,
                            borderBottomLeftRadius: !isUser ? "4px" : undefined,
                          }}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 버튼 */}
        <div className="flex gap-3 justify-center pt-4">
          {caseId && (
            <Link href={`/session/${caseId}`}>
              <Button variant="outline">다시 상담하기</Button>
            </Link>
          )}
          <Link href="/cases">
            <Button>다른 케이스 선택</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
