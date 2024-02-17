import type { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { bench, describe } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

describe('it should perform better than reference implementation', () => {
  const songBytes = readFileSync('../songs/Xeron/thxcolly-intro.ahx');
  //const songBytes = readFileSync('../songs/Galassir/saul the lawyer.ahx');

  bench(
    'reference implementation',
    async () => {
      const binString = new DataType();
      binString.data = String.fromCharCode(...songBytes);
      const referenceSong = new ReferenceSong();
      referenceSong.InitSong(binString);
      dump(ReferenceOutput(), referenceSong);
    },
    { time: 1000 },
  );

  bench(
    'new implementation',
    () => {
      const song = new AHXSong(toArrayBuffer(songBytes));
      dump(new AHXOutput(), song);
    },
    { time: 1000 },
  );
});
