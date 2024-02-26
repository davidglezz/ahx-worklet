import { AHXOutput, AHXSong } from './ahx.ts';

/// <reference types="@types/audioworklet" />

class AHXProcessor extends AudioWorkletProcessor implements AudioWorkletProcessorImpl {
  Output: AHXOutput = new AHXOutput();

  bufferFull = 0;
  bufferOffset = 0;

  constructor() {
    super();
    this.port.onmessage = event => {
      if (event.data) {
        const song = new AHXSong(event.data.songData);
        this.Output.Player.InitSong(song);
        this.Output.Player.InitSubsong(0);
        this.Output.Init(sampleRate, 16);
      }
    };
  }

  process(_input: never, outputs: Float32Array[][], _params: never): boolean {
    const output = outputs[0];
    const bufferSize = output[0].length;
    const left = output[0];
    const right = output[1];
    let want = bufferSize;
    let out = 0;
    while (want > 0) {
      if (this.bufferFull === 0) {
        this.Output.MixBuffer();
        this.bufferFull = this.Output.BufferSize;
        this.bufferOffset = 0;
      }

      let can = Math.min(this.bufferFull - this.bufferOffset, want);
      want -= can;
      while (can-- > 0) {
        left[out] = right[out] = this.Output.MixingBuffer[this.bufferOffset++] / (128 * 4);
        out++;
      }
      if (this.bufferOffset >= this.bufferFull) {
        this.bufferOffset = this.bufferFull = 0;
      }
    }

    return true;
  }
}

registerProcessor('ahx', AHXProcessor);
