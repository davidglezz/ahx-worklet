import './style.css';
import { AHXNode } from './ahx-node.ts';
import AHXProcessor from './ahx-worklet.ts?url';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>AHX worklet</h1>
    <div class="card">
      <button id="play" type="button">Play</button>
    </div>
  </div>
`;

async function loadBinary(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.statusText} (${response.status})`);
  }
  return await response.arrayBuffer();
}

const songUrl = 'https://modland.com/pub/modules/AHX/451/aces%20high.ahx';

document.querySelector<HTMLButtonElement>('#play')!.onclick = async () => {
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule(AHXProcessor);
  } catch (err) {
    console.error(err);
    return;
  }

  const node = new AHXNode(context);
  node.connect(context.destination);
  node.port.onmessage = console.log; // eslint-disable-line no-console
  context.resume();
  const song = await loadBinary(songUrl);
  node.load(song);
};
