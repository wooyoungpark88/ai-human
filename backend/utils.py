"""공용 유틸리티 — JSON 입출력, API 키 검증 등 서비스 공통 헬퍼"""

import json
import logging
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


def load_json_file(path: Path) -> Optional[dict[str, Any]]:
    """JSON 파일을 읽어 dict로 반환합니다. 실패 시 None 반환 후 경고 로그."""
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning(f"JSON 로드 실패: {path}: {e}")
        return None


def validate_api_key(key: str) -> bool:
    """API 키가 플레이스홀더가 아닌 실제 값인지 확인합니다."""
    return bool(key) and not key.startswith("your_") and len(key) > 10


def _strip_markdown_fence(text: str) -> str:
    """LLM 응답 앞뒤의 ```...``` 코드 펜스를 제거합니다."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if len(lines) > 2:
            text = "\n".join(lines[1:-1])
    return text


def _extract_json_object(text: str) -> Optional[str]:
    """텍스트 내 첫 번째 균형 잡힌 `{...}` 블록을 추출합니다."""
    start = text.find("{")
    if start < 0:
        return None

    depth = 0
    in_string = False
    escape = False

    for idx in range(start, len(text)):
        ch = text[idx]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:idx + 1]
    return None


def parse_json_from_text(text: str) -> Optional[dict[str, Any]]:
    """LLM 응답 텍스트에서 JSON 객체를 파싱합니다.

    1) 코드 펜스 제거 후 직접 파싱
    2) 실패 시 텍스트 내 첫 번째 균형 `{...}` 블록 추출 파싱
    실패 시 None 반환.
    """
    cleaned = _strip_markdown_fence(text)

    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    block = _extract_json_object(cleaned)
    if block is None:
        return None
    try:
        data = json.loads(block)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None
