import { gzipSync } from 'node:zlib';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const BASELINE_FILE = path.resolve(ROOT_DIR, 'scripts', 'perf-baseline.json');

const BUDGETS = {
  totalGzipBytes: 10,
  jsBytes: 10,
  jsGzipBytes: 10,
  cssBytes: 15,
  cssGzipBytes: 15,
  largestJsGzipBytes: 12
};

const METRIC_LABELS = {
  totalGzipBytes: 'Total gzip size',
  jsBytes: 'JS raw size',
  jsGzipBytes: 'JS gzip size',
  cssBytes: 'CSS raw size',
  cssGzipBytes: 'CSS gzip size',
  largestJsGzipBytes: 'Largest JS gzip size'
};

const args = new Set(process.argv.slice(2));
const shouldUpdate = args.has('--update');
const modeLabel = shouldUpdate ? 'update' : 'check';

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatDeltaPct(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) {
    return 'n/a';
  }
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function extGroup(relativePath) {
  if (relativePath.endsWith('.js') || relativePath.endsWith('.mjs')) return 'js';
  if (relativePath.endsWith('.css')) return 'css';
  if (relativePath.endsWith('.html')) return 'html';
  return 'asset';
}

async function collectMetrics() {
  const stats = await fs.stat(DIST_DIR).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error(`dist directory not found at ${DIST_DIR}. Run "npm run build" first.`);
  }

  const files = await walkFiles(DIST_DIR);
  const metrics = {
    fileCount: 0,
    totalBytes: 0,
    totalGzipBytes: 0,
    jsBytes: 0,
    jsGzipBytes: 0,
    cssBytes: 0,
    cssGzipBytes: 0,
    htmlBytes: 0,
    htmlGzipBytes: 0,
    largestJsBytes: 0,
    largestJsGzipBytes: 0,
    largestJsFile: null
  };

  for (const file of files) {
    const relative = path.relative(ROOT_DIR, file).split(path.sep).join('/');
    if (relative.endsWith('.map')) continue;

    const buffer = await fs.readFile(file);
    const bytes = buffer.byteLength;
    const gzipBytes = gzipSync(buffer).byteLength;
    const group = extGroup(relative);

    metrics.fileCount += 1;
    metrics.totalBytes += bytes;
    metrics.totalGzipBytes += gzipBytes;

    if (group === 'js') {
      metrics.jsBytes += bytes;
      metrics.jsGzipBytes += gzipBytes;
      if (gzipBytes > metrics.largestJsGzipBytes) {
        metrics.largestJsGzipBytes = gzipBytes;
        metrics.largestJsBytes = bytes;
        metrics.largestJsFile = relative;
      }
    } else if (group === 'css') {
      metrics.cssBytes += bytes;
      metrics.cssGzipBytes += gzipBytes;
    } else if (group === 'html') {
      metrics.htmlBytes += bytes;
      metrics.htmlGzipBytes += gzipBytes;
    }
  }

  return metrics;
}

async function readBaseline() {
  const raw = await fs.readFile(BASELINE_FILE, 'utf8').catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeBaseline(metrics) {
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    distDir: 'dist',
    budgets: BUDGETS,
    metrics
  };
  await fs.writeFile(BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function compareAgainstBaseline(current, baseline) {
  const failures = [];
  for (const key of Object.keys(BUDGETS)) {
    const budgetPct = BUDGETS[key];
    const baselineValue = baseline.metrics[key];
    const currentValue = current[key];
    if (!Number.isFinite(baselineValue) || baselineValue <= 0) continue;
    const deltaPct = ((currentValue - baselineValue) / baselineValue) * 100;
    const exceeded = deltaPct > budgetPct;
    const label = METRIC_LABELS[key] ?? key;
    const line = `${label}: ${formatBytes(currentValue)} (baseline ${formatBytes(baselineValue)}, ${formatDeltaPct(
      currentValue,
      baselineValue
    )}, budget +${budgetPct}%)`;
    if (exceeded) {
      failures.push(line);
    } else {
      console.log(`PASS  ${line}`);
    }
  }
  return failures;
}

async function main() {
  console.log(`Running perf regression script in ${modeLabel} mode`);
  const metrics = await collectMetrics();
  console.log(`Current dist summary: files=${metrics.fileCount}, total=${formatBytes(metrics.totalBytes)}, gzip=${formatBytes(metrics.totalGzipBytes)}`);
  if (metrics.largestJsFile) {
    console.log(
      `Largest JS bundle: ${metrics.largestJsFile} (${formatBytes(metrics.largestJsBytes)} raw / ${formatBytes(metrics.largestJsGzipBytes)} gzip)`
    );
  }

  if (shouldUpdate) {
    await writeBaseline(metrics);
    console.log(`Updated perf baseline: ${path.relative(ROOT_DIR, BASELINE_FILE)}`);
    return;
  }

  const baseline = await readBaseline();
  if (!baseline || !baseline.metrics) {
    throw new Error(`Missing baseline file: ${path.relative(ROOT_DIR, BASELINE_FILE)}. Run with --update first.`);
  }

  const failures = compareAgainstBaseline(metrics, baseline);
  if (failures.length > 0) {
    console.error('\nPERF REGRESSION DETECTED');
    for (const line of failures) {
      console.error(`FAIL  ${line}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Perf regression check passed.');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
