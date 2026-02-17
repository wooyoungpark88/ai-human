/**
 * AudioWorklet Processor — Float32 → Int16 PCM 변환
 *
 * ScriptProcessorNode (deprecated) 대비 장점:
 * - 별도 스레드에서 실행 → 메인 스레드 블로킹 없음
 * - 128 프레임 단위 처리 → 낮은 레이턴시
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(0);
    this.bufferSize = 2048; // 2048 samples = 128ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // Float32Array, 128 samples per call

    // Float32 → Int16 변환
    const pcm = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // 버퍼에 축적
    const newBuffer = new Int16Array(this.buffer.length + pcm.length);
    newBuffer.set(this.buffer);
    newBuffer.set(pcm, this.buffer.length);
    this.buffer = newBuffer;

    // 버퍼가 충분히 쌓이면 전송
    if (this.buffer.length >= this.bufferSize) {
      const chunk = this.buffer.slice(0, this.bufferSize);
      this.buffer = this.buffer.slice(this.bufferSize);
      this.port.postMessage({ pcmData: chunk.buffer }, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
