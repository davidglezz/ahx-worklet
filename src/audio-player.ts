import { AHXNode } from './ahx-node.ts';
import AHXProcessor from './ahx-worklet.ts?worker&url';
import type { AHXSong } from './ahx.ts';

export interface EventMap {
  statechange: AudioContext;
  songInfo: SongInfoEvent;
  position: PositionEvent;
  log: LogEvent;
  ready: CustomEvent;
}

export class AudioPlayer extends EventTarget {
  public context: AudioContext;
  protected gainNode: GainNode;
  protected playerNode!: AHXNode;

  constructor() {
    super();
    this.context = new AudioContext();
    if (this.context.state === 'running') {
      this.context.suspend();
    }
    this.gainNode = this.context.createGain();
    this.gainNode.connect(this.context.destination);

    this.context.audioWorklet.addModule(AHXProcessor).then(() => {
      this.playerNode = new AHXNode(this.context);
      this.playerNode.on('position', ({ detail }) => {
        this.dispatchEvent(new PositionEvent(detail.value));
      });
      this.playerNode.on('songInfo', ({ detail }) => {
        this.dispatchEvent(new SongInfoEvent(detail.songInfo));
      });
      this.playerNode.on('log', ({ detail: { severity, message } }) => {
        this.dispatchEvent(new LogEvent(severity, message));
      });
      this.playerNode.connect(this.gainNode);
      this.dispatchEvent(new CustomEvent('ready'));
    });
  }

  on<K extends keyof EventMap>(id: K, callback: (event: EventMap[K]) => void) {
    if (id === 'statechange') {
      this.context.addEventListener('statechange', () => callback(this.context as any));
    } else {
      this.addEventListener(id, callback as EventListener);
    }
  }

  async setVolume(value: number) {
    this.gainNode.gain.value = value;
  }

  async play(url = '') {
    if (url) {
      await this.load(url);
    }

    if (this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  async pause() {
    await this.context.suspend();
  }

  async togglePlay() {
    if (this.context.state !== 'running') {
      await this.play();
    } else {
      await this.pause();
    }
  }

  async load(url: string) {
    const songData = await this.download(url);
    await this.playerNode?.load(songData);
  }

  setPosition(value: number) {
    this.playerNode.setPosition(value);
  }

  connectVisualizer(visualizer: AudioNode) {
    this.playerNode.disconnect(this.gainNode);
    this.playerNode.connect(visualizer);
    visualizer.connect(this.gainNode);
  }

  protected async download(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.statusText} (${response.status})`);
    }
    return await response.arrayBuffer();
  }
}

export class PositionEvent extends Event {
  constructor(readonly value: number) {
    super('position');
  }
}

export class SongInfoEvent extends Event {
  constructor(readonly songInfo: AHXSong) {
    super('songInfo');
  }
}

export class LogEvent extends Event {
  constructor(
    readonly severity: 'info' | 'warn' | 'error',
    readonly message: string,
  ) {
    super('log');
  }
}
