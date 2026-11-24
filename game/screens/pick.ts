import { dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game, PickScreen } from '../state';

export function openPick(g: Game, screen: PickScreen): void {
  g.pick = screen;
  g.subScene = 'PICK';
  resetCursorEdge(g);
}

export function updatePick(g: Game): void {
  const { pick } = g;
  const { input, audio } = g.app;
  const dy = dirEdge(g);
  if (dy && pick.rows.length > 0) { pick.cursor = wrapCursor(pick.cursor, dy, pick.rows.length); audio.play('blip'); }
  if (input.pressed('B')) { audio.play('blip'); pick.onCancel(); return; }
  if (input.pressed('A') && pick.rows[pick.cursor]) { audio.play('blip'); pick.onPick(pick.cursor); }
}
