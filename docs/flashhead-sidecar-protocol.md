# FlashHead Sidecar Protocol (v0.1 draft)

OpenAvatarChat(OAC)의 FlashHead 엔진을 **독립 프로세스(사이드카)** 로 분리하여, 현 `ai-human` 백엔드/프론트와 통신하는 규약 초안. 목적은 **케이스별 맞춤 내담자 얼굴**을 로컬 GPU(RTX 5080, 16GB)에서 실시간 생성하되, 기존 Claude/ElevenLabs/Deepgram 파이프라인은 건드리지 않는 것.

## 1. 토폴로지

```
[브라우저]                                [ai-human backend]           [flashhead-sidecar (GPU)]
    │                                           │                               │
    │── WS /ws/conversation ────────────────────▶                               │
    │                        (STT 오디오, 텍스트)                               │
    │◀────────── audio(PCM16 b64) + text/emotion ─                              │
    │                                                                           │
    │── POST /session  { model_id, offer_sdp } ────────────────────────────────▶│
    │◀────────────────────────────── { session_id, answer_sdp } ────────────────│
    │                                                                           │
    │── POST /session/{id}/audio  (PCM16 raw bytes) ───────────────────────────▶│
    │◀═════════════ WebRTC video track (립싱크 얼굴) ═══════════════════════════│
```

- **핵심**: 사이드카는 **오디오 → 비디오**만 담당. LLM/TTS/세션 로직은 백엔드에 그대로.
- 프론트는 기존 ElevenLabs TTS가 반환한 PCM16 오디오를 **두 군데로 분기**:
  1. 기존대로 `<audio>`에 직접 재생 (귀에 들리는 목소리)
  2. 사이드카 `/session/{id}/audio`로도 전송 (립싱크 생성)
- 대안: 사이드카가 자체 `<audio>` 트랙도 반환하도록 하면 프론트 분기 제거 가능 (v0.2에서 결정).

## 2. 엔드포인트

### 2.1 `GET /health`
- **Response**: `200 OK`, `{"status": "ok", "gpu_vram_free_mb": int, "loaded_models": [str]}`
- **용도**: 백엔드 기동 시 사이드카 가용성 확인.

### 2.2 `POST /session`
- **Request body** (JSON):
  ```json
  {
    "model_id": "burnout_beginner",
    "offer_sdp": "v=0\r\no=- ...",
    "audio_format": "pcm_16000"
  }
  ```
- **Response** (JSON):
  ```json
  {
    "session_id": "sess_abc123",
    "answer_sdp": "v=0\r\no=- ..."
  }
  ```
- **실패**:
  - `404` — `model_id`에 해당하는 학습 모델 없음
  - `503` — VRAM 부족 (다른 세션 정리 후 재시도)

### 2.3 `POST /session/{session_id}/audio`
- **Content-Type**: `application/octet-stream`
- **Body**: raw PCM16 LE, 16 kHz, mono (ElevenLabs WebSocket 출력과 동일)
- **Response**: `202 Accepted` (비디오 생성은 비동기)
- **최대 청크**: 8192 bytes 권장 (지연 < 50ms 목표)
- **v0.2 제안**: `WS /session/{id}/audio`로 승격해 핸드셰이크 오버헤드 제거

### 2.4 `DELETE /session/{session_id}`
- **Response**: `204 No Content`
- 세션 종료 시 VRAM 해제 트리거.

### 2.5 `GET /models`
- **Response**: `{"models": [{"id": "burnout_beginner", "trained_at": "...", "vram_mb": 6200}, ...]}`
- 백엔드 `/api/cases` 응답에 flashhead 가용성을 표시하기 위한 참조용.

## 3. 모델 네이밍 규칙

| 필드 | 예시 | 출처 |
|---|---|---|
| `model_id` | `burnout_beginner` | `case_profiles/{id}.json`의 `flashhead_model_id` 또는 케이스 `id` |
| 학습 데이터 위치 (사이드카 내부) | `resource/avatar/{model_id}/source.mp4` | [scripts/train_case_avatar.py](../scripts/train_case_avatar.py) 스크립트가 배치 |
| 학습 산출물 | `resource/avatar/{model_id}/flashhead.ckpt` | 사이드카 내부 참조 |

## 4. 레이턴시 예산 (목표)

| 구간 | 예산 | 비고 |
|---|---|---|
| 백엔드 오디오 청크 도착 → 사이드카 수신 | < 30ms | 로컬 HTTP |
| 사이드카 FlashHead 추론 1 프레임 | ~30ms | 30fps 유지 가능 여부 PoC에서 확인 |
| WebRTC 전송 지연 | < 100ms | 로컬 네트워크 |
| **전체 추가 지연 (기존 Simli 대비)** | **< 200ms** | 허용 한계 |

초과 시 대응: LiteAvatar 모드로 전환, 또는 사이드카를 같은 프로세스에 embed.

## 5. 에러 및 폴백

백엔드/프론트는 아래 순서로 폴백:

1. `FLASHHEAD_SIDECAR_URL` 미설정 → `avatar_type="flashhead"`를 Simli로 치환
2. `/health` 실패 → 동일 폴백 + 경고 로그
3. `/session` `503` (VRAM 부족) → Simli 폴백, 관리자 알림
4. `/session/{id}/audio` 연속 실패 → 세션 재생성 1회 시도 후 Simli 폴백

## 6. 보안 / 배포

- 사이드카는 **localhost 또는 사설망에서만** 바인딩 (`127.0.0.1:9080` 권장).
- 인증: 초기엔 공유 시크릿(`X-Sidecar-Token` 헤더). 프로덕션 배포 시 mTLS.
- 학습된 얼굴 모델은 **초상권 이슈** → 반드시 동의한 배우/합성 소스만 사용. CI에서 `resource/avatar/` 커밋 차단.

## 7. v0.1 범위 (PoC)

- [ ] OAC 단독 설치, RTX 5080 위에서 FlashHead 1프레임 생성 확인
- [ ] 최소 `/session`, `/audio`, `DELETE /session` 구현
- [ ] `model_id="burnout_beginner"` 1개 학습 (source 2분 영상 확보 전제)
- [ ] 백엔드/프론트 스텁([backend/services/flashhead_service.py](../backend/services/flashhead_service.py), [frontend/src/hooks/useFlashHeadAvatar.ts](../frontend/src/hooks/useFlashHeadAvatar.ts))과 E2E 연결

## 8. v0.2 이후 고려 (deferred)

- WebSocket 오디오 전송으로 지연 단축
- 오디오 트랙도 사이드카가 반환해 프론트 분기 제거
- 감정 제어 API: `POST /session/{id}/emotion {tag, intensity}` — FlashHead 조건부 표정 강화
- 멀티 세션 (동시 2명 이상) 지원 시 VRAM 관리 정책

---
문서 버전: v0.1 draft | 2026-04-17
연관 문서: [OpenAvatarChat 셋업 가이드 v1.0](./OpenAvatarChat_한국어_셋업가이드_v1.0.pdf)
