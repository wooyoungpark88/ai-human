"""케이스별 FlashHead 아바타 모델 학습 스크립트 (skeleton)

목적:
  `backend/case_profiles/{case_id}.json` 에 정의된 케이스를 위해
  FlashHead 얼굴 모델을 OpenAvatarChat 사이드카에 학습/등록한다.

사용 예:
  python scripts/train_case_avatar.py \
      --case-id burnout_beginner \
      --source path/to/source_video.mp4 \
      --sidecar-url http://127.0.0.1:9080

초상권 경고:
  학습 소스 영상은 반드시 동의한 배우 혹은 합성 소스여야 한다.
  실제 내담자 영상 사용 금지.

현 상태:
  - 사이드카가 제공할 학습 엔드포인트(/train) 스펙이 확정되지 않아 스켈레톤만 제공.
  - OAC 저장소의 `scripts/download_models.py --handler flashhead` 및 학습 파이프라인
    검증 후 본 스크립트의 TODO 구간을 구현한다.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CASE_PROFILES_DIR = PROJECT_ROOT / "backend" / "case_profiles"


def load_case(case_id: str) -> dict:
    path = CASE_PROFILES_DIR / f"{case_id}.json"
    if not path.exists():
        raise SystemExit(f"케이스 프로필 없음: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_source_video(path: Path) -> None:
    """OpenAvatarChat 가이드 5절 기준을 최소한으로 검증."""
    if not path.exists():
        raise SystemExit(f"소스 영상 없음: {path}")
    size_mb = path.stat().st_size / (1024 * 1024)
    if size_mb < 5:
        print(f"[warn] 영상 크기가 작습니다 ({size_mb:.1f}MB) — 1080p/30fps/90초 권장")
    # TODO: ffprobe로 해상도/길이/프레임레이트 검사 (요구: 1080p+, 30fps, 90~120s)


def submit_training_job(
    sidecar_url: str, case_id: str, source_video: Path, dry_run: bool
) -> None:
    """사이드카에 학습 작업을 제출한다. (TODO: 실제 API 확정 후 구현)

    현재는 요청 페이로드만 출력하며 dry-run 동작을 한다.
    """
    payload = {
        "model_id": case_id,
        "source_video_path": str(source_video.resolve()),
        "target_fps": 30,
        "target_resolution": "1080p",
    }
    print("=== 학습 작업 페이로드 ===")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    if dry_run:
        print("[dry-run] 실제 전송은 생략")
        return

    # TODO: httpx.post(f"{sidecar_url}/train", json=payload) 로 교체
    raise NotImplementedError(
        "사이드카 /train 엔드포인트 스펙 미확정 — dry-run만 지원"
    )


def update_case_profile(case_id: str, model_id: str) -> None:
    """케이스 프로필에 flashhead_model_id 필드를 주입한다."""
    path = CASE_PROFILES_DIR / f"{case_id}.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["avatar_type"] = "flashhead"
    data["flashhead_model_id"] = model_id
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[ok] 케이스 프로필 갱신: {path}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="FlashHead 케이스 아바타 학습")
    parser.add_argument("--case-id", required=True, help="backend/case_profiles/{id}.json")
    parser.add_argument("--source", required=True, type=Path, help="2분 내외 학습 소스 영상")
    parser.add_argument(
        "--sidecar-url", default="http://127.0.0.1:9080", help="FlashHead 사이드카 URL"
    )
    parser.add_argument(
        "--update-profile",
        action="store_true",
        help="학습 완료 후 케이스 프로필에 flashhead_model_id 주입",
    )
    parser.add_argument("--dry-run", action="store_true", help="실제 요청 없이 페이로드만 출력")
    args = parser.parse_args(argv)

    case = load_case(args.case_id)
    print(f"[case] {case['name']} ({case.get('presenting_issue', '')})")

    validate_source_video(args.source)
    submit_training_job(args.sidecar_url, args.case_id, args.source, args.dry_run)

    if args.update_profile and not args.dry_run:
        update_case_profile(args.case_id, model_id=args.case_id)

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
