import fs from 'node:fs';
import { beforeAll, bench, describe } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';
import { resetComputedAHXWaves } from './AHXWaves.ts';

const options = { time: 1000, iterations: 5 };

function referenceImplementationDump(stringBytes: string) {
  const binString = new DataType();
  binString.data = stringBytes;
  const referenceSong = new ReferenceSong();
  referenceSong.InitSong(binString);
  return dump(ReferenceOutput(), referenceSong);
}

function newImplementationDump(arrayBuffer: ArrayBuffer) {
  return dump(new AHXOutput(), new AHXSong(arrayBuffer));
}

function runGenerator(generator: Generator<number[]>) {
  // Dumby read to force the generator to run
  let size = 0;
  for (const chunk of generator) {
    size += chunk.length;
  }
}

describe('it should perform better than reference implementation', () => {
  let songs: { stringBytes: string; arrayBuffer: ArrayBuffer }[] = [];

  beforeAll(async () => {
    songs = [
      // '03.ahx',
      // '04.ahx',
      //'die audienz ist horenz.ahx'], // Fail
      // 'drums.ahx',
      // 'frame.ahx',
      //'holla 2.ahx', // Fail
      // 'loom.ahx',
      'thxcolly-intro.ahx',
      // 'void.ahx',
    ].map(filename => {
      const buffer = fs.readFileSync(`test-songs/${filename}`);
      return {
        stringBytes: String.fromCharCode(...buffer),
        arrayBuffer: toArrayBuffer(buffer),
      };
    });
  });

  describe('single song', () => {
    bench(
      'reference implementation',
      () => songs.forEach(song => runGenerator(referenceImplementationDump(song.stringBytes))),
      options,
    );

    bench(
      'new implementation',
      () =>
        songs.forEach(song => {
          runGenerator(newImplementationDump(song.arrayBuffer));
          resetComputedAHXWaves();
        }),
      options,
    );
  });

  describe('multiple songs', () => {
    bench(
      'reference implementation',
      () => songs.forEach(song => runGenerator(referenceImplementationDump(song.stringBytes))),
      options,
    );

    bench(
      'new implementation',
      () => songs.forEach(song => runGenerator(newImplementationDump(song.arrayBuffer))),
      options,
    );
  });
});
