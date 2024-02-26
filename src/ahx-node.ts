export class AHXNode extends AudioWorkletNode {
  constructor(context: AudioContext) {
    super(context, 'ahx', {
      outputChannelCount: [2],
      numberOfInputs: 0,
      numberOfOutputs: 1,
    });
  }
  load(songData: ArrayBuffer) {
    this.port.postMessage({ id: 'songData', songData });
  }
}
