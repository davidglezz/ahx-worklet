import { AHXInstrument, AHXPlistEntry, AHXPosition, AHXTrack } from './types.ts';
import { readString } from './utils.ts';

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
  Positions: AHXPosition[] = [];
  Tracks: AHXTrack[];
  Instruments: AHXInstrument[] = [];
  Subsongs: number[] = [];

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
    for (let i = 0; i < this.SubsongNr; i++) {
      this.Subsongs.push((view.getUint8(SBPtr + 0) << 8) | view.getUint8(SBPtr + 1));
      SBPtr += 2;
    }

    // Position List /////////////////////////////////////
    for (let i = 0; i < this.PositionNr; i++) {
      const Pos: AHXPosition = { Track: [], Transpose: [] };
      for (let j = 0; j < 4; j++) {
        Pos.Track.push(view.getUint8(SBPtr++));
        Pos.Transpose.push(view.getInt8(SBPtr++));
      }
      this.Positions.push(Pos);
    }

    // Tracks ////////////////////////////////////////////
    this.Tracks = Array.from({ length: this.TrackNr + 1 });
    for (let i = 0; i < this.Tracks.length; i++) {
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
      this.Tracks[i] = Track;
    }

    // Instruments ///////////////////////////////////////
    // 0: empty instrument
    this.Instruments.push({
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
    });

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
      this.Instruments.push(Instrument);
    }
  }
}
