// input.ts — unified keyboard + pointer input, the A/B/PAUSE action model, and
// the immediate-mode hit-region registry that gives every tap target a
// keyboard route (createHitRegions, at the bottom of this file).
//
// Movement: arrows OR WASD → a direction vector (dir), plus dirPressed() — the
// direction that went DOWN this frame — for menus and cursors.
// Actions: two action buttons plus a dedicated pause button, each with key
// aliases:  A (primary) = Space or Z · B (secondary) = X or C ·
// PAUSE = P or Escape. PAUSE is dedicated — never remap it to gameplay.
// (Shift is deliberately NOT a key: five rapid presses opens the OS Sticky
// Keys dialog on Windows, stealing focus mid-game.)
// Pointer: mouse, pen or the first finger — ONE primary pointer, mapped to the
// canvas's LOGICAL pixels (InputOptions.pointer). Touch and keyboard are live
// in parallel, always both: nothing here is ever touch-only or key-only.
// Each game DECLARES its actions in code with a short human label (1-2 words);
// title-screen control hints render from these declarations (see controlHints
// and pointerHints), so a label can never drift from behaviour — change the
// binding, change the label, in one place.
//
// Edges: pressed() (down this frame), held(), released() (up this frame) —
// the same trio on the pointer, plus dirPressed(). Call endFrame() once per
// update tick, AFTER reading input, to clear every edge.
// The first keydown OR pointerdown fires onFirstInput (alias: onFirstKey) —
// the documented audio-unlock point.

export type ButtonName = 'A' | 'B' | 'PAUSE';

export interface ActionDecl {
  button: ButtonName;
  /** Short human label for the title-screen hint. One word, two max. */
  label: string;
}

/**
 * Physical keys bound to each button (first alias's name is the hint shown in
 * control hints). A logical button is DOWN while at least one of its alias
 * keys is down: pressed() fires on the 0→≥1 transition, released() only on
 * the ≥1→0 transition (last alias key up) — so holding Space and tapping Z
 * neither re-triggers pressed('A') nor fires released('A').
 */
export const BUTTON_KEY: Readonly<Record<ButtonName, { codes: string[]; hint: string }>> = {
  A: { codes: ['Space', 'KeyZ'], hint: 'SPACE' },
  B: { codes: ['KeyX', 'KeyC'], hint: 'X' },
  PAUSE: { codes: ['KeyP', 'Escape'], hint: 'P' },
};

type DirName = 'L' | 'R' | 'U' | 'D';

/**
 * Physical keys bound to each direction. A direction follows the same alias
 * rule as a button: it is DOWN while ≥1 of its keys is down, and dirPressed()
 * fires only on the 0→≥1 transition — holding ArrowUp and tapping W is not a
 * second "up", and OS key auto-repeat never counts.
 */
const DIR_KEY: Readonly<Record<DirName, { codes: string[]; x: number; y: number }>> = {
  L: { codes: ['ArrowLeft', 'KeyA'], x: -1, y: 0 },
  R: { codes: ['ArrowRight', 'KeyD'], x: 1, y: 0 },
  U: { codes: ['ArrowUp', 'KeyW'], x: 0, y: -1 },
  D: { codes: ['ArrowDown', 'KeyS'], x: 0, y: 1 },
};

const CODE_TO_DIR: Record<string, DirName> = {};
for (const name of Object.keys(DIR_KEY) as DirName[]) {
  for (const code of DIR_KEY[name].codes) CODE_TO_DIR[code] = name;
}

const CODE_TO_BUTTON: Record<string, ButtonName> = {};
for (const name of Object.keys(BUTTON_KEY) as ButtonName[]) {
  for (const code of BUTTON_KEY[name].codes) CODE_TO_BUTTON[code] = name;
}

// Keys we own — preventDefault so Space/arrows don't scroll the page.
const OWNED = new Set<string>([...Object.keys(CODE_TO_DIR), ...Object.keys(CODE_TO_BUTTON)]);

export interface PointerState {
  /**
   * Position in LOGICAL canvas pixels (fractional — floor it for pixel work).
   * Follows hover on a desktop; on touch it is wherever the finger last was.
   */
  readonly x: number;
  readonly y: number;
  /** Primary button / first finger is down. */
  readonly down: boolean;
  /** Went down this frame. Cleared by endFrame(). */
  readonly pressed: boolean;
  /**
   * Went up this frame — a real pointerup only. Cleared by endFrame().
   * A pointercancel (the OS took the touch) or a window blur drops `down`
   * WITHOUT this edge, exactly as blur drops keys: a tap that lost its pointer
   * must never complete.
   */
  readonly released: boolean;
  /** True once any pointer event has been seen (hover included). */
  readonly active: boolean;
  /**
   * pointerType of the last event — 'mouse' | 'touch' | 'pen' — '' before the
   * first. `type === 'touch'` is the signal that a touch device is in use; hide
   * keyboard hints on THAT, not on `active` (a desktop mouse merely passing
   * over the canvas sets `active` too).
   */
  readonly type: string;
}

export interface Input {
  /** Direction from arrows/WASD; each axis in {-1,0,1}. */
  readonly dir: { x: number; y: number };
  /**
   * Direction that went DOWN this frame, each axis in {-1,0,1}; 0 while held.
   * The menu edge — one step per press, auto-repeat ignored, cleared by
   * endFrame(). Returns a REUSED object: read it, don't keep it.
   */
  dirPressed(): { x: number; y: number };
  pressed(button: ButtonName): boolean;
  held(button: ButtonName): boolean;
  released(button: ButtonName): boolean;
  /** Always present; only live when InputOptions.pointer was given. */
  readonly pointer: PointerState;
  readonly actions: ReadonlyArray<ActionDecl>;
  /** Clear per-frame edges. Call once per update tick, after reading input. */
  endFrame(): void;
  dispose(): void;
}

export interface InputOptions {
  /**
   * Fired once, on the very first keydown OR pointerdown. The name predates
   * pointer input and is kept so existing games keep working; prefer
   * onFirstInput. When both are given, both fire (each at most once).
   */
  onFirstKey?: () => void;
  /** Preferred name for onFirstKey: the audio-unlock point, whichever input kind comes first. */
  onFirstInput?: () => void;
  /** Element to attach keyboard listeners to (default window). */
  target?: Window | HTMLElement;
  /**
   * Attach pointer listeners to this canvas and map events to its LOGICAL size
   * (width × height, the coordinate space you draw in) through the live CSS
   * box — the shell letterboxes the canvas, so CSS size ≠ backing size.
   */
  pointer?: { canvas: HTMLCanvasElement; width: number; height: number };
}

type PointerTarget = NonNullable<InputOptions['pointer']>;

export function createInput(actions: ActionDecl[], opts: InputOptions = {}): Input {
  const target = opts.target ?? window;
  const down = new Set<string>();
  const justPressed = new Set<ButtonName>();
  const justReleased = new Set<ButtonName>();
  const justPressedDirs = new Set<DirName>();
  // Reused so a menu polling dirPressed() every tick allocates nothing.
  const dirEdge = { x: 0, y: 0 };
  let firstInputSeen = false;

  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false, active: false, type: '' };
  let pointerId = -1; // the primary pointer currently held; -1 while none is

  const buttonDown = (button: ButtonName): boolean =>
    BUTTON_KEY[button].codes.some((code) => down.has(code));
  const dirDown = (name: DirName): boolean => DIR_KEY[name].codes.some((code) => down.has(code));

  // Audio needs a user gesture, and on a phone that gesture is a tap — so the
  // first input of EITHER kind unlocks, and both callbacks fire at most once.
  const onFirstInput = (): void => {
    if (firstInputSeen) return;
    firstInputSeen = true;
    opts.onFirstKey?.();
    opts.onFirstInput?.();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (OWNED.has(e.code)) e.preventDefault();
    onFirstInput();
    // down.add must run even for e.repeat: after blur clears the set, the OS
    // auto-repeat events that resume on refocus are the only way a still-held
    // key re-registers. Only the pressed() edges stay gated on a real press —
    // and on the whole button/direction being up (no alias held) before this
    // keydown.
    const button = CODE_TO_BUTTON[e.code];
    if (!e.repeat && button && !buttonDown(button)) justPressed.add(button);
    const dir = CODE_TO_DIR[e.code];
    if (!e.repeat && dir && !dirDown(dir)) justPressedDirs.add(dir);
    down.add(e.code);
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    if (OWNED.has(e.code)) e.preventDefault();
    down.delete(e.code);
    // released() only when the LAST alias goes up — a jump held on Space must
    // not be cut by tapping and releasing Z.
    const button = CODE_TO_BUTTON[e.code];
    if (button && !buttonDown(button)) justReleased.add(button);
  };

  // Losing focus mid-hold would otherwise leave a key (or a finger) "stuck"
  // down forever. Dropped without an edge: a hold that outlived focus is not a
  // release.
  const onBlur = (): void => {
    down.clear();
    pointer.down = false;
    pointerId = -1;
  };

  const attachPointer = ({ canvas, width, height }: PointerTarget): (() => void) => {
    const toLogical = (e: PointerEvent): void => {
      // The CSS box is letterboxed by the shell and never matches the backing
      // size, so map through the live rect. A hidden canvas has a 0-wide rect:
      // keep the last position rather than divide by zero.
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = (e.clientX - rect.left) * (width / rect.width);
      pointer.y = (e.clientY - rect.top) * (height / rect.height);
      pointer.active = true;
      pointer.type = e.pointerType;
    };
    const onDown = (e: PointerEvent): void => {
      // Never a text selection, a scroll start, or an image drag.
      e.preventDefault();
      if (!e.isPrimary || e.button !== 0) return; // a second finger, a right/middle button
      onFirstInput();
      toLogical(e);
      pointerId = e.pointerId;
      pointer.down = true;
      pointer.pressed = true;
      // Capture: a drag that leaves the canvas still reports its pointerup
      // here. Throws if the pointer is already gone — best effort.
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer ended before capture */ }
      // A tap must give the page keyboard focus (an embedded iframe only gets
      // keys after a click inside it), but cancelling pointerdown suppresses
      // the focusing mousedown — so focus the canvas explicitly (tabIndex -1:
      // focusable by script, skipped by Tab). Keys bubble from it to window.
      try { canvas.focus({ preventScroll: true }); } catch { /* not focusable here — keys still reach window */ }
    };
    const onMove = (e: PointerEvent): void => {
      if (!e.isPrimary) return;
      toLogical(e);
    };
    const onUp = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return; // a pointer we never pressed (second finger, or up after a cancel)
      toLogical(e);
      pointerId = -1;
      pointer.down = false;
      pointer.released = true;
    };
    const onCancel = (e: PointerEvent): void => {
      // lostpointercapture also follows a normal pointerup — by then onUp has
      // reset the id, so this only catches a pointer that vanished mid-hold.
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      pointer.down = false; // no released edge — see PointerState.released
    };

    // touch-action: none is what keeps pointermove flowing during a touch drag
    // (otherwise the browser claims the gesture for panning and fires
    // pointercancel). The shell sets it in CSS too; the input layer must not
    // depend on that.
    canvas.style.touchAction = 'none';
    canvas.tabIndex = -1;
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('lostpointercapture', onCancel);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('lostpointercapture', onCancel);
    };
  };

  target.addEventListener('keydown', onKeyDown as EventListener);
  target.addEventListener('keyup', onKeyUp as EventListener);
  window.addEventListener('blur', onBlur);
  const detachPointer = opts.pointer ? attachPointer(opts.pointer) : null;

  return {
    get dir() {
      let x = 0;
      let y = 0;
      for (const code of down) {
        const name = CODE_TO_DIR[code];
        if (name) {
          x += DIR_KEY[name].x;
          y += DIR_KEY[name].y;
        }
      }
      return { x: Math.sign(x), y: Math.sign(y) };
    },
    dirPressed() {
      dirEdge.x = (justPressedDirs.has('R') ? 1 : 0) - (justPressedDirs.has('L') ? 1 : 0);
      dirEdge.y = (justPressedDirs.has('D') ? 1 : 0) - (justPressedDirs.has('U') ? 1 : 0);
      return dirEdge;
    },
    pressed(button) {
      return justPressed.has(button);
    },
    held(button) {
      return buttonDown(button);
    },
    released(button) {
      return justReleased.has(button);
    },
    pointer,
    actions,
    endFrame() {
      justPressed.clear();
      justReleased.clear();
      justPressedDirs.clear();
      pointer.pressed = false;
      pointer.released = false;
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown as EventListener);
      target.removeEventListener('keyup', onKeyUp as EventListener);
      window.removeEventListener('blur', onBlur);
      detachPointer?.();
    },
  };
}

/**
 * Human-readable control hint lines derived from an Input's action declarations
 * — the single source of truth for the title screen. e.g. ['SPACE JUMP', 'X FIRE'].
 * Movement is implicit (arrows/WASD) and not included.
 */
export function controlHints(input: Input): string[] {
  return input.actions.map((a) => `${BUTTON_KEY[a.button].hint} ${a.label.toUpperCase()}`);
}

/**
 * The same declarations phrased for a touch screen — e.g. ['TAP SELECT'] — so
 * a title screen can show the right hints once `pointer.type === 'touch'`.
 * Every action must have a tap target on screen for this to be true; that is
 * the hit-region contract below.
 */
export function pointerHints(input: Input): string[] {
  return input.actions.map((a) => `TAP ${a.label.toUpperCase()}`);
}

// --- Hit regions — tap targets with keyboard parity --------------------------
//
// Immediate mode, like the drawing: every frame a screen re-registers the rects
// it is about to draw, then asks what happened. The registry keeps ONE pooled
// list — the regions of the last completed frame — so a screen that stops
// drawing a button has, by construction, stopped it being tappable.
//
//   regions.begin();
//   regions.add('attack', x, y, w, h, { index: 0, group: 'skills' });
//   ...
//   regions.end();                       // resolves this frame's interactions
//   if (regions.activated() === 'attack') attack();
//   input.endFrame();
//
// Ordering is the one rule: register in update() — begin/add/end run BEFORE
// input.endFrame() in the same tick, because end() reads that tick's edges (A
// pressed, direction pressed, pointer pressed/released). render() only READS:
// region() for the focus ring, hitRect() for a debug overlay, focused(),
// pressing() and hovered() for the button states — from the same layout
// numbers update() registered with, so the layout lives in one place. A render
// without an update in between (a paused loop, a repaint after a resize)
// reuses the last pool: every query answers for the last completed frame,
// never for an empty one.
//
// Two rects per region. The DRAWN rect is what add() was given — the pixels of
// the button — and the HIT rect is the drawn rect grown on each axis, about
// its centre, to at least TAP_MIN, then shifted back inside the canvas (never
// shrunk, unless the canvas itself is smaller than TAP_MIN). A near miss on a
// small target still lands. Hit testing runs in two passes, both in painter's
// order (the last registered wins on overlap): the drawn rects first, and only
// when no drawn rect contains the point, the hit rects. So a region's drawn
// rect ALWAYS beats a neighbour's expanded hit rect — expansion can never
// steal a tap from a button the finger is visibly on. hovered(), pressing()
// and the tap all use the same test.
//
// Keyboard parity — the contract's hard rule, "every tap target has a keyboard
// route" — is automatic: any registered region can be reached with the arrows
// and activated with A. Focus moves by the GEOMETRY of the drawn rects, then
// wraps, deterministically:
//   1. Spatial — from the focused centre, the candidate (any group) whose
//      centre lies within ±50° of the pressed direction, minimising
//      distance + 2 × off-axis offset. Ties: lower index, then earlier
//      registration.
//   2. Wrap — nothing in that direction: jump to the far edge on that axis
//      (down → the topmost row, right → the leftmost column) within the focused
//      region's group (all regions when it has none), taking the member nearest
//      on the other axis — so a grid wraps within its own row or column.
//   3. Flat — the focused region already sits on that far edge (a single row
//      pressed up/down, a single column pressed left/right): up/down cycle by
//      `index` within the group, wrapping; left/right do nothing.
// Twins — a sprite body and its panel registered under ONE id — are a single
// target: a move never lands on a twin of the focused id (focus would change
// hands and nothing on screen would), and twins are invisible to the wrap's
// edge as well. The focused id's geometry is its FIRST registered twin (so is
// region()'s rect): register the panel first when the ring belongs on it.
// A pointer press moves focus too, so a mixed session never shows two cursors.

/**
 * Every tap target is at least this big in both dimensions, in logical px —
 * the contract's floor of 44 CSS px at a phone's ≈ 0.5× CSS scale. A smaller
 * drawn rect still works (its HIT rect is grown to this) but warns once in
 * dev: a button that needs its margin to be hit is a bug report, not a crash.
 */
export const TAP_MIN = 96;
/**
 * Recommended clear gap between neighbouring drawn rects, logical px — the
 * room a thumb needs to land on the intended one of two adjacent targets.
 * Documentation only: layouts keep it, the registry does not enforce it
 * (overlapping hit rects resolve by the drawn-first rule above).
 */
export const TAP_GAP = 12;

export interface HitRegionOptions {
  /** Keyboard order within the group: breaks spatial ties and drives the up/down cycle on a flat row. */
  index?: number;
  /** Wrap scope: focus wraps within the focused region's group, or over everything when it has none. */
  group?: string;
  /** Focusable — so the player can read why it is greyed out — but never activatable. */
  disabled?: boolean;
}

/** A rect in logical px. */
type Rect = { x: number; y: number; w: number; h: number };

export interface HitRegions {
  /** Start a frame's registration: forgets last frame's regions and activation. */
  begin(): void;
  /**
   * Register a tappable rect (the DRAWN rect) in logical px. Allocation-free
   * once warm (records are pooled); hoist a constant `opts` object if the call
   * site is hot. A repeated id is the same target twice (twins: a sprite body
   * and its panel). Warns once per id, in dev only, when smaller than TAP_MIN
   * in either dimension — the hit rect is grown to TAP_MIN regardless.
   */
  add(id: string, x: number, y: number, w: number, h: number, opts?: HitRegionOptions): void;
  /** Finish registration and resolve this frame's focus, hover, press and activation. */
  end(): void;
  /**
   * Id activated this frame — by a real tap (pointer pressed AND released
   * inside the same region; a drag-off cancels) or by A on the focused region.
   * Pointer wins when both land in one frame. Null until the next activation.
   */
  activated(): string | null;
  /** The keyboard/hover focus. May name a region not registered this frame only when this frame registered nothing. */
  focused(): string | null;
  /** Set focus programmatically (a screen does this as it opens); validated at the next end(). */
  focus(id: string | null): void;
  /** Region under the pointer this frame (desktop hover feedback); null before any pointer event. */
  hovered(): string | null;
  /** Region the pointer is currently pressing (down inside it) — draw it depressed. */
  pressing(): string | null;
  /**
   * DRAWN rect of a region registered this frame (its first twin), for the
   * focus ring. Returns the pooled record itself: valid until the next
   * begin(), never mutate it.
   */
  region(id: string): Readonly<Rect> | null;
  /**
   * HIT rect of a region registered this frame (its first twin): the drawn
   * rect grown to TAP_MIN and kept inside the canvas — what a tap actually
   * tests against, for a debug overlay. Pooled like region(): read, don't keep.
   */
  hitRect(id: string): Readonly<Rect> | null;
}

interface Region extends Rect {
  id: string;
  /** The expanded hit rect. Owned by the pooled record — allocated once, rewritten by add(). */
  hit: Rect;
  cx: number;
  cy: number;
  index: number;
  group: string;
  disabled: boolean;
}

const NO_INDEX = Number.MAX_SAFE_INTEGER; // sorts after every explicit index
const CONE_COS = Math.cos((50 * Math.PI) / 180); // ±50° = the 100° search cone
const FLAT_EPS = 1; // centres within 1 px share a row/column

/**
 * True in a Vite dev build, and wherever import.meta.env does not exist at all
 * (Node, the esbuild bundle a headless check runs) — so only a production
 * bundle, where Vite defines DEV as false, is silent. Read through a cast:
 * this tsconfig carries no vite/client types, and the read must never throw
 * where import.meta has no env.
 */
function isDevBuild(): boolean {
  try {
    return (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? true;
  } catch {
    return true;
  }
}
const DEV = isDevBuild();

/**
 * Create the registry for one canvas. `width`/`height` are the LOGICAL canvas
 * size the hit rects are kept inside (default 1280×720, the v3 frame); pass
 * the numbers the canvas was created with.
 */
export function createHitRegions(input: Input, opts: { width?: number; height?: number } = {}): HitRegions {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const pool: Region[] = [];
  let count = 0;
  let focusId: string | null = null;
  let hoverId: string | null = null;
  let pressId: string | null = null;
  let activatedId: string | null = null;
  const warned = new Set<string>();

  // The first registered twin: the id's geometry for navigation and the ring.
  const find = (id: string | null): Region | null => {
    if (id === null) return null;
    for (let i = 0; i < count; i++) if (pool[i].id === id) return pool[i];
    return null;
  };

  // Shift a span of `size` at `pos` back inside [0, limit]. Only a span wider
  // than the canvas itself shrinks — it fills the canvas.
  const fit = (pos: number, size: number, limit: number): number =>
    size >= limit ? 0 : Math.min(Math.max(pos, 0), limit - size);

  const contains = (r: Rect, x: number, y: number): boolean =>
    x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  // Two passes, each in painter's order (registered last = drawn on top): the
  // drawn rects, then — only if none holds the point — the expanded hit rects.
  // A drawn rect therefore always beats a neighbour's expansion.
  const hit = (x: number, y: number): Region | null => {
    for (let i = count - 1; i >= 0; i--) if (contains(pool[i], x, y)) return pool[i];
    for (let i = count - 1; i >= 0; i--) if (contains(pool[i].hit, x, y)) return pool[i];
    return null;
  };

  // Lowest index, then registration order (strict < keeps the earlier one).
  const first = (): Region | null => {
    let best: Region | null = null;
    for (let i = 0; i < count; i++) if (!best || pool[i].index < best.index) best = pool[i];
    return best;
  };

  const inScope = (from: Region, r: Region): boolean => from.group === '' || r.group === from.group;

  const spatial = (from: Region, dx: number, dy: number): Region | null => {
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    let best: Region | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < count; i++) {
      const r = pool[i];
      if (r.id === from.id) continue; // itself and its twins
      const vx = r.cx - from.cx;
      const vy = r.cy - from.cy;
      const dist = Math.hypot(vx, vy);
      if (dist === 0) continue; // stacked on the focused region: unreachable by direction
      const along = vx * ux + vy * uy;
      if (along / dist < CONE_COS) continue;
      const score = dist + 2 * Math.sqrt(Math.max(0, dist * dist - along * along));
      if (score < bestScore || (score === bestScore && best !== null && r.index < best.index)) {
        best = r;
        bestScore = score;
      }
    }
    return best;
  };

  // Flat row/column: step by index within the group, wrapping at either end.
  const cycle = (from: Region, forward: boolean): Region | null => {
    if (from.index === NO_INDEX) return null;
    let next: Region | null = null;
    let wrapTo: Region | null = null;
    for (let i = 0; i < count; i++) {
      const r = pool[i];
      if (r.id === from.id || !inScope(from, r) || r.index === NO_INDEX) continue;
      if (forward) {
        if (r.index > from.index && (next === null || r.index < next.index)) next = r;
        if (wrapTo === null || r.index < wrapTo.index) wrapTo = r;
      } else {
        if (r.index < from.index && (next === null || r.index > next.index)) next = r;
        if (wrapTo === null || r.index > wrapTo.index) wrapTo = r;
      }
    }
    return next ?? wrapTo;
  };

  const wrap = (from: Region, dx: number, dy: number): Region | null => {
    const vertical = dy !== 0; // a diagonal press wraps on the vertical axis
    const forward = (vertical ? dy : dx) > 0;
    // The far edge: the smallest centre for down/right, the largest for up/left.
    // The focused region counts (it may BE the edge — the flat case below);
    // its twins do not, or a twin alone on the edge would leave nowhere to go.
    let edge = forward ? Infinity : -Infinity;
    for (let i = 0; i < count; i++) {
      const r = pool[i];
      if (!inScope(from, r) || (r !== from && r.id === from.id)) continue;
      const c = vertical ? r.cy : r.cx;
      if (forward ? c < edge : c > edge) edge = c;
    }
    const fromC = vertical ? from.cy : from.cx;
    if (Math.abs(fromC - edge) <= FLAT_EPS) return vertical ? cycle(from, forward) : null;
    let best: Region | null = null;
    let bestOff = Infinity;
    for (let i = 0; i < count; i++) {
      const r = pool[i];
      if (r.id === from.id || !inScope(from, r)) continue;
      if (Math.abs((vertical ? r.cy : r.cx) - edge) > FLAT_EPS) continue;
      const off = Math.abs(vertical ? r.cx - from.cx : r.cy - from.cy);
      if (off < bestOff || (off === bestOff && best !== null && r.index < best.index)) {
        best = r;
        bestOff = off;
      }
    }
    return best;
  };

  return {
    begin() {
      count = 0;
      activatedId = null;
    },
    add(id, x, y, w, h, opts) {
      let r = pool[count];
      if (!r) {
        r = { id, x: 0, y: 0, w: 0, h: 0, hit: { x: 0, y: 0, w: 0, h: 0 }, cx: 0, cy: 0, index: NO_INDEX, group: '', disabled: false };
        pool.push(r);
      }
      r.id = id;
      r.x = x;
      r.y = y;
      r.w = w;
      r.h = h;
      r.cx = x + w / 2;
      r.cy = y + h / 2;
      r.index = opts?.index ?? NO_INDEX;
      r.group = opts?.group ?? '';
      r.disabled = opts?.disabled ?? false;
      // The hit rect: an axis under TAP_MIN is grown about its centre and
      // shifted back inside the canvas. An axis already at TAP_MIN keeps its
      // drawn extent untouched, even past the edge — the off-canvas part is
      // simply unreachable, and shifting it would open a near-miss zone on the
      // far side that the button does not visibly occupy.
      const hit = r.hit;
      if (w < TAP_MIN) {
        hit.w = Math.min(TAP_MIN, width);
        hit.x = fit(r.cx - TAP_MIN / 2, TAP_MIN, width);
      } else {
        hit.x = x;
        hit.w = w;
      }
      if (h < TAP_MIN) {
        hit.h = Math.min(TAP_MIN, height);
        hit.y = fit(r.cy - TAP_MIN / 2, TAP_MIN, height);
      } else {
        hit.y = y;
        hit.h = h;
      }
      count++;
      // Feasibility rule, "every tap target ≥ TAP_MIN": a dev warning, never a
      // throw — an undersized button is a bug report, not a crash.
      if (DEV && (w < TAP_MIN || h < TAP_MIN) && !warned.has(id)) {
        warned.add(id);
        console.warn(
          `[hit-regions] "${id}" is ${w}×${h}; tap targets should be ≥ ${TAP_MIN}×${TAP_MIN} logical px (hit rect grown to ${hit.w}×${hit.h})`,
        );
      }
    },
    end() {
      const p = input.pointer;
      // Focus must name something real: a region that vanished this frame
      // (a menu closed, a skill list shrank) hands focus to the first one.
      if (count > 0 && find(focusId) === null) {
        const f = first();
        focusId = f ? f.id : null;
      }
      // Pointer: hover, press → focus, release inside the pressed region → tap.
      const over = p.active ? hit(p.x, p.y) : null;
      hoverId = over ? over.id : null;
      if (p.pressed) {
        pressId = over ? over.id : null;
        if (over) focusId = over.id;
      }
      if (p.released) {
        if (over !== null && pressId !== null && over.id === pressId && !over.disabled) activatedId = over.id;
        pressId = null;
      } else if (!p.down) {
        pressId = null; // the pointer vanished (cancel, blur): never a tap
      }
      // Keyboard: move focus by geometry, then A activates the focused region.
      const d = input.dirPressed();
      if (d.x !== 0 || d.y !== 0) {
        const from = find(focusId);
        if (from) {
          const to = spatial(from, d.x, d.y) ?? wrap(from, d.x, d.y);
          if (to) focusId = to.id;
        }
      }
      if (activatedId === null && input.pressed('A')) {
        const f = find(focusId);
        if (f && !f.disabled) activatedId = f.id;
      }
    },
    activated() {
      return activatedId;
    },
    focused() {
      return focusId;
    },
    focus(id) {
      focusId = id;
    },
    hovered() {
      return hoverId;
    },
    pressing() {
      return pressId !== null && hoverId === pressId ? pressId : null;
    },
    region(id) {
      return find(id);
    },
    hitRect(id) {
      const r = find(id);
      return r ? r.hit : null;
    },
  };
}
