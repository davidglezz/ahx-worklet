import { AHXOutput, AHXPlayer, AHXSong } from './ahx.ts';

/// <reference types="@types/audioworklet" />

/** Types to define the comunication between the AudioWorklet and the Node. */
export interface InputMessagesMap {
  load: { songData: ArrayBuffer };
  setPosition: { value: number };
}

export interface OutputMessagesMap {
  songInfo: { songInfo: AHXSong };
  position: { value: number };
  log: { severity: 'info' | 'warn' | 'error'; message: string };
}

type Id<T extends object, R = { [ID in keyof T]: { id: ID } & T[ID] }[keyof T]> = NonNullable<{
  [P in keyof R]: R[P];
}>;
export type InputMessages = Id<InputMessagesMap>;
export type OutputMessages = Id<OutputMessagesMap>;

type MessageHandler<T = InputMessagesMap> = { [ID in keyof T]: (params: T[ID]) => void };

class AHXProcessor
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl, MessageHandler
{
  Output: AHXOutput = new AHXOutput(new AHXPlayer(), sampleRate, 16);

  bufferFull = 0;
  bufferOffset = 0;
  currentPosition = 0;

  constructor() {
    super();
    this.port.onmessage = (ev: MessageEvent<InputMessages>) => {
      const { id, ...params } = ev.data;
      // @ts-expect-error - Params depends on the message id
      this[id]?.(params);
    };
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
        // 512 = 4 voices * 128 (int8 max value + 1)
        left[out] = right[out] = this.Output.MixingBuffer[this.bufferOffset++] / 512;
        out++;
      }
      if (this.bufferOffset >= this.bufferFull) {
        this.bufferOffset = this.bufferFull = 0;
      }
    }
    if (this.currentPosition !== this.Output.Player.PosNr) {
      const value = this.Output.Player.PosNr / this.Output.Player.Song.Positions.length;
      this.port.postMessage({ id: 'position', value });
      this.currentPosition = this.Output.Player.PosNr;
    }

    return true;
  }

  setPosition({ value }: InputMessagesMap['setPosition']) {
    const PosNr = this.Output.Player.Song?.Positions.length;
    if (!PosNr) return;
    this.Output.pos = [0, 0, 0, 0];
    this.bufferFull = 0;
    this.currentPosition = Math.floor(value * PosNr);
    this.Output.Player.SetPosition(this.currentPosition);
    //this.port.postMessage({ id: 'position', value: this.Output.Player.PosNr / PosNr });
  }

  load({ songData }: InputMessagesMap['load']) {
    const song = new AHXSong(songData);
    this.Output.Player.InitSong(song);
    this.currentPosition = this.Output.Player.PosNr;
    this.port.postMessage({ id: 'songInfo', songInfo: song });
    this.port.postMessage({ id: 'position', value: 0 });
  }
}

registerProcessor('ahx', AHXProcessor);
