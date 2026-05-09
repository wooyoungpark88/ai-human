"""기존 case_profiles JSON 5개에 8가지 감정 변형 초상화 일괄 생성 + 메타 갱신.

실행:
    venv\Scripts\python.exe scripts\backfill_portraits.py
사전 조건:
    - backend uvicorn이 localhost:8000에서 실행 중
    - .env에 OPENAI_API_KEY 설정됨
"""
import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
CASE_DIR = ROOT / "backend" / "case_profiles"
API = "http://localhost:8000"
EMOTIONS = ["neutral", "happy", "sad", "angry", "surprised", "thinking", "anxious", "empathetic"]


def main(force: bool = False) -> int:
    files = sorted(CASE_DIR.glob("*.json"))
    if not files:
        print("[backfill] case_profiles 비어있음", file=sys.stderr)
        return 1

    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(f"[backfill] 대상 케이스 {len(files)}개")
    for fp in files:
        print(f"  - {fp.stem}")

    for fp in files:
        case = json.loads(fp.read_text(encoding="utf-8"))
        case_id = case.get("id") or fp.stem
        existing = case.get("portrait_variants") or {}
        if (
            not force
            and len(existing) >= len(EMOTIONS)
            and all(existing.get(e) for e in EMOTIONS)
        ):
            print(f"\n[{case_id}] 이미 8장 모두 보유 — 건너뜀")
            continue

        print(f"\n[{case_id}] 8장 생성 시작 ({case.get('name')})")
        t0 = time.time()
        with httpx.Client(timeout=300.0) as client:
            r = client.post(
                f"{API}/api/cases/generate-portrait",
                json={
                    "persona": case,
                    "case_id": case_id,
                    "emotions": EMOTIONS,
                },
            )
        dt = time.time() - t0
        if r.status_code >= 400:
            print(f"  HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)
            continue
        data = r.json()
        if data.get("error"):
            print(f"  실패: {data['error']}", file=sys.stderr)
            continue

        variants = data.get("variants", {})
        print(f"  완료 ({dt:.1f}s) — {len(variants)}장: {sorted(variants.keys())}")
        if data.get("errors"):
            print(f"  부분 실패: {data['errors']}", file=sys.stderr)

        # JSON에 영구 반영
        case["portrait_url"] = data.get("url") or variants.get("neutral")
        case["portrait_variants"] = variants
        case["portrait_prompt"] = data.get("prompt_used")
        # schema_version 1인 경우에도 portrait는 추가됨 — 그대로 둔다
        fp.write_text(
            json.dumps(case, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"  -> {fp.relative_to(ROOT)} 저장됨")

    print("\n[backfill] 완료")
    return 0


if __name__ == "__main__":
    force = "--force" in sys.argv
    sys.exit(main(force=force))
