import { AHXInstrument } from './AHXInstrument.ts';
import { AHXPlistEntry } from './AHXPlistEntry.ts';
import { AHXPosition } from './AHXPosition.ts';
import type { AHXTrack } from './AHXStep.ts';
import { AHXStep } from './AHXStep.ts';
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
      const Pos = new AHXPosition();
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
      if ((view.getUint8(6) & 0x80) === 0x80 && i === 0) {
        // empty track
        Track.fill(new AHXStep());
      } else {
        for (let j = 0; j < this.TrackLength; j++) {
          const Step = new AHXStep();
          Step.Note = (view.getUint8(SBPtr) >> 2) & 0x3f;
          Step.Instrument = ((view.getUint8(SBPtr) & 0x3) << 4) | (view.getUint8(SBPtr + 1) >> 4);
          Step.FX = view.getUint8(SBPtr + 1) & 0xf;
          Step.FXParam = view.getUint8(SBPtr + 2);
          Track[j] = Step;
          SBPtr += 3;
        }
      }
      this.Tracks[i] = Track;
    }

    // Instruments ///////////////////////////////////////
    this.Instruments.push(new AHXInstrument()); // empty instrument 0
    for (let i = 1; i < this.InstrumentNr + 1; i++) {
      const Instrument = new AHXInstrument();
      Instrument.Name = readString(view, NamePtr);
      NamePtr += Instrument.Name.length + 1;
      Instrument.Volume = view.getUint8(SBPtr + 0);
      Instrument.FilterSpeed =
        ((view.getUint8(SBPtr + 1) >> 3) & 0x1f) | ((view.getUint8(SBPtr + 12) >> 2) & 0x20);
      Instrument.WaveLength = view.getUint8(SBPtr + 1) & 0x7;
      Instrument.Envelope.aFrames = view.getUint8(SBPtr + 2);
      Instrument.Envelope.aVolume = view.getUint8(SBPtr + 3);
      Instrument.Envelope.dFrames = view.getUint8(SBPtr + 4);
      Instrument.Envelope.dVolume = view.getUint8(SBPtr + 5);
      Instrument.Envelope.sFrames = view.getUint8(SBPtr + 6);
      Instrument.Envelope.rFrames = view.getUint8(SBPtr + 7);
      Instrument.Envelope.rVolume = view.getUint8(SBPtr + 8);
      Instrument.FilterLowerLimit = view.getUint8(SBPtr + 12) & 0x7f;
      Instrument.VibratoDelay = view.getUint8(SBPtr + 13);
      Instrument.HardCutReleaseFrames = (view.getUint8(SBPtr + 14) >> 4) & 7;
      Instrument.HardCutRelease = view.getUint8(SBPtr + 14) & 0x80 ? 1 : 0;
      Instrument.VibratoDepth = view.getUint8(SBPtr + 14) & 0xf;
      Instrument.VibratoSpeed = view.getUint8(SBPtr + 15);
      Instrument.SquareLowerLimit = view.getUint8(SBPtr + 16);
      Instrument.SquareUpperLimit = view.getUint8(SBPtr + 17);
      Instrument.SquareSpeed = view.getUint8(SBPtr + 18);
      Instrument.FilterUpperLimit = view.getUint8(SBPtr + 19) & 0x3f;
      Instrument.PList.Speed = view.getUint8(SBPtr + 20);
      Instrument.PList.Length = view.getUint8(SBPtr + 21);
      SBPtr += 22;

      //Instrument.PList.Entries=new AHXPListEntry[Instrument.PList.Length);
      for (let j = 0; j < Instrument.PList.Length; j++) {
        const Entry = new AHXPlistEntry();
        Entry.FX[0] = (view.getUint8(SBPtr + 0) >> 2) & 7;
        Entry.FX[1] = (view.getUint8(SBPtr + 0) >> 5) & 7;
        Entry.Waveform = ((view.getUint8(SBPtr + 0) << 1) & 6) | (view.getUint8(SBPtr + 1) >> 7);
        Entry.Fixed = (view.getUint8(SBPtr + 1) >> 6) & 1;
        Entry.Note = view.getUint8(SBPtr + 1) & 0x3f;
        Entry.FXParam[0] = view.getUint8(SBPtr + 2);
        Entry.FXParam[1] = view.getUint8(SBPtr + 3);
        Instrument.PList.Entries.push(Entry);
        SBPtr += 4;
      }
      this.Instruments.push(Instrument);
    }
  }
}
