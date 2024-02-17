import type { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
  dataType,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong } from './ahx.ts';

function Dump(output, song) {
  // song = AHXSong()
  output.Player.InitSong(song);
  output.Player.InitSubsong(0);
  output.Init(48000, 16);

  const outSound = [];
  while (!output.Player.SongEndReached) {
    output.MixBuffer();
    outSound.push(...output.MixingBuffer);
  }

  return outSound;
}

function toArrayBuffer(buffer: Buffer) {
  const ab = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
}

describe('ahx', () => {
  it('should output the same buffer values', async () => {
    //const songBytes = readFileSync('../songs/Galassir/saul the lawyer.ahx');
    const songBytes = readFileSync('../songs/Xeron/thxcolly-intro.ahx');

    const binString = new dataType();
    binString.data = String.fromCharCode(...songBytes);
    const referenceSong = new ReferenceSong();
    referenceSong.InitSong(binString);
    const expected = Dump(ReferenceOutput(), referenceSong);

    const song = new AHXSong();
    song.InitSong(toArrayBuffer(songBytes));
    const actual = Dump(AHXOutput(), song);

    expect(JSON.stringify(song)).toEqual(JSON.stringify(referenceSong));
    expect(actual).toEqual(expected);
  });
});
