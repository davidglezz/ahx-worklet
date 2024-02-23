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

// eslint-disable-next-line no-restricted-syntax
const enum Waveform {
  TRIANGLE = 0,
  SAWTOOTH = 1,
  SQUARE = 2,
  WNOISE = 3,
}

export type AHXWaves = [
  Triangle: [
    len04: number[],
    len08: number[],
    len10: number[],
    len20: number[],
    len40: number[],
    len80: number[],
  ],
  Sawtooth: [
    len04: number[],
    len08: number[],
    len10: number[],
    len20: number[],
    len40: number[],
    len80: number[],
  ],
  Squares: number[],
  WhiteNoiseBig: number[],
][];

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
  Waveform: Waveform;
  FX: [number, number];
  FXParam: [number, number];
}

export interface AHXPList {
  Speed: number;
  Length: number;
  Entries: AHXPlistEntry[];
}

const clamp = (v: number, min: number, max: number) =>
  v < min ? min
  : v > max ? max
  : v;
const toSixtyTwo = (v: number) => clamp(v, 0, 62);

export function readString(view: DataView, pos: number) {
  let str = '';
  while (pos < view.byteLength) {
    const byte = view.getUint8(pos++);
    if (byte === 0) break;
    str += String.fromCharCode(byte);
  }
  return str;
}

export class AHXSong {
  Name: string;
  Restart: number;
  PositionNr: number;
  TrackLength: number;
  TrackNr: number;
  InstrumentNr: number;
  SubsongNr: number;
  Revision: number;
  SpeedMultiplier: number;
  Positions: AHXPosition[];
  Tracks: AHXTrack[];
  Instruments: AHXInstrument[];
  Subsongs: number[];

  static async LoadSong(url: string) {
    const buffer = await fetch(url).then(response => response.arrayBuffer());
    return new AHXSong(buffer);
  }

  constructor(buffer: ArrayBuffer) {
    const view = new DataView(buffer);

    // Validate
    if (view.getUint8(0) !== 0x54 || view.getUint8(1) !== 0x48 || view.getUint8(2) !== 0x58) {
      throw new Error('Invalid AHX file.');
    }

    this.Revision = view.getUint8(3);
    let SBPtr = 14;

    // Header ////////////////////////////////////////////
    let NamePtr = view.getUint16(4);
    this.Name = readString(view, NamePtr);
    NamePtr += this.Name.length + 1;
    this.SpeedMultiplier = ((view.getUint8(6) >> 5) & 3) + 1;

    this.PositionNr = ((view.getUint8(6) & 0xf) << 8) | view.getUint8(7);
    this.Restart = (view.getUint8(8) << 8) | view.getUint8(9);
    this.TrackLength = view.getUint8(10);
    this.TrackNr = view.getUint8(11);
    this.InstrumentNr = view.getUint8(12);
    this.SubsongNr = view.getUint8(13);

    // Subsongs //////////////////////////////////////////
    this.Subsongs = Array.from(
      { length: this.SubsongNr },
      () => (view.getUint8(SBPtr++) << 8) | view.getUint8(SBPtr++),
    );

    // Position List /////////////////////////////////////
    this.Positions = Array.from({ length: this.PositionNr }, () => {
      const Pos: AHXPosition = { Track: [], Transpose: [] };
      for (let j = 0; j < 4; j++) {
        Pos.Track.push(view.getUint8(SBPtr++));
        Pos.Transpose.push(view.getInt8(SBPtr++));
      }
      return Pos;
    });

    // Tracks ////////////////////////////////////////////
    this.Tracks = Array.from({ length: this.TrackNr + 1 }, (_, i) => {
      const Track: AHXTrack = Array.from({ length: this.TrackLength });
      if (i === 0 && (view.getUint8(6) & 0x80) === 0x80) {
        // empty track
        Track.fill({ Note: 0, Instrument: 0, FX: 0, FXParam: 0 });
      } else {
        for (let j = 0; j < this.TrackLength; j++) {
          Track[j] = {
            Note: (view.getUint8(SBPtr) >> 2) & 0x3f,
            Instrument: ((view.getUint8(SBPtr) & 0x3) << 4) | (view.getUint8(SBPtr + 1) >> 4),
            FX: view.getUint8(SBPtr + 1) & 0xf,
            FXParam: view.getUint8(SBPtr + 2),
          };
          SBPtr += 3;
        }
      }
      return Track;
    });

    // Instruments ///////////////////////////////////////
    this.Instruments = Array.from({ length: this.InstrumentNr });
    // Empty instrument
    this.Instruments[0] = {
      Name: '',
      Volume: 0,
      WaveLength: 0,
      Envelope: {
        aFrames: 0,
        aVolume: 0,
        dFrames: 0,
        dVolume: 0,
        sFrames: 0,
        rFrames: 0,
        rVolume: 0,
      },
      FilterLowerLimit: 0,
      FilterUpperLimit: 0,
      FilterSpeed: 0,
      SquareLowerLimit: 0,
      SquareUpperLimit: 0,
      SquareSpeed: 0,
      VibratoDelay: 0,
      VibratoDepth: 0,
      VibratoSpeed: 0,
      HardCutRelease: 0,
      HardCutReleaseFrames: 0,
      PList: { Speed: 0, Length: 0, Entries: [] },
    };

    for (let i = 1; i < this.InstrumentNr + 1; i++) {
      const Instrument: AHXInstrument = {
        Name: readString(view, NamePtr),
        Volume: view.getUint8(SBPtr + 0),
        WaveLength: view.getUint8(SBPtr + 1) & 0x7,
        Envelope: {
          aFrames: view.getUint8(SBPtr + 2),
          aVolume: view.getUint8(SBPtr + 3),
          dFrames: view.getUint8(SBPtr + 4),
          dVolume: view.getUint8(SBPtr + 5),
          sFrames: view.getUint8(SBPtr + 6),
          rFrames: view.getUint8(SBPtr + 7),
          rVolume: view.getUint8(SBPtr + 8),
        },
        FilterLowerLimit: view.getUint8(SBPtr + 12) & 0x7f,
        FilterUpperLimit: view.getUint8(SBPtr + 19) & 0x3f,
        FilterSpeed:
          ((view.getUint8(SBPtr + 1) >> 3) & 0x1f) | ((view.getUint8(SBPtr + 12) >> 2) & 0x20),
        SquareLowerLimit: view.getUint8(SBPtr + 16),
        SquareUpperLimit: view.getUint8(SBPtr + 17),
        SquareSpeed: view.getUint8(SBPtr + 18),
        VibratoDelay: view.getUint8(SBPtr + 13),
        VibratoDepth: view.getUint8(SBPtr + 14) & 0xf,
        VibratoSpeed: view.getUint8(SBPtr + 15),
        HardCutRelease: view.getUint8(SBPtr + 14) & 0x80 ? 1 : 0,
        HardCutReleaseFrames: (view.getUint8(SBPtr + 14) >> 4) & 7,
        PList: {
          Speed: view.getUint8(SBPtr + 20),
          Length: view.getUint8(SBPtr + 21),
          Entries: [],
        },
      };
      NamePtr += Instrument.Name.length + 1;
      SBPtr += 22;

      for (let j = 0; j < Instrument.PList.Length; j++) {
        const byte0 = view.getUint8(SBPtr++);
        const byte1 = view.getUint8(SBPtr++);
        const byte2 = view.getUint8(SBPtr++);
        const byte3 = view.getUint8(SBPtr++);

        const Entry: AHXPlistEntry = {
          Note: byte1 & 0x3f,
          Fixed: (byte1 >> 6) & 1,
          Waveform: ((byte0 << 1) & 6) | (byte1 >> 7),
          FX: [(byte0 >> 2) & 7, (byte0 >> 5) & 7],
          FXParam: [byte2, byte3],
        };
        Instrument.PList.Entries.push(Entry);
      }
      this.Instruments[i] = Instrument;
    }
  }
}

export class AHXVoice {
  number: number;
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
  Waveform: Waveform = 0;
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

  constructor(number: number) {
    this.number = number;
  }

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

let computedAHXWaves: AHXWaves | undefined;
export function getAHXWaves(): AHXWaves {
  if (!computedAHXWaves) {
    computedAHXWaves = buildAHXWaves();
    Object.freeze(computedAHXWaves);
  }
  return computedAHXWaves;
}

export function resetComputedAHXWaves() {
  computedAHXWaves = undefined;
}

export function buildAHXWaves() {
  const filterSets: AHXWaves = Array.from({ length: 31 + 1 + 31 });
  filterSets[31] = [
    [
      GenerateTriangle(0x04),
      GenerateTriangle(0x08),
      GenerateTriangle(0x10),
      GenerateTriangle(0x20),
      GenerateTriangle(0x40),
      GenerateTriangle(0x80),
    ],
    [
      GenerateSawtooth(0x04),
      GenerateSawtooth(0x08),
      GenerateSawtooth(0x10),
      GenerateSawtooth(0x20),
      GenerateSawtooth(0x40),
      GenerateSawtooth(0x80),
    ],
    GenerateSquare(),
    GenerateWhiteNoise(0x280 * 3),
  ];
  GenerateFilterWaveforms(filterSets);
  return filterSets;
}

function GenerateTriangle(Len: number) {
  const Buffer: number[] = [];
  const d2 = Len;
  const d5 = d2 >> 2;
  const d1 = 128 / d5;
  const d4 = -(d2 >> 1);
  let eax = 0;
  for (let ecx = 0; ecx < d5; ecx++) {
    Buffer.push(eax);
    eax += d1;
  }
  Buffer.push(0x7f);
  if (d5 !== 1) {
    eax = 128;
    for (let ecx = 0; ecx < d5 - 1; ecx++) {
      eax -= d1;
      Buffer.push(eax);
    }
  }
  let esi = Buffer.length + d4;
  for (let ecx = 0; ecx < d5 * 2; ecx++) {
    let neu = Buffer[esi++];
    if (neu === 0x7f) neu = -0x80;
    else neu = -neu;
    Buffer.push(neu);
  }
  return Buffer;
}

function GenerateSquare() {
  const Buffer = [];
  for (let ebx = 1; ebx <= 0x20; ebx++) {
    for (let ecx = 0; ecx < (0x40 - ebx) * 2; ecx++) Buffer.push(-0x80);
    for (let ecx = 0; ecx < ebx * 2; ecx++) Buffer.push(0x7f);
  }
  return Buffer;
}

function GenerateSawtooth(Len: number) {
  const Buffer = [];
  const ebx = Math.floor(256 / (Len - 1));
  let eax = -128;
  for (let ecx = 0; ecx < Len; ecx++) {
    Buffer.push(eax);
    eax += ebx;
  }
  return Buffer;
}

function GenerateWhiteNoise(Len: number) {
  const noise = [
    127, 127, -88, -30, 120, 62, 44, -110, 82, -43, -128, -128, -85, -128, 127, 55, 127, 127, 21,
    59, -68, 102, -13, 127, -128, -128, -128, -128, 66, -27, -8, -128, 127, 127, 38, 127, -128,
    -105, -128, 95, -89, 127, -128, -128, -128, 127, 127, 127, -50, 121, -116, -128, 74, 127, -128,
    22, 127, 127, -128, -128, 9, -15, -128, -107, 120, 120, 127, -72, -30, 82, 127, 8, -109, 127,
    127, -128, -5, -88, 68, -27, -54, 9, 127, -128, 127, -128, -53, -128, 127, -9, -128, -128, -73,
    127, 91, -128, 59, 20, -49, -128, 127, -128, 22, 31, 103, -95, 98, 113, 113, -89, 127, 68, 65,
    -128, 127, -51, 65, 67, 75, -13, -128, -57, -33, -33, -43, 39, 31, 31, -97, 54, 36, 115, 113,
    127, -128, 127, 121, 66, 127, 127, -128, -128, -128, 46, 34, 127, -14, 70, -128, -128, -76, -46,
    53, 46, -128, -113, -75, -68, -128, 56, -14, 127, 16, 45, 127, 127, 38, -111, 127, -16, 127,
    -33, 43, 127, -128, 62, 127, 127, -128, -128, -85, -82, 127, -54, -128, -128, -13, -70, 52,
    -128, -128, 127, 127, -128, 62, 102, -128, 23, -128, -85, -128, 9, -13, 127, 41, -128, -60, 127,
    -128, -45, 127, -70, -128, 127, -128, -99, 127, -128, 56, -128, 127, 127, 127, 105, 127, 127,
    21, 79, -128, 124, -116, 27, 127, 127, -128, -128, 112, 43, -128, 127, 90, -63, 127, -128, 127,
    69, -69, -128, 127, -9, -50, -128, -128, -128, -38, -99, 127, -128, 127, -70, -30, 2, -128,
    -107, -70, -128, -6, -2, -128, -76, -128, -128, -120, 127, 127, 18, -128, -128, 14, -101, -128,
    -128, 79, -55, 43, -128, 119, -75, 127, 81, 127, 127, 127, 127, -128, 127, -15, -128, 49, -26,
    -128, 127, -128, -91, -128, 127, -54, 127, 37, -128, -110, -76, 127, -128, -105, 127, 127, -108,
    32, 27, 59, 127, -18, -54, -128, -128, 66, -128, -128, -93, -128, -59, -15, -128, 127, 127, 127,
    81, -81, 127, 53, 66, -128, 127, -15, -128, -59, 127, 127, 127, -128, 40, 127, -77, 44, 44, -22,
    127, 127, -128, 127, 33, -87, 127, 52, 127, -82, 30, -59, -65, -82, 127, -117, 55, 127, 13,
    -128, 115, 35, -69, -128, -128, -58, -128, -74, -128, 127, -128, -128, 127, 127, -128, 33, 127,
    32, 69, -89, -54, 127, -128, -128, -128, 61, 127, 21, 69, -13, -40, -117, -101, -50, 85, -128,
    -128, 127, -67, -50, 127, 54, -128, 127, -65, 98, 35, 7, 37, -15, -54, 89, 127, -86, 127, 127,
    71, -109, -128, 27, 33, -128, -101, -54, -128, 45, -128, -104, 127, 127, 127, -18, -128, -128,
    -128, 127, 32, 59, -128, 60, 34, -49, 127, -128, -128, 89, -99, 127, 42, 127, -128, 124, -128,
    -45, 33, -128, -89, 127, 127, -128, 9, 61, 127, 127, -82, -128, -89, -128, 127, 115, 5, 61,
    -128, 127, 127, 127, 38, 59, 127, -10, -128, 127, 94, 71, -33, -128, 124, 54, 54, 127, -1, -68,
    -68, -68, 127, 127, 127, -128, -128, 77, 33, 127, 127, 127, 65, 77, -128, 127, 127, -128, -64,
    -81, 44, 127, 23, 53, -128, -128, 127, -16, 60, 18, -121, 127, -128, -128, 19, 115, 45, 62,
    -128, 127, -128, -90, -40, 25, -128, 127, 39, -128, 127, -128, 127, -128, 127, 35, -128, 77,
    -128, 127, 127, -119, 127, -128, -75, 74, 23, -81, -120, -107, -128, 112, 119, -105, 127, -128,
    -128, 34, -101, 2, 47, -128, -128, -104, 127, 127, 18, 45, 40, -50, -81, -112, 88, -23, 26, 113,
    47, 92, 127, -128, 127, 127, -128, 127, 71, -51, -81, 44, 6, -128, 47, -128, -24, -128, 46, 88,
    17, -41, -83, 88, 67, 23, -97, 112, -61, -128, 112, 25, -61, 55, 46, 66, -128, 44, -68, -128,
    127, 127, 127, 16, 69, 45, 62, 62, -112, -128, -90, -40, 91, -128, 127, 39, -128, 127, -128, 51,
    -128, 117, -128, 127, 127, -108, -128, 33, -15, 127, -18, 127, -82, -10, -82, -128, 65, -128,
    -91, 127, 64, 127, -118, 61, 18, -35, 127, -98, 127, -110, 54, 102, 25, -128, -128, -89, -96,
    -112, -128, 95, 35, 87, -128, 49, -128, 45, 54, -96, -46, -113, -39, 63, -128, 62, -128, 41,
    -40, -83, 127, 127, 81, -69, 112, -53, -75, -36, 61, -62, -73, 127, -70, -128, 62, -128, 127,
    59, 68, -128, -90, 127, -128, -128, 124, -128, 97, 127, -54, 127, 127, -128, -1, 52, 127, 70, 5,
    127, 36, 127, 127, 127, 127, -68, 127, 127, 127, -128, 127, 21, 127, -50, -27, 127, -128, 127,
    -67, 88, -123, 51, 127, 126, -128, -128, -128, 127, 127, -128, 127, -9, 50, -108, 64, 115, 127,
    127, -18, -36, 127, 36, 127, 127, -70, -58, 39, 33, -107, -128, 61, -92, -128, 127, 127, -128,
    127, 127, -108, 127, 127, -108, -128, 97, 127, -128, 127, 127, 121, -128, 66, 127, -66, -128,
    -128, -62, 67, -9, -84, -84, -128, 127, 127, 127, -128, 20, 127, 21, 127, -62, 29, 127, -128,
    127, -69, -128, -128, -128, -128, -74, 127, 127, 68, 127, 9, 7, -128, 127, -128, 127, 127, -106,
    127, -50, -128, -128, 97, 101, -128, 45, 74, 127, 127, -128, 127, 70, -128, 127, -86, 68, -128,
    -53, -119, 127, -128, 127, -128, 127, -114, -97, -128, -61, 67, 113, -103, -128, 127, 71, 65,
    -81, -128, 59, -74, 127, 114, -128, -47, -128, 127, 68, -128, 47, 127, 127, 66, -128, 127, -16,
    127, 69, 127, -128, 127, -128, -64, -81, 127, -100, 30, 53, 127, -54, 101, -15, 60, -110, -76,
    -96, -128, 127, 127, 15, -41, 115, -128, 14, -128, 127, -128, 124, -54, -57, -83, -128, -128,
    61, -98, -16, -126, -115, -39, 25, 127, -109, 127, -128, -128, -128, -104, -128, -128, 127, 59,
    40, -50, 9, 127, 94, -23, -128, -128, 127, 69, -128, -6, 127, 127, -128, 127, -128, 127, 127,
    17, -128, -76, 44, -128, 19, 127, -128, -128, -59, 127, 127, -18, -126, -128, -128, 65, -128,
    17, 127, -128, -63, 127, -83, 127, 127, 127, -127, -15, -128, 49, -96, -128, 127, 127, 37, 87,
    127, -60, -128, 45, 54, 127, -67, -128, -39, 127, -69, 127, -128, 47, 127, 54, -128, 62, 88,
    -128, -128, 65, 95, -128, 34, -128, -128, -52, 127, 127, 36, -59, 41, -26, -60, 127, -128, -47,
    -128, 58, 12, -95, -128, -73, 127, -66, -128, 20, -107, -128, -13, 127, -119, -128, -63, 127,
    -128, 127, 127, -88, 30, -61, 67, 33, -128, -128, 127, 71, -51, 123, -128, 59, -128, 127, 37,
    -128, -47, 39, -119, 127, -128, 40, -92, -112, 127, 89, 127, 36, 127, -79, 92, 127, -65, 127,
    127, -128, 22, -128, -37, -128, 127, -128, 127, 127, -11, -78, 127, 127, -128, 127, 15, -128,
    -128, -128, 119, -128, 46, -128, 60, -96, 127, 43, 127, 104, -128, -64, 127, 127, 127, 16, -75,
    127, -54, 17, -111, -128, -107, 127, 127, 127, 127, -128, -128, -53, -128, 127, -127, 127, -84,
    -86, 127, 127, -128, -109, 58, -64, -128, -128, -104, 82, -128, 127, -31, -88, -36, -123, -77,
    118, 127, -70, -128, 127, -93, -128, -76, -128, -58, 33, 127, 15, 127, 127, -128, 9, 127, 127,
    127, -95, -8, 127, -93, 127, 38, -128, -61, -128, 65, 43, 127, 127, -128, -63, 85, 127, 127,
    127, -81, -128, -128, -128, 49, -128, 127, 127, -65, 82, 57, 102, 115, -9, 92, -23, -128, 127,
    127, 66, 85, -128, -128, -110, 127, 127, -128, -105, 127, 21, -128, 35, 27, -69, -102, -128,
    -128, -128, -74, 40, -66, -128, 127, 15, -21, -16, -128, 95, -55, 33, 107, 127, 76, -128, 127,
    -83, -60, -63, 127, -106, 127, 127, -81, 127, -31, -98, -128, 127, -77, -10, -128, -128, -128,
    -128, -85, -16, -128, -128, -6, 58, 127, -128, -128, -119, 127, 8, 127, -128, 127, -128, -6, 68,
    -113, 9, 127, -128, 127, -128, -128, 34, -101, 127, -72, -128, 127, 127, -128, 127, 21, 45, 127,
    127, 127, -107, 88, -109, 127, -16, -30, -36, 127, 21, 127, -128, 127, -127, 127, -14, -108,
    -128, -128, 127, -128, 127, -50, -128, -128, -128, -128, -128, -101, -128, 63, -94, -128, -104,
    2, 127, 32, 41, -88, 120, 127, 68, 105, 17, 127, -54, 65, 77, 23, 127, 127, -128, -128, 112, -9,
    127, -4, -128, -128, 127, -50, 127, -128, -128, 74, 29, -128, 77, 127, -128, 127, -14, -128, -2,
    -128, -128, -20, 98, 127, 127, -1, -128, -53, -128, 127, -128, -64, 127, -128, 78, 33, 53, 12,
    -81, -78, 127, -128, 62, -16, -106, -84, 127, 43, -22, -128, -128, -128, -128, -96, 127, 68,
    127, 127, 109, -57, 127, 36, -128, 42, 127, -128, 60, -128, -20, 127, -128, -24, -128, -92, 42,
    62, 86, -128, -128, -45, -37, -75, -64, -128, 127, -81, 20, 53, -128, 56, 127, -106, 127, 127,
    104, 127, 127, 65, 127, 68, 127, -128, -57, -57, -128, -128, -128, 20, -128, 127, 127, -36, 29,
    127, 127, 127, -65, -128, 92, -128, 119, -9, -64, -63, -128, 35, 89, -128, -128, 127, -83, -36,
    127, -118, -119, 127, -70, 127, 127, -128, -87, -128, -128, 127, 75, -111, 127, 76, 127, 68,
    -81, 127, 127, -128, 127, 127, -72, -128, 60, 127, 59, 127, -128, -24, -128, 127, 122, 44, 86,
    -128, 127, -128, -24, 127, 127, 23, 63, 127, -40, 5, 115, -33, 45, -76, -128, 127, -107, -128,
    -116, 127, 127, -29, -128, 9, 37, 127, 127, 127, 127, -86, 127, 21, -61, -81, -70, -128, -128,
    44, -16, -70, 127, 127, 104, 127, 127, 127, 23, 79, -123, -128, -128, 112, 127, -101, 98, 45,
    -128, -128, -101, -128, -128, -107, -128, -104, 127, -9, 127, 54, -128, -128, -128, 127, 39,
    -128, 127, -54, 39, -128, 14, -128, 58, -128, -128, 49, -16, 127, -108, -78, 82, 127, -128,
    -128, -120, 93, 5, -93, 20, -111, -128, -52, 127, -128, 127, 127, -128, -128, 127, -128, 127,
    127, 76, 127, -10, 127, 127, -128, -92, 127, 127, -107, 127, 36, 127, -9, 98, 127, -128, 33,
    127, 68, 127, 67, 77, -53, -128, 127, -128, -64, -128, 127, 127, 18, 53, 36, 75, -109, -112,
    -128, -128, -57, 43, -128, 59, 8, 127, 94, 127, 81, -128, -95, -78, -128, 127, -82, -128, 127,
    90, 75, -9, -128, -128, -62, 127, -128, -128, -110, 52, -128, -107, -84, -128, -89, 127, 127,
    17, 59, 60, 127, -128, 127, -128, -24, 102, 127, 127, 23, -41, -93, 58, -128, 112, -128, -128,
    127, 127, -128, -128, -128, 92, 45, -128, 23, 127, 127, -128, 56, -128, -85, 127, 15, -128, 127,
    -128, -128, -56, -15, -86, 127, 127, -128, 127, 127, -128, 79, -89, -60, -128, 2, 55, -128, 61,
    -128, 127, 127, -72, 127, -128, 47, 20, 19, -128, 56, -128, 127, -16, 127, 104, 127, 89, -23,
    42, -50, 123, 92, -128, -20, 127, 127, 127, -8, -128, -128, -120, 45, 127, 67, 19, -111, -40,
    -128, -60, 127, 59, 127, -128, -128, -53, -128, -128, -128, 127, -84, 127, 38, 127, -128, -128,
    -39, 39, 27, 127, 122, 52, 127, -128, 127, 127, 127, 12, 127, 127, 127, -128, 127, -128, 23,
    -128, 110, -128, 118, -128, -128, 95, -95, -96, -98, 127, 77, 85, -43, 25, 127, 127, 127, -128,
    19, -25, 44, 44,
  ];
  return noise.slice(0, Len);
}

function Filter(input: number[], fre: number): [low: number[], high: number[]] {
  let high;
  let mid = 0.0;
  let low = 0.0;
  const outputLow = Array.from<number>({ length: input.length });
  const outputHigh = Array.from<number>({ length: input.length });
  for (let i = 0; i < input.length; i++) {
    high = clamp(input[i] - mid - low, -128.0, 127.0);
    mid = clamp(mid + high * fre, -128.0, 127.0);
    low = clamp(low + mid * fre, -128.0, 127.0);
  }
  for (let i = 0; i < input.length; i++) {
    high = clamp(input[i] - mid - low, -128.0, 127.0);
    mid = clamp(mid + high * fre, -128.0, 127.0);
    low = clamp(low + mid * fre, -128.0, 127.0);
    outputLow[i] = Math.floor(low);
    outputHigh[i] = Math.floor(high);
  }
  return [outputLow, outputHigh];
}

function GenerateFilterWaveforms(filterSets: AHXWaves) {
  const src = filterSets[31];
  let freq = 8;
  let temp = 0;
  while (temp < 31) {
    let dstLowSquares: number[] = [];
    let dstHighSquares: number[] = [];
    const fre = (freq * 1.25) / 100.0;
    // squares alle einzeln filtern
    for (let i = 0; i < 0x20; i++) {
      const square = src[Waveform.SQUARE].slice(i * 0x80, (i + 1) * 0x80);
      const [dstLowSquare, dstHighSquare] = Filter(square, fre);
      dstLowSquares = dstLowSquares.concat(dstLowSquare);
      dstHighSquares = dstHighSquares.concat(dstHighSquare);
    }

    const [lowTriangle04, highTriangle04] = Filter(src[Waveform.TRIANGLE][0], fre);
    const [lowTriangle08, highTriangle08] = Filter(src[Waveform.TRIANGLE][1], fre);
    const [lowTriangle10, highTriangle10] = Filter(src[Waveform.TRIANGLE][2], fre);
    const [lowTriangle20, highTriangle20] = Filter(src[Waveform.TRIANGLE][3], fre);
    const [lowTriangle40, highTriangle40] = Filter(src[Waveform.TRIANGLE][4], fre);
    const [lowTriangle80, highTriangle80] = Filter(src[Waveform.TRIANGLE][5], fre);
    const [lowSawtooth04, highSawtooth04] = Filter(src[Waveform.SAWTOOTH][0], fre);
    const [lowSawtooth08, highSawtooth08] = Filter(src[Waveform.SAWTOOTH][1], fre);
    const [lowSawtooth10, highSawtooth10] = Filter(src[Waveform.SAWTOOTH][2], fre);
    const [lowSawtooth20, highSawtooth20] = Filter(src[Waveform.SAWTOOTH][3], fre);
    const [lowSawtooth40, highSawtooth40] = Filter(src[Waveform.SAWTOOTH][4], fre);
    const [lowSawtooth80, highSawtooth80] = Filter(src[Waveform.SAWTOOTH][5], fre);
    const [lowWhiteNoiseBig, highWhiteNoiseBig] = Filter(src[Waveform.WNOISE], fre);

    const dstLow: AHXWaves[number] = [
      [lowTriangle04, lowTriangle08, lowTriangle10, lowTriangle20, lowTriangle40, lowTriangle80],
      [lowSawtooth04, lowSawtooth08, lowSawtooth10, lowSawtooth20, lowSawtooth40, lowSawtooth80],
      dstLowSquares,
      lowWhiteNoiseBig,
    ];
    const dstHigh: AHXWaves[number] = [
      [
        highTriangle04,
        highTriangle08,
        highTriangle10,
        highTriangle20,
        highTriangle40,
        highTriangle80,
      ],
      [
        highSawtooth04,
        highSawtooth08,
        highSawtooth10,
        highSawtooth20,
        highSawtooth40,
        highSawtooth80,
      ],
      dstHighSquares,
      highWhiteNoiseBig,
    ];

    filterSets[temp] = dstLow;
    filterSets[temp + 32] = dstHigh;

    temp++;
    freq += 3;
  }
}

export class AHXPlayer {
  StepWaitFrames = 0;
  GetNewPosition = 0;
  SongEndReached = 0;
  TimingValue = 0;
  PatternBreak = 0;
  MainVolume = 0x40;
  Playing = 0;
  Tempo = 0;
  PosNr = 0;
  PosJump = 0;
  NoteNr = 0;
  PosJumpNote = 0;
  WaveformTab = [0, 0, 0, 0];
  Waves = getAHXWaves();
  Voices!: AHXVoice[] & { length: 4 };
  WNRandom = 0;
  Song!: AHXSong;
  PlayingTime = 0;

  VibratoTable = [
    0, 24, 49, 74, 97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253, 255, 253, 250, 244,
    235, 224, 212, 197, 180, 161, 141, 120, 97, 74, 49, 24, 0, -24, -49, -74, -97, -120, -141, -161,
    -180, -197, -212, -224, -235, -244, -250, -253, -255, -253, -250, -244, -235, -224, -212, -197,
    -180, -161, -141, -120, -97, -74, -49, -24,
  ];

  PeriodTable = [
    0, 3424, 3232, 3048, 2880, 2712, 2560, 2416, 2280, 2152, 2032, 1920, 1812, 1712, 1616, 1524,
    1440, 1356, 1280, 1208, 1140, 1076, 1016, 960, 906, 856, 808, 762, 720, 678, 640, 604, 570, 538,
    508, 480, 453, 428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226, 214, 202, 190, 180,
    170, 160, 151, 143, 135, 127, 120, 113,
  ];

  InitSong(song: AHXSong) {
    this.Song = song;
  }

  InitSubsong(Nr: number) {
    if (Nr > this.Song.SubsongNr) return 0;

    if (Nr === 0) this.PosNr = 0;
    else this.PosNr = this.Song.Subsongs[Nr - 1];

    this.PosJump = 0;
    this.PatternBreak = 0;
    //this.MainVolume = 0x40;
    this.Playing = 1;
    this.NoteNr = this.PosJumpNote = 0;
    this.Tempo = 6;
    this.StepWaitFrames = 0;
    this.GetNewPosition = 1;
    this.SongEndReached = 0;
    this.TimingValue = this.PlayingTime = 0;
    this.Voices = [new AHXVoice(0), new AHXVoice(1), new AHXVoice(2), new AHXVoice(3)];
  }

  PlayIRQ() {
    if (this.Tempo > 0 && this.StepWaitFrames <= 0) {
      if (this.GetNewPosition) {
        let NextPos = this.PosNr + 1 === this.Song.PositionNr ? 0 : this.PosNr + 1;
        if (this.PosNr >= this.Song.Positions.length) {
          // Track range error? 01
          this.PosNr = this.Song.PositionNr - 1;
        }
        if (NextPos >= this.Song.Positions.length) {
          // Track range error? 02
          NextPos = this.Song.PositionNr - 1;
        }
        this.Voices.forEach(voice => {
          voice.Track = this.Song.Positions[this.PosNr].Track[voice.number];
          voice.Transpose = this.Song.Positions[this.PosNr].Transpose[voice.number];
          voice.NextTrack = this.Song.Positions[NextPos].Track[voice.number];
          voice.NextTranspose = this.Song.Positions[NextPos].Transpose[voice.number];
        });
        this.GetNewPosition = 0;
      }
      this.Voices.forEach(voice => this.ProcessStep(voice));
      this.StepWaitFrames = this.Tempo;
    }
    //DoFrameStuff
    this.Voices.forEach(voice => this.ProcessFrame(voice));
    this.PlayingTime++;
    if (this.Tempo > 0 && --this.StepWaitFrames <= 0) {
      if (!this.PatternBreak) {
        this.NoteNr++;
        if (this.NoteNr >= this.Song.TrackLength) {
          this.PosJump = this.PosNr + 1;
          this.PosJumpNote = 0;
          this.PatternBreak = 1;
        }
      }
      if (this.PatternBreak) {
        this.PatternBreak = 0;
        this.NoteNr = this.PosJumpNote;
        this.PosJumpNote = 0;
        this.PosNr = this.PosJump;
        this.PosJump = 0;
        if (this.PosNr === this.Song.PositionNr) {
          this.SongEndReached = 1;
          this.PosNr = this.Song.Restart;
        }
        this.GetNewPosition = 1;
      }
    }
    //RemainPosition
    this.Voices.forEach(voice => this.SetAudio(voice));
  }

  NextPosition() {
    this.PosNr++;
    if (this.PosNr === this.Song.PositionNr) this.PosNr = 0;
    this.StepWaitFrames = 0;
    this.GetNewPosition = 1;
  }

  PrevPosition() {
    this.PosNr--;
    if (this.PosNr < 0) this.PosNr = 0;
    this.StepWaitFrames = 0;
    this.GetNewPosition = 1;
  }

  ProcessStep(voice: AHXVoice) {
    if (!voice.TrackOn) return;
    voice.VolumeSlideUp = voice.VolumeSlideDown = 0;

    let { Note, Instrument, FX, FXParam } = this.Song.Tracks[voice.Track][this.NoteNr];
    switch (FX) {
      case 0x0: // Position Jump HI
        if ((FXParam & 0xf) > 0 && (FXParam & 0xf) <= 9) this.PosJump = FXParam & 0xf;
        break;
      case 0x5: // Volume Slide + Tone Portamento
      case 0xa: // Volume Slide
        voice.VolumeSlideDown = FXParam & 0x0f;
        voice.VolumeSlideUp = FXParam >> 4;
        break;
      case 0xb: // Position Jump
        this.PosJump = this.PosJump * 100 + (FXParam & 0x0f) + (FXParam >> 4) * 10;
        this.PatternBreak = 1;
        break;
      case 0xd: // Patternbreak
        this.PosJump = this.PosNr + 1;
        this.PosJumpNote = (FXParam & 0x0f) + (FXParam >> 4) * 10;
        if (this.PosJumpNote > this.Song.TrackLength) this.PosJumpNote = 0;
        this.PatternBreak = 1;
        break;
      case 0xe: // Enhanced commands
        switch (FXParam >> 4) {
          case 0xc: // Note Cut
            if ((FXParam & 0x0f) < this.Tempo) {
              voice.NoteCutWait = FXParam & 0x0f;
              if (voice.NoteCutWait) {
                voice.NoteCutOn = 1;
                voice.HardCutRelease = 0;
              }
            }
            break;
          case 0xd: // Note Delay
            if (voice.NoteDelayOn) {
              voice.NoteDelayOn = 0;
            } else {
              if ((FXParam & 0x0f) < this.Tempo) {
                voice.NoteDelayWait = FXParam & 0x0f;
                if (voice.NoteDelayWait) {
                  voice.NoteDelayOn = 1;
                  return;
                }
              }
            }
            break;
        }
        break;
      case 0xf: // Speed
        this.Tempo = FXParam;
        break;
    }
    if (Instrument) {
      voice.PerfSubVolume = 0x40;
      voice.PeriodSlideSpeed = voice.PeriodSlidePeriod = voice.PeriodSlideLimit = 0;
      voice.ADSRVolume = 0;
      if (Instrument < this.Song.Instruments.length) {
        voice.Instrument = this.Song.Instruments[Instrument];
      } else {
        // Overriding instrument
        voice.Instrument = this.Song.Instruments[0];
      }
      voice.CalcADSR();
      //InitOnInstrument
      voice.WaveLength = voice.Instrument.WaveLength;
      voice.NoteMaxVolume = voice.Instrument.Volume;
      //InitVibrato
      voice.VibratoCurrent = 0;
      voice.VibratoDelay = voice.Instrument.VibratoDelay;
      voice.VibratoDepth = voice.Instrument.VibratoDepth;
      voice.VibratoSpeed = voice.Instrument.VibratoSpeed;
      voice.VibratoPeriod = 0;
      //InitHardCut
      voice.HardCutRelease = voice.Instrument.HardCutRelease;
      voice.HardCut = voice.Instrument.HardCutReleaseFrames;
      //InitSquare
      voice.IgnoreSquare = voice.SquareSlidingIn = 0;
      voice.SquareWait = voice.SquareOn = 0;
      let SquareLower = voice.Instrument.SquareLowerLimit >> (5 - voice.WaveLength);
      let SquareUpper = voice.Instrument.SquareUpperLimit >> (5 - voice.WaveLength);
      if (SquareUpper < SquareLower) {
        const t = SquareUpper;
        SquareUpper = SquareLower;
        SquareLower = t;
      }
      voice.SquareUpperLimit = SquareUpper;
      voice.SquareLowerLimit = SquareLower;
      //InitFilter
      voice.IgnoreFilter = voice.FilterWait = voice.FilterOn = 0;
      voice.FilterSlidingIn = 0;
      let d6 = voice.Instrument.FilterSpeed;
      let d3 = voice.Instrument.FilterLowerLimit;
      let d4 = voice.Instrument.FilterUpperLimit;
      if (d3 & 0x80) d6 |= 0x20;
      if (d4 & 0x80) d6 |= 0x40;
      voice.FilterSpeed = d6;
      d3 &= ~0x80;
      d4 &= ~0x80;
      if (d3 > d4) {
        const t = d3;
        d3 = d4;
        d4 = t;
      }
      voice.FilterUpperLimit = d4;
      voice.FilterLowerLimit = d3;
      voice.FilterPos = 32;
      //Init PerfList
      voice.PerfWait = voice.PerfCurrent = 0;
      voice.PerfSpeed = voice.Instrument.PList.Speed;
      voice.PerfList = voice.Instrument.PList;
    }
    //NoInstrument
    voice.PeriodSlideOn = 0;

    switch (FX) {
      case 0x4: // Override filter
        break;
      case 0x9: // Set Squarewave-Offset
        voice.SquarePos = FXParam >> (5 - voice.WaveLength);
        voice.PlantSquare = 1;
        voice.IgnoreSquare = 1;
        break;
      case 0x5: // Tone Portamento + Volume Slide
      case 0x3: // Tone Portamento (Period Slide Up/Down w/ Limit)
        if (FXParam !== 0) voice.PeriodSlideSpeed = FXParam;
        if (Note) {
          let Neue = this.PeriodTable[Note];
          let Alte = this.PeriodTable[voice.TrackPeriod];
          Alte -= Neue;
          Neue = Alte + voice.PeriodSlidePeriod;
          if (Neue) voice.PeriodSlideLimit = -Alte;
        }
        voice.PeriodSlideOn = 1;
        voice.PeriodSlideWithLimit = 1;
        Note = 0;
    }

    // Note anschlagen
    if (Note) {
      voice.TrackPeriod = Note;
      voice.PlantPeriod = 1;
    }

    switch (FX) {
      case 0x1: // Portamento up (Period slide down)
        voice.PeriodSlideSpeed = -FXParam;
        voice.PeriodSlideOn = 1;
        voice.PeriodSlideWithLimit = 0;
        break;
      case 0x2: // Portamento down (Period slide up)
        voice.PeriodSlideSpeed = FXParam;
        voice.PeriodSlideOn = 1;
        voice.PeriodSlideWithLimit = 0;
        break;
      case 0xc: // Volume
        if (FXParam <= 0x40) voice.NoteMaxVolume = FXParam;
        else {
          FXParam -= 0x50;
          if (FXParam <= 0x40)
            for (let i = 0; i < 4; i++) this.Voices[i].TrackMasterVolume = FXParam;
          else {
            FXParam -= 0xa0 - 0x50;
            if (FXParam <= 0x40) voice.TrackMasterVolume = FXParam;
          }
        }
        break;
      case 0xe: // Enhanced commands
        switch (FXParam >> 4) {
          case 0x1: // Fineslide up (Period fineslide down)
            voice.PeriodSlidePeriod = -(FXParam & 0x0f);
            voice.PlantPeriod = 1;
            break;
          case 0x2: // Fineslide down (Period fineslide up)
            voice.PeriodSlidePeriod = FXParam & 0x0f;
            voice.PlantPeriod = 1;
            break;
          case 0x4: // Vibrato control
            voice.VibratoDepth = FXParam & 0x0f;
            break;
          case 0xa: // Finevolume up
            voice.NoteMaxVolume += FXParam & 0x0f;
            if (voice.NoteMaxVolume > 0x40) voice.NoteMaxVolume = 0x40;
            break;
          case 0xb: // Finevolume down
            voice.NoteMaxVolume -= FXParam & 0x0f;
            if (voice.NoteMaxVolume < 0) voice.NoteMaxVolume = 0;
            break;
        }
        break;
    }
  }

  ProcessFrame(voice: AHXVoice) {
    if (!voice.TrackOn) return;

    if (voice.NoteDelayOn) {
      if (voice.NoteDelayWait <= 0) this.ProcessStep(voice);
      else voice.NoteDelayWait--;
    }
    if (voice.HardCut) {
      let NextInstrument;
      if (this.NoteNr + 1 < this.Song.TrackLength)
        NextInstrument = this.Song.Tracks[voice.Track][this.NoteNr + 1].Instrument;
      else NextInstrument = this.Song.Tracks[voice.NextTrack][0].Instrument;
      if (NextInstrument) {
        let d1 = this.Tempo - voice.HardCut;
        if (d1 < 0) d1 = 0;
        if (!voice.NoteCutOn) {
          voice.NoteCutOn = 1;
          voice.NoteCutWait = d1;
          voice.HardCutReleaseF = -(d1 - this.Tempo);
        } else voice.HardCut = 0;
      }
    }
    if (voice.NoteCutOn) {
      if (voice.NoteCutWait <= 0) {
        voice.NoteCutOn = 0;
        if (voice.HardCutRelease) {
          voice.ADSR.rVolume =
            -(voice.ADSRVolume - (voice.Instrument.Envelope.rVolume << 8)) / voice.HardCutReleaseF;
          voice.ADSR.rFrames = voice.HardCutReleaseF;
          voice.ADSR.aFrames = voice.ADSR.dFrames = voice.ADSR.sFrames = 0;
        } else voice.NoteMaxVolume = 0;
      } else voice.NoteCutWait--;
    }
    //adsrEnvelope
    if (voice.ADSR.aFrames) {
      voice.ADSRVolume += voice.ADSR.aVolume; // Delta
      if (--voice.ADSR.aFrames <= 0) voice.ADSRVolume = voice.Instrument.Envelope.aVolume << 8;
    } else if (voice.ADSR.dFrames) {
      voice.ADSRVolume += voice.ADSR.dVolume; // Delta
      if (--voice.ADSR.dFrames <= 0) voice.ADSRVolume = voice.Instrument.Envelope.dVolume << 8;
    } else if (voice.ADSR.sFrames) {
      voice.ADSR.sFrames--;
    } else if (voice.ADSR.rFrames) {
      voice.ADSRVolume += voice.ADSR.rVolume; // Delta
      if (--voice.ADSR.rFrames <= 0) voice.ADSRVolume = voice.Instrument.Envelope.rVolume << 8;
    }
    //VolumeSlide
    voice.NoteMaxVolume = voice.NoteMaxVolume + voice.VolumeSlideUp - voice.VolumeSlideDown;
    if (voice.NoteMaxVolume < 0) voice.NoteMaxVolume = 0;
    if (voice.NoteMaxVolume > 0x40) voice.NoteMaxVolume = 0x40;
    //Portamento
    if (voice.PeriodSlideOn) {
      if (voice.PeriodSlideWithLimit) {
        let d0 = voice.PeriodSlidePeriod - voice.PeriodSlideLimit;
        let d2 = voice.PeriodSlideSpeed;
        if (d0 > 0) d2 = -d2;
        if (d0) {
          const d3 = (d0 + d2) ^ d0;
          if (d3 >= 0) d0 = voice.PeriodSlidePeriod + d2;
          else d0 = voice.PeriodSlideLimit;
          voice.PeriodSlidePeriod = d0;
          voice.PlantPeriod = 1;
        }
      } else {
        voice.PeriodSlidePeriod += voice.PeriodSlideSpeed;
        voice.PlantPeriod = 1;
      }
    }
    //Vibrato
    if (voice.VibratoDepth) {
      if (voice.VibratoDelay <= 0) {
        voice.VibratoPeriod = (this.VibratoTable[voice.VibratoCurrent] * voice.VibratoDepth) >> 7;
        voice.PlantPeriod = 1;
        voice.VibratoCurrent = (voice.VibratoCurrent + voice.VibratoSpeed) & 0x3f;
      } else voice.VibratoDelay--;
    }
    //PList
    if (voice.Instrument && voice.PerfCurrent < voice.Instrument.PList.Length) {
      if (--voice.PerfWait <= 0) {
        const Cur = voice.PerfCurrent++;
        voice.PerfWait = voice.PerfSpeed;
        if (voice.PerfList.Entries[Cur].Waveform) {
          voice.Waveform = voice.PerfList.Entries[Cur].Waveform - 1;
          voice.NewWaveform = 1;
          voice.PeriodPerfSlideSpeed = voice.PeriodPerfSlidePeriod = 0;
        }
        //Holdwave
        voice.PeriodPerfSlideOn = 0;
        for (let i = 0; i < 2; i++)
          this.PListCommandParse(
            voice,
            voice.PerfList.Entries[Cur].FX[i],
            voice.PerfList.Entries[Cur].FXParam[i],
          );
        //GetNote
        if (voice.PerfList.Entries[Cur].Note) {
          voice.InstrPeriod = voice.PerfList.Entries[Cur].Note;
          voice.PlantPeriod = 1;
          voice.FixedNote = voice.PerfList.Entries[Cur].Fixed;
        }
      }
    } else {
      if (voice.PerfWait) voice.PerfWait--;
      else voice.PeriodPerfSlideSpeed = 0;
    }
    //PerfPortamento
    if (voice.PeriodPerfSlideOn) {
      voice.PeriodPerfSlidePeriod -= voice.PeriodPerfSlideSpeed;
      if (voice.PeriodPerfSlidePeriod) voice.PlantPeriod = 1;
    }
    if (voice.Waveform === 3 - 1 && voice.SquareOn) {
      if (--voice.SquareWait <= 0) {
        const d1 = voice.SquareLowerLimit;
        const d2 = voice.SquareUpperLimit;
        let d3 = voice.SquarePos;
        if (voice.SquareInit) {
          voice.SquareInit = 0;
          if (d3 <= d1) {
            voice.SquareSlidingIn = 1;
            voice.SquareSign = 1;
          } else if (d3 >= d2) {
            voice.SquareSlidingIn = 1;
            voice.SquareSign = -1;
          }
        }
        //NoSquareInit
        if (d1 === d3 || d2 === d3) {
          if (voice.SquareSlidingIn) {
            voice.SquareSlidingIn = 0;
          } else {
            voice.SquareSign = -voice.SquareSign;
          }
        }
        d3 += voice.SquareSign;
        voice.SquarePos = d3;
        voice.PlantSquare = 1;
        voice.SquareWait = voice.Instrument.SquareSpeed;
      }
    }
    if (voice.FilterOn && --voice.FilterWait <= 0) {
      const d1 = voice.FilterLowerLimit;
      const d2 = voice.FilterUpperLimit;
      let d3 = voice.FilterPos;
      if (voice.FilterInit) {
        voice.FilterInit = 0;
        if (d3 <= d1) {
          voice.FilterSlidingIn = 1;
          voice.FilterSign = 1;
        } else if (d3 >= d2) {
          voice.FilterSlidingIn = 1;
          voice.FilterSign = -1;
        }
      }
      //NoFilterInit
      const FMax = voice.FilterSpeed < 3 ? 5 - voice.FilterSpeed : 1;
      for (let i = 0; i < FMax; i++) {
        if (d1 === d3 || d2 === d3) {
          if (voice.FilterSlidingIn) {
            voice.FilterSlidingIn = 0;
          } else {
            voice.FilterSign = -voice.FilterSign;
          }
        }
        d3 += voice.FilterSign;
      }
      voice.FilterPos = d3;
      voice.NewWaveform = 1;
      voice.FilterWait = voice.FilterSpeed - 3;
      if (voice.FilterWait < 1) voice.FilterWait = 1;
    }
    if (voice.Waveform === Waveform.SQUARE || voice.PlantSquare) {
      //CalcSquare
      const SquarePtr = this.Waves[toSixtyTwo(voice.FilterPos - 1)][Waveform.SQUARE];
      let SquareOfs = 0;
      let X = voice.SquarePos << (5 - voice.WaveLength);
      if (X > 0x20) {
        X = 0x40 - X;
        voice.SquareReverse = 1;
      }
      //OkDownSquare
      if (X--) SquareOfs = X * 0x80; // <- WTF!?
      const Delta = 32 >> voice.WaveLength;
      const AudioLen = (1 << voice.WaveLength) * 4;
      voice.AudioSource = Array.from({ length: AudioLen });
      for (let i = 0; i < AudioLen; i++) {
        voice.AudioSource[i] = SquarePtr[SquareOfs];
        SquareOfs += Delta;
      }
      voice.NewWaveform = 1;
      voice.Waveform = Waveform.SQUARE;
      voice.PlantSquare = 0;
    }
    if (voice.Waveform === Waveform.WNOISE)
      // white noise
      voice.NewWaveform = 1;

    if (voice.NewWaveform) {
      if (voice.Waveform !== Waveform.SQUARE) {
        // don't process square
        const FilterSet = toSixtyTwo(voice.FilterPos - 1);

        if (voice.Waveform === Waveform.WNOISE) {
          // white noise
          const WNStart = this.WNRandom & (2 * 0x280 - 1) & ~1;
          voice.AudioSource = this.Waves[FilterSet][voice.Waveform].slice(WNStart, WNStart + 0x280);
          //AddRandomMoving
          //GoOnRandom
          this.WNRandom += 2239384;
          this.WNRandom = ((((this.WNRandom >> 8) | (this.WNRandom << 24)) + 782323) ^ 75) - 6735;
        } else {
          // triangle / sawtooth
          voice.AudioSource = this.Waves[FilterSet][voice.Waveform][voice.WaveLength];
        }
      }
    }
    //StillHoldWaveform
    //AudioInitPeriod
    voice.AudioPeriod = voice.InstrPeriod;
    if (!voice.FixedNote) voice.AudioPeriod += voice.Transpose + voice.TrackPeriod - 1;
    if (voice.AudioPeriod > 5 * 12) voice.AudioPeriod = 5 * 12;
    if (voice.AudioPeriod < 0) voice.AudioPeriod = 0;
    voice.AudioPeriod = this.PeriodTable[voice.AudioPeriod];
    if (!voice.FixedNote) voice.AudioPeriod += voice.PeriodSlidePeriod;
    voice.AudioPeriod += voice.PeriodPerfSlidePeriod + voice.VibratoPeriod;
    if (voice.AudioPeriod > 0x0d60) voice.AudioPeriod = 0x0d60;
    if (voice.AudioPeriod < 0x0071) voice.AudioPeriod = 0x0071;
    //AudioInitVolume
    voice.AudioVolume =
      ((((((((voice.ADSRVolume >> 8) * voice.NoteMaxVolume) >> 6) * voice.PerfSubVolume) >> 6) *
        voice.TrackMasterVolume) >>
        6) *
        this.MainVolume) >>
      6;
  }

  SetAudio(voice: AHXVoice) {
    if (!voice.TrackOn) {
      voice.VoiceVolume = 0;
      return;
    }

    voice.VoiceVolume = voice.AudioVolume;
    if (voice.PlantPeriod) {
      voice.PlantPeriod = 0;
      voice.VoicePeriod = voice.AudioPeriod;
    }
    if (voice.NewWaveform) {
      if (voice.Waveform === 4 - 1) {
        // for white noise, copy whole 0x280 samples
        voice.VoiceBuffer = voice.AudioSource;
      } else {
        const WaveLoops = (1 << (5 - voice.WaveLength)) * 5;
        const LoopLen = 4 * (1 << voice.WaveLength);
        if (!voice.AudioSource.length) {
          // New or fill?
          voice.VoiceBuffer = Array.from({ length: WaveLoops * LoopLen });
        } else {
          const Loop = voice.AudioSource.slice(0, LoopLen);
          voice.VoiceBuffer = Array.from<number[]>({ length: WaveLoops }).fill(Loop).flat();
        }
      }
      //voice.VoiceBuffer[0x280] = voice.VoiceBuffer[0];
    }
  }

  PListCommandParse(voice: AHXVoice, FX: number, FXParam: number) {
    switch (FX) {
      case 0:
        if (this.Song.Revision > 0 && FXParam !== 0) {
          if (voice.IgnoreFilter) {
            voice.FilterPos = voice.IgnoreFilter;
            voice.IgnoreFilter = 0;
          } else voice.FilterPos = FXParam;
          voice.NewWaveform = 1;
        }
        break;
      case 1:
        voice.PeriodPerfSlideSpeed = FXParam;
        voice.PeriodPerfSlideOn = 1;
        break;
      case 2:
        voice.PeriodPerfSlideSpeed = -FXParam;
        voice.PeriodPerfSlideOn = 1;
        break;
      case 3: // Init Square Modulation
        if (!voice.IgnoreSquare) {
          voice.SquarePos = FXParam >> (5 - voice.WaveLength);
        } else voice.IgnoreSquare = 0;
        break;
      case 4: // Start/Stop Modulation
        if (this.Song.Revision === 0 || FXParam === 0) {
          voice.SquareInit = voice.SquareOn ^= 1;
          voice.SquareSign = 1;
        } else {
          if (FXParam & 0x0f) {
            voice.SquareInit = voice.SquareOn ^= 1;
            voice.SquareSign = 1;
            if ((FXParam & 0x0f) === 0x0f) voice.SquareSign = -1;
          }
          if (FXParam & 0xf0) {
            voice.FilterInit = voice.FilterOn ^= 1;
            voice.FilterSign = 1;
            if ((FXParam & 0xf0) === 0xf0) voice.FilterSign = -1;
          }
        }
        break;
      case 5: // Jump to Step [xx]
        voice.PerfCurrent = FXParam;
        break;
      case 6: // Set Volume
        if (FXParam > 0x40) {
          if ((FXParam -= 0x50) >= 0) {
            if (FXParam <= 0x40) voice.PerfSubVolume = FXParam;
            else if ((FXParam -= 0xa0 - 0x50) >= 0)
              if (FXParam <= 0x40) voice.TrackMasterVolume = FXParam;
          }
        } else voice.NoteMaxVolume = FXParam;
        break;
      case 7: // set speed
        voice.PerfSpeed = voice.PerfWait = FXParam;
        break;
    }
  }

  VoiceOnOff(Voice: number, OnOff: number) {
    if (Voice < 0 || Voice > 3) return;
    this.Voices[Voice].TrackOn = OnOff;
  }
}

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
      let samplesToMix = NrSamples;
      let mixpos = 0;
      while (samplesToMix) {
        if (this.pos[v] >= 0x280 << 16) this.pos[v] -= 0x280 << 16;
        const thiscount = Math.min(
          samplesToMix,
          Math.floor(((0x280 << 16) - this.pos[v] - 1) / delta) + 1,
        );
        samplesToMix -= thiscount;
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
