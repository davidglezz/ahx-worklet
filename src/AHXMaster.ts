export function AHXMaster() {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  if (typeof AudioContext != 'undefined') return new AHXMasterWebKit();
  else if (typeof new Audio().mozSetup != 'undefined') return new AHXMasterMoz();
  else throw new Error('No audio support in this browser!');
}

function AHXMasterWebKit(output) {
  this.Output = output || AHXOutput();
  this.AudioContext = null;
  this.AudioNode = null;

  this.Play = function (song) {
    // song = AHXSong()
    this.Output.Player.InitSong(song);
    this.Output.Player.InitSubsong(0);
    if (!this.AudioContext) this.AudioContext = new AudioContext();
    this.Output.Init(this.AudioContext.sampleRate, 16);
    this.bufferSize = 8192;
    this.bufferFull = 0;
    this.bufferOffset = 0;
    if (this.AudioNode) this.AudioNode.disconnect();
    this.AudioNode = this.AudioContext.createScriptProcessor(this.bufferSize);
    this.AudioNode.onaudioprocess = event => this.mixer(event);
    this.AudioNode.connect(this.AudioContext.destination);
  };

  this.mixer = function (e: AudioProcessingEvent) {
    let want = this.bufferSize;

    const buffer = e.outputBuffer;
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    let out = 0;

    while (want > 0) {
      if (this.bufferFull === 0) {
        this.Output.MixBuffer();
        this.bufferFull = this.Output.BufferSize;
        this.bufferOffset = 0;
      }

      let can = Math.min(this.bufferFull - this.bufferOffset, want);
      want -= can;
      while (can-- > 0) {
        const thissample = this.Output.MixingBuffer[this.bufferOffset++] / (128 * 4);
        left[out] = right[out] = thissample;
        out++;
      }
      if (this.bufferOffset >= this.bufferFull) {
        this.bufferOffset = this.bufferFull = 0;
      }
    }
  };

  this.init = function () {};

  this.reset = function () {};

  this.Stop = function () {
    this.AudioNode.disconnect();
  };

  this.init();
  this.reset();
  return this;
}

function AHXMasterMoz(output) {
  function AudioDataDestination(sampleRate, readFn) {
    // Initialize the audio output.
    const audio = new Audio();
    audio.mozSetup(1, sampleRate);
    this.audio = audio;

    let currentWritePosition = 0;
    const prebufferSize = sampleRate / 2; // buffer 500ms
    let tail = null;
    let tailPosition;

    // The function called with regular interval to populate
    // the audio output buffer.
    this.intervalId = setInterval(() => {
      let written;
      // Check if some data was not written in previous attempts.
      if (tail) {
        written = audio.mozWriteAudio(tail.subarray(tailPosition));
        currentWritePosition += written;
        tailPosition += written;
        if (tailPosition < tail.length) {
          // Not all the data was written, saving the tail...
          return; // ... and exit the function.
        }
        tail = null;
      }

      // Check if we need add some data to the audio output.
      const currentPosition = audio.mozCurrentSampleOffset();
      const available = currentPosition + prebufferSize - currentWritePosition;
      if (available > 0) {
        // Request some sound data from the callback function.
        const soundData = new Float32Array(available);
        readFn(soundData);

        // Writting the data.
        written = audio.mozWriteAudio(soundData);
        if (written < soundData.length) {
          // Not all the data was written, saving the tail.
          tail = soundData;
          tailPosition = written;
        }
        currentWritePosition += written;
      }
    }, 100);
  }

  this.Output = output || AHXOutput();

  this.Play = function (song) {
    // song = AHXSong()
    this.Output.Player.InitSong(song);
    this.Output.Player.InitSubsong(0);
    this.sampleRate = 44100;
    this.bufferFull = 0;
    this.bufferOffset = 0;
    this.Output.Init(this.sampleRate, 16);
    this.audioDestination = new AudioDataDestination(this.sampleRate, s => this.mixer(s));
  };

  this.mixer = function (soundData) {
    let want = soundData.length;

    let out = 0;

    while (want > 0) {
      if (this.bufferFull === 0) {
        this.Output.MixBuffer();
        this.bufferFull = this.Output.BufferSize;
        this.bufferOffset = 0;
      }

      let can = Math.min(this.bufferFull - this.bufferOffset, want);
      want -= can;
      while (can-- > 0) {
        const thissample = this.Output.MixingBuffer[this.bufferOffset++] / (128 * 4);
        soundData[out] = thissample;
        out++;
      }
      if (this.bufferOffset >= this.bufferFull) {
        this.bufferOffset = this.bufferFull = 0;
      }
    }
  };

  this.init = function () {};

  this.reset = function () {};

  this.Stop = function () {
    clearInterval(this.audioDestination.intervalId);
  };

  this.init();
  this.reset();
  return this;
}
