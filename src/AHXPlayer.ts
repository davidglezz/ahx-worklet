import type { AHXSong } from './AHXSong.ts';
import { AHXVoice } from './AHXVoice.ts';
import { buildAHXWaves } from './AHXWaves.ts';
import { toSixtyTwo } from './utils.ts';

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
  WavesFilterSets = buildAHXWaves();
  Voices: AHXVoice[] & { length: 0 | 4 } = [];
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
    this.Voices = [new AHXVoice(), new AHXVoice(), new AHXVoice(), new AHXVoice()];
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
        for (let i = 0; i < 4; i++) {
          this.Voices[i].Track = this.Song.Positions[this.PosNr].Track[i];
          this.Voices[i].Transpose = this.Song.Positions[this.PosNr].Transpose[i];
          this.Voices[i].NextTrack = this.Song.Positions[NextPos].Track[i];
          this.Voices[i].NextTranspose = this.Song.Positions[NextPos].Transpose[i];
        }
        this.GetNewPosition = 0;
      }
      for (let i = 0; i < 4; i++) this.ProcessStep(i);
      this.StepWaitFrames = this.Tempo;
    }
    //DoFrameStuff
    for (let i = 0; i < 4; i++) this.ProcessFrame(i);
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
    for (let a = 0; a < 4; a++) this.SetAudio(a);
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

  ProcessStep(v: number) {
    if (!this.Voices[v].TrackOn) return;
    this.Voices[v].VolumeSlideUp = this.Voices[v].VolumeSlideDown = 0;

    let Note = this.Song.Tracks[this.Song.Positions[this.PosNr].Track[v]][this.NoteNr].Note;
    const Instrument =
      this.Song.Tracks[this.Song.Positions[this.PosNr].Track[v]][this.NoteNr].Instrument;
    const FX = this.Song.Tracks[this.Song.Positions[this.PosNr].Track[v]][this.NoteNr].FX;
    let FXParam = this.Song.Tracks[this.Song.Positions[this.PosNr].Track[v]][this.NoteNr].FXParam;

    switch (FX) {
      case 0x0: // Position Jump HI
        if ((FXParam & 0xf) > 0 && (FXParam & 0xf) <= 9) this.PosJump = FXParam & 0xf;
        break;
      case 0x5: // Volume Slide + Tone Portamento
      case 0xa: // Volume Slide
        this.Voices[v].VolumeSlideDown = FXParam & 0x0f;
        this.Voices[v].VolumeSlideUp = FXParam >> 4;
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
              this.Voices[v].NoteCutWait = FXParam & 0x0f;
              if (this.Voices[v].NoteCutWait) {
                this.Voices[v].NoteCutOn = 1;
                this.Voices[v].HardCutRelease = 0;
              }
            }
            break;
          case 0xd: // Note Delay
            if (this.Voices[v].NoteDelayOn) {
              this.Voices[v].NoteDelayOn = 0;
            } else {
              if ((FXParam & 0x0f) < this.Tempo) {
                this.Voices[v].NoteDelayWait = FXParam & 0x0f;
                if (this.Voices[v].NoteDelayWait) {
                  this.Voices[v].NoteDelayOn = 1;
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
      this.Voices[v].PerfSubVolume = 0x40;
      this.Voices[v].PeriodSlideSpeed =
        this.Voices[v].PeriodSlidePeriod =
        this.Voices[v].PeriodSlideLimit =
          0;
      this.Voices[v].ADSRVolume = 0;
      if (Instrument < this.Song.Instruments.length) {
        this.Voices[v].Instrument = this.Song.Instruments[Instrument];
      } else {
        // Overriding instrument
        this.Voices[v].Instrument = this.Song.Instruments[0];
      }
      this.Voices[v].CalcADSR();
      //InitOnInstrument
      this.Voices[v].WaveLength = this.Voices[v].Instrument.WaveLength;
      this.Voices[v].NoteMaxVolume = this.Voices[v].Instrument.Volume;
      //InitVibrato
      this.Voices[v].VibratoCurrent = 0;
      this.Voices[v].VibratoDelay = this.Voices[v].Instrument.VibratoDelay;
      this.Voices[v].VibratoDepth = this.Voices[v].Instrument.VibratoDepth;
      this.Voices[v].VibratoSpeed = this.Voices[v].Instrument.VibratoSpeed;
      this.Voices[v].VibratoPeriod = 0;
      //InitHardCut
      this.Voices[v].HardCutRelease = this.Voices[v].Instrument.HardCutRelease;
      this.Voices[v].HardCut = this.Voices[v].Instrument.HardCutReleaseFrames;
      //InitSquare
      this.Voices[v].IgnoreSquare = this.Voices[v].SquareSlidingIn = 0;
      this.Voices[v].SquareWait = this.Voices[v].SquareOn = 0;
      let SquareLower =
        this.Voices[v].Instrument.SquareLowerLimit >> (5 - this.Voices[v].WaveLength);
      let SquareUpper =
        this.Voices[v].Instrument.SquareUpperLimit >> (5 - this.Voices[v].WaveLength);
      if (SquareUpper < SquareLower) {
        const t = SquareUpper;
        SquareUpper = SquareLower;
        SquareLower = t;
      }
      this.Voices[v].SquareUpperLimit = SquareUpper;
      this.Voices[v].SquareLowerLimit = SquareLower;
      //InitFilter
      this.Voices[v].IgnoreFilter = this.Voices[v].FilterWait = this.Voices[v].FilterOn = 0;
      this.Voices[v].FilterSlidingIn = 0;
      let d6 = this.Voices[v].Instrument.FilterSpeed;
      let d3 = this.Voices[v].Instrument.FilterLowerLimit;
      let d4 = this.Voices[v].Instrument.FilterUpperLimit;
      if (d3 & 0x80) d6 |= 0x20;
      if (d4 & 0x80) d6 |= 0x40;
      this.Voices[v].FilterSpeed = d6;
      d3 &= ~0x80;
      d4 &= ~0x80;
      if (d3 > d4) {
        const t = d3;
        d3 = d4;
        d4 = t;
      }
      this.Voices[v].FilterUpperLimit = d4;
      this.Voices[v].FilterLowerLimit = d3;
      this.Voices[v].FilterPos = 32;
      //Init PerfList
      this.Voices[v].PerfWait = this.Voices[v].PerfCurrent = 0;
      this.Voices[v].PerfSpeed = this.Voices[v].Instrument.PList.Speed;
      this.Voices[v].PerfList = this.Voices[v].Instrument.PList;
    }
    //NoInstrument
    this.Voices[v].PeriodSlideOn = 0;

    switch (FX) {
      case 0x4: // Override filter
        break;
      case 0x9: // Set Squarewave-Offset
        this.Voices[v].SquarePos = FXParam >> (5 - this.Voices[v].WaveLength);
        this.Voices[v].PlantSquare = 1;
        this.Voices[v].IgnoreSquare = 1;
        break;
      case 0x5: // Tone Portamento + Volume Slide
      case 0x3: // Tone Portamento (Period Slide Up/Down w/ Limit)
        if (FXParam !== 0) this.Voices[v].PeriodSlideSpeed = FXParam;
        if (Note) {
          let Neue = this.PeriodTable[Note];
          let Alte = this.PeriodTable[this.Voices[v].TrackPeriod];
          Alte -= Neue;
          Neue = Alte + this.Voices[v].PeriodSlidePeriod;
          if (Neue) this.Voices[v].PeriodSlideLimit = -Alte;
        }
        this.Voices[v].PeriodSlideOn = 1;
        this.Voices[v].PeriodSlideWithLimit = 1;
        Note = 0;
    }

    // Note anschlagen
    if (Note) {
      this.Voices[v].TrackPeriod = Note;
      this.Voices[v].PlantPeriod = 1;
    }

    switch (FX) {
      case 0x1: // Portamento up (Period slide down)
        this.Voices[v].PeriodSlideSpeed = -FXParam;
        this.Voices[v].PeriodSlideOn = 1;
        this.Voices[v].PeriodSlideWithLimit = 0;
        break;
      case 0x2: // Portamento down (Period slide up)
        this.Voices[v].PeriodSlideSpeed = FXParam;
        this.Voices[v].PeriodSlideOn = 1;
        this.Voices[v].PeriodSlideWithLimit = 0;
        break;
      case 0xc: // Volume
        if (FXParam <= 0x40) this.Voices[v].NoteMaxVolume = FXParam;
        else {
          FXParam -= 0x50;
          if (FXParam <= 0x40)
            for (let i = 0; i < 4; i++) this.Voices[i].TrackMasterVolume = FXParam;
          else {
            FXParam -= 0xa0 - 0x50;
            if (FXParam <= 0x40) this.Voices[v].TrackMasterVolume = FXParam;
          }
        }
        break;
      case 0xe: // Enhanced commands
        switch (FXParam >> 4) {
          case 0x1: // Fineslide up (Period fineslide down)
            this.Voices[v].PeriodSlidePeriod = -(FXParam & 0x0f);
            this.Voices[v].PlantPeriod = 1;
            break;
          case 0x2: // Fineslide down (Period fineslide up)
            this.Voices[v].PeriodSlidePeriod = FXParam & 0x0f;
            this.Voices[v].PlantPeriod = 1;
            break;
          case 0x4: // Vibrato control
            this.Voices[v].VibratoDepth = FXParam & 0x0f;
            break;
          case 0xa: // Finevolume up
            this.Voices[v].NoteMaxVolume += FXParam & 0x0f;
            if (this.Voices[v].NoteMaxVolume > 0x40) this.Voices[v].NoteMaxVolume = 0x40;
            break;
          case 0xb: // Finevolume down
            this.Voices[v].NoteMaxVolume -= FXParam & 0x0f;
            if (this.Voices[v].NoteMaxVolume < 0) this.Voices[v].NoteMaxVolume = 0;
            break;
        }
        break;
    }
  }

  ProcessFrame(v: number) {
    if (!this.Voices[v].TrackOn) return;

    if (this.Voices[v].NoteDelayOn) {
      if (this.Voices[v].NoteDelayWait <= 0) this.ProcessStep(v);
      else this.Voices[v].NoteDelayWait--;
    }
    if (this.Voices[v].HardCut) {
      let NextInstrument;
      if (this.NoteNr + 1 < this.Song.TrackLength)
        NextInstrument = this.Song.Tracks[this.Voices[v].Track][this.NoteNr + 1].Instrument;
      else NextInstrument = this.Song.Tracks[this.Voices[v].NextTrack][0].Instrument;
      if (NextInstrument) {
        let d1 = this.Tempo - this.Voices[v].HardCut;
        if (d1 < 0) d1 = 0;
        if (!this.Voices[v].NoteCutOn) {
          this.Voices[v].NoteCutOn = 1;
          this.Voices[v].NoteCutWait = d1;
          this.Voices[v].HardCutReleaseF = -(d1 - this.Tempo);
        } else this.Voices[v].HardCut = 0;
      }
    }
    if (this.Voices[v].NoteCutOn) {
      if (this.Voices[v].NoteCutWait <= 0) {
        this.Voices[v].NoteCutOn = 0;
        if (this.Voices[v].HardCutRelease) {
          this.Voices[v].ADSR.rVolume =
            -(this.Voices[v].ADSRVolume - (this.Voices[v].Instrument.Envelope.rVolume << 8)) /
            this.Voices[v].HardCutReleaseF;
          this.Voices[v].ADSR.rFrames = this.Voices[v].HardCutReleaseF;
          this.Voices[v].ADSR.aFrames =
            this.Voices[v].ADSR.dFrames =
            this.Voices[v].ADSR.sFrames =
              0;
        } else this.Voices[v].NoteMaxVolume = 0;
      } else this.Voices[v].NoteCutWait--;
    }
    //adsrEnvelope
    if (this.Voices[v].ADSR.aFrames) {
      this.Voices[v].ADSRVolume += this.Voices[v].ADSR.aVolume; // Delta
      if (--this.Voices[v].ADSR.aFrames <= 0)
        this.Voices[v].ADSRVolume = this.Voices[v].Instrument.Envelope.aVolume << 8;
    } else if (this.Voices[v].ADSR.dFrames) {
      this.Voices[v].ADSRVolume += this.Voices[v].ADSR.dVolume; // Delta
      if (--this.Voices[v].ADSR.dFrames <= 0)
        this.Voices[v].ADSRVolume = this.Voices[v].Instrument.Envelope.dVolume << 8;
    } else if (this.Voices[v].ADSR.sFrames) {
      this.Voices[v].ADSR.sFrames--;
    } else if (this.Voices[v].ADSR.rFrames) {
      this.Voices[v].ADSRVolume += this.Voices[v].ADSR.rVolume; // Delta
      if (--this.Voices[v].ADSR.rFrames <= 0)
        this.Voices[v].ADSRVolume = this.Voices[v].Instrument.Envelope.rVolume << 8;
    }
    //VolumeSlide
    this.Voices[v].NoteMaxVolume =
      this.Voices[v].NoteMaxVolume + this.Voices[v].VolumeSlideUp - this.Voices[v].VolumeSlideDown;
    if (this.Voices[v].NoteMaxVolume < 0) this.Voices[v].NoteMaxVolume = 0;
    if (this.Voices[v].NoteMaxVolume > 0x40) this.Voices[v].NoteMaxVolume = 0x40;
    //Portamento
    if (this.Voices[v].PeriodSlideOn) {
      if (this.Voices[v].PeriodSlideWithLimit) {
        let d0 = this.Voices[v].PeriodSlidePeriod - this.Voices[v].PeriodSlideLimit;
        let d2 = this.Voices[v].PeriodSlideSpeed;
        if (d0 > 0) d2 = -d2;
        if (d0) {
          const d3 = (d0 + d2) ^ d0;
          if (d3 >= 0) d0 = this.Voices[v].PeriodSlidePeriod + d2;
          else d0 = this.Voices[v].PeriodSlideLimit;
          this.Voices[v].PeriodSlidePeriod = d0;
          this.Voices[v].PlantPeriod = 1;
        }
      } else {
        this.Voices[v].PeriodSlidePeriod += this.Voices[v].PeriodSlideSpeed;
        this.Voices[v].PlantPeriod = 1;
      }
    }
    //Vibrato
    if (this.Voices[v].VibratoDepth) {
      if (this.Voices[v].VibratoDelay <= 0) {
        this.Voices[v].VibratoPeriod =
          (this.VibratoTable[this.Voices[v].VibratoCurrent] * this.Voices[v].VibratoDepth) >> 7;
        this.Voices[v].PlantPeriod = 1;
        this.Voices[v].VibratoCurrent =
          (this.Voices[v].VibratoCurrent + this.Voices[v].VibratoSpeed) & 0x3f;
      } else this.Voices[v].VibratoDelay--;
    }
    //PList
    if (
      this.Voices[v].Instrument &&
      this.Voices[v].PerfCurrent < this.Voices[v].Instrument.PList.Length
    ) {
      if (--this.Voices[v].PerfWait <= 0) {
        const Cur = this.Voices[v].PerfCurrent++;
        this.Voices[v].PerfWait = this.Voices[v].PerfSpeed;
        if (this.Voices[v].PerfList.Entries[Cur].Waveform) {
          this.Voices[v].Waveform = this.Voices[v].PerfList.Entries[Cur].Waveform - 1;
          this.Voices[v].NewWaveform = 1;
          this.Voices[v].PeriodPerfSlideSpeed = this.Voices[v].PeriodPerfSlidePeriod = 0;
        }
        //Holdwave
        this.Voices[v].PeriodPerfSlideOn = 0;
        for (let i = 0; i < 2; i++)
          this.PListCommandParse(
            v,
            this.Voices[v].PerfList.Entries[Cur].FX[i],
            this.Voices[v].PerfList.Entries[Cur].FXParam[i],
          );
        //GetNote
        if (this.Voices[v].PerfList.Entries[Cur].Note) {
          this.Voices[v].InstrPeriod = this.Voices[v].PerfList.Entries[Cur].Note;
          this.Voices[v].PlantPeriod = 1;
          this.Voices[v].FixedNote = this.Voices[v].PerfList.Entries[Cur].Fixed;
        }
      }
    } else {
      if (this.Voices[v].PerfWait) this.Voices[v].PerfWait--;
      else this.Voices[v].PeriodPerfSlideSpeed = 0;
    }
    //PerfPortamento
    if (this.Voices[v].PeriodPerfSlideOn) {
      this.Voices[v].PeriodPerfSlidePeriod -= this.Voices[v].PeriodPerfSlideSpeed;
      if (this.Voices[v].PeriodPerfSlidePeriod) this.Voices[v].PlantPeriod = 1;
    }
    if (this.Voices[v].Waveform === 3 - 1 && this.Voices[v].SquareOn) {
      if (--this.Voices[v].SquareWait <= 0) {
        const d1 = this.Voices[v].SquareLowerLimit;
        const d2 = this.Voices[v].SquareUpperLimit;
        let d3 = this.Voices[v].SquarePos;
        if (this.Voices[v].SquareInit) {
          this.Voices[v].SquareInit = 0;
          if (d3 <= d1) {
            this.Voices[v].SquareSlidingIn = 1;
            this.Voices[v].SquareSign = 1;
          } else if (d3 >= d2) {
            this.Voices[v].SquareSlidingIn = 1;
            this.Voices[v].SquareSign = -1;
          }
        }
        //NoSquareInit
        if (d1 === d3 || d2 === d3) {
          if (this.Voices[v].SquareSlidingIn) {
            this.Voices[v].SquareSlidingIn = 0;
          } else {
            this.Voices[v].SquareSign = -this.Voices[v].SquareSign;
          }
        }
        d3 += this.Voices[v].SquareSign;
        this.Voices[v].SquarePos = d3;
        this.Voices[v].PlantSquare = 1;
        this.Voices[v].SquareWait = this.Voices[v].Instrument.SquareSpeed;
      }
    }
    if (this.Voices[v].FilterOn && --this.Voices[v].FilterWait <= 0) {
      const d1 = this.Voices[v].FilterLowerLimit;
      const d2 = this.Voices[v].FilterUpperLimit;
      let d3 = this.Voices[v].FilterPos;
      if (this.Voices[v].FilterInit) {
        this.Voices[v].FilterInit = 0;
        if (d3 <= d1) {
          this.Voices[v].FilterSlidingIn = 1;
          this.Voices[v].FilterSign = 1;
        } else if (d3 >= d2) {
          this.Voices[v].FilterSlidingIn = 1;
          this.Voices[v].FilterSign = -1;
        }
      }
      //NoFilterInit
      const FMax = this.Voices[v].FilterSpeed < 3 ? 5 - this.Voices[v].FilterSpeed : 1;
      for (let i = 0; i < FMax; i++) {
        if (d1 === d3 || d2 === d3) {
          if (this.Voices[v].FilterSlidingIn) {
            this.Voices[v].FilterSlidingIn = 0;
          } else {
            this.Voices[v].FilterSign = -this.Voices[v].FilterSign;
          }
        }
        d3 += this.Voices[v].FilterSign;
      }
      this.Voices[v].FilterPos = d3;
      this.Voices[v].NewWaveform = 1;
      this.Voices[v].FilterWait = this.Voices[v].FilterSpeed - 3;
      if (this.Voices[v].FilterWait < 1) this.Voices[v].FilterWait = 1;
    }
    if (this.Voices[v].Waveform === 3 - 1 || this.Voices[v].PlantSquare) {
      //CalcSquare
      const SquarePtr = this.WavesFilterSets[toSixtyTwo(this.Voices[v].FilterPos - 1)].Squares;
      let SquareOfs = 0;
      let X = this.Voices[v].SquarePos << (5 - this.Voices[v].WaveLength);
      if (X > 0x20) {
        X = 0x40 - X;
        this.Voices[v].SquareReverse = 1;
      }
      //OkDownSquare
      if (X--) SquareOfs = X * 0x80; // <- WTF!?
      const Delta = 32 >> this.Voices[v].WaveLength;
      //WaveformTab[3-1] = this.Voices[v].SquareTempBuffer;
      const AudioLen = (1 << this.Voices[v].WaveLength) * 4;
      this.Voices[v].AudioSource = Array.from({ length: AudioLen });
      for (let i = 0; i < AudioLen; i++) {
        this.Voices[v].AudioSource[i] = SquarePtr[SquareOfs];
        SquareOfs += Delta;
      }
      this.Voices[v].NewWaveform = 1;
      this.Voices[v].Waveform = 3 - 1;
      this.Voices[v].PlantSquare = 0;
    }
    if (this.Voices[v].Waveform === 4 - 1)
      // white noise
      this.Voices[v].NewWaveform = 1;

    if (this.Voices[v].NewWaveform) {
      if (this.Voices[v].Waveform !== 3 - 1) {
        // don't process square
        let FilterSet = 31;
        FilterSet = toSixtyTwo(this.Voices[v].FilterPos - 1);

        if (this.Voices[v].Waveform === 4 - 1) {
          // white noise
          const WNStart = this.WNRandom & (2 * 0x280 - 1) & ~1;
          this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].WhiteNoiseBig.slice(
            WNStart,
            WNStart + 0x280,
          );
          //AddRandomMoving
          //GoOnRandom
          this.WNRandom += 2239384;
          this.WNRandom = ((((this.WNRandom >> 8) | (this.WNRandom << 24)) + 782323) ^ 75) - 6735;
        } else if (this.Voices[v].Waveform === 1 - 1) {
          // triangle
          switch (this.Voices[v].WaveLength) {
            case 0:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Triangle04;
              break;
            case 1:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Triangle08;
              break;
            case 2:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Triangle10;
              break;
            case 3:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Triangle20;
              break;
            case 4:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Triangle40;
              break;
            case 5:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Triangle80;
              break;
          }
        } else if (this.Voices[v].Waveform === 2 - 1) {
          // sawtooth
          switch (this.Voices[v].WaveLength) {
            case 0:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Sawtooth04;
              break;
            case 1:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Sawtooth08;
              break;
            case 2:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Sawtooth10;
              break;
            case 3:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Sawtooth20;
              break;
            case 4:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Sawtooth40;
              break;
            case 5:
              this.Voices[v].AudioSource = this.WavesFilterSets[FilterSet].Sawtooth80;
              break;
          }
        }
      }
    }
    //StillHoldWaveform
    //AudioInitPeriod
    this.Voices[v].AudioPeriod = this.Voices[v].InstrPeriod;
    if (!this.Voices[v].FixedNote)
      this.Voices[v].AudioPeriod += this.Voices[v].Transpose + this.Voices[v].TrackPeriod - 1;
    if (this.Voices[v].AudioPeriod > 5 * 12) this.Voices[v].AudioPeriod = 5 * 12;
    if (this.Voices[v].AudioPeriod < 0) this.Voices[v].AudioPeriod = 0;
    this.Voices[v].AudioPeriod = this.PeriodTable[this.Voices[v].AudioPeriod];
    if (!this.Voices[v].FixedNote) this.Voices[v].AudioPeriod += this.Voices[v].PeriodSlidePeriod;
    this.Voices[v].AudioPeriod +=
      this.Voices[v].PeriodPerfSlidePeriod + this.Voices[v].VibratoPeriod;
    if (this.Voices[v].AudioPeriod > 0x0d60) this.Voices[v].AudioPeriod = 0x0d60;
    if (this.Voices[v].AudioPeriod < 0x0071) this.Voices[v].AudioPeriod = 0x0071;
    //AudioInitVolume
    this.Voices[v].AudioVolume =
      ((((((((this.Voices[v].ADSRVolume >> 8) * this.Voices[v].NoteMaxVolume) >> 6) *
        this.Voices[v].PerfSubVolume) >>
        6) *
        this.Voices[v].TrackMasterVolume) >>
        6) *
        this.MainVolume) >>
      6;
  }

  SetAudio(v: number) {
    if (!this.Voices[v].TrackOn) {
      this.Voices[v].VoiceVolume = 0;
      return;
    }

    this.Voices[v].VoiceVolume = this.Voices[v].AudioVolume;
    if (this.Voices[v].PlantPeriod) {
      this.Voices[v].PlantPeriod = 0;
      this.Voices[v].VoicePeriod = this.Voices[v].AudioPeriod;
    }
    if (this.Voices[v].NewWaveform) {
      if (this.Voices[v].Waveform === 4 - 1) {
        // for white noise, copy whole 0x280 samples
        this.Voices[v].VoiceBuffer = this.Voices[v].AudioSource;
      } else {
        const WaveLoops = (1 << (5 - this.Voices[v].WaveLength)) * 5;
        const LoopLen = 4 * (1 << this.Voices[v].WaveLength);
        if (!this.Voices[v].AudioSource.length) {
          // New or fill?
          this.Voices[v].VoiceBuffer = Array.from({ length: WaveLoops * LoopLen });
        } else {
          this.Voices[v].VoiceBuffer = [];
          for (let i = 0; i < WaveLoops; i++) {
            this.Voices[v].VoiceBuffer = this.Voices[v].VoiceBuffer.concat(
              this.Voices[v].AudioSource.slice(0, LoopLen),
            );
          }
        }
      }
      //this.Voices[v].VoiceBuffer[0x280] = this.Voices[v].VoiceBuffer[0];
    }
  }

  PListCommandParse(v: number, FX: number, FXParam: number) {
    switch (FX) {
      case 0:
        if (this.Song.Revision > 0 && FXParam !== 0) {
          if (this.Voices[v].IgnoreFilter) {
            this.Voices[v].FilterPos = this.Voices[v].IgnoreFilter;
            this.Voices[v].IgnoreFilter = 0;
          } else this.Voices[v].FilterPos = FXParam;
          this.Voices[v].NewWaveform = 1;
        }
        break;
      case 1:
        this.Voices[v].PeriodPerfSlideSpeed = FXParam;
        this.Voices[v].PeriodPerfSlideOn = 1;
        break;
      case 2:
        this.Voices[v].PeriodPerfSlideSpeed = -FXParam;
        this.Voices[v].PeriodPerfSlideOn = 1;
        break;
      case 3: // Init Square Modulation
        if (!this.Voices[v].IgnoreSquare) {
          this.Voices[v].SquarePos = FXParam >> (5 - this.Voices[v].WaveLength);
        } else this.Voices[v].IgnoreSquare = 0;
        break;
      case 4: // Start/Stop Modulation
        if (this.Song.Revision === 0 || FXParam === 0) {
          this.Voices[v].SquareInit = this.Voices[v].SquareOn ^= 1;
          this.Voices[v].SquareSign = 1;
        } else {
          if (FXParam & 0x0f) {
            this.Voices[v].SquareInit = this.Voices[v].SquareOn ^= 1;
            this.Voices[v].SquareSign = 1;
            if ((FXParam & 0x0f) === 0x0f) this.Voices[v].SquareSign = -1;
          }
          if (FXParam & 0xf0) {
            this.Voices[v].FilterInit = this.Voices[v].FilterOn ^= 1;
            this.Voices[v].FilterSign = 1;
            if ((FXParam & 0xf0) === 0xf0) this.Voices[v].FilterSign = -1;
          }
        }
        break;
      case 5: // Jump to Step [xx]
        this.Voices[v].PerfCurrent = FXParam;
        break;
      case 6: // Set Volume
        if (FXParam > 0x40) {
          if ((FXParam -= 0x50) >= 0) {
            if (FXParam <= 0x40) this.Voices[v].PerfSubVolume = FXParam;
            else if ((FXParam -= 0xa0 - 0x50) >= 0)
              if (FXParam <= 0x40) this.Voices[v].TrackMasterVolume = FXParam;
          }
        } else this.Voices[v].NoteMaxVolume = FXParam;
        break;
      case 7: // set speed
        this.Voices[v].PerfSpeed = this.Voices[v].PerfWait = FXParam;
        break;
    }
  }

  VoiceOnOff(Voice: number, OnOff: number) {
    if (Voice < 0 || Voice > 3) return;
    this.Voices[Voice].TrackOn = OnOff;
  }
}
