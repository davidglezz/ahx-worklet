export type MessageToWorklet = PositionEvent | LoadEvent;
export type MessageToNode = PositionEvent | LoadEvent;

export interface LoadEvent {
  id: 'load';
  songData: ArrayBuffer;
}

/** @property value - Get/Set new position in the song. */
export interface PositionEvent {
  id: 'position';
  value: number;
}
