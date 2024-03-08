import type { LoadEvent, MessageToNode, PositionEvent } from './types.ts';

type EventListeners = {
  [K in MessageToNode['id']]?: (event: Extract<MessageToNode, { id: K }>) => void;
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
    this.port.onmessage = ({ data }: MessageEvent<MessageToNode>) =>
      this.eventListeners[data.id]?.(data);
  }

  load(songData: ArrayBuffer) {
    this.port.postMessage({ id: 'load', songData } satisfies LoadEvent);
  }

  setPosition(value: number) {
    this.port.postMessage({ id: 'position', value } satisfies PositionEvent);
  }
}
