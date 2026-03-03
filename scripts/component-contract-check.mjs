import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const failures = [];
const warnings = [];

function read(file) {
  return readFileSync(resolve(repoRoot, file), 'utf8');
}

function mustContain(file, snippet, reason) {
  const source = read(file);
  if (!source.includes(snippet)) {
    failures.push(`${file}: ${reason}`);
  }
}

function scanRiskyClickModifiers(file) {
  const source = read(file);
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/<[A-Z][\w-]*[^>]*@click\.stop=/.test(line)) {
      warnings.push(`${file}:${index + 1} custom component uses @click.stop, verify emitted event carries native payload`);
    }
  });
}

mustContain(
  'src/components/overlay/CornerAction.vue',
  `@click.stop="emit('click', $event)"`,
  'CornerAction must forward native click event payload to prevent wrapper event-chain regressions'
);

mustContain(
  'src/components/ui/Toast/index.vue',
  'resolveToastRenderState',
  'UiToast must use shared render-state resolver to keep channel mode and legacy mode compatible'
);

scanRiskyClickModifiers('src/components/overlay/config/OverlayConfigThemeSection.vue');

if (warnings.length) {
  console.warn('[component-contract-check] warnings:');
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}

if (failures.length) {
  console.error('[component-contract-check] failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('[component-contract-check] passed');
