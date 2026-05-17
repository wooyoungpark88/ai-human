"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { API_URL, CATEGORY_LABELS, DIFFICULTY_LABELS } from "@/lib/constants";
import type { PersonaDraft } from "@/lib/types";

const RISK_LABELS = ["없음", "수동적", "계획 단계", "즉시 위험"];

export default function CaseSpecPage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [data, setData] = useState<PersonaDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [portraitBusy, setPortraitBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const regeneratePortrait = async (mode: "single" | "all_emotions") => {
    if (!data) return;
    setPortraitBusy(true);
    setToast(null);
    try {
      const emotions =
        mode === "all_emotions"
          ? ["neutral", "happy", "sad", "angry", "surprised", "thinking", "anxious", "empathetic"]
          : ["neutral"];
      const r = await fetch(`${API_URL}/api/cases/generate-portrait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: data, case_id: caseId, emotions }),
      });
      const j = await r.json();
      if (j.error) {
        setToast({ type: "err", msg: j.error });
        return;
      }
      const merged: PersonaDraft = {
        ...data,
        portrait_url: j.url,
        portrait_variants: j.variants
          ? { ...(data.portrait_variants || {}), ...j.variants }
          : data.portrait_variants,
        portrait_prompt: j.prompt_used,
      };
      await fetch(`${API_URL}/api/cases/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: merged, overwrite: true }),
      });
      const t = Date.now();
      setData({
        ...merged,
        portrait_url: `${j.url}?t=${t}`,
        portrait_variants: j.variants
          ? Object.fromEntries(
              Object.entries(j.variants).map(([k, v]) => [k, `${v}?t=${t}`])
            )
          : merged.portrait_variants,
      });
      const cnt = j.variants ? Object.keys(j.variants).length : 1;
      setToast({ type: "ok", msg: `${cnt}장 재생성 + 저장 완료` });
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "실패" });
    } finally {
      setPortraitBusy(false);
    }
  };

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    fetch(`${API_URL}/api/cases/${caseId}?include_internal=true`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
        <Navigation />
        <div className="text-center py-20 text-[13px]" style={{ color: "var(--tc-text-sec)" }}>
          명세 로딩 중...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
        <Navigation />
        <div className="text-center py-20 text-[13px]" style={{ color: "var(--tc-red)" }}>
          {error || "케이스를 찾을 수 없습니다"}
        </div>
      </div>
    );
  }

  const v2 = (data.schema_version ?? 1) >= 2;

  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-9 py-5 sm:py-7">
        {/* 헤더 */}
        <div className="mb-5">
          <div className="text-[11.5px] flex gap-1.5 mb-1.5" style={{ color: "var(--tc-text-sec)" }}>
            <Link href="/cases" className="hover:underline">케이스</Link>
            <span style={{ color: "var(--tc-text-muted)" }}>›</span>
            <span>{data.name}</span>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex items-start gap-4">
              {/* 초상화 — 큰 사이즈 (있을 때만) */}
              {data.portrait_url || data.portrait_variants?.neutral ? (
                <div
                  className="w-[120px] h-[150px] sm:w-[140px] sm:h-[175px] rounded-[14px] overflow-hidden flex-shrink-0"
                  style={{ background: "var(--tc-soft-bg)", border: "1.5px solid var(--tc-border-warm)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${API_URL}${data.portrait_variants?.neutral || data.portrait_url}`}
                    alt={data.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-[120px] h-[150px] sm:w-[140px] sm:h-[175px] rounded-[14px] flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "var(--tc-soft-bg)",
                    border: "1.5px dashed var(--tc-border-warm)",
                    color: "var(--tc-text-muted)",
                  }}
                >
                  <span style={{ fontSize: 44 }}>👤</span>
                </div>
              )}
              <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="tc-tag tc-tag-cream">
                  {CATEGORY_LABELS[data.category] || data.category}
                </span>
                <span className="tc-tag tc-tag-gold">
                  {DIFFICULTY_LABELS[data.difficulty] || data.difficulty}
                </span>
                {data.avatar_type && (
                  <span className="tc-tag tc-tag-blue">{data.avatar_type}</span>
                )}
                <span
                  className="tc-tag"
                  style={{
                    background: v2 ? "var(--tc-green-soft)" : "var(--tc-soft-bg)",
                    color: v2 ? "var(--tc-green-deep)" : "var(--tc-text-muted)",
                  }}
                >
                  Schema v{data.schema_version ?? 1}
                </span>
              </div>
              <h1 className="tc-page-h text-[22px] sm:text-[26px]">
                {data.name}{" "}
                <span className="text-[14px] sm:text-[16px] font-normal" style={{ color: "var(--tc-text-sec)" }}>
                  · {data.age}세 · {data.gender}
                </span>
              </h1>
              <p className="text-[13px] mt-1" style={{ color: "var(--tc-text-sec)" }}>
                {data.occupation}
              </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Link
                href={`/cases/new?from=${caseId}`}
                className="px-4 py-2 rounded-full text-[12px] font-semibold transition-colors flex items-center gap-1.5"
                style={{
                  background: "var(--tc-card-white)",
                  color: "var(--tc-accent-dark)",
                  border: "1.5px solid var(--tc-border-warm)",
                }}
                title="페르소나 빌더에서 모든 필드 편집"
              >
                ✏️ 빌더로 편집
              </Link>
              <Link
                href={`/cases/${caseId}/tune`}
                className="px-4 py-2 rounded-full text-[12px] font-semibold transition-colors flex items-center gap-1.5"
                style={{
                  background: "var(--tc-card-white)",
                  color: "var(--tc-accent-dark)",
                  border: "1.5px solid var(--tc-border-warm)",
                }}
                title="감정 빈도·응답 길이·가이드 조정"
              >
                🎛️ 품질 튜닝
              </Link>
              {/* 8가지 표정 생성 — photo 모드 케이스에서만 노출
                  (영상 모드는 라이브 비디오라 정적 초상화 불필요) */}
              {data.avatar_type === "photo" && (
                <button
                  onClick={() => regeneratePortrait("all_emotions")}
                  disabled={portraitBusy}
                  className="px-4 py-2 rounded-full text-[12px] font-semibold disabled:opacity-50 transition-colors"
                  style={{
                    background: "var(--tc-card-white)",
                    color: "var(--tc-accent-dark)",
                    border: "1.5px solid var(--tc-border-warm)",
                  }}
                >
                  {portraitBusy
                    ? "생성 중..."
                    : (data.portrait_variants && Object.keys(data.portrait_variants).length >= 8)
                      ? "🎨 8장 재생성"
                      : "🎨 8가지 표정 생성"}
                </button>
              )}
              <Link
                href={`/session/${caseId}`}
                className="px-5 py-2.5 rounded-full text-[12.5px] font-bold transition-opacity hover:opacity-90 shadow-[0_3px_10px_rgba(60,40,23,0.15)]"
                style={{ background: "var(--tc-accent-dark)", color: "#fff" }}
              >
                ▶ 상담 시작
              </Link>
            </div>
          </div>
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

        {/* 본문 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <div className="space-y-4">
            {/* 8가지 표정 갤러리 (있을 때만) */}
            {data.portrait_variants && Object.keys(data.portrait_variants).length > 0 && (
              <Card title={`감정별 표정 (${Object.keys(data.portrait_variants).length}/8)`}>
                <p
                  className="text-[11.5px] mb-3"
                  style={{ color: "var(--tc-text-muted)" }}
                >
                  세션 중 내담자의 감정에 따라 카드·세션 헤더의 사진이 자동으로 바뀝니다.
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {[
                    ["neutral", "평온"],
                    ["happy", "행복"],
                    ["sad", "슬픔"],
                    ["angry", "분노"],
                    ["surprised", "놀람"],
                    ["thinking", "생각"],
                    ["anxious", "불안"],
                    ["empathetic", "공감"],
                  ].map(([emo, label]) => {
                    const url = data.portrait_variants?.[emo];
                    return (
                      <div
                        key={emo}
                        className="aspect-[4/5] rounded-md overflow-hidden relative"
                        style={{
                          background: url ? "transparent" : "var(--tc-soft-bg)",
                          border: `1px solid ${url ? "var(--tc-border-warm)" : "var(--tc-border)"}`,
                        }}
                      >
                        {url ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`${API_URL}${url}`}
                              alt={label}
                              className="w-full h-full object-cover"
                            />
                            <span
                              className="absolute bottom-0 left-0 right-0 text-[9.5px] font-bold py-0.5 text-center"
                              style={{
                                background: "rgba(255, 246, 234, 0.9)",
                                color: "var(--tc-accent-deep)",
                              }}
                            >
                              {label}
                            </span>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span
                              className="text-[10px]"
                              style={{ color: "var(--tc-text-muted)" }}
                            >
                              {label}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* 호소 + 설명 */}
            <Card title="호소 문제">
              <p className="text-[14px] leading-relaxed mb-3" style={{ color: "var(--tc-text)" }}>
                {data.presenting_issue}
              </p>
              {data.description && (
                <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tc-text-sec)" }}>
                  {data.description}
                </p>
              )}
            </Card>

            {/* 임상 (v2) */}
            {data.clinical && (data.clinical.primary_diagnosis || data.clinical.onset_date || (data.clinical.comorbid?.length ?? 0)) && (
              <Card title="임상 추정">
                <KV
                  rows={[
                    ["주 진단", data.clinical.primary_diagnosis],
                    ["공존질환", data.clinical.comorbid?.join(", ")],
                    ["발병 시기", data.clinical.onset_date],
                    [
                      "만성도",
                      data.clinical.chronicity === "acute"
                        ? "급성 (4주 이내)"
                        : data.clinical.chronicity === "subacute"
                          ? "아급성 (1~6개월)"
                          : data.clinical.chronicity === "chronic"
                            ? "만성 (6개월+)"
                            : data.clinical.chronicity,
                    ],
                    ["ICD-11", data.clinical.icd11_code],
                  ]}
                />
              </Card>
            )}

            {/* 위험 평가 (v2) */}
            {data.risk_assessment && (
              <Card title="위험 평가 (4축)">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <RiskCell label="자살" v={data.risk_assessment.suicide} />
                  <RiskCell label="자해" v={data.risk_assessment.self_harm} />
                  <RiskCell label="타해" v={data.risk_assessment.harm_others} />
                  <RiskCell label="중독" v={data.risk_assessment.substance} />
                </div>
                {(data.risk_assessment.warning_signs?.length ?? 0) > 0 && (
                  <Subsection label="경고 신호">
                    <Chips items={data.risk_assessment.warning_signs!} variant="red" />
                  </Subsection>
                )}
              </Card>
            )}

            {/* 인물 */}
            <Card title="인물 묘사">
              <Subsection label="성격">
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--tc-text)" }}>
                  {data.personality}
                </p>
              </Subsection>
              <Subsection label="말투">
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--tc-text)" }}>
                  {data.speaking_style}
                </p>
              </Subsection>
              {data.emotional_baseline && (
                <Subsection label="기저 정서">
                  <span className="tc-tag tc-tag-cream">{data.emotional_baseline}</span>
                </Subsection>
              )}
              {(data.defense_mechanisms?.length ?? 0) > 0 && (
                <Subsection label="방어기제">
                  <Chips items={data.defense_mechanisms!} variant="cream" />
                </Subsection>
              )}
              {(data.strengths?.length ?? 0) > 0 && (
                <Subsection label="강점·자원">
                  <Chips items={data.strengths!} variant="green" />
                </Subsection>
              )}
            </Card>

            {/* 배경 */}
            <Card title="배경 스토리">
              <p
                className="text-[13px] leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--tc-text)" }}
              >
                {data.background_story}
              </p>
              {data.developmental_history && (
                <Subsection label="발달 이력">
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--tc-text-sec)" }}>
                    {data.developmental_history}
                  </p>
                </Subsection>
              )}
              {(data.trauma_history?.length ?? 0) > 0 && (
                <Subsection label="외상 이력">
                  <Chips items={data.trauma_history!} variant="red" />
                </Subsection>
              )}
            </Card>

            {/* 관계 (v2) */}
            {(data.relationships?.length ?? 0) > 0 && (
              <Card title="관계 그래프">
                <div className="space-y-2">
                  {data.relationships!.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-md p-3"
                      style={{
                        background: "var(--tc-soft-bg)",
                        border: "1px solid var(--tc-border)",
                      }}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[13px] font-bold" style={{ color: "var(--tc-accent-dark)" }}>
                          {r.role}
                        </span>
                        {r.age != null && (
                          <span className="text-[11px]" style={{ color: "var(--tc-text-sec)" }}>
                            {r.age}세
                          </span>
                        )}
                        {r.quality && (
                          <span className="tc-tag tc-tag-cream">{r.quality}</span>
                        )}
                      </div>
                      {r.dynamics && (
                        <p className="text-[12px]" style={{ color: "var(--tc-text-sec)" }}>
                          {r.dynamics}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 트리거 (v2) */}
            {(data.triggers?.length ?? 0) > 0 && (
              <Card title="트리거 (회피·폭발 주제)">
                <div className="space-y-2">
                  {data.triggers!.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-md p-2.5"
                      style={{
                        background: "var(--tc-peach-soft)",
                        border: "1px solid var(--tc-border-warm)",
                      }}
                    >
                      <span className="text-[12.5px] font-bold flex-shrink-0" style={{ color: "var(--tc-accent-dark)" }}>
                        {t.topic}
                      </span>
                      <span className="text-[12px] flex-1" style={{ color: "var(--tc-accent-deep)" }}>
                        → {t.reaction}
                      </span>
                      <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: "var(--tc-accent-deep)" }}>
                        강도 {Math.round((t.intensity ?? 0) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 증상 + 숨겨진 이슈 */}
            <Card title="증상">
              <Chips items={data.symptoms} variant="gray" />
            </Card>

            {(data.hidden_issues?.length ?? 0) > 0 && (
              <Card title="숨겨진 이슈" warning="훈련 중에는 노출되지 않으며, 신뢰 형성 후 점진적으로 드러납니다.">
                <Chips items={data.hidden_issues} variant="red" />
              </Card>
            )}

            {/* 저항 곡선 + 세션 단계 (v2) */}
            {(data.resistance_curve || data.resistance_level !== undefined) && (
              <Card title="저항 모델">
                {data.resistance_curve ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="초기 저항" value={`${Math.round(data.resistance_curve.initial * 100)}%`} />
                    <Stat label="신뢰 후" value={`${Math.round(data.resistance_curve.after_rapport * 100)}%`} />
                    {(data.resistance_curve.trust_gates?.length ?? 0) > 0 && (
                      <div className="col-span-2">
                        <Subsection label="신뢰 게이트">
                          <Chips items={data.resistance_curve.trust_gates!} variant="cream" />
                        </Subsection>
                      </div>
                    )}
                  </div>
                ) : (
                  <Stat label="저항도" value={`${Math.round((data.resistance_level ?? 0) * 100)}%`} />
                )}
              </Card>
            )}

            {(data.session_phases?.length ?? 0) > 0 && (
              <Card title="세션 단계 매트릭스">
                <ol className="space-y-2">
                  {data.session_phases!.map((s, i) => (
                    <li
                      key={i}
                      className="rounded-md p-3 flex gap-3"
                      style={{ background: "var(--tc-soft-bg)", border: "1px solid var(--tc-border)" }}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                        style={{
                          background: "var(--tc-accent-dark)",
                          color: "#fff",
                          fontFamily: "'Gowun Batang', serif",
                        }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13px] font-bold" style={{ color: "var(--tc-accent-dark)" }}>
                            {s.phase}
                          </span>
                          {s.duration_turns && (
                            <span className="tc-tag tc-tag-gray">{s.duration_turns} 턴</span>
                          )}
                        </div>
                        <p className="text-[12.5px]" style={{ color: "var(--tc-text)" }}>
                          {s.behavior}
                        </p>
                        {s.trigger && (
                          <p className="text-[11.5px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
                            → 다음 단계 진입: {s.trigger}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            {/* 지지자원 (v2) */}
            {((data.support_system?.length ?? 0) > 0 ||
              (data.coping_resources?.length ?? 0) > 0 ||
              (data.cultural_context?.length ?? 0) > 0) && (
              <Card title="지지자원·문화">
                {(data.support_system?.length ?? 0) > 0 && (
                  <Subsection label="지지 시스템">
                    <Chips items={data.support_system!} variant="green" />
                  </Subsection>
                )}
                {(data.coping_resources?.length ?? 0) > 0 && (
                  <Subsection label="대처 자원">
                    <Chips items={data.coping_resources!} variant="cream" />
                  </Subsection>
                )}
                {(data.cultural_context?.length ?? 0) > 0 && (
                  <Subsection label="문화 컨텍스트">
                    <Chips items={data.cultural_context!} variant="gray" />
                  </Subsection>
                )}
              </Card>
            )}

            {/* 세션 목표 + 루브릭 */}
            <Card title="세션 목표">
              <ul className="space-y-1.5">
                {data.session_goals?.map((g, i) => (
                  <li key={i} className="flex gap-2 text-[13px]" style={{ color: "var(--tc-text)" }}>
                    <span style={{ color: "var(--tc-accent-light)" }}>·</span>
                    <span>{g}</span>
                  </li>
                ))}
                {(data.session_goals?.length ?? 0) === 0 && (
                  <li className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>(없음)</li>
                )}
              </ul>
            </Card>

            {data.rubric && (
              ((data.rubric.good_responses?.length ?? 0) > 0 ||
                (data.rubric.bad_responses?.length ?? 0) > 0) && (
                <Card title="평가 루브릭">
                  {(data.rubric.good_responses?.length ?? 0) > 0 && (
                    <Subsection label="좋은 반응">
                      <ul className="space-y-1.5">
                        {data.rubric.good_responses!.map((r, i) => (
                          <RubricRow key={i} pattern={r.pattern} example={r.example} weight={r.weight} positive />
                        ))}
                      </ul>
                    </Subsection>
                  )}
                  {(data.rubric.bad_responses?.length ?? 0) > 0 && (
                    <Subsection label="피해야 할 반응">
                      <ul className="space-y-1.5">
                        {data.rubric.bad_responses!.map((r, i) => (
                          <RubricRow key={i} pattern={r.pattern} example={r.example} weight={r.weight} positive={false} />
                        ))}
                      </ul>
                    </Subsection>
                  )}
                </Card>
              )
            )}

            {/* 안전 프로토콜 */}
            {data.safety_protocols && (
              ((data.safety_protocols.crisis_signals?.length ?? 0) > 0 ||
                data.safety_protocols.expected_counselor_response ||
                data.safety_protocols.ideal_response_example) && (
                <Card
                  title="안전 프로토콜"
                  warning="위기 신호 발생 시 상담사가 따라야 할 가이드"
                >
                  {(data.safety_protocols.crisis_signals?.length ?? 0) > 0 && (
                    <Subsection label="위기 신호">
                      <Chips items={data.safety_protocols.crisis_signals!} variant="red" />
                    </Subsection>
                  )}
                  {data.safety_protocols.expected_counselor_response && (
                    <Subsection label="기대되는 상담사 대응">
                      <p className="text-[12.5px]" style={{ color: "var(--tc-text)" }}>
                        {data.safety_protocols.expected_counselor_response}
                      </p>
                    </Subsection>
                  )}
                  {data.safety_protocols.ideal_response_example && (
                    <Subsection label="이상적 응답 예시">
                      <blockquote
                        className="text-[12.5px] italic pl-3 py-1.5"
                        style={{
                          color: "var(--tc-accent-deep)",
                          borderLeft: "3px solid var(--tc-accent-light)",
                        }}
                      >
                        &ldquo;{data.safety_protocols.ideal_response_example}&rdquo;
                      </blockquote>
                    </Subsection>
                  )}
                </Card>
              )
            )}

            {/* system_prompt (접힘) */}
            {data.system_prompt && (
              <Card
                title="system_prompt (LLM 주입 원문)"
                warning="훈련 중 화면에 표시되지 않습니다. 페르소나 검토용."
              >
                <button
                  onClick={() => setShowPrompt((s) => !s)}
                  className="text-[12px] font-semibold mb-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: "var(--tc-soft-bg)",
                    color: "var(--tc-text)",
                    border: "1px solid var(--tc-border)",
                  }}
                >
                  {showPrompt ? "▾ 접기" : "▸ 펼치기"} ({data.system_prompt.length}자)
                </button>
                {showPrompt && (
                  <pre
                    className="text-[11.5px] p-3 rounded-md overflow-x-auto whitespace-pre-wrap"
                    style={{
                      background: "var(--tc-soft-bg)",
                      border: "1px solid var(--tc-border)",
                      color: "var(--tc-text)",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      maxHeight: "400px",
                      overflowY: "auto",
                    }}
                  >
                    {data.system_prompt}
                  </pre>
                )}
              </Card>
            )}
          </div>

          {/* 우측 메타 */}
          <aside className="lg:sticky lg:top-[68px] lg:self-start space-y-3">
            <Card compact title="아바타 매핑">
              <KV
                rows={[
                  ["타입", data.avatar_type],
                  ["HeyGen", data.heygen_avatar_id],
                  ["Simli", data.simli_face_id],
                  ["DeepBrain", data.deepbrain_avatar_id],
                  ["FlashHead", data.flashhead_model_id],
                  ["External URL", data.external_url],
                ]}
              />
            </Card>

            <Card compact title="TTS 음성">
              <KV
                rows={[
                  ["ElevenLabs Voice", data.voice_id || "(백엔드 기본값)"],
                ]}
              />
            </Card>

            <Card compact title="원본 JSON">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${caseId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full px-3 py-1.5 rounded-md text-[11.5px] font-semibold"
                style={{
                  background: "var(--tc-soft-bg)",
                  color: "var(--tc-text)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                ⬇ JSON 다운로드
              </button>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ============ 헬퍼 컴포넌트 ============ */

function Card({
  title,
  warning,
  compact,
  children,
}: {
  title: string;
  warning?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[14px] border"
      style={{
        background: "var(--tc-card-white)",
        borderColor: "var(--tc-border)",
        padding: compact ? "12px 14px" : "18px 20px",
      }}
    >
      <h2
        className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2.5"
        style={{ color: "var(--tc-text-muted)" }}
      >
        {title}
      </h2>
      {warning && (
        <p
          className="text-[11px] mb-3 px-2.5 py-1.5 rounded"
          style={{
            background: "var(--tc-peach-soft)",
            color: "var(--tc-accent-deep)",
            border: "1px solid var(--tc-border-warm)",
          }}
        >
          ⚠ {warning}
        </p>
      )}
      {children}
    </section>
  );
}

function Subsection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p
        className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5"
        style={{ color: "var(--tc-text-muted)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function KV({ rows }: { rows: Array<[string, string | undefined | null]> }) {
  const filtered = rows.filter(([, v]) => v != null && v !== "");
  if (filtered.length === 0) {
    return <p className="text-[12px]" style={{ color: "var(--tc-text-muted)" }}>(설정 없음)</p>;
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
      {filtered.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[11.5px]" style={{ color: "var(--tc-text-muted)" }}>{k}</dt>
          <dd className="text-[12.5px]" style={{ color: "var(--tc-text)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[10px] px-3 py-2.5"
      style={{ background: "var(--tc-soft-bg)", border: "1px solid var(--tc-border)" }}
    >
      <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--tc-text-sec)" }}>
        {label}
      </p>
      <p
        className="leading-none tabular-nums"
        style={{
          fontFamily: "'Gowun Batang', serif",
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--tc-accent-dark)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function RiskCell({ label, v }: { label: string; v: number }) {
  const colors =
    v === 0
      ? { bg: "var(--tc-green-soft)", fg: "var(--tc-green-deep)" }
      : v <= 1
        ? { bg: "var(--tc-gold-soft)", fg: "#7A5418" }
        : v === 2
          ? { bg: "var(--tc-peach-soft)", fg: "var(--tc-accent-deep)" }
          : { bg: "var(--tc-red-soft)", fg: "var(--tc-red)" };
  return (
    <div
      className="rounded-[10px] px-2.5 py-2"
      style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.fg}` }}
    >
      <p className="text-[10.5px] font-semibold mb-1">{label}</p>
      <p
        className="leading-none tabular-nums"
        style={{
          fontFamily: "'Gowun Batang', serif",
          fontSize: "18px",
          fontWeight: 700,
        }}
      >
        {v}
      </p>
      <p className="text-[10px] mt-1 opacity-80">{RISK_LABELS[v]}</p>
    </div>
  );
}

function Chips({
  items,
  variant,
}: {
  items: string[];
  variant: "cream" | "red" | "green" | "gray" | "blue";
}) {
  if (!items || items.length === 0) {
    return <p className="text-[11.5px]" style={{ color: "var(--tc-text-muted)" }}>(없음)</p>;
  }
  const cls = `tc-tag tc-tag-${variant}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className={cls}>
          {it}
        </span>
      ))}
    </div>
  );
}

function RubricRow({
  pattern,
  example,
  weight,
  positive,
}: {
  pattern: string;
  example?: string;
  weight: number;
  positive: boolean;
}) {
  return (
    <li
      className="rounded-md p-2.5 text-[12.5px]"
      style={{
        background: positive ? "var(--tc-green-soft)" : "var(--tc-red-soft)",
        border: `1px solid ${positive ? "var(--tc-green)" : "var(--tc-red)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span
          className="font-bold"
          style={{ color: positive ? "var(--tc-green-deep)" : "var(--tc-red)" }}
        >
          {pattern}
        </span>
        <span
          className="text-[11px] tabular-nums font-bold"
          style={{ color: positive ? "var(--tc-green-deep)" : "var(--tc-red)" }}
        >
          weight {weight > 0 ? "+" : ""}{weight}
        </span>
      </div>
      {example && (
        <p
          className="text-[12px] italic"
          style={{ color: "var(--tc-text-sec)" }}
        >
          예: &ldquo;{example}&rdquo;
        </p>
      )}
    </li>
  );
}
