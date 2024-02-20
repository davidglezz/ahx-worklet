import fs from 'node:fs';
import { beforeAll, describe } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong, resetComputedAHXWaves } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

const options = { time: 1000, iterations: 5 };

function referenceImplementationLoad(stringBytes: string) {
  const binString = new DataType();
  binString.data = stringBytes;
  const referenceSong = new ReferenceSong();
  referenceSong.InitSong(binString);
  return referenceSong;
}

function referenceImplementationDump(stringBytes: string) {
  const referenceSong = referenceImplementationLoad(stringBytes);
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
  return size > 0;
}

let songs: { stringBytes: string; arrayBuffer: ArrayBuffer }[] = [];

beforeAll(async () => {
  songs = [
    '03.ahx',
    '04.ahx',
    'die audienz ist horenz.ahx',
    'drums.ahx',
    'frame.ahx',
    'holla 2.ahx',
    'loom.ahx',
    'thxcolly-intro.ahx',
    'void.ahx',
  ].map(filename => {
    const buffer = fs.readFileSync(`test-songs/${filename}`);
    return {
      stringBytes: String.fromCharCode(...buffer),
      arrayBuffer: toArrayBuffer(buffer),
    };
  });
});

describe('load song', () => {
  bench(
    'reference implementation',
    () => songs.forEach(song => referenceImplementationLoad(song.stringBytes)),
    options,
  );

  bench('new implementation', () => songs.forEach(song => new AHXSong(song.arrayBuffer)), options);
});

describe('render song', () => {
  describe('single song', () => {
    bench('reference implementation', () =>
      songs.forEach(song => runGenerator(referenceImplementationDump(song.stringBytes))),
    );

    bench('new implementation', () =>
      songs.forEach(song => {
        runGenerator(newImplementationDump(song.arrayBuffer));
        resetComputedAHXWaves();
      }),
    );
  });

  describe('multiple songs', () => {
    bench('reference implementation', () =>
      songs.forEach(song => runGenerator(referenceImplementationDump(song.stringBytes))),
    );

    bench('new implementation', () =>
      songs.forEach(song => runGenerator(newImplementationDump(song.arrayBuffer))),
    );
  });
});
