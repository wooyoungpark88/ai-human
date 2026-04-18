#!/bin/bash
# OAC FlashHead 사이드카 기동
# - ai-human .env에서 ANTHROPIC_API_KEY를 읽어 환경변수로만 전달 (출력 없음)
# - WSL2 Ubuntu 안에서 실행해야 함

set -e

ENV_FILE="/mnt/c/Users/SKTelecom/service/ai-human/ai-human/.env"
echo "[1] ENV_FILE=${ENV_FILE}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "[ERR] ENV_FILE not found: ${ENV_FILE}"
  exit 1
fi
echo "[2] .env 파일 존재 확인"

# .env source — 키 값은 절대 출력하지 않음
set -a
source "${ENV_FILE}"
set +a
echo "[3] .env source 완료"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "[ERR] ANTHROPIC_API_KEY 비어있음"
  exit 1
fi
echo "[4] ANTHROPIC_API_KEY 로드됨 (길이: ${#ANTHROPIC_API_KEY}자)"

# OAC LLMOpenAICompatible 핸들러는 OPENAI_API_KEY 우선 사용
export OPENAI_API_KEY="${ANTHROPIC_API_KEY}"
echo "[5] OPENAI_API_KEY 설정"

cd "${HOME}/OpenAvatarChat"
export PATH="${HOME}/.local/bin:${PATH}"
echo "[6] OAC 디렉토리 이동: $(pwd)"

# 키를 yaml에 직접 적지 않고, 임시 config로 치환 (transcript/git에 노출 방지)
SRC_CONFIG="${OAC_CONFIG:-config/chat_korean_claude_flashhead_duplex.yaml}"
TMP_CONFIG="/tmp/oac_active_config.yaml"
# 모든 placeholder를 전역 치환 (sed 기본은 첫 번째만 — g 옵션 명시)
sed "s|__API_KEY_PLACEHOLDER__|${OPENAI_API_KEY}|g" "${SRC_CONFIG}" > "${TMP_CONFIG}"
chmod 600 "${TMP_CONFIG}"
echo "[7] 임시 config 생성: ${TMP_CONFIG}"

echo "[8] 사이드카 기동 (stdout/stderr api_key 마스킹 + unbuffered)"
# PYTHONUNBUFFERED=1: Python stdout 라인 단위 flush
# sed -u: sed unbuffered (라인마다 즉시 flush)
# stdbuf -oL -eL: 추가 안전망
export PYTHONUNBUFFERED=1
exec stdbuf -oL -eL .venv/bin/python src/demo.py --config "${TMP_CONFIG}" 2>&1 \
  | stdbuf -oL sed -u -E "s/(api_key=)['\"][^'\"]+['\"]/\1'***MASKED***'/g"
