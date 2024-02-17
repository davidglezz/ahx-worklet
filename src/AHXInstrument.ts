import { AHXEnvelope } from './AHXEnvelope.ts';
import { AHXPList } from './AHXPList.ts';

export class AHXInstrument {
  Name = '';
  Volume = 0;
  WaveLength = 0;
  Envelope = new AHXEnvelope();
  FilterLowerLimit = 0;
  FilterUpperLimit = 0;
  FilterSpeed = 0;
  SquareLowerLimit = 0;
  SquareUpperLimit = 0;
  SquareSpeed = 0;
  VibratoDelay = 0;
  VibratoDepth = 0;
  VibratoSpeed = 0;
  HardCutRelease = 0;
  HardCutReleaseFrames = 0;
  PList = new AHXPList();
}
