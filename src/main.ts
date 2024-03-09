import './style.css';
import { AHXNode } from './ahx-node.ts';
import AHXProcessor from './ahx-worklet.ts?url';
import type { PositionEvent } from './types.ts';

const icons = {
  play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>play</title><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>`,
  stop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>stop</title><path d="M18,18H6V6H18V18Z" /></svg>`,
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h1>AHX worklet</h1>
  <div class="controls">
    <button id="play" class="btn-icon" type="button">${icons.play}</button>
    <input id="position" class="flex-fill" type="range" min="0.0" max="1.0" step="0.01" value="0"/>
    <input id="volume" type="range" min="0.0" max="1.0" step="0.01" value="1.0"/>
  </div>
  <div class="list" id="songlist"></div>
`;

const parts = {
  play: document.querySelector<HTMLButtonElement>('#play')!,
  position: document.querySelector<HTMLInputElement>('#position')!,
  volume: document.querySelector<HTMLInputElement>('#volume')!,
  songlist: document.querySelector<HTMLDivElement>('#songlist')!,
};

let ahxNode: AHXNode;
let gainNode: GainNode;
const context = await start();

parts.play.onclick = async () => {
  if (context.state === 'suspended') {
    play(location.hash.slice(1));
  } else {
    await context.suspend();
  }
};

parts.volume.addEventListener('input', event => {
  gainNode.gain.value = Number((event.target as HTMLInputElement).value);
});

parts.position.addEventListener('input', event => {
  ahxNode.setPosition(Number((event.target as HTMLInputElement).value));
});

window.addEventListener('hashchange', () => play(location.hash.slice(1)));

async function loadBinary(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.statusText} (${response.status})`);
  }
  return await response.arrayBuffer();
}

async function start(context = new AudioContext()) {
  context.onstatechange = () => {
    parts.play.innerHTML = icons[context.state === 'running' ? 'stop' : 'play'];
  };
  await context.audioWorklet.addModule(AHXProcessor);
  gainNode = context.createGain();
  gainNode.connect(context.destination);
  ahxNode = new AHXNode(context, {
    position: ({ value }: PositionEvent) => (parts.position.value = String(value)),
  });
  ahxNode.connect(gainNode);
  return context;
}

async function play(songName: string) {
  if (!songName) {
    return;
  }
  const url = `https://modland.com/pub/modules/AHX/${songName}.ahx`;
  const songData = await loadBinary(url);
  await ahxNode.load(songData);
  if (context.state !== 'running') {
    await context.resume();
  }
}

async function loadSongList() {
  const response = await fetch('songlist.txt');
  const data = await response.text();
  return data.split('\n').filter(Boolean);
}

async function displaySongList() {
  const list = document.querySelector<HTMLDListElement>('#songlist')!;
  const songs = (await loadSongList()).map(fileName => {
    const [author, ...titleParts] = fileName.split('/');
    return { author, title: titleParts.join('/'), fileName };
  });
  Object.entries(Object.groupBy(songs, s => s.author)).forEach(([author, songs]) => {
    const section = document.createElement('section');
    list.appendChild(section);

    const title = document.createElement('h3');
    title.textContent = author;
    section.appendChild(title);

    const ul = document.createElement('ul');
    section.appendChild(ul);
    songs.forEach(({ title, fileName }) => {
      const li = document.createElement('li');
      ul.appendChild(li);
      const a = document.createElement('a');
      a.dataset.song = fileName;
      a.textContent = title;
      a.href = `#${encodeURIComponent(fileName)}`;
      li.appendChild(a);
    });
  });
}

displaySongList();
