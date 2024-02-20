import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
  AHXWaves as ReferenceWaves,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong, getAHXWaves } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

describe('test AHX', () => {
  describe.concurrent.each([
    ['03.ahx'],
    ['04.ahx'],
    ['die audienz ist horenz.ahx'],
    ['drums.ahx'],
    ['frame.ahx'],
    ['holla 2.ahx'],
    ['loom.ahx'],
    ['thxcolly-intro.ahx'],
    ['void.ahx'],
  ])('it should output the same buffer values', file => {
    it(`file: ${file}`, ({ expect }) => {
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

  it('should generate the same waves', () => {
    const expected = ReferenceWaves().FilterSets;
    const actual = getAHXWaves();
    expect(actual).toEqual(expected);
  });
});
