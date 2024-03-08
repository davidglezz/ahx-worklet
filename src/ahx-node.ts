import type { EventType, LoadEvent, PositionEvent } from './types.ts';

type EventListeners = {
  [K in EventType['id']]?: (event: Extract<EventType, { id: K }>) => void;
};

export class AHXNode extends AudioWorkletNode {
  eventListeners: EventListeners;
  constructor(context: AudioContext, eventListeners: EventListeners) {
    super(context, 'ahx', {
      outputChannelCount: [2],
      numberOfInputs: 0,
      numberOfOutputs: 1,
    });
    this.eventListeners = eventListeners;
    this.port.onmessage = ({ data }: MessageEvent<EventType>) =>
      this.eventListeners[data.id]?.(data);
  }

  load(songData: ArrayBuffer) {
    this.port.postMessage({ id: 'load', songData } satisfies LoadEvent);
  }

  setPosition(value: number) {
    this.port.postMessage({ id: 'position', value } satisfies PositionEvent);
  }
}
