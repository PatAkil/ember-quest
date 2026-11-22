import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = import.meta.dirname;
const BARREL = join(ROOT, 'engine', 'index.ts');

const barrelExports = () => {
  const source = readFileSync(BARREL, 'utf8');
  const names = new Set();
  for (const [, list] of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const name of list.split(',')) {
      const trimmed = name.trim();
      if (trimmed) {
        names.add(trimmed);
      }
    }
  }
  return names;
};

const documentedEngineApi = (text, filename) => {
  const exported = barrelExports();
  const cited = new Set();
  const fenced = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(([, code]) => code);
  const prose = text.replace(/```[\s\S]*?```/g, '');
  const inline = [...prose.matchAll(/`([^`\n]+)`/g)].map(([, code]) => code);
  for (const code of [...fenced, ...inline]) {
    for (const [word] of code.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (exported.has(word)) {
        cited.add(word);
      }
    }
  }
  if (cited.size === 0) {
    return '';
  }
  const specifier = relative(dirname(filename), BARREL).replace(/\.ts$/, '');
  const path = specifier.startsWith('.') ? specifier : `./${specifier}`;
  return `import { ${[...cited].sort().join(', ')} } from '${path}';\n`;
};

export default {
  entry: [
    'scripts/*.mjs',
    'knip.config.js',
    'CLAUDE.md',
    '.claude/skills/*/SKILL.md',
  ],
  project: [
    'game/**/*.ts',
    'engine/**/*.ts',
    'sim/**/*.mjs',
    'scripts/**/*.mjs',
    'tools/**/*.mjs',
    '*.{js,mjs,cjs,ts}',
    '.*.cjs',
  ],
  compilers: {
    md: documentedEngineApi,
  },
};
