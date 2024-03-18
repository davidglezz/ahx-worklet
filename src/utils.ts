/**
 * Gets the full audio buffer for a given AHX song.
 * @param output AHXOutput-like object
 * @param song AHXSong-like object
 * @returns full audio buffer
 */
export function* dump(output: any, song: any) {
  output.Player.InitSong(song);
  if (output.Init) {
    output.Player.InitSubsong(0);
    output.Init(48000, 16);
  }
  while (!output.Player.SongEndReached) {
    output.MixBuffer();
    yield output.MixingBuffer.slice(0, output.BufferSize);
  }
}

export function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
}

type VisualizeType = 'sinewave' | 'frequencybars' | 'off';

export function visualize(
  audioCtx: AudioContext,
  canvas: HTMLCanvasElement,
  type: VisualizeType = 'sinewave',
) {
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) {
    throw new Error("Couldn't get canvas context!");
  }

  const analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -30;
  analyser.smoothingTimeConstant = 0.65;

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  let drawVisual = 0;

  const setup = {
    sinewave() {
      analyser.fftSize = 512;
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      const draw = function () {
        drawVisual = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(255, 255, 255)';
        canvasCtx.beginPath();
        const sliceWidth = WIDTH / bufferLength;
        canvasCtx.moveTo(0, HEIGHT / 2);
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          canvasCtx.lineTo(i * sliceWidth, (v * HEIGHT) / 2);
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      };
      draw();
    },
    frequencybars() {
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const barWidth = WIDTH / bufferLength;
      const draw = function () {
        drawVisual = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
        for (let i = 0; i < bufferLength; i++) {
          const v = easeInOutQuad(dataArray[i] / 255);
          canvasCtx.fillStyle = `rgba(255, 255, 255, ${v})`;
          const barHeight = v * HEIGHT;
          canvasCtx.fillRect(i * barWidth, HEIGHT - barHeight, barWidth - 1, barHeight);
        }
      };
      draw();
    },
    off() {
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
    },
  };

  setup[type]();

  return {
    node: analyser,
    setVisualSetting(type: VisualizeType) {
      cancelAnimationFrame(drawVisual);
      setup[type]();
    },
  } as const;
}
