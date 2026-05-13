"""ChatGPT/Midjourney 그리드 이미지를 8장으로 분할 + 4:5 세로 비율로 자르고 JPEG 저장.

박지영 케이스용 — 2행 × 4열 그리드 → relationship_intermediate_{emotion}.jpg 7장 + angry 삭제.

실행:
    venv\\Scripts\\python.exe scripts\\split_portrait_grid.py
"""
import sys
from pathlib import Path

from PIL import Image

SRC = Path(r"O:\1.반출파일함(myDesk - PC)\ChatGPT Image 2026년 5월 13일 오후 02_08_25.png")
DST_DIR = Path(__file__).resolve().parent.parent / "backend" / "portraits"
PREFIX = "relationship_intermediate"

# (row, col) → emotion. (1,3)은 사용하지 않음 (angry 표정 부재 → 미저장 + 기존 angry 파일 삭제)
MAPPING = {
    (0, 0): "neutral",
    (0, 1): "happy",
    (0, 2): "surprised",
    (0, 3): "empathetic",
    (1, 0): "anxious",
    (1, 1): "sad",
    (1, 2): "thinking",
}


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    if not SRC.exists():
        print(f"[split] 원본 없음: {SRC}", file=sys.stderr)
        return 1
    if not DST_DIR.exists():
        print(f"[split] 저장 디렉토리 없음: {DST_DIR}", file=sys.stderr)
        return 1

    img = Image.open(SRC).convert("RGB")
    W, H = img.size
    cell_w = W // 4
    cell_h = H // 2
    print(f"[split] 원본: {W}x{H}, cell: {cell_w}x{cell_h}, aspect: {cell_w/cell_h:.3f}")

    # 4:5 세로 비율 target: target_w = cell_h * 4 / 5
    target_w = int(cell_h * 4 / 5)
    # cell이 그보다 가로로 더 길면 좌우 trim, 좁으면 cell_w 유지 (그대로 4:5에 더 가까움)
    crop_w = min(cell_w, target_w)
    x_pad = (cell_w - crop_w) // 2
    print(f"[split] 4:5 target_w={target_w}, crop_w={crop_w}, x_pad={x_pad}")

    saved = 0
    for (row, col), emotion in MAPPING.items():
        x0 = col * cell_w + x_pad
        y0 = row * cell_h
        cropped = img.crop((x0, y0, x0 + crop_w, y0 + cell_h))
        dst = DST_DIR / f"{PREFIX}_{emotion}.jpg"
        cropped.save(
            dst,
            "JPEG",
            quality=92,
            optimize=True,
            progressive=True,
            subsampling=0,  # 4:4:4 full chroma — 디테일 보존
        )
        size_kb = dst.stat().st_size / 1024
        print(f"  ({row},{col}) → {dst.name}  {cropped.size}  {size_kb:.0f}KB")
        saved += 1

    # 기존 angry 파일 삭제 (사용 안 함 — neutral 폴백 의도)
    angry = DST_DIR / f"{PREFIX}_angry.jpg"
    if angry.exists():
        angry.unlink()
        print(f"  deleted: {angry.name} (angry는 neutral로 폴백)")

    print(f"\n[split] 완료: {saved}장 저장")
    return 0


if __name__ == "__main__":
    sys.exit(main())
