import type { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dataType as DataType,
  AHXOutput as ReferenceOutput,
  AHXSong as ReferenceSong,
} from './ahx.reference-implementation.js';
import { AHXOutput, AHXSong } from './ahx.ts';
import { dump, toArrayBuffer } from './utils.ts';

describe('ahx', () => {
  it('should output the same buffer values', async () => {
    //const songBytes = readFileSync('../songs/Galassir/saul the lawyer.ahx');
    const songBytes = readFileSync('../songs/Xeron/thxcolly-intro.ahx');

    const binString = new DataType();
    binString.data = String.fromCharCode(...songBytes);
    const referenceSong = new ReferenceSong();
    referenceSong.InitSong(binString);
    const expected = dump(ReferenceOutput(), referenceSong);

    const song = new AHXSong(toArrayBuffer(songBytes));
    const actual = dump(new AHXOutput(), song);

    expect(JSON.stringify(song)).toEqual(JSON.stringify(referenceSong));
    expect(actual).toEqual(expected);
  });
});
