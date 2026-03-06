export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export type DiskType = 'nvme' | 'ssd' | 'hdd' | 'unknown';

export const RADAR_CENTER = 100;
export const RADAR_RADIUS = 68;
export const RADAR_LABEL_RADIUS = 88;
export const RADAR_RINGS = [0.2, 0.4, 0.6, 0.8, 1];

type Translate = (key: string, params?: Record<string, unknown>) => string;

export type RadarMetric = {
  title: string;
  score: number;
};

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function gradeForScore(value: number): Grade {
  if (value >= 95) return 'S';
  if (value >= 80) return 'A';
  if (value >= 60) return 'B';
  if (value >= 40) return 'C';
  return 'D';
}

export function gradeColor(grade: Grade) {
  if (grade === 'S') return 'rgba(0, 242, 255, 0.96)';
  if (grade === 'A') return 'rgba(99, 255, 212, 0.92)';
  if (grade === 'B') return 'rgba(255, 214, 102, 0.92)';
  if (grade === 'C') return 'rgba(255, 144, 155, 0.92)';
  return 'rgba(255, 92, 92, 0.92)';
}

export function gradeLabel(grade: Grade, t: Translate) {
  if (grade === 'S') return t('toolkit.levelS');
  if (grade === 'A') return t('toolkit.levelA');
  if (grade === 'B') return t('toolkit.levelB');
  if (grade === 'C') return t('toolkit.levelC');
  return t('toolkit.levelD');
}

export function badgeClassForScore(value: number) {
  return `toolkit-score-badge--${gradeForScore(value).toLowerCase()}`;
}

export function totalSummaryText(score: number, t: Translate) {
  if (score >= 95) return t('toolkit.totalSummaryS');
  if (score >= 80) return t('toolkit.totalSummaryA');
  if (score >= 60) return t('toolkit.totalSummaryB');
  if (score >= 40) return t('toolkit.totalSummaryC');
  return t('toolkit.totalSummaryD');
}

export function parseRamSpec(value: string) {
  const text = value ?? '';
  const totalMatch = text.match(/(\d+)\s*(?:GB|G)\b/i);
  const freqMatch = text.match(/(\d{3,5})\s*mhz/i);
  const typeMatch = text.match(/\b(DDR\d|LPDDR\d)\b/i);
  return {
    totalGb: totalMatch ? Math.max(1, Number(totalMatch[1])) : null,
    freqMhz: freqMatch ? Math.max(1, Number(freqMatch[1])) : null,
    type: typeMatch ? typeMatch[1].toUpperCase() : null
  };
}

export function buildRamLabel(
  spec: { totalGb: number | null; freqMhz: number | null; type: string | null },
  totalGb: number,
  t: Translate
) {
  const parts: string[] = [];
  if (spec.type) parts.push(spec.type);
  if (spec.freqMhz) parts.push(`${spec.freqMhz}MHz`);
  if (totalGb) parts.push(`${totalGb}GB`);
  return parts.length ? parts.join(' ') : t('common.na');
}

export function detectDiskType(models: string[]): DiskType {
  const text = models.join(' ').toLowerCase();
  if (!text.trim()) return 'unknown';
  if (/(nvme|pcie|m\.2)/i.test(text)) return 'nvme';
  if (/(ssd|solid state)/i.test(text)) return 'ssd';
  if (/(hdd|hard disk|5400|7200|wdc|seagate|hitachi|toshiba)/i.test(text)) return 'hdd';
  return 'unknown';
}

export function calcCpuScore(model: string, maxFreqMhz: number | null, currentFreqMhz: number | null) {
  const freq = maxFreqMhz ?? currentFreqMhz ?? 3200;
  const base = ((freq - 800) / (5200 - 800)) * 100;
  const name = (model ?? '').toLowerCase();
  let boost = 0;
  if (/(threadripper|epyc|xeon w|xeon gold|i9|ryzen 9)/i.test(name)) boost = 18;
  else if (/(i7|ryzen 7)/i.test(name)) boost = 12;
  else if (/(i5|ryzen 5)/i.test(name)) boost = 8;
  else if (/(i3|ryzen 3)/i.test(name)) boost = 0;
  else if (/(celeron|pentium|athlon)/i.test(name)) boost = -12;
  else if (/\bm[1-3]\b|\bm2\b|\bm3\b/i.test(name)) boost = 15;
  return clampScore(base + boost);
}

export function calcGpuScore(vramGb: number | null, freqMhz: number | null) {
  const vramScore = calcVramScoreForGaming(vramGb) ?? 40;
  const freqScore = calcGpuFreqScore(freqMhz);
  const baseScore = vramScore * 0.7 + freqScore * 0.3;

  const vramBonus = (vramGb ?? 0) >= 12 ? 8 : (vramGb ?? 0) < 6 ? -12 : 0;
  return clampScore(baseScore + vramBonus);
}

function calcGpuFreqScore(freqMhz: number | null): number {
  if (freqMhz == null || freqMhz <= 0) return 65;
  if (freqMhz >= 2500) return 100;
  if (freqMhz >= 2200) return 92;
  if (freqMhz >= 1900) return 84;
  if (freqMhz >= 1600) return 76;
  if (freqMhz >= 1300) return 68;
  if (freqMhz >= 1000) return 58;
  return 48;
}

function calcVramScoreForGaming(vramGb: number | null) {
  if (vramGb == null) return null;
  if (vramGb >= 24) return 100;
  if (vramGb >= 16) return 94;
  if (vramGb >= 12) return 87;
  if (vramGb >= 8) return 80;
  if (vramGb >= 6) return 72;
  if (vramGb >= 4) return 62;
  if (vramGb >= 2) return 48;
  return 32;
}

function calcVramScore(vramGb: number | null) {
  if (vramGb == null) return null;
  if (vramGb >= 24) return 92;
  if (vramGb >= 16) return 82;
  if (vramGb >= 12) return 72;
  if (vramGb >= 8) return 60;
  if (vramGb >= 6) return 50;
  if (vramGb >= 4) return 40;
  if (vramGb >= 2) return 30;
  return 20;
}

export function calcRamScore(totalGb: number, freqMhz: number | null) {
  let score = 0;
  if (totalGb >= 64) score = 100;
  else if (totalGb >= 32) score = 95;
  else if (totalGb >= 16) score = 80;
  else if (totalGb >= 12) score = 72;
  else if (totalGb >= 8) score = 60;
  else if (totalGb >= 4) score = 40;
  else score = 20;

  if (freqMhz != null) {
    if (freqMhz >= 5600) score += 4;
    else if (freqMhz >= 3600) score += 2;
  }
  return clampScore(score);
}

export function calcDiskScore(type: DiskType) {
  if (type === 'nvme') return 100;
  if (type === 'ssd') return 80;
  if (type === 'hdd') return 40;
  return 60;
}

export function calcBalanceScore(cpu: number, gpu: number, ram: number, diskType: DiskType) {
  const values = [cpu, gpu, ram];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);
  let score = 100 - stddev * 2;
  if (diskType === 'hdd') score -= 10;
  return clampScore(score);
}

export function calcLlmScore(vramGb: number | null, ramScore: number, cpuScore: number, diskScore: number, diskType: DiskType) {
  const vramScore = calcVramScore(vramGb) ?? 30;
  let score = vramScore * 0.5 + ramScore * 0.25 + cpuScore * 0.15 + diskScore * 0.1;
  if (diskType === 'hdd') score -= 15;
  return clampScore(score);
}

export function calcOverallScore(cpu: number, gpu: number, ram: number, diskScore: number) {
  return clampScore(cpu * 0.32 + gpu * 0.32 + ram * 0.22 + diskScore * 0.14);
}

export function calcProductivityScore(cpu: number, gpu: number, ram: number, diskScore: number) {
  return clampScore(cpu * 0.35 + ram * 0.3 + diskScore * 0.2 + gpu * 0.15);
}

export function calcCodingScore(ramGb: number, diskType: DiskType) {
  let score = 0;
  if (ramGb >= 64) score = 100;
  else if (ramGb >= 32) score = 95;
  else if (ramGb >= 16) score = 80;
  else if (ramGb >= 8) score = 60;
  else if (ramGb >= 4) score = 40;
  else score = 25;
  if (diskType === 'hdd') score -= 10;
  return clampScore(score);
}

export function isCudaSupported(model: string) {
  return /(nvidia|geforce|rtx|gtx|quadro|tesla)/i.test(model ?? '');
}

export function calcRadarAxes(metrics: RadarMetric[]) {
  const total = Math.max(1, metrics.length);
  return metrics.map((item, index) => {
    const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
    const x = RADAR_CENTER + RADAR_RADIUS * Math.cos(angle);
    const y = RADAR_CENTER + RADAR_RADIUS * Math.sin(angle);
    const labelX = RADAR_CENTER + RADAR_LABEL_RADIUS * Math.cos(angle);
    const labelY = RADAR_CENTER + RADAR_LABEL_RADIUS * Math.sin(angle);
    const axisCos = Math.cos(angle);
    const axisSin = Math.sin(angle);
    const anchor = Math.abs(axisCos) < 0.2 ? 'middle' : axisCos > 0 ? 'start' : 'end';
    const baseline = Math.abs(axisSin) < 0.2 ? 'middle' : axisSin > 0 ? 'hanging' : 'baseline';
    return { x, y, labelX, labelY, label: item.title, anchor, baseline };
  });
}

export function calcRadarGridPolygons(metricCount: number) {
  const total = Math.max(1, metricCount);
  return RADAR_RINGS.map(step => {
    const points = Array.from({ length: metricCount }, (_, index) => {
      const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
      const radius = RADAR_RADIUS * step;
      const x = RADAR_CENTER + radius * Math.cos(angle);
      const y = RADAR_CENTER + radius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return { step, points };
  });
}

export function calcRadarValuePoints(metrics: RadarMetric[]) {
  const total = Math.max(1, metrics.length);
  return metrics
    .map((item, index) => {
      const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
      const radius = (RADAR_RADIUS * item.score) / 100;
      const x = RADAR_CENTER + radius * Math.cos(angle);
      const y = RADAR_CENTER + radius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function calcRadarValueDots(metrics: RadarMetric[]) {
  const total = Math.max(1, metrics.length);
  return metrics.map((item, index) => {
    const angle = ((-90 + (360 / total) * index) * Math.PI) / 180;
    const radius = (RADAR_RADIUS * item.score) / 100;
    return {
      x: RADAR_CENTER + radius * Math.cos(angle),
      y: RADAR_CENTER + radius * Math.sin(angle)
    };
  });
}
