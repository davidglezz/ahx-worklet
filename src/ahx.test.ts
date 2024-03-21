import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
  AHXWaves as ReferenceWaves,
  // @ts-expect-error - no types
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong, Waveform, getAHXWaves } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

describe('test AHX', () => {
  describe.concurrent.each([
    ['03', 'ec1a9656abfd3c63816a4498bc25974804995480916f19828a350b6375ea669b'],
    ['04', '7f85de43ae56372c73365d1db21bea41870a3bb769ca39533bd84b700cdbbc93'],
    ['die audienz ist horenz', 'f879c46cdc1989d0cf60278d7b38a0b2fc34cdf91848952708915c68a13a4385'],
    ['drums', '418c0160b5463cc44d1829713a44405768cca271f397d5f97f95621a48f0e21f'],
    ['frame', '6d278655b96751026a9c2c6b59002a2854d3878a4af6860b0da68e2c5151880c'],
    //['holla 2'],// hangs
    ['loom', '540b1159e05c81cd84bd56f7c0656b32c57dea998b57968c25ce14259694b0b3'],
    ['thxcolly-intro', '5ab97f815c72007b2eb940bbff28bb9c7a9b3d67b4639677057a043407317f34'],
    ['void', 'a3191a324369a0e39b2321eb0800c6eef7fcb0ed4ffaa826004493433534e8de'],
    ['100th', 'bdddc915e3dba2ed1e1daa3c3e65762d1432a8f0f6e8bdaf9f244d441188bf7d'],
    ['choochoo', '7b2810faa33367a248c537116c9c1a94ff31f9a34b7b793b03f746ec6a468564'],
    ['shamrock', '1b22ffb4057ef478bcd625cf492b8ebb9f7992699a1a73d2f0bacca40c5c6f71'],
  ])('%s', (file, sha256) => {
    it.skip(`genrerate and compare hash`, ({ expect }) => {
      const songBytes = readFileSync(`test-songs/${file}.ahx`);

      const binString = new DataType();
      binString.data = String.fromCharCode(...songBytes);
      const referenceSong = new ReferenceSong();
      referenceSong.InitSong(binString);
      const expected = [...dump(ReferenceOutput(), referenceSong)].flat();

      const song = new AHXSong(toArrayBuffer(songBytes));
      const actual = [...dump(new AHXOutput(), song)].flat();

      expect(actual).toHaveLength(expected.length);
      expect(actual).toEqual(expected);

      const hashedExpected = createHash('sha256').update(new Uint16Array(expected)).digest('hex');
      const hashedActual = createHash('sha256').update(new Uint16Array(actual)).digest('hex');

      expect(hashedActual).toBe(hashedExpected);
      console.log(hashedExpected); // eslint-disable-line no-console
    });

    it.skip(`progressive compare`, ({ expect }) => {
      const songBytes = readFileSync(`test-songs/${file}.ahx`);

      const binString = new DataType();
      binString.data = String.fromCharCode(...songBytes);
      const referenceSong = new ReferenceSong();
      referenceSong.InitSong(binString);
      const expected = dump(ReferenceOutput(), referenceSong);

      const song = new AHXSong(toArrayBuffer(songBytes));
      const actual = dump(new AHXOutput(), song);

      for (const expectedChunk of expected) {
        let actualChunk = actual.next().value;
        if (song.SpeedMultiplier > 1) actualChunk = actualChunk.concat(actual.next().value);
        if (song.SpeedMultiplier > 2) actualChunk = actualChunk.concat(actual.next().value);
        if (song.SpeedMultiplier > 3) actualChunk = actualChunk.concat(actual.next().value);
        expect(actualChunk).toHaveLength(expectedChunk.length);
        expect(actualChunk).toEqual(expectedChunk);
      }
      expect(actual.next()).toEqual({ value: undefined, done: true });
    });

    it(`should have the same hash`, ({ expect }) => {
      const songBytes = readFileSync(`test-songs/${file}.ahx`);
      const song = new AHXSong(toArrayBuffer(songBytes));
      const actual = dump(new AHXOutput(), song);
      const hashedActual = createHash('sha256');
      for (const actualChunk of actual) {
        hashedActual.update(new Uint16Array(actualChunk));
      }
      expect(hashedActual.digest('hex')).toBe(sha256);
    });
  });

  describe('should generate the same waves', () => {
    const filterSets = [...Array.from({ length: 31 + 1 + 31 }).keys()];
    const filterLengths = { '04': 0, '08': 1, '10': 2, '20': 3, '40': 4, '80': 5 };
    const filterLengthsKeys = Object.keys(filterLengths) as (keyof typeof filterLengths)[];
    let referenceWaves: ReturnType<typeof ReferenceWaves>;
    let actualWaves: ReturnType<typeof getAHXWaves>;
    beforeAll(() => {
      referenceWaves = ReferenceWaves();
      actualWaves = getAHXWaves();
    });

    describe.each(filterSets)('filterSet %i', (i: number) => {
      it.each(filterLengthsKeys)('triangle%s', length => {
        const expected = referenceWaves.FilterSets[i][`Triangle${length}`];
        const actual = actualWaves[i][Waveform.TRIANGLE][filterLengths[length]];
        expect(actual).toEqual(expected);
      });

      it.each(filterLengthsKeys)('sawtooth%s', length => {
        const expected = referenceWaves.FilterSets[i][`Sawtooth${length}`];
        const actual = actualWaves[i][Waveform.SAWTOOTH][filterLengths[length]];
        expect(actual).toEqual(expected);
      });

      it('square', () => {
        const expected = referenceWaves.FilterSets[i].Squares;
        const actual = actualWaves[i][Waveform.SQUARE];
        expect(actual).toEqual(expected);
      });

      it('noise', () => {
        const expected = referenceWaves.FilterSets[i].WhiteNoiseBig;
        const actual = actualWaves[i][Waveform.WNOISE];
        expect(actual).toEqual(expected);
      });
    });
  });
});
