export interface AHXEnvelope {
  aFrames: number;
  aVolume: number;
  dFrames: number;
  dVolume: number;
  sFrames: number;
  rFrames: number;
  rVolume: number;
}

export interface AHXInstrument {
  Name: string;
  Volume: number;
  WaveLength: number;
  Envelope: AHXEnvelope;
  FilterLowerLimit: number;
  FilterUpperLimit: number;
  FilterSpeed: number;
  SquareLowerLimit: number;
  SquareUpperLimit: number;
  SquareSpeed: number;
  VibratoDelay: number;
  VibratoDepth: number;
  VibratoSpeed: number;
  HardCutRelease: number;
  HardCutReleaseFrames: number;
  PList: AHXPList;
}

export interface FilterWaveform {
  Sawtooth04: number[];
  Sawtooth08: number[];
  Sawtooth10: number[];
  Sawtooth20: number[];
  Sawtooth40: number[];
  Sawtooth80: number[];
  Triangle04: number[];
  Triangle08: number[];
  Triangle10: number[];
  Triangle20: number[];
  Triangle40: number[];
  Triangle80: number[];
  Squares: number[];
  WhiteNoiseBig: number[];
}

export type AHXWaves = FilterWaveform[];

export interface AHXPosition {
  Track: number[];
  Transpose: number[];
}


export interface AHXStep {
  Note: number;
  Instrument: number;
  FX: number;
  FXParam: number;
}

export type AHXTrack = AHXStep[];


export interface AHXPlistEntry {
  Note: number;
  Fixed: number;
  Waveform: number;
  FX: [number, number];
  FXParam: [number, number];
}

export interface AHXPList {
  Speed: number;
  Length: number;
  Entries: AHXPlistEntry[];
}
