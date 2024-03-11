import { AHXOutput, AHXPlayer, AHXSong } from './ahx.ts';
import type { LoadEvent, MessageToWorklet, PositionEvent } from './types.ts';

/// <reference types="@types/audioworklet" />

class AHXProcessor extends AudioWorkletProcessor implements AudioWorkletProcessorImpl {
  Output: AHXOutput = new AHXOutput(new AHXPlayer(), sampleRate, 16);

  bufferFull = 0;
  bufferOffset = 0;
  currentPosition = 0;

  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent<MessageToWorklet>) => this[data.id]?.(data);
  }

  process(_input: never, outputs: Float32Array[][], _params: never): boolean {
    if (!this.Output.Player.Song) return false;
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
    if (this.currentPosition !== this.Output.Player.PosNr) {
      const value = this.Output.Player.PosNr / this.Output.Player.Song.PositionNr;
      this.port.postMessage({ id: 'position', value });
      this.currentPosition = this.Output.Player.PosNr;
    }

    /*this.port.postMessage({
        id: 'stats',
        pos: `${this.Output.Player.PosNr} / ${this.Output.Player.Song.PositionNr}`,
        time: this.Output.Player.PlayingTime,
        songEndReached: this.Output.Player.SongEndReached,
    });*/

    return true;
  }

  position({ value }: PositionEvent) {
    this.Output.pos = [0, 0, 0, 0];
    this.bufferFull = 0;
    this.currentPosition = Math.floor(value * this.Output.Player.Song.PositionNr);
    this.Output.Player.SetPosition(this.currentPosition);
    /*this.port.postMessage({
      id: 'position',
      value: this.Output.Player.PosNr / this.Output.Player.Song.PositionNr,
    });*/
  }

  load({ songData }: LoadEvent) {
    const song = new AHXSong(songData);
    this.Output.Player.InitSong(song);
    this.currentPosition = this.Output.Player.PosNr;
    this.port.postMessage({ id: 'songInfo', songInfo: song });
    this.port.postMessage({ id: 'position', value: 0 });
  }
}

registerProcessor('ahx', AHXProcessor);
