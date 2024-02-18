import type { AHXEnvelope, AHXPList, AHXInstrument } from './types.ts';

export class AHXVoice {
  // Read those variables for mixing!
  VoiceVolume = 0;
  VoicePeriod = 0;
  VoiceBuffer: number[] = []; //char VoiceBuffer[0x281]; // for oversampling optimization!

  Track = 0;
  Transpose = 0;
  NextTrack = 0;
  NextTranspose = 0;
  ADSRVolume = 0; // fixed point 8 =8
  ADSR: AHXEnvelope = {
    aFrames: 0,
    aVolume: 0,
    dFrames: 0,
    dVolume: 0,
    sFrames: 0,
    rFrames: 0,
    rVolume: 0,
  };
  Instrument!: AHXInstrument; // current instrument
  InstrPeriod = 0;
  TrackPeriod = 0;
  VibratoPeriod = 0;
  NoteMaxVolume = 0;
  PerfSubVolume = 0;
  TrackMasterVolume = 0x40;
  NewWaveform = 0;
  Waveform = 0;
  PlantSquare = 0;
  PlantPeriod = 0;
  IgnoreSquare = 0;
  TrackOn = 1;
  FixedNote = 0;
  VolumeSlideUp = 0;
  VolumeSlideDown = 0;
  HardCut = 0;
  HardCutRelease = 0;
  HardCutReleaseF = 0;
  PeriodSlideSpeed = 0;
  PeriodSlidePeriod = 0;
  PeriodSlideLimit = 0;
  PeriodSlideOn = 0;
  PeriodSlideWithLimit = 0;
  PeriodPerfSlideSpeed = 0;
  PeriodPerfSlidePeriod = 0;
  PeriodPerfSlideOn = 0;
  VibratoDelay = 0;
  VibratoCurrent = 0;
  VibratoDepth = 0;
  VibratoSpeed = 0;
  SquareOn = 0;
  SquareInit = 0;
  SquareWait = 0;
  SquareLowerLimit = 0;
  SquareUpperLimit = 0;
  SquarePos = 0;
  SquareSign = 0;
  SquareSlidingIn = 0;
  SquareReverse = 0;
  FilterOn = 0;
  FilterInit = 0;
  FilterWait = 0;
  FilterLowerLimit = 0;
  FilterUpperLimit = 0;
  FilterPos = 0;
  FilterSign = 0;
  FilterSpeed = 0;
  FilterSlidingIn = 0;
  IgnoreFilter = 0;
  PerfCurrent = 0;
  PerfSpeed = 0;
  PerfWait = 0;
  WaveLength = 0;
  PerfList!: AHXPList;
  NoteDelayWait = 0;
  NoteDelayOn = 0;
  NoteCutWait = 0;
  NoteCutOn = 0;
  AudioSource: number[] = [];
  AudioPeriod = 0;
  AudioVolume = 0;
  //SquareTempBuffer: new Array(0x80), //char SquareTempBuffer[0x80]: 0,

  CalcADSR() {
    this.ADSR.aFrames = this.Instrument.Envelope.aFrames;
    this.ADSR.aVolume = (this.Instrument.Envelope.aVolume * 256) / this.ADSR.aFrames;
    this.ADSR.dFrames = this.Instrument.Envelope.dFrames;
    this.ADSR.dVolume =
      ((this.Instrument.Envelope.dVolume - this.Instrument.Envelope.aVolume) * 256) /
      this.ADSR.dFrames;
    this.ADSR.sFrames = this.Instrument.Envelope.sFrames;
    this.ADSR.rFrames = this.Instrument.Envelope.rFrames;
    this.ADSR.rVolume =
      ((this.Instrument.Envelope.rVolume - this.Instrument.Envelope.dVolume) * 256) /
      this.ADSR.rFrames;
  }
}
