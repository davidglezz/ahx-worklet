export interface AHXEnvelope {
  aFrames: number;
  aVolume: number;
  dFrames: number;
  dVolume: number;
  sFrames: number;
  rFrames: number;
  rVolume: number;
}

export interface AHXPlistEntry {
  Note: number;
  Fixed: number;
  Waveform: Waveform;
  FX: [number, number];
  FXParam: [number, number];
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
  PerfSpeed: number;
  PerfList: AHXPlistEntry[];
}

// eslint-disable-next-line no-restricted-syntax
export const enum Waveform {
  TRIANGLE = 1,
  SAWTOOTH = 2,
  SQUARE = 3,
  WNOISE = 4,
}

export type AHXWaves = [
  empty: undefined,
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

const clamp = (v: number, min: number, max: number) =>
  v < min ? min
  : v > max ? max
  : v;

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
    this.Instruments = Array.from({ length: view.getUint8(12) + 1 });

    // Subsongs //////////////////////////////////////////
    this.Subsongs = Array.from(
      { length: view.getUint8(13) },
      () => (view.getUint8(SBPtr++) << 8) | view.getUint8(SBPtr++),
    );

    // Position List /////////////////////////////////////
    this.Positions = Array.from({ length: this.PositionNr }, () => {
      const Pos: AHXPosition = {
        Track: Array.from({ length: 4 }),
        Transpose: Array.from({ length: 4 }),
      };
      for (let j = 0; j < 4; j++) {
        Pos.Track[j] = view.getUint8(SBPtr++);
        Pos.Transpose[j] = view.getInt8(SBPtr++);
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
      PerfSpeed: 0,
      PerfList: [],
    };

    for (let i = 1; i < this.Instruments.length; i++) {
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
        PerfSpeed: view.getUint8(SBPtr + 20),
        PerfList: Array.from({ length: view.getUint8(SBPtr + 21) }),
      };
      NamePtr += Instrument.Name.length + 1;
      SBPtr += 22;

      for (let j = 0; j < Instrument.PerfList.length; j++) {
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
        Instrument.PerfList[j] = Entry;
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
  NewWaveform: boolean = false;
  Waveform: Waveform = 1;
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
  PerfList!: AHXPlistEntry[];
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
    undefined,
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

function GenerateTriangle(length: number) {
  const Buffer = Array.from({ length });
  const q = length >> 2;
  const step = 128 / q;
  let value = 0;
  for (let i = 0; i < q; i++) {
    Buffer[i] = value;
    Buffer[i + q] = value === 0 ? 127 : 128 - value;
    Buffer[i + q * 2] = -value;
    Buffer[i + q * 3] = -128 + value;
    value += step;
  }
  return Buffer;
}

function GenerateSquare() {
  const Buffer = Int8Array.from({ length: 4096 });
  for (let ebx = 0; ebx < 0x40; ebx += 2) {
    const start1 = ebx * 0x40;
    const start2 = start1 + 0x7e - ebx;
    Buffer.fill(-0x80, start1, start2);
    Buffer.fill(0x7f, start2, start2 + ebx + 2);
  }
  return Buffer;
}

function GenerateSawtooth(Len: number) {
  const Buffer = Array.from({ length: Len });
  const ebx = Math.floor(256 / (Len - 1));
  let eax = -128;
  for (let ecx = 0; ecx < Len; ecx++) {
    Buffer[ecx] = eax;
    eax += ebx;
  }
  return Buffer;
}

const b256Noise =
  'ĿĿŨƢĸþìŒĒƕŀŀūŀĿ÷ĿĿÕûżĦƳĿŀŀŀŀĂƥƸŀĿĿæĿŀŗŀğŧĿŀŀŀĿĿĿƎĹŌŀĊĿŀÖĿĿŀŀÉƱŀŕĸĸĿŸƢĒĿÈœĿĿŀƻŨĄƥƊÉĿŀĿŀƋŀĿƷŀŀŷĿěŀûÔƏŀĿŀÖßħšĢııŧĿĄāŀĿƍāăċƳŀƇƟƟƕçßßşöäĳıĿŀĿĹĂĿĿŀŀŀîâĿƲĆŀŀŴƒõîŀŏŵżŀøƲĿÐíĿĿæőĿưĿƟëĿŀþĿĿŀŀūŮĿƊŀŀƳźôŀŀĿĿŀþĦŀ×ŀūŀÉƳĿéŀƄĿŀƓĿźŀĿŀŝĿŀøŀĿĿĿĩĿĿÕďŀļŌÛĿĿŀŀİëŀĿĚƁĿŀĿąŻŀĿƷƎŀŀŀƚŝĿŀĿźƢÂŀŕźŀƺƾŀŴŀŀňĿĿÒŀŀÎśŀŀďƉëŀķŵĿđĿĿĿĿŀĿƱŀñƦŀĿŀťŀĿƊĿåŀŒŴĿŀŗĿĿŔàÛûĿƮƊŀŀĂŀŀţŀƅƱŀĿĿĿđůĿõĂŀĿƱŀƅĿĿĿŀèĿųììƪĿĿŀĿáũĿôĿŮÞƅſŮĿŋ÷ĿÍŀĳãŻŀŀƆŀŶŀĿŀŀĿĿŀáĿàąŧƊĿŀŀŀýĿÕąƳƘŋśƎĕŀŀĿŽƎĿöŀĿſĢãÇåƱƊęĿŪĿĿćœŀÛáŀśƊŀíŀŘĿĿĿƮŀŀŀĿàûŀüâƏĿŀŀęŝĿêĿŀļŀƓáŀŧĿĿŀÉýĿĿŮŀŧŀĿĳÅýŀĿĿĿæûĿƶŀĿĞćƟŀļööĿƿżżżĿĿĿŀŀčáĿĿĿāčŀĿĿŀƀůìĿ×õŀŀĿưüÒŇĿŀŀÓĳíþŀĿŀŦƘÙŀĿçŀĿŀĿŀĿãŀčŀĿĿŉĿŀŵĊ×ůňŕŀİķŗĿŀŀâśÂïŀŀŘĿĿÒíèƎůŐĘƩÚıïĜĿŀĿĿŀĿćƍůìÆŀïŀƨŀîĘÑƗŭĘă×şİƃŀİÙƃ÷îĂŀìżŀĿĿĿÐąíþþŐŀŦƘěŀĿçŀĿŀóŀĵŀĿĿŔŀáƱĿƮĿŮƶŮŀāŀťĿĀĿŊýÒƝĿŞĿŒöĦÙŀŀŧŠŐŀğãėŀñŀíöŠƒŏƙÿŀþŀéƘŭĿĿđŻİƋŵƜýƂŷĿźŀþŀĿûĄŀŦĿŀŀļŀġĿƊĿĿŀƿôĿĆÅĿäĿĿĿĿżĿĿĿŀĿÕĿƎƥĿŀĿŽĘŅóĿľŀŀŀĿĿŀĿƷòŔĀĳĿĿƮƜĿäĿĿźƆçáŕŀýŤŀĿĿŀĿĿŔĿĿŔŀġĿŀĿĿĹŀĂĿžŀŀƂăƷŬŬŀĿĿĿŀÔĿÕĿƂÝĿŀĿŻŀŀŀŀŶĿĿĄĿÉÇŀĿŀĿĿŖĿƎŀŀġĥŀíĊĿĿŀĿĆŀĿŪĄŀƋŉĿŀĿŀĿŎşŀƃăıřŀĿćāůŀûŶĿĲŀƑŀĿĄŀïĿĿĂŀĿưĿąĿŀĿŀƀůĿŜÞõĿƊĥƱüŒŴŠŀĿĿÏƗĳŀÎŀĿŀļƊƇŭŀŀýŞưłōƙÙĿœĿŀŀŀŘŀŀĿûèƎÉĿĞƩŀŀĿąŀƺĿĿŀĿŀĿĿÑŀŴìŀÓĿŀŀƅĿĿƮłŀŀāŀÑĿŀƁĿŭĿĿĿŁƱŀñŠŀĿĿåėĿƄŀíöĿŽŀƙĿŻĿŀïĿöŀþĘŀŀāğŀâŀŀƌĿĿäƅéƦƄĿŀƑŀúÌšŀŷĿžŀÔŕŀƳĿŉŀƁĿŀĿĿŨÞƃăáŀŀĿćƍĻŀûŀĿåŀƑçŉĿŀèŤŐĿęĿäĿűĜĿſĿĿŀÖŀƛŀĿŀĿĿƵŲĿĿŀĿÏŀŀŀķŀîŀüŠĿëĿĨŀƀĿĿĿÐŵĿƊÑőŀŕĿĿĿĿŀŀƋŀĿŁĿŬŪĿĿŀœúƀŀŀŘĒŀĿơŨƜŅųĶĿźŀĿţŀŴŀƆáĿÏĿĿŀÉĿĿĿšƸĿţĿæŀƃŀāëĿĿŀƁĕĿĿĿůŀŀŀñŀĿĿſĒùĦĳƷĜƩŀĿĿĂĕŀŀŒĿĿŀŗĿÕŀãÛŻŚŀŀŀŶèžŀĿÏƫưŀğƉáīĿČŀĿŭƄƁĿŖĿĿůĿơŞŀĿųƶŀŀŀŀūưŀŀƺúĿŀŀŉĿÈĿŀĿŀƺĄŏÉĿŀĿŀŀâśĿŸŀĿĿŀĿÕíĿĿĿŕĘœĿưƢƜĿÕĿŀĿŁĿƲŔŀŀĿŀĿƎŀŀŀŀŀśŀÿŢŀŘÂĿàéŨĸĿĄĩÑĿƊāč×ĿĿŀŀİƷĿƼŀŀĿƎĿŀŀĊÝŀčĿŀĿƲŀƾŀŀƬĢĿĿƿŀƋŀĿŀƀĿŀĎáõÌůŲĿŀþưŖŬĿëƪŀŀŀŀŠĿĄĿĿĭƇĿäŀêĿŀüŀƬĿŀƨŀŤêþĖŀŀƓƛŵƀŀĿůÔõŀøĿŖĿĿĨĿĿāĿĄĿŀƇƇŀŀŀÔŀĿĿƜÝĿĿĿſŀĜŀķƷƀƁŀãęŀŀĿŭƜĿŊŉĿźĿĿŀũŀŀĿċőĿČĿĄůĿĿŀĿĿŸŀüĿûĿŀƨŀĿĺìĖŀĿŀƨĿĿ×ÿĿƘÅĳƟíŴŀĿŕŀŌĿĿƣŀÉåĿĿĿĿŪĿÕƃůźŀŀìưźĿĿĨĿĿĿ×ďŅŀŀİĿśĢíŀŀśŀŀŕŀŘĿƷĿöŀŀŀĿçŀĿƊçŀÎŀúŀŀñưĿŔŲĒĿŀŀňĝÅţÔőŀƌĿŀĿĿŀŀĿŀĿĿČĿƶĿĿŀŤĿĿŕĿäĿƷĢĿŀáĿĄĿăčƋŀĿŀƀŀĿĿÒõäċœŐŀŀƇëŀûÈĿĞĿđŀšŲŀĿŮŀĿĚċƷŀŀƂĿŀŀŒôŀŕŬŀŧĿĿÑûüĿŀĿŀƨĦĿĿ×ƗţúŀİŀŀĿĿŀŀŀĜíŀ×ĿĿŀøŀūĿÏŀĿŀŀƈƱŪĿĿŀĿĿŀďŧƄŀÂ÷ŀýŀĿĿŸĿŀïÔÓŀøŀĿưĿĨĿęƩêƎĻĜŀƬĿĿĿƸŀŀňíĿăÓőƘŀƄĿûĿŀŀƋŀŀŀĿŬĿæĿŀŀƙçÛĿĺôĿŀĿĿĿÌĿĿĿŀĿŀ×ŀĮŀĶŀŀğšŠŞĿčĕƕÙĿĿĿŀÓƧìì';
const noise = new Int8Array(b256Noise.split('').map(c => c.charCodeAt(0) - 192));

function GenerateWhiteNoise(Len: number) {
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
  for (let set = 0; set < 31; set++) {
    const fre = (freq * 1.25) / 100.0;
    // Filter all squares individually
    const dstLowSquares = Array.from<number[]>({ length: 0x20 });
    const dstHighSquares = Array.from<number[]>({ length: 0x20 });
    for (let i = 0; i < 0x20; i++) {
      const square = src[Waveform.SQUARE].slice(i * 0x80, (i + 1) * 0x80);
      [dstLowSquares[i], dstHighSquares[i]] = Filter(square, fre);
    }

    const [lowTri04, highTri04] = Filter(src[Waveform.TRIANGLE][0], fre);
    const [lowTri08, highTri08] = Filter(src[Waveform.TRIANGLE][1], fre);
    const [lowTri10, highTri10] = Filter(src[Waveform.TRIANGLE][2], fre);
    const [lowTri20, highTri20] = Filter(src[Waveform.TRIANGLE][3], fre);
    const [lowTri40, highTri40] = Filter(src[Waveform.TRIANGLE][4], fre);
    const [lowTri80, highTri80] = Filter(src[Waveform.TRIANGLE][5], fre);
    const [lowSaw04, highSaw04] = Filter(src[Waveform.SAWTOOTH][0], fre);
    const [lowSaw08, highSaw08] = Filter(src[Waveform.SAWTOOTH][1], fre);
    const [lowSaw10, highSaw10] = Filter(src[Waveform.SAWTOOTH][2], fre);
    const [lowSaw20, highSaw20] = Filter(src[Waveform.SAWTOOTH][3], fre);
    const [lowSaw40, highSaw40] = Filter(src[Waveform.SAWTOOTH][4], fre);
    const [lowSaw80, highSaw80] = Filter(src[Waveform.SAWTOOTH][5], fre);
    const [lowWhiteNoiseBig, highWhiteNoiseBig] = Filter(src[Waveform.WNOISE], fre);

    filterSets[set] = [
      undefined,
      [lowTri04, lowTri08, lowTri10, lowTri20, lowTri40, lowTri80],
      [lowSaw04, lowSaw08, lowSaw10, lowSaw20, lowSaw40, lowSaw80],
      dstLowSquares.flat(),
      lowWhiteNoiseBig,
    ];
    filterSets[set + 32] = [
      undefined,
      [highTri04, highTri08, highTri10, highTri20, highTri40, highTri80],
      [highSaw04, highSaw08, highSaw10, highSaw20, highSaw40, highSaw80],
      dstHighSquares.flat(),
      highWhiteNoiseBig,
    ];

    freq += 3;
  }
}

export class AHXPlayer {
  StepWaitFrames = 0;
  GetNewPosition = false;
  SongEndReached = false;
  PatternBreak = false;
  MainVolume = 0x40;
  Tempo = 0;
  PosNr = 0;
  PosJump = 0;
  NoteNr = 0;
  PosJumpNote = 0;
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

  InitSong(song: AHXSong, subsong = 0) {
    this.Song = song;
    this.InitSubsong(subsong);
  }

  InitSubsong(Nr: number) {
    if (Nr > this.Song.Subsongs.length) return 0;

    if (Nr === 0) this.PosNr = 0;
    else this.PosNr = this.Song.Subsongs[Nr - 1];

    this.PosJump = 0;
    this.PatternBreak = false;
    this.NoteNr = this.PosJumpNote = 0;
    this.Tempo = 6;
    this.StepWaitFrames = 0;
    this.GetNewPosition = true;
    this.SongEndReached = false;
    this.PlayingTime = 0;
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
        this.GetNewPosition = false;
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
          this.PatternBreak = true;
        }
      }
      if (this.PatternBreak) {
        this.PatternBreak = false;
        this.NoteNr = this.PosJumpNote;
        this.PosJumpNote = 0;
        this.PosNr = this.PosJump;
        this.PosJump = 0;
        if (this.PosNr >= this.Song.PositionNr) {
          this.SongEndReached = true;
          this.PosNr = this.Song.Restart;
        }
        this.GetNewPosition = true;
      }
    }
    //RemainPosition
    this.Voices.forEach(voice => this.SetAudio(voice));
  }

  NextPosition() {
    this.SetPosition(this.PosNr + 1 === this.Song.PositionNr ? 0 : this.PosNr + 1);
  }

  PrevPosition() {
    this.SetPosition(this.PosNr - 1);
  }

  SetPosition(n: number) {
    this.PosNr = clamp(n, 0, this.Song.PositionNr - 1);
    this.StepWaitFrames = 0;
    this.GetNewPosition = true;
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
        this.PatternBreak = true;
        break;
      case 0xd: // Patternbreak
        this.PosJump = this.PosNr + 1;
        this.PosJumpNote = (FXParam & 0x0f) + (FXParam >> 4) * 10;
        if (this.PosJumpNote > this.Song.TrackLength) this.PosJumpNote = 0;
        this.PatternBreak = true;
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
      voice.PerfSpeed = voice.Instrument.PerfSpeed;
      voice.PerfList = voice.Instrument.PerfList;
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
    if (voice.Instrument && voice.PerfCurrent < voice.Instrument.PerfList.length) {
      if (--voice.PerfWait <= 0) {
        const Cur = voice.PerfCurrent++;
        const { FX, FXParam, Fixed, Note, Waveform } = voice.PerfList[Cur];
        voice.PerfWait = voice.PerfSpeed;
        if (Waveform) {
          voice.Waveform = Waveform;
          voice.NewWaveform = true;
          voice.PeriodPerfSlideSpeed = voice.PeriodPerfSlidePeriod = 0;
        }
        //Holdwave
        voice.PeriodPerfSlideOn = 0;
        this.PListCommandParse(voice, FX[0], FXParam[0]);
        this.PListCommandParse(voice, FX[1], FXParam[1]);
        //GetNote
        if (Note) {
          voice.InstrPeriod = Note;
          voice.PlantPeriod = 1;
          voice.FixedNote = Fixed;
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
    if (voice.Waveform === Waveform.SQUARE && voice.SquareOn) {
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
      voice.NewWaveform = true;
      voice.FilterWait = voice.FilterSpeed - 3;
      if (voice.FilterWait < 1) voice.FilterWait = 1;
    }
    if (voice.Waveform === Waveform.SQUARE || voice.PlantSquare) {
      //CalcSquare
      const SquarePtr = this.Waves[clamp(voice.FilterPos - 1, 0, 62)][Waveform.SQUARE];
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
      voice.NewWaveform = true;
      voice.Waveform = Waveform.SQUARE;
      voice.PlantSquare = 0;
    }
    if (voice.Waveform === Waveform.WNOISE)
      // white noise
      voice.NewWaveform = true;

    if (voice.NewWaveform) {
      if (voice.Waveform !== Waveform.SQUARE) {
        // don't process square
        const FilterSet = clamp(voice.FilterPos - 1, 0, 62);

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
      if (voice.Waveform === Waveform.WNOISE) {
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
          voice.NewWaveform = true;
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
            voice.SquareSign = (FXParam & 0x0f) === 0x0f ? -1 : 1;
          }
          if (FXParam & 0xf0) {
            voice.FilterInit = voice.FilterOn ^= 1;
            voice.FilterSign = (FXParam & 0xf0) === 0xf0 ? -1 : 1;
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
  BufferSize = 0;
  MixingBuffer: number[] = [];

  constructor(
    public Player = new AHXPlayer(),
    public Frequency = 48000,
    public Bits = 16,
  ) {
    this.BufferSize = Math.floor(Frequency / 50);
    this.MixingBuffer = Array.from({ length: this.BufferSize });
  }

  MixBuffer() {
    // Output: 1 amiga(50hz)-frame of audio data
    this.BufferSize = Math.floor(this.Frequency / 50 / this.Player.Song.SpeedMultiplier);
    this.MixingBuffer.fill(0, 0, this.BufferSize);
    const period2Freq2delta = (3579545.25 * (1 << 16)) / this.Frequency;
    const maxPos = 0x280 << 16;
    this.Player.PlayIRQ();
    for (let v = 0; v < 4; v++) {
      const { VoiceBuffer, VoiceVolume, VoicePeriod } = this.Player.Voices[v];
      if (VoiceVolume === 0) continue;
      const delta = Math.floor(period2Freq2delta / VoicePeriod);
      let samplesToMix = this.BufferSize;
      let mixpos = 0;
      while (samplesToMix) {
        if (this.pos[v] >= maxPos) this.pos[v] -= maxPos;
        const remaining = Math.floor((maxPos - this.pos[v] - 1) / delta) + 1;
        const thiscount = Math.min(samplesToMix, remaining);
        samplesToMix -= thiscount;
        for (let i = 0; i < thiscount; i++) {
          this.MixingBuffer[mixpos++] += (VoiceBuffer[this.pos[v] >> 16] * VoiceVolume) >> 6;
          this.pos[v] += delta;
        }
      }
    }
  }
}
