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
