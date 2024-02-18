import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

describe('AHX: It should output the same buffer values', () => {
  it.each([
    // ['03.ahx'], // Fail
    // ['04.ahx'], // Fail
    // ['die audienz ist horenz.ahx'], // Fail
    //['drums.ahx'],
    ['frame.ahx'],  // Fail
    // ['holla 2.ahx'], // Fail
    //['loom.ahx'],
    //['thxcolly-intro.ahx'],
    //['void.ahx'],
  ])('File %s', file => {
    const songBytes = readFileSync(`test-songs/${file}`);

    const binString = new DataType();
    binString.data = String.fromCharCode(...songBytes);
    const referenceSong = new ReferenceSong();
    referenceSong.InitSong(binString);
    const expected = dump(ReferenceOutput(), referenceSong);

    const song = new AHXSong(toArrayBuffer(songBytes));
    const actual = dump(new AHXOutput(), song);

    //expect(JSON.stringify(song, null, 2)).toEqual(JSON.stringify(referenceSong, null, 2));
    expect(actual.length).toBe(expected.length);
    expect(actual).toEqual(expected);
  });
});
