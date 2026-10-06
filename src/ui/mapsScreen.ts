import { THEMES } from '../config/themes';
import type { SavedMap } from '../storage/maps';
import { $, escapeHtml } from './dom';
import { S, fmt } from './strings';

/** รายการ "แมพของฉัน" */
export function renderMapList(maps: readonly SavedMap[], onPlay: (i: number) => void, onDelete: (i: number) => void): void {
  const cont = $('mapList');
  cont.innerHTML = '';
  if (!maps.length) {
    cont.innerHTML = `<div class="map-empty">${S.mapsEmpty}</div>`;
    return;
  }
  maps.forEach((m, i) => {
    const row = document.createElement('div');
    row.className = 'map-row';
    const info = document.createElement('div');
    info.innerHTML = `<div class="mname">${THEMES[m.theme]?.emoji ?? '🗺️'} ${escapeHtml(m.name)}</div><div class="msub">${fmt.mapSub(m.obstacles.length, m.water.length)}</div>`;
    const btns = document.createElement('div');
    btns.className = 'mbtns';
    const play = document.createElement('button');
    play.className = 'map-mini';
    play.textContent = S.play;
    play.addEventListener('click', () => onPlay(i));
    const del = document.createElement('button');
    del.className = 'map-mini del';
    del.textContent = S.del;
    del.addEventListener('click', () => onDelete(i));
    btns.append(play, del);
    row.append(info, btns);
    cont.appendChild(row);
  });
}
