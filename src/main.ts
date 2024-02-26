import './style.css';
import { AHXNode } from './ahx-node.ts';
import AHXProcessor from './ahx-worklet.ts?url';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>AHX worklet</h1>
    <div class="card">
      <button id="play" type="button">Play</button>
    </div>
    <div class="card">
      <ul id="songlist"></ul>
    </div>
  </div>
`;

let node: AHXNode;

document.querySelector<HTMLButtonElement>('#play')!.onclick = () => play(location.hash.slice(1));
window.addEventListener('hashchange', () => node && play(location.hash.slice(1)));

async function loadBinary(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.statusText} (${response.status})`);
  }
  return await response.arrayBuffer();
}

async function start(context: AudioContext) {
  await context.audioWorklet.addModule(AHXProcessor);
  const node = new AHXNode(context);
  node.connect(context.destination);
  node.port.onmessage = console.log; // eslint-disable-line no-console
  context.resume();
  return node;
}

async function play(songName: string) {
  if (!node) {
    node = await start(new AudioContext());
  }
  if (!songName) {
    return;
  }
  const url = `https://modland.com/pub/modules/AHX/${songName}.ahx`;
  const songData = await loadBinary(url);
  await node.load(songData);
}

async function loadSongList() {
  const response = await fetch('songlist.txt');
  const data = await response.text();
  return data.split('\n');
}

async function displaySongList() {
  const list = document.querySelector<HTMLUListElement>('#songlist')!;
  const songs = await loadSongList();
  songs.forEach(song => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.dataset.song = song;
    a.textContent = song;
    a.href = `#${encodeURIComponent(song)}`;
    li.appendChild(a);
    list.appendChild(li);
  });
}

displaySongList();
