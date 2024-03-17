import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
    ['03.ahx', '1b6e2e76a017ba1d50193e8746a00b5853e02baa56cc67ec1a02b3e35f0e9a95'],
    ['04.ahx', '1692a0cb59bc98ab2ac9354539e2d38e2992c38ad97dad31aeac35276be04370'],
    [
      'die audienz ist horenz.ahx',
      'b34e74704e344c064a560b513a412f106b358c90248622635d512a9cf5d92271',
    ],
    ['drums.ahx', '7eefdffe557757cd793df9e8b75d973138ef5f600a702aa412f4bab81c654156'],
    ['frame.ahx', '75b10dd78464f6a754ff13c84214b5b0407569da462559bd9ca4b71a1c5959dd'],
    //['holla 2.ahx'],// hangs
    ['loom.ahx', '73a8a2480259604d826968aa67b62dd630226c7d7ac62c7f2cabbea8ecca1118'],
    ['thxcolly-intro.ahx', '1173840ace165a5b52b03f1df3091ace73f8aea3b0848424c822920ea98e7e8f'],
    ['void.ahx', 'aff41a17588cfa099c98f25be27d19ef6ead1eadc3742431b3811d4dde5b7211'],
    ['100th.ahx', '80c4b95a0bf36fe5f45aae4a31b43b9fe735aaba1f687bd182df9d3ce3c945fa'],
    ['choochoo.ahx', '695a49a80c8795d7063e74d997e848f81b93b4b5de0a43cac612117a5a35771b'],
    ['shamrock.ahx', '121dcb52c7c88fa924ff9ba13a777f8e87479a213178ad68c51986e197cc60b5'],
  ])('it should output the same buffer values', (file, sha256) => {
    it.skip(`file: ${file}`, ({ expect }) => {
      const songBytes = readFileSync(`test-songs/${file}`);

      const binString = new DataType();
      binString.data = String.fromCharCode(...songBytes);
      const referenceSong = new ReferenceSong();
      referenceSong.InitSong(binString);
      const expected = dump(ReferenceOutput(), referenceSong);

      const song = new AHXSong(toArrayBuffer(songBytes));
      const actual = dump(new AHXOutput(), song);

      const hashedExpected = createHash('sha256').update(file);
      const hashedActual = createHash('sha256').update(file);
      for (const actualChunk of actual) {
        const expectedChunk = expected.next().value;
        expect(actualChunk).toHaveLength(expectedChunk.length);
        expect(actualChunk).toEqual(expectedChunk);
        hashedExpected.update(new Uint16Array(expectedChunk));
        hashedActual.update(new Uint16Array(actualChunk));
      }
      expect(actual.next()).toEqual({ value: undefined, done: true });
      const sha256 = hashedExpected.digest('hex');
      expect(hashedActual.digest('hex')).toBe(sha256);
      console.log(sha256); // eslint-disable-line no-console
    });

    it(`should have the same hash: ${file}`, ({ expect }) => {
      const songBytes = readFileSync(`test-songs/${file}`);
      const song = new AHXSong(toArrayBuffer(songBytes));
      const actual = dump(new AHXOutput(), song);
      const hashedActual = createHash('sha256').update(file);
      for (const actualChunk of actual) {
        hashedActual.update(new Uint16Array(actualChunk));
      }
      expect(hashedActual.digest('hex')).toBe(sha256);
    });
  });

  it.skip('should generate the same waves', () => {
    const expected = ReferenceWaves().FilterSets;
    const actual = getAHXWaves();
    expect(actual).toEqual(expected);
  });
});
