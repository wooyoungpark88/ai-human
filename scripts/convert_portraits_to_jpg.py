"""portraits/ 의 PNG를 JPEG(quality=88)로 일괄 변환 + case_profiles JSON URL 갱신.

PNG 평균 ~2.5MB → JPEG ~250KB (10배 절감, GitHub push 안정화).
원본 PNG는 삭제. 추후 backend가 JPEG으로 직접 저장하도록 main.py도 수정.
"""
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PORTRAITS = ROOT / "backend" / "portraits"
CASES = ROOT / "backend" / "case_profiles"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    pngs = sorted(PORTRAITS.glob("*.png"))
    print(f"[convert] PNG {len(pngs)}장 변환 시작")
    total_before = sum(p.stat().st_size for p in pngs)

    converted = 0
    for png_path in pngs:
        jpg_path = png_path.with_suffix(".jpg")
        try:
            with Image.open(png_path) as im:
                im = im.convert("RGB")
                im.save(jpg_path, "JPEG", quality=88, optimize=True, progressive=True)
            png_path.unlink()
            converted += 1
        except Exception as e:
            print(f"  실패 {png_path.name}: {e}", file=sys.stderr)

    total_after = sum(p.stat().st_size for p in PORTRAITS.glob("*.jpg"))
    print(f"[convert] {converted}장 완료. {total_before / 1e6:.1f}MB → {total_after / 1e6:.1f}MB")

    # JSON URL 갱신: .png → .jpg
    print("\n[convert] case_profiles JSON URL 갱신")
    for case_path in sorted(CASES.glob("*.json")):
        data = json.loads(case_path.read_text(encoding="utf-8"))
        changed = False
        if isinstance(data.get("portrait_url"), str) and data["portrait_url"].endswith(".png"):
            data["portrait_url"] = data["portrait_url"].replace(".png", ".jpg")
            changed = True
        if isinstance(data.get("portrait_variants"), dict):
            new_variants = {}
            for emo, url in data["portrait_variants"].items():
                if isinstance(url, str) and url.endswith(".png"):
                    new_variants[emo] = url.replace(".png", ".jpg")
                    changed = True
                else:
                    new_variants[emo] = url
            data["portrait_variants"] = new_variants
        if changed:
            case_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  {case_path.name} 갱신")

    return 0


if __name__ == "__main__":
    sys.exit(main())
