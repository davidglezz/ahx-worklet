/**
 * Gets the full audio buffer for a given AHX song.
 * @param output AHXOutput-like object
 * @param song AHXSong-like object
 * @returns full audio buffer
 */
export function* dump(output: any, song: any) {
  output.Player.InitSong(song);
  if (output.Init) {
    output.Player.InitSubsong(0);
    output.Init(48000, 16);
  }
  while (!output.Player.SongEndReached) {
    output.MixBuffer();
    yield output.MixingBuffer.slice(0, output.BufferSize);
  }
}

export function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
