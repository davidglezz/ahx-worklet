type VisualizerType = 'sinewave' | 'frequencybars' | 'off';

export class AudioVisualizer {
  protected canvas: HTMLCanvasElement;
  protected canvasCtx: CanvasRenderingContext2D;
  protected analyser: AnalyserNode;
  protected rafHandle = 0;
  protected activeVisualizer: VisualizerType = 'off';

  constructor(audioCtx: AudioContext, canvas: HTMLCanvasElement, type: VisualizerType = 'off') {
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d')!;
    if (!this.canvasCtx) {
      throw new Error("Couldn't get canvas context!");
    }

    this.analyser = audioCtx.createAnalyser();
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -30;
    this.analyser.smoothingTimeConstant = 0.65;

    this[type]();
  }

  getNode() {
    return this.analyser;
  }

  sinewave() {
    cancelAnimationFrame(this.rafHandle);
    this.activeVisualizer = 'sinewave';
    const color = getComputedStyle(document.body).getPropertyValue('--fg-color');
    const bufferLength = (this.analyser.fftSize = 512);
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      this.rafHandle = requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(dataArray);
      this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvasCtx.lineWidth = 2;
      this.canvasCtx.strokeStyle = color;
      this.canvasCtx.beginPath();
      const sliceWidth = this.canvas.width / bufferLength;
      this.canvasCtx.moveTo(0, this.canvas.height / 2);
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        this.canvasCtx.lineTo(i * sliceWidth, (v * this.canvas.height) / 2);
      }
      this.canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
      this.canvasCtx.stroke();
    };
    draw();
  }

  frequencybars() {
    cancelAnimationFrame(this.rafHandle);
    this.activeVisualizer = 'frequencybars';
    const color = getComputedStyle(document.body).getPropertyValue('--fg-color');
    const [, r, g, b] = color.split(/[^\d\.]+/g);
    this.analyser.fftSize = 128;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const barWidth = this.canvas.width / bufferLength;
    const draw = () => {
      this.rafHandle = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);
      this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let i = 0; i < bufferLength; i++) {
        const v = easeInOutQuad(dataArray[i] / 255);
        this.canvasCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${v})`;
        const barHeight = v * this.canvas.height;
        this.canvasCtx.fillRect(
          i * barWidth,
          this.canvas.height - barHeight,
          barWidth - 1,
          barHeight,
        );
      }
    };
    draw();
  }

  off() {
    cancelAnimationFrame(this.rafHandle);
    this.activeVisualizer = 'off';
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  next() {
    const next = {
      sinewave: 'frequencybars',
      frequencybars: 'off',
      off: 'sinewave',
    } as const;
    this[next[this.activeVisualizer]]();
  }
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}
