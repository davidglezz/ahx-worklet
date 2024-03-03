import './style.css';
import { AHXNode } from './ahx-node.ts';
import AHXProcessor from './ahx-worklet.ts?url';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h1>AHX worklet</h1>
  <div class="card">
    <button id="play" type="button">Play</button>
  </div>
  <div class="list">
    <dl id="songlist"></dl>
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
