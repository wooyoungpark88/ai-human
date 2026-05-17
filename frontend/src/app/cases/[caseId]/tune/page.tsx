"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { API_URL, EMOTION_MAP } from "@/lib/constants";
import type { PersonaDraft, EmotionType } from "@/lib/types";

const BUILDER_PASSWORD = "qwer11!!";
const UNLOCK_STORAGE_KEY = "persona-builder-unlocked";

const EMOTION_ORDER: EmotionType[] = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "thinking",
  "anxious",
  "empathetic",
];

const DEFAULT_WEIGHTS: Record<string, number> = {
  neutral: 1.4,
  thinking: 1.2,
  anxious: 1.0,
  empathetic: 0.9,
  happy: 0.7,
  surprised: 0.7,
  sad: 0.4,
  angry: 0.5,
};

const LENGTH_PRESETS = [
  "응답은 1~2문장으로 간결하게. 내담자는 상담사보다 말이 적어야 합니다.",
  "응답은 2~3문장. 가끔 짧은 설명을 곁들이세요.",
  "응답은 3~5문장. 내담자가 비교적 적극적으로 말하는 케이스.",
];

export default function PersonaTunePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  // 비밀번호 게이트
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  useEffect(() => {
    setUnlocked(sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "1");
  }, []);

  const [data, setData] = useState<PersonaDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (!unlocked || !caseId) return;
    fetch(`${API_URL}/api/cases/${caseId}?include_internal=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setToast({ type: "err", msg: d.error });
        } else {
          // emotion_weights가 비어있으면 기본값으로 채움
          if (!d.emotion_weights || Object.keys(d.emotion_weights).length === 0) {
            d.emotion_weights = { ...DEFAULT_WEIGHTS };
          }
          if (!d.response_length) d.response_length = LENGTH_PRESETS[0];
          setData(d);
        }
      })
      .finally(() => setLoading(false));
  }, [caseId, unlocked]);

  const updateWeight = (emotion: string, value: number) => {
    if (!data) return;
    setData({
      ...data,
      emotion_weights: { ...(data.emotion_weights || {}), [emotion]: value },
    });
  };

  const save = async () => {
    if (!data) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`${API_URL}/api/cases/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: data, overwrite: true }),
      });
      const j = await res.json();
      if (j.error) {
        setToast({ type: "err", msg: j.error });
      } else {
        setToast({ type: "ok", msg: "튜닝 저장 완료 — 다음 세션부터 반영" });
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = () => {
    if (!data) return;
    setData({
      ...data,
      emotion_weights: { ...DEFAULT_WEIGHTS },
      response_length: LENGTH_PRESETS[0],
      tuning_notes: "",
    });
  };

  // 분포 % 계산 (시각화용)
  const distribution = useMemo(() => {
    if (!data?.emotion_weights) return {};
    const sum = EMOTION_ORDER.reduce(
      (acc, e) => acc + (data.emotion_weights?.[e] ?? 1),
      0
    );
    if (sum === 0) return {};
    return Object.fromEntries(
      EMOTION_ORDER.map((e) => [
        e,
        Math.round(((data.emotion_weights?.[e] ?? 1) / sum) * 100),
      ])
    );
  }, [data?.emotion_weights]);

  if (unlocked === null) {
    return <div className="min-h-screen" style={{ background: "var(--tc-bg)" }} />;
  }
  if (!unlocked) {
    return <LockGate />;
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
        <Navigation />
        <div className="text-center py-20 text-[13px]" style={{ color: "var(--tc-text-sec)" }}>
          페르소나 로딩 중...
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
        <Navigation />
        <div className="text-center py-20 text-[13px]" style={{ color: "var(--tc-red)" }}>
          케이스를 찾을 수 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-9 py-5 sm:py-7">
        {/* 헤더 */}
        <div className="mb-5">
          <div
            className="text-[11.5px] flex gap-1.5 mb-1.5"
            style={{ color: "var(--tc-text-sec)" }}
          >
            <Link href="/" className="hover:underline">홈</Link>
            <span style={{ color: "var(--tc-text-muted)" }}>›</span>
            <Link href={`/cases/${caseId}`} className="hover:underline">{data.name}</Link>
            <span style={{ color: "var(--tc-text-muted)" }}>›</span>
            <span>품질 튜닝</span>
          </div>
          <h1 className="tc-page-h text-[22px] sm:text-[24px]">
            페르소나 품질 튜닝
          </h1>
          <p
            className="text-[12.5px] sm:text-[13px] mt-1.5 max-w-[780px] leading-relaxed"
            style={{ color: "var(--tc-text-sec)" }}
          >
            <strong>{data.name}</strong>의 감정 표현 빈도·응답 길이·추가 가이드를 조정합니다.
            저장 시 LLM의 system_prompt에 동적으로 주입되어 다음 세션부터 즉시 반영됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* 메인 */}
          <div className="space-y-4">
            {/* 감정 가중치 */}
            <section
              className="rounded-[14px] border p-5"
              style={{ background: "var(--tc-card-white)", borderColor: "var(--tc-border)" }}
            >
              <h2 className="tc-card-t text-[14px] mb-1">감정 표현 빈도</h2>
              <p className="text-[11.5px] mb-4" style={{ color: "var(--tc-text-muted)" }}>
                각 감정의 가중치 0.0~2.0. <strong>0.4 미만 = 매우 자제</strong>,
                1.0 = 기본, 1.3 초과 = 자주. 예시: 슬픔(sad) 자주 표현되면 0.3~0.5로 낮추세요.
              </p>
              <div className="space-y-3">
                {EMOTION_ORDER.map((emo) => {
                  const w = data.emotion_weights?.[emo] ?? 1.0;
                  const info = EMOTION_MAP[emo] ?? EMOTION_MAP.neutral;
                  const pct = distribution[emo] ?? 0;
                  return (
                    <div
                      key={emo}
                      className="grid grid-cols-[110px_1fr_60px_50px] sm:grid-cols-[140px_1fr_60px_50px] gap-3 items-center"
                    >
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <span className="text-[18px]">{info.emoji}</span>
                        <span style={{ color: "var(--tc-text)" }}>{info.label}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.1}
                        value={w}
                        onChange={(e) => updateWeight(emo, parseFloat(e.target.value))}
                        className="w-full"
                        style={{
                          accentColor:
                            w < 0.5
                              ? "var(--tc-blue)"
                              : w > 1.3
                                ? "var(--tc-accent)"
                                : "var(--tc-text-sec)",
                        }}
                      />
                      <span
                        className="text-[11.5px] tabular-nums text-right font-mono"
                        style={{ color: "var(--tc-text-sec)" }}
                      >
                        {w.toFixed(1)}x
                      </span>
                      <span
                        className="text-[11px] tabular-nums text-right"
                        style={{
                          color:
                            pct >= 20
                              ? "var(--tc-accent-deep)"
                              : pct <= 5
                                ? "var(--tc-text-muted)"
                                : "var(--tc-text-sec)",
                        }}
                        title="추정 출현 비율 (정규화된 가중치)"
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t flex items-center gap-2 flex-wrap"
                style={{ borderColor: "var(--tc-border)" }}>
                <button
                  onClick={resetToDefault}
                  className="px-3 py-1.5 rounded-full text-[11.5px] font-medium"
                  style={{
                    background: "var(--tc-soft-bg)",
                    color: "var(--tc-text-sec)",
                    border: "1px solid var(--tc-border)",
                  }}
                >
                  기본값으로 초기화
                </button>
                <button
                  onClick={() => {
                    if (!data) return;
                    setData({
                      ...data,
                      emotion_weights: Object.fromEntries(
                        EMOTION_ORDER.map((e) => [e, 1.0])
                      ),
                    });
                  }}
                  className="px-3 py-1.5 rounded-full text-[11.5px] font-medium"
                  style={{
                    background: "var(--tc-soft-bg)",
                    color: "var(--tc-text-sec)",
                    border: "1px solid var(--tc-border)",
                  }}
                >
                  모두 1.0 (가이드 비활성)
                </button>
              </div>
            </section>

            {/* 응답 길이 */}
            <section
              className="rounded-[14px] border p-5"
              style={{ background: "var(--tc-card-white)", borderColor: "var(--tc-border)" }}
            >
              <h2 className="tc-card-t text-[14px] mb-3">응답 길이 가이드</h2>
              <div className="space-y-2">
                {LENGTH_PRESETS.map((preset, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-2.5 p-3 rounded-md cursor-pointer transition-colors"
                    style={{
                      background:
                        data.response_length === preset
                          ? "var(--tc-cream)"
                          : "var(--tc-soft-bg)",
                      border: `1px solid ${
                        data.response_length === preset
                          ? "var(--tc-border-warm)"
                          : "var(--tc-border)"
                      }`,
                    }}
                  >
                    <input
                      type="radio"
                      checked={data.response_length === preset}
                      onChange={() => setData({ ...data, response_length: preset })}
                      style={{ accentColor: "var(--tc-accent)", marginTop: 2 }}
                    />
                    <span className="text-[12.5px]" style={{ color: "var(--tc-text)" }}>
                      {preset}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* 추가 가이드 */}
            <section
              className="rounded-[14px] border p-5"
              style={{ background: "var(--tc-card-white)", borderColor: "var(--tc-border)" }}
            >
              <h2 className="tc-card-t text-[14px] mb-1">추가 가이드 (선택)</h2>
              <p className="text-[11.5px] mb-3" style={{ color: "var(--tc-text-muted)" }}>
                LLM에 추가로 주입할 자유 텍스트. 예: &quot;첫 5분은 무관심한 척하다가 점차 마음을 열기&quot;,
                &quot;상담사 질문에 자주 침묵으로 응대&quot; 등.
              </p>
              <textarea
                value={data.tuning_notes || ""}
                onChange={(e) => setData({ ...data, tuning_notes: e.target.value })}
                rows={4}
                placeholder="추가 행동 가이드를 자유롭게 적으세요..."
                className="w-full px-3 py-2 rounded-md text-[12.5px] outline-none transition-colors focus:border-[var(--tc-accent-light)] resize-y"
                style={{
                  border: "1px solid var(--tc-border)",
                  background: "#fff",
                  color: "var(--tc-text)",
                }}
              />
            </section>

            {/* 저장 */}
            <div
              className="flex items-center justify-end gap-3 sticky bottom-3 z-10"
            >
              <button
                onClick={save}
                disabled={busy}
                className="px-6 py-3 rounded-full text-[13px] font-bold disabled:opacity-50 shadow-[0_4px_14px_rgba(60,40,23,0.18)]"
                style={{ background: "var(--tc-accent-dark)", color: "#fff" }}
              >
                {busy ? "저장 중..." : "튜닝 저장"}
              </button>
            </div>
          </div>

          {/* 우측 — 미리보기 + 안내 */}
          <aside className="lg:sticky lg:top-[68px] lg:self-start space-y-3">
            <section
              className="rounded-[14px] border p-4"
              style={{ background: "var(--tc-cream)", borderColor: "var(--tc-border-warm)" }}
            >
              <h3 className="text-[10px] font-bold tracking-[0.16em] uppercase mb-3"
                style={{ color: "var(--tc-text-muted)" }}>
                감정 출현 추정 분포
              </h3>
              <div className="space-y-1.5">
                {EMOTION_ORDER.sort(
                  (a, b) => (distribution[b] ?? 0) - (distribution[a] ?? 0)
                ).map((emo) => {
                  const pct = distribution[emo] ?? 0;
                  const info = EMOTION_MAP[emo] ?? EMOTION_MAP.neutral;
                  return (
                    <div key={emo} className="flex items-center gap-2">
                      <span className="text-[14px] w-5">{info.emoji}</span>
                      <span className="text-[11.5px] w-12" style={{ color: "var(--tc-text-sec)" }}>
                        {info.label}
                      </span>
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--tc-soft-bg)" }}
                      >
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 20
                                ? "var(--tc-accent)"
                                : pct >= 10
                                  ? "var(--tc-accent-light)"
                                  : "var(--tc-border-warm)",
                          }}
                        />
                      </div>
                      <span
                        className="text-[10.5px] tabular-nums w-9 text-right"
                        style={{ color: "var(--tc-text-sec)" }}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10.5px] mt-3 leading-relaxed" style={{ color: "var(--tc-text-muted)" }}>
                정규화된 가중치 기준 추정. 실제 출현은 대화 맥락과 LLM 판단에 따라 변동.
              </p>
            </section>

            <section
              className="rounded-[14px] border p-4 text-[11.5px] leading-relaxed"
              style={{
                background: "var(--tc-card-white)",
                borderColor: "var(--tc-border)",
                color: "var(--tc-text-sec)",
              }}
            >
              <p className="font-bold mb-1.5" style={{ color: "var(--tc-text)" }}>💡 튜닝 팁</p>
              <ul className="space-y-1.5 list-disc pl-4">
                <li>슬픔이 자주 나오면 <strong>sad 0.3~0.5</strong></li>
                <li>너무 평탄하면 <strong>anxious/thinking 1.2+</strong></li>
                <li>공감 환경 위해 <strong>empathetic 1.0+</strong></li>
                <li>저항 강한 케이스 <strong>angry 0.5 이하</strong></li>
              </ul>
            </section>

            <Link
              href={`/cases/${caseId}`}
              className="block text-center text-[11.5px] hover:underline"
              style={{ color: "var(--tc-text-sec)" }}
            >
              ← 명세로 돌아가기
            </Link>
          </aside>
        </div>

        {toast && (
          <div
            onClick={() => setToast(null)}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-[12.5px] font-semibold shadow-lg z-50 cursor-pointer"
            style={{
              background: toast.type === "ok" ? "var(--tc-green-deep)" : "var(--tc-red)",
              color: "#fff",
            }}
          >
            {toast.msg}
          </div>
        )}
      </main>
    </div>
  );
}

/* ============ 비밀번호 게이트 ============ */
function LockGate() {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === BUILDER_PASSWORD) {
      sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      location.reload();
    } else {
      setError("비밀번호가 일치하지 않습니다.");
      setPw("");
    }
  };
  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />
      <main className="max-w-md mx-auto px-4 py-16 sm:py-24">
        <div
          className="rounded-[18px] border p-8 sm:p-10 text-center"
          style={{
            background: "var(--tc-card-white)",
            borderColor: "var(--tc-border)",
            boxShadow: "0 8px 24px rgba(60,40,23,0.08)",
          }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--tc-accent-dark) 0%, var(--tc-accent) 100%)",
            }}
          >
            <span className="text-[28px]">🎛️</span>
          </div>
          <h1
            className="tc-page-h text-[20px] sm:text-[22px] mb-2"
            style={{ color: "var(--tc-accent-dark)" }}
          >
            품질 튜닝 접근
          </h1>
          <p
            className="text-[12.5px] mb-6 leading-relaxed"
            style={{ color: "var(--tc-text-sec)" }}
          >
            관리자 영역입니다. 비밀번호를 입력하세요.
          </p>
          <form onSubmit={submit} className="space-y-3 text-left">
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                if (error) setError("");
              }}
              placeholder="비밀번호"
              autoFocus
              className="w-full px-4 py-3 rounded-md text-[13.5px] outline-none transition-colors focus:border-[var(--tc-accent-light)]"
              style={{
                border: "1.5px solid var(--tc-border)",
                background: "#fff",
                color: "var(--tc-text)",
              }}
            />
            {error && (
              <p className="text-[12px] text-center" style={{ color: "var(--tc-red)" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={!pw}
              className="w-full px-5 py-3 rounded-full text-[13.5px] font-bold disabled:opacity-40 shadow-[0_4px_14px_rgba(60,40,23,0.18)]"
              style={{
                background: "var(--tc-accent-dark)",
                color: "#fff",
                fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
              }}
            >
              잠금 해제
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
