import type { AHXSong } from './ahx';

export type MessageToWorklet = PositionEvent | LoadEvent;
export type MessageToNode = PositionEvent | LoadEvent | SongInfoEvent | LogEvent;

export interface LoadEvent {
  id: 'load';
  songData: ArrayBuffer;
}

/** @property value - Get/Set new position in the song. */
export interface PositionEvent {
  id: 'position';
  value: number;
}

export interface SongInfoEvent {
  id: 'songInfo';
  songInfo: AHXSong;
}

export interface LogEvent {
  id: 'log';
  severity: 'info' | 'warn' | 'error';
  message: string;
}
