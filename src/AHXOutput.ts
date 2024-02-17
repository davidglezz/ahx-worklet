import { AHXPlayer } from './AHXPlayer.ts';

export class AHXOutput {
  pos = [0, 0, 0, 0];
  Frequency = 0;
  Bits = 0;
  BufferSize = 0;
  MixingBuffer: number[] = [];

  constructor(public Player = new AHXPlayer()) {}

  Init(Frequency: number, Bits: number) {
    this.Frequency = Frequency;
    this.Bits = Bits;
    this.BufferSize = Math.floor(Frequency / 50);
    this.MixingBuffer = Array.from({ length: this.BufferSize });
  }

  MixChunk(NrSamples: number, mb: number) {
    for (let v = 0; v < 4; v++) {
      if (this.Player.Voices[v].VoiceVolume === 0) continue;
      const freq = 3579545.25 / this.Player.Voices[v].VoicePeriod; // #define Period2Freq(period) (3579545.25f / (period))
      const delta = Math.floor((freq * (1 << 16)) / this.Frequency);
      let samples_to_mix = NrSamples;
      let mixpos = 0;
      while (samples_to_mix) {
        if (this.pos[v] >= 0x280 << 16) this.pos[v] -= 0x280 << 16;
        const thiscount = Math.min(
          samples_to_mix,
          Math.floor(((0x280 << 16) - this.pos[v] - 1) / delta) + 1,
        );
        samples_to_mix -= thiscount;
        for (let i = 0; i < thiscount; i++) {
          this.MixingBuffer[mb + mixpos++] +=
            (this.Player.Voices[v].VoiceBuffer[this.pos[v] >> 16] *
              this.Player.Voices[v].VoiceVolume) >>
            6;
          this.pos[v] += delta;
        }
      }
    }
    mb += NrSamples;
    return mb;
  }

  MixBuffer() {
    // Output: 1 amiga(50hz)-frame of audio data
    this.MixingBuffer.fill(0);

    let mb = 0;
    const NrSamples = Math.floor(this.BufferSize / this.Player.Song.SpeedMultiplier);
    for (let f = 0; f < this.Player.Song.SpeedMultiplier; f++) {
      this.Player.PlayIRQ();
      mb = this.MixChunk(NrSamples, mb);
    }
  }
}
