import './style.css';
import { AHXNode } from './ahx-node.ts';
import AHXProcessor from './ahx-worklet.ts?url';

const icons = {
  play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>play</title><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>`,
  stop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>stop</title><path d="M18,18H6V6H18V18Z" /></svg>`,
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h1>AHX worklet</h1>
  <div class="controls">
    <button id="play" class="btn-icon" type="button">${icons.play}</button>
    <input id="volume" type="range" min="0.0" max="1.0" step="0.01" value="1.0"/>
  </div>
  <div class="list">
    <dl id="songlist"></dl>
  </div>
`;

let ahxNode: AHXNode;
let gainNode: GainNode;
const context = await start();

document.querySelector<HTMLButtonElement>('#play')!.onclick = async (event: Event) => {
  if (context.state === 'suspended') {
    play(location.hash.slice(1));
    await context.resume();
    (event.target as HTMLButtonElement).innerHTML = icons.stop;
  } else {
    context.suspend();
    (event.target as HTMLButtonElement).innerHTML = icons.play;
  }
};

document.getElementById('volume')?.addEventListener('input', event => {
  gainNode.gain.value = Number((event.target as HTMLInputElement).value);
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
  context.onstatechange = () => console.log(`AudioContext: ${context.state}`); // eslint-disable-line no-console
  console.log('Creating AudioContext...'); // eslint-disable-line no-console
  await context.audioWorklet.addModule(AHXProcessor);
  gainNode = context.createGain();
  gainNode.connect(context.destination);
  ahxNode = new AHXNode(context);
  ahxNode.connect(gainNode);
  ahxNode.port.onmessage = console.log; // eslint-disable-line no-console
  return context;
}

async function play(songName: string) {
  if (!songName) {
    return;
  }
  const url = `https://modland.com/pub/modules/AHX/${songName}.ahx`;
  const songData = await loadBinary(url);
  await ahxNode.load(songData);
}

async function loadSongList() {
  const response = await fetch('songlist.txt');
  const data = await response.text();
  return data.split('\n').filter(Boolean);
}

async function displaySongList() {
  const list = document.querySelector<HTMLDListElement>('#songlist')!;
  const songs = await loadSongList();
  let currentAuthor = '';
  songs.forEach(song => {
    const dd = document.createElement('dd');
    const a = document.createElement('a');
    a.dataset.song = song;
    const [author, title] = song.split('/');
    if (author !== currentAuthor) {
      const dt = document.createElement('dt');
      dt.textContent = author;
      list.appendChild(dt);
      currentAuthor = author;
    }
    a.textContent = title;
    a.href = `#${encodeURIComponent(song)}`;
    dd.appendChild(a);
    list.appendChild(dd);
  });
}

displaySongList();
