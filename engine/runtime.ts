type RuntimeMessageType = 'gameOver' | 'scoreChanged' | 'stateChanged';

interface RuntimeMessage {
  source: 'retrovibe';
  type: RuntimeMessageType;
  payload: unknown;
}

export interface Runtime {
  readonly embedded: boolean;
  gameOver(payload?: { score?: number; won?: boolean }): void;
  scoreChanged(score: number): void;
  stateChanged(state: string): void;
  send(type: RuntimeMessageType, payload: unknown): void;
}

interface RuntimeOptions {
  targetOrigin?: string;
  onStandalone?(message: RuntimeMessage): void;
}

export function createRuntime(opts: RuntimeOptions = {}): Runtime {
  const embedded = window.parent !== window;
  const targetOrigin = opts.targetOrigin ?? '*';

  function send(type: RuntimeMessageType, payload: unknown): void {
    const message: RuntimeMessage = { source: 'retrovibe', type, payload };
    if (embedded) {
      window.parent.postMessage(message, targetOrigin);
    } else {
      opts.onStandalone?.(message);
    }
  }

  return {
    embedded,
    send,
    gameOver(payload = {}) {
      send('gameOver', payload);
    },
    scoreChanged(score) {
      send('scoreChanged', { score });
    },
    stateChanged(state) {
      send('stateChanged', { state });
    },
  };
}
