"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { SessionFeedback } from "@/lib/types";

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

  useEffect(() => {
    const stored = sessionStorage.getItem("lastFeedback");
    const storedCaseId = sessionStorage.getItem("lastCaseId");
    if (stored) {
      try {
        setFeedback(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
    if (storedCaseId) setCaseId(storedCaseId);
  }, []);

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
