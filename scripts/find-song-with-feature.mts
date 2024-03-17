import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AHXSong } from '../src/ahx.ts';
import { toArrayBuffer } from '../src/utils.ts';

async function getFiles(dir) {
  const files = await readdir(dir, { recursive: true, withFileTypes: true });
  return files
    .filter(f => f.isFile() && !f.name.endsWith('.DS_Store'))
    .map(f => resolve(dir, f.path, f.name));
}

// Find song with SpeedMultiplier other than 1
const files = await getFiles('../songs');
console.log(files);
for (const file of files) {
  try {
    const songBytes = await readFile(file);
    const song = new AHXSong(toArrayBuffer(songBytes));
    if (song.SpeedMultiplier > 1) {
      console.log(song.SpeedMultiplier, songBytes.length, file);
    }
  } catch (e) {
    console.error(file, e);
    continue;
  }
}
