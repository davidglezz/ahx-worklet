export const toSixtyTwo = (v: number) =>
  v < 0 ? 0
  : v > 62 ? 62
  : v;

export function readString(view: DataView, pos: number) {
  let str = '';
  while (pos < view.byteLength) {
    const byte = view.getUint8(pos++);
    if (byte === 0) break;
    str += String.fromCharCode(byte);
  }
  return str;
}

/**
 * Gets the full audio buffer for a given AHX song.
 * @param output AHXOutput-like object
 * @param song AHXSong-like object
 * @returns full audio buffer
 */
export function dump(output: any, song: any) {
  output.Player.InitSong(song);
  output.Player.InitSubsong(0);
  output.Init(48000, 16);

  const outSound = [];
  while (!output.Player.SongEndReached) {
    output.MixBuffer();
    outSound.push(...output.MixingBuffer);
  }

  return outSound;
}

export function toArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}
