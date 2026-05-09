"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { API_URL, CATEGORY_LABELS } from "@/lib/constants";
import type { PersonaDraft, AvatarType } from "@/lib/types";

/* ============ 초기값 ============ */
const INITIAL_PERSONA: PersonaDraft = {
  id: "",
  name: "",
  age: 30,
  gender: "여성",
  occupation: "",
  presenting_issue: "",
  category: "anxiety",
  difficulty: "beginner",
  description: "",
  personality: "",
  speaking_style: "",
  background_story: "",
  symptoms: [],
  hidden_issues: [],
  emotional_baseline: "neutral",
  resistance_level: 0.4,
  session_goals: [],
  system_prompt: "",
  clinical: { primary_diagnosis: "", comorbid: [], onset_date: "", chronicity: "", icd11_code: "" },
  risk_assessment: { suicide: 0, self_harm: 0, harm_others: 0, substance: 0, warning_signs: [] },
  defense_mechanisms: [],
  triggers: [],
  relationships: [],
  developmental_history: "",
  trauma_history: [],
  strengths: [],
  support_system: [],
  coping_resources: [],
  resistance_curve: { initial: 0.5, after_rapport: 0.3, trust_gates: [] },
  session_phases: [],
  rubric: { good_responses: [], bad_responses: [] },
  safety_protocols: { crisis_signals: [], expected_counselor_response: "", ideal_response_example: "" },
  cultural_context: [],
  schema_version: 2,
  avatar_type: "vrm",
};

const STEPS = [
  { key: "basic", label: "기본 정보" },
  { key: "clinical", label: "임상" },
  { key: "risk", label: "위험 평가" },
  { key: "person", label: "인물" },
  { key: "background", label: "배경" },
  { key: "relations", label: "관계·트리거" },
  { key: "session", label: "세션 시뮬" },
  { key: "rubric", label: "목표·평가" },
  { key: "prompt", label: "프롬프트·저장" },
] as const;

const CATEGORY_OPTIONS = ["anxiety", "depression", "burnout", "relationship", "self_esteem", "bullying"];
const DIFFICULTY_OPTIONS = [
  { v: "beginner", l: "초급" },
  { v: "intermediate", l: "중급" },
  { v: "advanced", l: "고급" },
];
const GENDER_OPTIONS = ["여성", "남성", "기타"];
const EMOTION_BASELINES = ["neutral", "anxious", "sad", "happy", "thinking", "empathetic"];
const AVATAR_OPTIONS: { v: AvatarType; l: string }[] = [
  { v: "vrm", l: "VRM" },
  { v: "heygen", l: "HeyGen" },
  { v: "simli", l: "Simli" },
  { v: "deepbrain", l: "DeepBrain AI Human" },
  { v: "flashhead", l: "OpenAvatarChat (FlashHead)" },
];
const DEFENSE_OPTIONS = ["회피", "부인", "합리화", "지성화", "투사", "행동화", "체념", "유머", "이타화"];
const RISK_LABELS = ["없음", "수동적 사고", "계획 단계", "즉시 위험"];

/* ============ 빌더 페이지 ============ */
export default function NewPersonaPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [persona, setPersona] = useState<PersonaDraft>(INITIAL_PERSONA);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const update = <K extends keyof PersonaDraft>(key: K, value: PersonaDraft[K]) =>
    setPersona((p) => ({ ...p, [key]: value }));

  const updateNested = <P extends keyof PersonaDraft>(
    parent: P,
    patch: Partial<NonNullable<PersonaDraft[P]>>
  ) =>
    setPersona((p) => ({
      ...p,
      [parent]: { ...(p[parent] as object), ...patch } as PersonaDraft[P],
    }));

  const generatePortrait = async (
    mode: "single" | "all_emotions",
    promptOverride?: string
  ) => {
    setBusy(`portrait-${mode}`);
    setToast(null);
    try {
      const emotions =
        mode === "all_emotions"
          ? ["neutral", "happy", "sad", "angry", "surprised", "thinking", "anxious", "empathetic"]
          : ["neutral"];
      const res = await fetch(`${API_URL}/api/cases/generate-portrait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          prompt_override: promptOverride,
          case_id: persona.id || undefined,
          emotions,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ type: "err", msg: data.error });
      } else if (data.url) {
        update("portrait_url", data.url);
        if (data.variants) {
          update("portrait_variants", data.variants);
        }
        update("portrait_prompt", data.prompt_used);
        const cnt = data.variants ? Object.keys(data.variants).length : 1;
        setToast({
          type: "ok",
          msg:
            data.errors?.length > 0
              ? `${cnt}장 생성 완료 (${data.errors.length}건 실패)`
              : `${cnt}장 생성 완료`,
        });
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "생성 실패" });
    } finally {
      setBusy(null);
    }
  };

  const generatePrompt = async (mode: "ai" | "template") => {
    setBusy(`prompt-${mode}`);
    setToast(null);
    try {
      const res = await fetch(`${API_URL}/api/cases/generate-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona, mode }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ type: "err", msg: data.error });
      } else if (data.prompt) {
        update("system_prompt", data.prompt);
        setToast({ type: "ok", msg: `프롬프트 ${mode === "ai" ? "AI" : "템플릿"} 생성 완료` });
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "생성 실패" });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setToast(null);
    try {
      const res = await fetch(`${API_URL}/api/cases/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: persona, overwrite: false }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ type: "err", msg: data.error });
      } else if (data.saved) {
        setToast({ type: "ok", msg: `저장 완료 — '${data.id}'` });
        setTimeout(() => router.push("/cases"), 800);
      }
    } catch (e) {
      setToast({ type: "err", msg: e instanceof Error ? e.message : "저장 실패" });
    } finally {
      setBusy(null);
    }
  };

  const completion = useMemo(() => computeCompletion(persona), [persona]);

  return (
    <div className="min-h-screen" style={{ background: "var(--tc-bg)" }}>
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-9 py-5 sm:py-7">
        {/* 헤더 */}
        <div className="mb-5">
          <div className="text-[11.5px] flex gap-1.5 mb-1.5" style={{ color: "var(--tc-text-sec)" }}>
            <Link href="/cases" className="hover:underline">케이스</Link>
            <span style={{ color: "var(--tc-text-muted)" }}>›</span>
            <span>신규 페르소나</span>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="tc-page-h text-[20px] sm:text-[24px]">내담자 페르소나 빌더</h1>
              <p className="text-[12.5px] sm:text-[13px] mt-1 max-w-[760px]" style={{ color: "var(--tc-text-sec)" }}>
                구조화된 임상 정보를 입력하면 AI가 system_prompt를 자동 생성합니다.
                기존 케이스보다 임상 깊이·위험 평가·방어기제·트리거·강점·세션 단계 매트릭스가 추가됩니다.
              </p>
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--tc-text-sec)" }}>
              완성도{" "}
              <span style={{ color: "var(--tc-accent-deep)", fontWeight: 700 }}>
                {completion}%
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          {/* === 메인 폼 === */}
          <div
            className="rounded-[14px] border p-4 sm:p-6"
            style={{ background: "var(--tc-card-white)", borderColor: "var(--tc-border)" }}
          >
            {/* 탭 네비 */}
            <div
              className="flex gap-1 overflow-x-auto pb-3 mb-4 border-b"
              style={{ borderColor: "var(--tc-border)" }}
            >
              {STEPS.map((s, i) => {
                const active = i === step;
                return (
                  <button
                    key={s.key}
                    onClick={() => setStep(i)}
                    className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap transition-colors flex-shrink-0"
                    style={{
                      background: active ? "var(--tc-accent-dark)" : "var(--tc-soft-bg)",
                      color: active ? "#fff" : "var(--tc-text-sec)",
                      border: `1px solid ${active ? "var(--tc-accent-dark)" : "var(--tc-border)"}`,
                    }}
                  >
                    {i + 1}. {s.label}
                  </button>
                );
              })}
            </div>

            {/* 단계별 폼 */}
            {STEPS[step].key === "basic" && (
              <SectionBasic
                persona={persona}
                update={update}
                onGeneratePortrait={generatePortrait}
                busy={busy}
              />
            )}
            {STEPS[step].key === "clinical" && (
              <SectionClinical persona={persona} updateNested={updateNested} />
            )}
            {STEPS[step].key === "risk" && (
              <SectionRisk persona={persona} updateNested={updateNested} />
            )}
            {STEPS[step].key === "person" && (
              <SectionPerson persona={persona} update={update} />
            )}
            {STEPS[step].key === "background" && (
              <SectionBackground persona={persona} update={update} />
            )}
            {STEPS[step].key === "relations" && (
              <SectionRelations persona={persona} update={update} />
            )}
            {STEPS[step].key === "session" && (
              <SectionSession persona={persona} update={update} updateNested={updateNested} />
            )}
            {STEPS[step].key === "rubric" && (
              <SectionRubric persona={persona} update={update} updateNested={updateNested} />
            )}
            {STEPS[step].key === "prompt" && (
              <SectionPromptAndSave
                persona={persona}
                update={update}
                onGenerate={generatePrompt}
                onSave={save}
                busy={busy}
              />
            )}

            {/* 하단 네비 */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: "var(--tc-border)" }}>
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="px-4 py-2 rounded-full text-[12px] font-medium disabled:opacity-40"
                style={{
                  background: "var(--tc-soft-bg)",
                  color: "var(--tc-text)",
                  border: "1px solid var(--tc-border)",
                }}
              >
                ← 이전
              </button>
              <span className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                {step + 1} / {STEPS.length}
              </span>
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === STEPS.length - 1}
                className="px-4 py-2 rounded-full text-[12px] font-semibold disabled:opacity-40"
                style={{
                  background: "var(--tc-accent-dark)",
                  color: "#fff",
                }}
              >
                다음 →
              </button>
            </div>
          </div>

          {/* === 우측 미리보기 === */}
          <aside className="lg:sticky lg:top-[68px] lg:self-start">
            <PreviewPane persona={persona} />
          </aside>
        </div>

        {/* 토스트 */}
        {toast && (
          <div
            className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-[12.5px] font-semibold shadow-lg z-50"
            style={{
              background: toast.type === "ok" ? "var(--tc-green-deep)" : "var(--tc-red)",
              color: "#fff",
            }}
            onClick={() => setToast(null)}
          >
            {toast.msg}
          </div>
        )}
      </main>
    </div>
  );
}

/* ============ 섹션 컴포넌트 ============ */

const EMOTION_LABELS: Record<string, string> = {
  neutral: "평온",
  happy: "행복",
  sad: "슬픔",
  angry: "분노",
  surprised: "놀람",
  thinking: "생각",
  anxious: "불안",
  empathetic: "공감",
};

function SectionBasic({
  persona,
  update,
  onGeneratePortrait,
  busy,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
  onGeneratePortrait: (mode: "single" | "all_emotions", prompt?: string) => void;
  busy: string | null;
}) {
  const [editPrompt, setEditPrompt] = useState(false);
  const variants = persona.portrait_variants || {};
  const variantsCount = Object.keys(variants).length;
  return (
    <div className="space-y-4">
      <H2>기본 정보</H2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="ID (영문 소문자·숫자·_)" hint="저장 파일명. 예: my_anxiety_case">
          <Input
            value={persona.id}
            onChange={(v) => update("id", v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="my_new_case"
          />
        </Field>
        <Field label="이름">
          <Input value={persona.name} onChange={(v) => update("name", v)} placeholder="홍길동" />
        </Field>
        <Field label="나이">
          <Input
            type="number"
            value={String(persona.age)}
            onChange={(v) => update("age", Number(v) || 0)}
          />
        </Field>
        <Field label="성별">
          <Select
            value={persona.gender}
            onChange={(v) => update("gender", v)}
            options={GENDER_OPTIONS.map((g) => ({ v: g, l: g }))}
          />
        </Field>
        <Field label="직업">
          <Input
            value={persona.occupation}
            onChange={(v) => update("occupation", v)}
            placeholder="회사원, 대학생, 주부..."
          />
        </Field>
        <Field label="카테고리">
          <Select
            value={persona.category}
            onChange={(v) => update("category", v)}
            options={CATEGORY_OPTIONS.map((c) => ({ v: c, l: CATEGORY_LABELS[c] || c }))}
          />
        </Field>
        <Field label="난이도">
          <Select
            value={persona.difficulty}
            onChange={(v) => update("difficulty", v)}
            options={DIFFICULTY_OPTIONS.map((d) => ({ v: d.v, l: d.l }))}
          />
        </Field>
      </div>
      <Field label="호소 문제 (한 문장)">
        <Input
          value={persona.presenting_issue}
          onChange={(v) => update("presenting_issue", v)}
          placeholder="예: 직장 내 번아웃과 만성 피로"
        />
      </Field>
      <Field label="설명 (카드 본문)">
        <TextArea
          value={persona.description}
          onChange={(v) => update("description", v)}
          rows={3}
          placeholder="카드에 노출되는 짧은 설명"
        />
      </Field>

      {/* === 초상화 생성 (정적 사진 — 8가지 감정 변형) === */}
      <div className="pt-4 mt-4 border-t" style={{ borderColor: "var(--tc-border)" }}>
        <H2>인물 사진 (정적 초상화)</H2>
        <p
          className="text-[11.5px] mt-1 mb-3"
          style={{ color: "var(--tc-text-muted)" }}
        >
          OpenAI DALL-E 3가 페르소나 정보로 한국인 실사 세로 초상화를 생성합니다.
          8가지 감정 변형을 만들면 세션 중 내담자 감정 변화에 따라 표정이 자동으로 바뀝니다.
          (실시간 영상 AI 휴먼과는 별개)
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
          {/* 큰 미리보기 (neutral 또는 portrait_url) */}
          <div
            className="w-full rounded-[14px] overflow-hidden flex items-center justify-center"
            style={{
              aspectRatio: "4 / 5",
              background: "var(--tc-soft-bg)",
              border: "1.5px dashed var(--tc-border-warm)",
            }}
          >
            {persona.portrait_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_URL}${persona.portrait_url}`}
                alt={persona.name || "초상화"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center px-3" style={{ color: "var(--tc-text-muted)" }}>
                <div className="text-[40px] leading-none mb-1.5">🎨</div>
                <p className="text-[11px]">초상화 미생성</p>
              </div>
            )}
          </div>

          {/* 컨트롤 */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onGeneratePortrait("all_emotions")}
              disabled={busy?.startsWith("portrait")}
              className="w-full px-4 py-3 rounded-full text-[13px] font-bold disabled:opacity-50 transition-opacity hover:opacity-95 shadow-[0_4px_14px_rgba(60,40,23,0.18)]"
              style={{ background: "var(--tc-accent-dark)", color: "#fff" }}
            >
              {busy === "portrait-all_emotions"
                ? "8장 생성 중... (~1분 소요)"
                : "✦ 8가지 표정 모두 생성 (권장)"}
            </button>
            <button
              type="button"
              onClick={() => onGeneratePortrait("single")}
              disabled={busy?.startsWith("portrait")}
              className="w-full px-4 py-2 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-50"
              style={{
                background: "var(--tc-card-white)",
                color: "var(--tc-accent-dark)",
                border: "1.5px solid var(--tc-border-warm)",
              }}
            >
              {busy === "portrait-single"
                ? "생성 중..."
                : "기본(평온) 1장만 생성 (~15초)"}
            </button>
            <button
              type="button"
              onClick={() => setEditPrompt((s) => !s)}
              className="w-full px-3 py-1.5 rounded-full text-[11px] font-medium"
              style={{
                background: "var(--tc-soft-bg)",
                color: "var(--tc-text-sec)",
                border: "1px solid var(--tc-border)",
              }}
            >
              {editPrompt ? "▾ 프롬프트 닫기" : "▸ 생성 프롬프트 편집"}
            </button>
            {editPrompt && (
              <div className="space-y-2">
                <TextArea
                  rows={5}
                  mono
                  value={persona.portrait_prompt || ""}
                  onChange={(v) => update("portrait_prompt", v)}
                  placeholder="비워두면 페르소나 데이터로 자동 생성됩니다. 영문 prompt 권장."
                />
                <button
                  type="button"
                  onClick={() => onGeneratePortrait("all_emotions", persona.portrait_prompt || undefined)}
                  disabled={busy?.startsWith("portrait")}
                  className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold disabled:opacity-50"
                  style={{
                    background: "var(--tc-card-white)",
                    color: "var(--tc-accent-dark)",
                    border: "1.5px solid var(--tc-border-warm)",
                  }}
                >
                  이 프롬프트로 8장 재생성
                </button>
              </div>
            )}
            {persona.portrait_url && !editPrompt && persona.portrait_prompt && (
              <details className="text-[11px]" style={{ color: "var(--tc-text-muted)" }}>
                <summary className="cursor-pointer">사용된 프롬프트 보기</summary>
                <p
                  className="mt-1.5 px-2 py-1.5 rounded leading-relaxed"
                  style={{ background: "var(--tc-soft-bg)" }}
                >
                  {persona.portrait_prompt}
                </p>
              </details>
            )}
          </div>
        </div>

        {/* 8가지 표정 갤러리 */}
        {variantsCount > 0 && (
          <div className="mt-4">
            <p
              className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2"
              style={{ color: "var(--tc-text-muted)" }}
            >
              감정별 변형 ({variantsCount}/8)
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {Object.entries(EMOTION_LABELS).map(([emo, label]) => {
                const url = variants[emo];
                return (
                  <div
                    key={emo}
                    className="aspect-[4/5] rounded-md overflow-hidden flex items-center justify-center text-center"
                    style={{
                      background: url ? "transparent" : "var(--tc-soft-bg)",
                      border: `1px solid ${url ? "var(--tc-border-warm)" : "var(--tc-border)"}`,
                    }}
                    title={label}
                  >
                    {url ? (
                      <div className="relative w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${API_URL}${url}`}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className="absolute bottom-0 left-0 right-0 text-[9.5px] font-bold py-0.5 text-center backdrop-blur-sm"
                          style={{
                            background: "rgba(255, 246, 234, 0.85)",
                            color: "var(--tc-accent-deep)",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    ) : (
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--tc-text-muted)" }}
                      >
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionClinical({
  persona,
  updateNested,
}: {
  persona: PersonaDraft;
  updateNested: <P extends keyof PersonaDraft>(p: P, patch: Partial<NonNullable<PersonaDraft[P]>>) => void;
}) {
  const c = persona.clinical || {};
  return (
    <div className="space-y-4">
      <H2>임상 추정</H2>
      <Help>
        DSM-5 / ICD-11 기준 추정 진단을 입력하면 system_prompt가 임상적으로 더 정밀해집니다.
        진단명은 추정이므로 단언하지 말고 &quot;~ 가능성&quot; 식으로 표기하세요.
      </Help>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="주 진단 추정">
          <Input
            value={c.primary_diagnosis || ""}
            onChange={(v) => updateNested("clinical", { primary_diagnosis: v })}
            placeholder="예: 주요우울장애 (재발성, 중등도)"
          />
        </Field>
        <Field label="ICD-11 코드 (선택)">
          <Input
            value={c.icd11_code || ""}
            onChange={(v) => updateNested("clinical", { icd11_code: v })}
            placeholder="예: 6A70.1"
          />
        </Field>
        <Field label="발병 시기">
          <Input
            value={c.onset_date || ""}
            onChange={(v) => updateNested("clinical", { onset_date: v })}
            placeholder="예: 2025-12 경, 약 3개월 전"
          />
        </Field>
        <Field label="만성도">
          <Select
            value={c.chronicity || ""}
            onChange={(v) => updateNested("clinical", { chronicity: v as "" | "acute" | "subacute" | "chronic" })}
            options={[
              { v: "", l: "미분류" },
              { v: "acute", l: "급성 (4주 이내)" },
              { v: "subacute", l: "아급성 (1~6개월)" },
              { v: "chronic", l: "만성 (6개월+)" },
            ]}
          />
        </Field>
      </div>
      <Field label="공존질환 (Enter로 추가)">
        <ChipInput
          values={c.comorbid || []}
          onChange={(v) => updateNested("clinical", { comorbid: v })}
          placeholder="예: 범불안장애"
        />
      </Field>
    </div>
  );
}

function SectionRisk({
  persona,
  updateNested,
}: {
  persona: PersonaDraft;
  updateNested: <P extends keyof PersonaDraft>(p: P, patch: Partial<NonNullable<PersonaDraft[P]>>) => void;
}) {
  const r = persona.risk_assessment || { suicide: 0, self_harm: 0, harm_others: 0, substance: 0 };
  const set = (k: "suicide" | "self_harm" | "harm_others" | "substance", v: number) =>
    updateNested("risk_assessment", { [k]: v } as Record<string, number>);
  return (
    <div className="space-y-4">
      <H2>위험 평가 (4축)</H2>
      <Help>
        각 축은 0=없음 / 1=수동적 사고 / 2=구체적 계획 / 3=즉시 위험. 위험이 있는 케이스는 안전 평가 훈련용으로 매우 유용합니다.
      </Help>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RiskAxis label="자살" value={r.suicide} onChange={(v) => set("suicide", v)} />
        <RiskAxis label="자해" value={r.self_harm} onChange={(v) => set("self_harm", v)} />
        <RiskAxis label="타해" value={r.harm_others} onChange={(v) => set("harm_others", v)} />
        <RiskAxis label="약물·중독" value={r.substance} onChange={(v) => set("substance", v)} />
      </div>
      <Field label="경고 신호 (Enter로 추가)">
        <ChipInput
          values={r.warning_signs || []}
          onChange={(v) => updateNested("risk_assessment", { warning_signs: v })}
          placeholder="예: 사라지고 싶다는 수동적 사고"
        />
      </Field>
    </div>
  );
}

function RiskAxis({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-[10px] p-3 border" style={{ borderColor: "var(--tc-border)", background: "var(--tc-soft-bg)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12.5px] font-bold" style={{ color: "var(--tc-text)" }}>{label}</span>
        <span
          className="tc-tag"
          style={{
            background: value === 0 ? "var(--tc-green-soft)" : value <= 1 ? "var(--tc-gold-soft)" : value === 2 ? "var(--tc-peach-soft)" : "var(--tc-red-soft)",
            color: value === 0 ? "var(--tc-green-deep)" : value <= 1 ? "#7A5418" : value === 2 ? "var(--tc-accent-deep)" : "var(--tc-red)",
          }}
        >
          {value} · {RISK_LABELS[value]}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={3}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--tc-accent)" }}
      />
    </div>
  );
}

function SectionPerson({
  persona,
  update,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <H2>인물 묘사</H2>
      <Field label="성격">
        <TextArea
          rows={3}
          value={persona.personality}
          onChange={(v) => update("personality", v)}
          placeholder="예: 내성적이지만 책임감이 강하고, 자기 감정 표현이 서투릅니다."
        />
      </Field>
      <Field label="말투·언어 스타일">
        <TextArea
          rows={3}
          value={persona.speaking_style}
          onChange={(v) => update("speaking_style", v)}
          placeholder="예: 존댓말. 한숨이 많음. '뭐 어쩌겠어요', '그냥...' 표현 사용"
        />
      </Field>
      <Field label="기저 정서">
        <Select
          value={persona.emotional_baseline}
          onChange={(v) => update("emotional_baseline", v)}
          options={EMOTION_BASELINES.map((e) => ({ v: e, l: e }))}
        />
      </Field>
      <Field label="주방어기제 (선택, 1~3개)">
        <ChipMultiSelect
          options={DEFENSE_OPTIONS}
          values={persona.defense_mechanisms || []}
          onChange={(v) => update("defense_mechanisms", v)}
        />
      </Field>
      <Field label="강점·자원 (Enter로 추가)" hint="해결중심·긍정심리 학습용 — 상담사가 발견·활용하도록">
        <ChipInput
          values={persona.strengths || []}
          onChange={(v) => update("strengths", v)}
          placeholder="예: 강한 책임감, 친구 1명과는 솔직"
        />
      </Field>
    </div>
  );
}

function SectionBackground({
  persona,
  update,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <H2>배경 스토리</H2>
      <Field label="배경 스토리 (생활사)">
        <TextArea
          rows={6}
          value={persona.background_story}
          onChange={(v) => update("background_story", v)}
          placeholder="가족·학력·경력·결혼·이주 등 핵심 생활사. 현재 상황으로 이어지는 흐름."
        />
      </Field>
      <Field label="발달 이력 (어린 시절·청소년기 핵심)">
        <TextArea
          rows={3}
          value={persona.developmental_history || ""}
          onChange={(v) => update("developmental_history", v)}
          placeholder="예: 안정적 양육, 사춘기 부모 이혼 후 위축"
        />
      </Field>
      <Field label="외상 이력 (Enter로 추가)" hint="외상 경험이 있으면 1줄씩. 없으면 비워두세요.">
        <ChipInput
          values={persona.trauma_history || []}
          onChange={(v) => update("trauma_history", v)}
          placeholder="예: 7세 학대 경험"
        />
      </Field>
    </div>
  );
}

function SectionRelations({
  persona,
  update,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <H2>관계 그래프</H2>
      <ObjectArrayEditor
        items={persona.relationships || []}
        onChange={(v) => update("relationships", v)}
        emptyMsg="가족·동료·친구 등 핵심 관계 1~5명"
        addLabel="+ 관계 추가"
        emptyItem={{ role: "", age: undefined, quality: "", dynamics: "" }}
        renderItem={(item, set, remove) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={item.role || ""} onChange={(v) => set({ role: v })} placeholder="역할 (남편/엄마)" />
            <Input
              type="number"
              value={item.age != null ? String(item.age) : ""}
              onChange={(v) => set({ age: v ? Number(v) : undefined })}
              placeholder="나이"
            />
            <Input value={item.quality || ""} onChange={(v) => set({ quality: v })} placeholder="질 (단절/거리감/친밀)" />
            <Input value={item.dynamics || ""} onChange={(v) => set({ dynamics: v })} placeholder="역동 (자유 텍스트)" />
            <RemoveBtn onClick={remove} />
          </div>
        )}
      />

      <H2>트리거 (회피·폭발 주제)</H2>
      <ObjectArrayEditor
        items={persona.triggers || []}
        onChange={(v) => update("triggers", v)}
        emptyMsg="상담사가 꺼내면 강한 반응을 일으키는 주제"
        addLabel="+ 트리거 추가"
        emptyItem={{ topic: "", reaction: "", intensity: 0.5 }}
        renderItem={(item, set, remove) => (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
            <Input value={item.topic || ""} onChange={(v) => set({ topic: v })} placeholder="주제 (이혼/엄마)" />
            <Input value={item.reaction || ""} onChange={(v) => set({ reaction: v })} placeholder="반응 (회피/분노/울음)" />
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={item.intensity ?? 0.5}
                onChange={(e) => set({ intensity: Number(e.target.value) })}
                className="flex-1"
                style={{ accentColor: "var(--tc-accent)" }}
              />
              <span className="text-[11px] tabular-nums w-8 text-right" style={{ color: "var(--tc-text-sec)" }}>
                {Math.round((item.intensity ?? 0.5) * 100)}%
              </span>
              <RemoveBtn onClick={remove} />
            </div>
          </div>
        )}
      />
    </div>
  );
}

function SectionSession({
  persona,
  update,
  updateNested,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
  updateNested: <P extends keyof PersonaDraft>(p: P, patch: Partial<NonNullable<PersonaDraft[P]>>) => void;
}) {
  const curve = persona.resistance_curve || { initial: 0.5, after_rapport: 0.3, trust_gates: [] };
  return (
    <div className="space-y-5">
      <H2>증상 + 숨겨진 이슈</H2>
      <Field label="증상 (Enter로 추가)">
        <ChipInput
          values={persona.symptoms}
          onChange={(v) => update("symptoms", v)}
          placeholder="예: 만성 피로"
        />
      </Field>
      <Field label="숨겨진 이슈 (점진적 공개)" hint="처음엔 말 안 하고, 신뢰 형성 후 드러나는 핵심 이슈들">
        <ChipInput
          values={persona.hidden_issues}
          onChange={(v) => update("hidden_issues", v)}
          placeholder="예: 부모님의 기대 압박"
        />
      </Field>

      <H2>저항 곡선</H2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={`초기 저항 ${Math.round(curve.initial * 100)}%`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={curve.initial}
            onChange={(e) => updateNested("resistance_curve", { initial: Number(e.target.value) })}
            className="w-full" style={{ accentColor: "var(--tc-accent)" }}
          />
        </Field>
        <Field label={`신뢰 후 저항 ${Math.round(curve.after_rapport * 100)}%`}>
          <input
            type="range" min={0} max={1} step={0.05}
            value={curve.after_rapport}
            onChange={(e) => updateNested("resistance_curve", { after_rapport: Number(e.target.value) })}
            className="w-full" style={{ accentColor: "var(--tc-accent)" }}
          />
        </Field>
      </div>
      <Field label="신뢰 게이트 (Enter로 추가)" hint="이 조건이 충족되면 저항이 낮아짐">
        <ChipInput
          values={curve.trust_gates || []}
          onChange={(v) => updateNested("resistance_curve", { trust_gates: v })}
          placeholder="예: 감정 반영 3회 이상"
        />
      </Field>

      <H2>세션 단계 매트릭스</H2>
      <ObjectArrayEditor
        items={persona.session_phases || []}
        onChange={(v) => update("session_phases", v)}
        emptyMsg="상담 진행에 따른 단계별 행동 (초기 → 탐색 → 핵심 노출)"
        addLabel="+ 단계 추가"
        emptyItem={{ phase: "", behavior: "", duration_turns: "", trigger: "" }}
        renderItem={(item, set, remove) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={item.phase || ""} onChange={(v) => set({ phase: v })} placeholder="단계명 (초기/탐색/핵심)" />
            <Input value={item.duration_turns || ""} onChange={(v) => set({ duration_turns: v })} placeholder="턴 수 (3-5)" />
            <Input value={item.behavior || ""} onChange={(v) => set({ behavior: v })} placeholder="이 단계 행동" />
            <Input value={item.trigger || ""} onChange={(v) => set({ trigger: v })} placeholder="다음 단계 진입 트리거" />
            <RemoveBtn onClick={remove} />
          </div>
        )}
      />

      <H2>지지자원·문화 컨텍스트</H2>
      <Field label="지지 시스템 (Enter로 추가)">
        <ChipInput values={persona.support_system || []} onChange={(v) => update("support_system", v)} placeholder="예: 친구 정희" />
      </Field>
      <Field label="대처 자원 (Enter로 추가)">
        <ChipInput values={persona.coping_resources || []} onChange={(v) => update("coping_resources", v)} placeholder="예: 혼자 산책" />
      </Field>
      <Field label="문화 컨텍스트 (Enter로 추가)" hint="한국 가족 위계, 체면, 학교 단톡 문화 등">
        <ChipInput values={persona.cultural_context || []} onChange={(v) => update("cultural_context", v)} placeholder="예: 시어머니 압박" />
      </Field>
    </div>
  );
}

function SectionRubric({
  persona,
  update,
  updateNested,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
  updateNested: <P extends keyof PersonaDraft>(p: P, patch: Partial<NonNullable<PersonaDraft[P]>>) => void;
}) {
  const rubric = persona.rubric || { good_responses: [], bad_responses: [] };
  const safety = persona.safety_protocols || {};
  return (
    <div className="space-y-5">
      <H2>세션 목표</H2>
      <Field label="세션 목표 (Enter로 추가, 3~4개 권장)">
        <ChipInput
          values={persona.session_goals}
          onChange={(v) => update("session_goals", v)}
          placeholder="예: 안전한 환경에서 자기 이야기를 꺼내도록 돕기"
        />
      </Field>

      <H2>평가 루브릭 — 좋은 반응</H2>
      <ObjectArrayEditor
        items={rubric.good_responses}
        onChange={(v) => updateNested("rubric", { good_responses: v })}
        emptyMsg="이 케이스에 효과적인 상담사 반응 패턴"
        addLabel="+ 좋은 반응 추가"
        emptyItem={{ pattern: "", example: "", weight: 1.0 }}
        renderItem={(item, set, remove) => (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={item.pattern} onChange={(v) => set({ pattern: v })} placeholder="패턴 (감정 반영)" />
            <Input value={item.example || ""} onChange={(v) => set({ example: v })} placeholder="예시 발화" />
            <div className="flex items-center gap-2">
              <Input
                type="number" value={String(item.weight)} onChange={(v) => set({ weight: Number(v) || 0 })}
              />
              <RemoveBtn onClick={remove} />
            </div>
          </div>
        )}
      />

      <H2>평가 루브릭 — 나쁜 반응</H2>
      <ObjectArrayEditor
        items={rubric.bad_responses}
        onChange={(v) => updateNested("rubric", { bad_responses: v })}
        emptyMsg="피해야 할 반응 (성급한 조언, 도덕적 판단 등)"
        addLabel="+ 나쁜 반응 추가"
        emptyItem={{ pattern: "", example: "", weight: -1.0 }}
        renderItem={(item, set, remove) => (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={item.pattern} onChange={(v) => set({ pattern: v })} placeholder="패턴 (성급한 해결책)" />
            <Input value={item.example || ""} onChange={(v) => set({ example: v })} placeholder="예시 발화" />
            <div className="flex items-center gap-2">
              <Input
                type="number" value={String(item.weight)} onChange={(v) => set({ weight: Number(v) || 0 })}
              />
              <RemoveBtn onClick={remove} />
            </div>
          </div>
        )}
      />

      <H2>안전 프로토콜</H2>
      <Field label="위기 신호 (Enter로 추가)">
        <ChipInput
          values={safety.crisis_signals || []}
          onChange={(v) => updateNested("safety_protocols", { crisis_signals: v })}
          placeholder="예: 사라지고 싶다"
        />
      </Field>
      <Field label="기대되는 상담사 대응">
        <TextArea
          rows={2}
          value={safety.expected_counselor_response || ""}
          onChange={(v) => updateNested("safety_protocols", { expected_counselor_response: v })}
          placeholder="예: 안전 평가 우선 + 자살 위험 직접 질문"
        />
      </Field>
      <Field label="이상적 응답 예시">
        <TextArea
          rows={2}
          value={safety.ideal_response_example || ""}
          onChange={(v) => updateNested("safety_protocols", { ideal_response_example: v })}
          placeholder="예: 혹시 자해하거나 스스로 해치고 싶다는 생각이 드신 적 있으세요?"
        />
      </Field>
    </div>
  );
}

function SectionPromptAndSave({
  persona,
  update,
  onGenerate,
  onSave,
  busy,
}: {
  persona: PersonaDraft;
  update: <K extends keyof PersonaDraft>(k: K, v: PersonaDraft[K]) => void;
  onGenerate: (mode: "ai" | "template") => void;
  onSave: () => void;
  busy: string | null;
}) {
  return (
    <div className="space-y-4">
      <H2>아바타 매핑</H2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="아바타 타입">
          <Select
            value={persona.avatar_type || "vrm"}
            onChange={(v) => update("avatar_type", v as AvatarType)}
            options={AVATAR_OPTIONS.map((a) => ({ v: a.v, l: a.l }))}
          />
        </Field>
        {persona.avatar_type === "heygen" && (
          <Field label="HeyGen Avatar ID">
            <Input value={persona.heygen_avatar_id || ""} onChange={(v) => update("heygen_avatar_id", v)} placeholder="June_HR_public" />
          </Field>
        )}
        {persona.avatar_type === "simli" && (
          <Field label="Simli Face ID">
            <Input value={persona.simli_face_id || ""} onChange={(v) => update("simli_face_id", v)} />
          </Field>
        )}
        {persona.avatar_type === "deepbrain" && (
          <Field label="DeepBrain Avatar Name">
            <Input value={persona.deepbrain_avatar_id || ""} onChange={(v) => update("deepbrain_avatar_id", v)} />
          </Field>
        )}
        {persona.avatar_type === "flashhead" && (
          <>
            <Field label="FlashHead Model ID">
              <Input value={persona.flashhead_model_id || ""} onChange={(v) => update("flashhead_model_id", v)} placeholder="default" />
            </Field>
            <Field label="External URL (사이드카)">
              <Input value={persona.external_url || ""} onChange={(v) => update("external_url", v)} placeholder="https://localhost:8282" />
            </Field>
          </>
        )}
      </div>

      <H2>system_prompt 생성·편집</H2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onGenerate("ai")}
          disabled={busy === "prompt-ai"}
          className="px-5 py-2.5 rounded-full text-[12.5px] font-bold disabled:opacity-50 transition-opacity hover:opacity-95"
          style={{ background: "var(--tc-accent-dark)", color: "#fff" }}
        >
          {busy === "prompt-ai" ? "Claude 생성 중..." : "✦ Claude로 자동 생성 (권장)"}
        </button>
        <button
          onClick={() => onGenerate("template")}
          disabled={busy === "prompt-template"}
          className="px-5 py-2.5 rounded-full text-[12.5px] font-semibold transition-colors hover:bg-[var(--tc-soft-bg)]"
          style={{
            background: "var(--tc-card-white)",
            color: "var(--tc-text)",
            border: "1.5px solid var(--tc-border-warm)",
          }}
        >
          ⌘ 템플릿으로 즉시 생성
        </button>
      </div>
      <Field label="system_prompt (편집 가능)" hint="생성 후 직접 다듬을 수 있습니다.">
        <TextArea
          rows={16}
          value={persona.system_prompt}
          onChange={(v) => update("system_prompt", v)}
          placeholder="버튼을 눌러 자동 생성하거나 직접 작성하세요"
          mono
        />
      </Field>

      <div className="pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--tc-border)" }}>
        <p className="text-[11.5px]" style={{ color: "var(--tc-text-sec)" }}>
          저장하면 <code>case_profiles/{persona.id || "<id>"}.json</code> 으로 기록됩니다.
        </p>
        <button
          onClick={onSave}
          disabled={busy === "save" || !persona.id || !persona.system_prompt}
          className="px-6 py-2.5 rounded-full text-[13px] font-bold disabled:opacity-40 shadow-[0_4px_14px_rgba(60,40,23,0.18)]"
          style={{ background: "var(--tc-accent-dark)", color: "#fff" }}
        >
          {busy === "save" ? "저장 중..." : "케이스 저장"}
        </button>
      </div>
    </div>
  );
}

/* ============ 미리보기 ============ */

function PreviewPane({ persona }: { persona: PersonaDraft }) {
  return (
    <div
      className="rounded-[14px] border p-4"
      style={{ background: "var(--tc-cream)", borderColor: "var(--tc-border-warm)" }}
    >
      <h3 className="text-[10px] font-bold tracking-[0.16em] uppercase mb-3" style={{ color: "var(--tc-text-muted)" }}>
        실시간 미리보기
      </h3>
      {persona.portrait_url && (
        <div
          className="w-full aspect-[4/3] rounded-[10px] overflow-hidden mb-3"
          style={{ background: "var(--tc-soft-bg)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${API_URL}${persona.portrait_url}`}
            alt={persona.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="tc-tag tc-tag-cream">{CATEGORY_LABELS[persona.category] || persona.category}</span>
        <span className="tc-tag tc-tag-gold">{persona.difficulty}</span>
        {persona.avatar_type && (
          <span className="tc-tag tc-tag-blue">{persona.avatar_type}</span>
        )}
      </div>
      <p
        className="text-[15px] font-bold leading-snug"
        style={{ fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif", color: "var(--tc-accent-dark)" }}
      >
        {persona.name || "(이름 미입력)"}{" "}
        <span className="text-[12px] font-normal" style={{ color: "var(--tc-text-sec)" }}>
          {persona.age}세 · {persona.gender}
        </span>
      </p>
      <p className="text-[12px] mt-1" style={{ color: "var(--tc-text-sec)" }}>{persona.occupation || "(직업)"}</p>
      <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--tc-border-warm)" }}>
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: "var(--tc-text-muted)" }}>
          호소 문제
        </p>
        <p className="text-[12.5px]" style={{ color: "var(--tc-text)" }}>
          {persona.presenting_issue || "—"}
        </p>
      </div>
      {persona.clinical?.primary_diagnosis && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--tc-border-warm)" }}>
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: "var(--tc-text-muted)" }}>
            임상 추정
          </p>
          <p className="text-[12px]" style={{ color: "var(--tc-text)" }}>
            {persona.clinical.primary_diagnosis}
          </p>
        </div>
      )}
      {persona.risk_assessment && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--tc-border-warm)" }}>
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: "var(--tc-text-muted)" }}>
            위험
          </p>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <RiskMini label="자살" v={persona.risk_assessment.suicide} />
            <RiskMini label="자해" v={persona.risk_assessment.self_harm} />
            <RiskMini label="타해" v={persona.risk_assessment.harm_others} />
            <RiskMini label="중독" v={persona.risk_assessment.substance} />
          </div>
        </div>
      )}
      {(persona.session_goals?.length ?? 0) > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--tc-border-warm)" }}>
          <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-1" style={{ color: "var(--tc-text-muted)" }}>
            세션 목표
          </p>
          <ul className="text-[11.5px] space-y-0.5" style={{ color: "var(--tc-text-sec)" }}>
            {persona.session_goals.slice(0, 4).map((g, i) => (
              <li key={i}>· {g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RiskMini({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded"
      style={{
        background: v === 0 ? "var(--tc-green-soft)" : v <= 1 ? "var(--tc-gold-soft)" : "var(--tc-red-soft)",
        color: v === 0 ? "var(--tc-green-deep)" : v <= 1 ? "#7A5418" : "var(--tc-red)",
      }}
    >
      <span>{label}</span>
      <span className="font-bold">{v}</span>
    </div>
  );
}

/* ============ 입력 헬퍼 ============ */

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[14px] font-bold mt-1"
      style={{
        fontFamily: "var(--font-noto-serif), 'Noto Serif KR', serif",
        color: "var(--tc-accent-dark)",
      }}
    >
      {children}
    </h2>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-bold tracking-[0.06em] mb-1" style={{ color: "var(--tc-text-sec)" }}>
        {label}
      </div>
      {children}
      {hint && (
        <p className="text-[10.5px] mt-1" style={{ color: "var(--tc-text-muted)" }}>
          {hint}
        </p>
      )}
    </label>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11.5px] p-2.5 rounded-md"
      style={{
        color: "var(--tc-text-sec)",
        background: "var(--tc-soft-bg)",
        border: "1px solid var(--tc-border)",
      }}
    >
      💡 {children}
    </p>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-md text-[12.5px] outline-none transition-colors focus:border-[var(--tc-accent-light)]"
      style={{
        border: "1px solid var(--tc-border)",
        background: "#fff",
        color: "var(--tc-text)",
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-md text-[12.5px] outline-none transition-colors focus:border-[var(--tc-accent-light)] resize-y"
      style={{
        border: "1px solid var(--tc-border)",
        background: "#fff",
        color: "var(--tc-text)",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
        fontSize: mono ? "11.5px" : undefined,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-md text-[12.5px] outline-none transition-colors focus:border-[var(--tc-accent-light)] cursor-pointer"
      style={{
        border: "1px solid var(--tc-border)",
        background: "#fff",
        color: "var(--tc-text)",
      }}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...values, t]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]"
            style={{
              background: "var(--tc-peach-soft)",
              color: "var(--tc-accent-deep)",
              border: "1px solid var(--tc-border-warm)",
            }}
          >
            {v}
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-[14px] leading-none opacity-60 hover:opacity-100"
              type="button"
              aria-label="삭제"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 rounded-md text-[12px] outline-none"
          style={{ border: "1px solid var(--tc-border)", background: "#fff" }}
        />
        <button
          onClick={add}
          type="button"
          className="px-3 py-1.5 rounded-md text-[11.5px] font-medium"
          style={{ background: "var(--tc-soft-bg)", color: "var(--tc-text)", border: "1px solid var(--tc-border)" }}
        >
          추가
        </button>
      </div>
    </div>
  );
}

function ChipMultiSelect({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors"
            style={{
              background: active ? "var(--tc-accent-dark)" : "var(--tc-soft-bg)",
              color: active ? "#fff" : "var(--tc-text-sec)",
              border: `1px solid ${active ? "var(--tc-accent-dark)" : "var(--tc-border)"}`,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function ObjectArrayEditor<T extends object>({
  items,
  onChange,
  emptyMsg,
  addLabel,
  emptyItem,
  renderItem,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  emptyMsg: string;
  addLabel: string;
  emptyItem: T;
  renderItem: (item: T, set: (patch: Partial<T>) => void, remove: () => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-[11.5px]" style={{ color: "var(--tc-text-muted)" }}>
          {emptyMsg}
        </p>
      )}
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-md p-3"
          style={{ background: "var(--tc-soft-bg)", border: "1px solid var(--tc-border)" }}
        >
          {renderItem(
            item,
            (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))),
            () => onChange(items.filter((_, j) => j !== i))
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...emptyItem }])}
        className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold"
        style={{
          background: "var(--tc-card-white)",
          color: "var(--tc-accent-dark)",
          border: "1.5px dashed var(--tc-border-warm)",
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="text-[11px] px-2 py-1 rounded"
      style={{
        background: "var(--tc-red-soft)",
        color: "var(--tc-red)",
        border: "1px solid var(--tc-red)",
        opacity: 0.8,
      }}
    >
      삭제
    </button>
  );
}

/* ============ 완성도 계산 ============ */
function computeCompletion(p: PersonaDraft): number {
  const checks: boolean[] = [
    !!p.id,
    !!p.name,
    !!p.age,
    !!p.gender,
    !!p.occupation,
    !!p.presenting_issue,
    !!p.description,
    !!p.personality,
    !!p.speaking_style,
    !!p.background_story,
    p.symptoms.length > 0,
    p.hidden_issues.length > 0,
    p.session_goals.length > 0,
    !!p.system_prompt,
    !!p.clinical?.primary_diagnosis,
    !!p.risk_assessment,
    (p.defense_mechanisms?.length ?? 0) > 0,
    (p.triggers?.length ?? 0) > 0,
    (p.relationships?.length ?? 0) > 0,
    (p.strengths?.length ?? 0) > 0,
  ];
  const ratio = checks.filter(Boolean).length / checks.length;
  return Math.round(ratio * 100);
}
