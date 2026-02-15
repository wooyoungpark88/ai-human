/**
 * PCM 스트리밍 오디오 재생기
 * - Base64 인코딩된 PCM 16kHz/mono/16bit 청크를 수신하여 재생
 * - AnalyserNode를 통해 립싱크용 주파수 데이터 제공
 * - 갭리스 스케줄링으로 끊김 없는 재생
 */
export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private scheduledTime = 0;
  private _isPlaying = false;
  private activeSourceCount = 0;

  async init(): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.gainNode = this.audioContext.createGain();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.5;

    // analyser → gain → speakers
    this.analyserNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.scheduledTime = 0;
  }

  feedBase64Chunk(base64: string): void {
    if (!this.audioContext || !this.analyserNode) return;

    // AudioContext가 suspended 상태이면 resume
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    // Base64 → Uint8Array (Int16 PCM)
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Int16 PCM → Float32 (-1..1)
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    // AudioBuffer 생성
    const buffer = this.audioContext.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);

    // 스케줄링: 이전 오디오 끝 지점에 연결
    const now = this.audioContext.currentTime;
    if (this.scheduledTime < now) {
      this.scheduledTime = now;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyserNode!);
    source.start(this.scheduledTime);
    this.scheduledTime += buffer.duration;

    this.activeSourceCount++;
    this._isPlaying = true;

    source.onended = () => {
      this.activeSourceCount--;
      if (this.activeSourceCount <= 0) {
        this.activeSourceCount = 0;
        this._isPlaying = false;
      }
    };
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  stop(): void {
    this.scheduledTime = 0;
    this.activeSourceCount = 0;
    this._isPlaying = false;
    // AudioContext를 닫지 않고 스케줄만 리셋 (재사용 가능)
  }

  dispose(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.gainNode = null;
    this.analyserNode = null;
  }
}
