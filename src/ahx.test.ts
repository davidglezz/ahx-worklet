import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

describe('AHX', () => {
  describe.concurrent.each([
    //['03.ahx'],
    //['04.ahx'],
    ['die audienz ist horenz.ahx'], // Fail
    //['drums.ahx'],
    //['frame.ahx'],
    //['holla 2.ahx'], // Fail
    //['loom.ahx'],
    //['thxcolly-intro.ahx'],
    //['void.ahx'],
  ])('It should output the same buffer values', file => {
    it(`File: ${file}`, ({ expect }) => {
      const songBytes = readFileSync(`test-songs/${file}`);

      const binString = new DataType();
      binString.data = String.fromCharCode(...songBytes);
      const referenceSong = new ReferenceSong();
      referenceSong.InitSong(binString);
      const expected = dump(ReferenceOutput(), referenceSong);

      const song = new AHXSong(toArrayBuffer(songBytes));
      const actual = dump(new AHXOutput(), song);

      expect(JSON.stringify(song, null, 2)).toEqual(JSON.stringify(referenceSong, null, 2));
      for (const expectedChunk of expected) {
        const actualChunk = actual.next().value;
        expect(actualChunk).toHaveLength(expectedChunk.length);
        expect(actualChunk).toEqual(expectedChunk);
      }
      expect(actual.next()).toEqual({ value: undefined, done: true });
    });
  });
});
