export interface DeepgramConfig {
  apiKey: string;
  model?: string;
  language?: string;
}

export type TranscriptCallback = (text: string, isFinal: boolean) => void;

export class DeepgramClient {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onTranscript: TranscriptCallback;
  private apiKey: string;
  private model: string;
  private language: string;

  constructor(config: DeepgramConfig, onTranscript: TranscriptCallback) {
    this.apiKey = config.apiKey;
    this.model = config.model || "nova-3";
    this.language = config.language || "en";
    this.onTranscript = onTranscript;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const params = new URLSearchParams({
      model: this.model,
      language: this.language,
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "1500",
      vad_events: "true",
      encoding: "linear16",
      sample_rate: "16000",
    });

    this.socket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params}`,
      ["token", this.apiKey]
    );

    this.socket.onopen = () => {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(this.stream!);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          this.socket.send(pcm16.buffer);
        }
      };
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "Results" && data.channel?.alternatives?.[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        if (transcript) {
          this.onTranscript(transcript, data.is_final);
        }
      }
    };

    this.socket.onerror = (error) => {
      console.error("Deepgram WebSocket error:", error);
    };
  }

  stop(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "CloseStream" }));
      this.socket.close();
    }
    this.socket = null;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
