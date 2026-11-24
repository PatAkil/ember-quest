import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function withSim(use) {
  const dir = await mkdtemp(join(tmpdir(), 'ember-sim-'));
  const outfile = join(dir, 'sim.bundle.mjs');
  try {
    await build({
      entryPoints: [new URL('../game/sim.ts', import.meta.url).pathname],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    });
    return await use(await import(pathToFileURL(outfile).href));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
