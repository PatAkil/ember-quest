import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COMMENT_MARKER = '<!-- ember-oracle -->';
const MAX_IMAGES = 6;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || args[i + 1] === undefined) {
    throw new Error(`oracle-comment: --${name} is required`);
  }
  return args[i + 1];
};

const readSnapshot = (path) => JSON.parse(readFileSync(path, 'utf8'));
const shotName = (key) => {
  const [scene, act, keys] = key.split('/');
  return `${scene}-${act}-${keys === 'still' ? 'still' : 'keys'}.png`;
};

function caseShape(snapshot) {
  const keys = Object.keys(snapshot).map((key) => key.split('/'));
  const count = (i) => new Set(keys.map((parts) => parts[i])).size;
  return `${String(count(0))} scenes x ${String(count(1))} acts x ${String(count(2))} input runs`;
}

function changedCases(base, head) {
  return Object.keys(base)
    .filter((key) => JSON.stringify(base[key]) !== JSON.stringify(head[key]))
    .map((key) => ({ key, kind: base[key].state === head[key]?.state ? 'pixels only' : 'game state' }));
}

function onePerScene(cases) {
  const seen = new Set();
  return cases.filter(({ key }) => {
    const scene = key.split('/')[0];
    if (seen.has(scene)) {
      return false;
    }
    seen.add(scene);
    return true;
  }).slice(0, MAX_IMAGES);
}

function publishShots(picked, dirs, publish) {
  mkdirSync(publish, { recursive: true });
  for (const { key } of picked) {
    const name = shotName(key);
    copyFileSync(join(dirs.base, name), join(publish, `base-${name}`));
    copyFileSync(join(dirs.head, name), join(publish, `head-${name}`));
  }
}

function changedBody(cases, picked, urlPrefix, total) {
  const rows = cases.map(({ key, kind }) => `| \`${key}\` | ${kind} |`);
  const images = picked.map(({ key }) => {
    const name = shotName(key);
    return `| \`${key}\` | <img src="${urlPrefix}/base-${name}" width="320"> | <img src="${urlPrefix}/head-${name}" width="320"> |`;
  });
  const more = cases.length > picked.length ? `\n\nImages for the first changed case of each screen (${String(picked.length)} shown). All shots are in the run's \`oracle-screens\` artifact.` : '';
  return [
    `**${String(cases.length)} of ${String(total)} cases differ.** Expected for visual or rules changes; check that nothing changed that should not have.`,
    '',
    '| Case (screen/act/input) | What changed |',
    '|---|---|',
    ...rows,
    '',
    '| Case | Base | This PR |',
    '|---|---|---|',
    ...images,
  ].join('\n') + more;
}

const base = readSnapshot(flag('base'));
const head = readSnapshot(flag('head'));
const total = Object.keys(base).length;
const cases = changedCases(base, head);
const picked = onePerScene(cases);
if (picked.length > 0) {
  publishShots(picked, { base: flag('base-dir'), head: flag('head-dir') }, flag('publish'));
}
const title = `## Pixel oracle: this PR vs base \`${flag('base-sha')}\``;
const body = cases.length === 0
  ? `All ${String(total)} cases (${caseShape(base)}, seed 7) are identical in state and pixels.`
  : changedBody(cases, picked, flag('url-prefix'), total);
const footer = `<sub>Informational, never blocks. Updated for ${flag('head-sha')} · [run](${flag('run-url')})</sub>`;
writeFileSync(flag('out'), `${COMMENT_MARKER}\n${title}\n\n${body}\n\n${footer}\n`);
console.log(`oracle-comment: ${String(cases.length)} changed, ${String(picked.length)} image pairs`);
