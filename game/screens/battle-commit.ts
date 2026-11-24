import type { BattleState, EnemyInstance, Hero, HeroAction, Rng, TurnResult } from '../types';
import { must } from '../lookup';
import { resolveTurn, turnRng } from '../sim';
import type { TurnStream } from '../sim';
import type { CommittedTurn, Game, TurnLedger } from '../state';
import { forgetRun, persistBattle } from '../persist';

type Ledger = TurnLedger;

const cloneHero = (h: Hero): Hero => ({
  ...h,
  alloc: { ...h.alloc },
  equipment: { ...h.equipment },
  levels: { ...h.levels },
  pack: h.pack.map((o) => ({ ...o })),
  baseSpells: [...h.baseSpells],
  missedScrolls: [...h.missedScrolls],
  burn: h.burn ? { ...h.burn } : null,
  pacts: [...h.pacts],
});

const cloneFoe = (e: EnemyInstance): EnemyInstance => ({ ...e, affixes: [...e.affixes], burn: e.burn ? { ...e.burn } : null });

function ledgerOf(g: Game, enemy: EnemyInstance, state: BattleState): Ledger {
  return { hero: g.hero, enemy, state, clears: g.clears, bosses: g.bosses, score: g.score, rng: g.rngSource.getState() };
}

function install(g: Game, l: Ledger): void {
  g.hero = l.hero;
  g.battle.enemy = l.enemy;
  g.battle.state = l.state;
  g.clears = l.clears; g.bosses = l.bosses; g.score = l.score;
  g.rngSource.setState(l.rng);
}

function saveOutcome(g: Game, r: TurnResult): void {
  if (r.outcome === 'LOST') { forgetRun(g); return; }
  if (r.outcome === 'WON') { g.battle.onKill(); return; }
  persistBattle(g);
}

export function commitTurn(g: Game, action: HeroAction): CommittedTurn | null {
  const { enemy, state } = g.battle;
  if (!enemy || !state) {return null;}
  const live = ledgerOf(g, enemy, state);
  const foe = cloneFoe(enemy);
  install(g, { ...live, hero: cloneHero(g.hero), enemy: foe, state: { ...state, enemy: foe } });
  const shadow = must(g.battle.state ?? undefined, 'battle state');
  const result = resolveTurn(g.hero, shadow, action, g.roomSeed);
  saveOutcome(g, result);
  const after = ledgerOf(g, foe, shadow);
  install(g, live);
  return { result, after };
}

export function mirrorRng(g: Game, stream: TurnStream): Rng {
  const turn = g.battle.committed?.result.turn;
  return turn === undefined ? g.rng : turnRng(g.roomSeed, turn, stream);
}

const drifted = (g: Game, after: Ledger): boolean =>
  g.hero.hp !== after.hero.hp || g.hero.mp !== after.hero.mp || g.battle.enemy?.hp !== after.enemy.hp;

export function adoptTurn(g: Game, checked: boolean): void {
  const c = g.battle.committed;
  if (!c) {return;}
  g.battle.committed = null;
  if (checked && drifted(g, c.after)) {reportError(new Error(`[battle] turn ${String(c.result.turn)} replay drifted from the committed result`));}
  install(g, c.after);
}
