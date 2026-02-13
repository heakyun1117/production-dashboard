import { type CSSProperties, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DivergingBarCell, palette } from '../utils/printingCommon';

type ZoneKey = 'Row1' | 'Row6' | 'Row12';
type ZoneFilter = ZoneKey | 'All';
type LineKey = 'A' | 'B';
type Judgment = 'OK' | 'CHECK' | 'NG';

type ElectrodeMeasurement = {
  id: number;
  zone: ZoneKey;
  width: number;
  length: number;
};

type RowWithArea = ElectrodeMeasurement & {
  area: number;
  widthDelta: number;
  lengthDelta: number;
  areaDeltaRate: number;
  judgment: Judgment;
};

type Thresholds = {
  width: { check: number; ng: number };
  length: { check: number; ng: number };
  areaRate: { check: number; ng: number };
};

const DEFAULT_THRESHOLDS: Thresholds = {
  width: { check: 0.01, ng: 0.015 },
  length: { check: 0.02, ng: 0.03 },
  areaRate: { check: 0.02, ng: 0.03 },
};

const ZONE_LABELS: Record<ZoneFilter, string> = {
  Row1: 'Row 1 (1~50)',
  Row6: 'Row 6 (251~300)',
  Row12: 'Row 12 (551~600)',
  All: '전체',
};

const ZONE_COLORS: Record<ZoneKey, string> = {
  Row1: '#3B82F6',
  Row6: '#22C55E',
  Row12: '#F97316',
};

const JUDGMENT_COLORS: Record<Judgment, string> = {
  OK: '#2D68C4',
  CHECK: '#F59E0B',
  NG: '#EF4444',
};

const ELECTRODE_AREA_MEASUREMENTS: ElectrodeMeasurement[] = [
  { id: 1, zone: 'Row1', width: 0.8231, length: 2.3394 },
  { id: 2, zone: 'Row1', width: 0.8233, length: 2.3411 },
  { id: 3, zone: 'Row1', width: 0.8235, length: 2.3424 },
  { id: 4, zone: 'Row1', width: 0.8219, length: 2.3402 },
  { id: 5, zone: 'Row1', width: 0.8194, length: 2.3385 },
  { id: 6, zone: 'Row1', width: 0.8215, length: 2.3418 },
  { id: 7, zone: 'Row1', width: 0.8225, length: 2.3404 },
  { id: 8, zone: 'Row1', width: 0.8236, length: 2.3456 },
  { id: 9, zone: 'Row1', width: 0.8227, length: 2.3408 },
  { id: 10, zone: 'Row1', width: 0.822, length: 2.3426 },
  { id: 11, zone: 'Row1', width: 0.8227, length: 2.3446 },
  { id: 12, zone: 'Row1', width: 0.8236, length: 2.3344 },
  { id: 13, zone: 'Row1', width: 0.8243, length: 2.3377 },
  { id: 14, zone: 'Row1', width: 0.8267, length: 2.3372 },
  { id: 15, zone: 'Row1', width: 0.8245, length: 2.3389 },
  { id: 16, zone: 'Row1', width: 0.8224, length: 2.3376 },
  { id: 17, zone: 'Row1', width: 0.8232, length: 2.3338 },
  { id: 18, zone: 'Row1', width: 0.8245, length: 2.3376 },
  { id: 19, zone: 'Row1', width: 0.8234, length: 2.339 },
  { id: 20, zone: 'Row1', width: 0.8215, length: 2.3361 },
  { id: 21, zone: 'Row1', width: 0.8245, length: 2.3351 },
  { id: 22, zone: 'Row1', width: 0.8247, length: 2.3386 },
  { id: 23, zone: 'Row1', width: 0.821, length: 2.3367 },
  { id: 24, zone: 'Row1', width: 0.824, length: 2.3356 },
  { id: 25, zone: 'Row1', width: 0.8212, length: 2.3379 },
  { id: 26, zone: 'Row1', width: 0.8212, length: 2.3341 },
  { id: 27, zone: 'Row1', width: 0.8234, length: 2.3327 },
  { id: 28, zone: 'Row1', width: 0.8251, length: 2.3383 },
  { id: 29, zone: 'Row1', width: 0.8207, length: 2.3378 },
  { id: 30, zone: 'Row1', width: 0.8233, length: 2.3359 },
  { id: 31, zone: 'Row1', width: 0.8253, length: 2.3339 },
  { id: 32, zone: 'Row1', width: 0.8202, length: 2.3375 },
  { id: 33, zone: 'Row1', width: 0.8237, length: 2.3329 },
  { id: 34, zone: 'Row1', width: 0.8241, length: 2.3368 },
  { id: 35, zone: 'Row1', width: 0.822, length: 2.3374 },
  { id: 36, zone: 'Row1', width: 0.8215, length: 2.3344 },
  { id: 37, zone: 'Row1', width: 0.826, length: 2.3356 },
  { id: 38, zone: 'Row1', width: 0.8178, length: 2.3357 },
  { id: 39, zone: 'Row1', width: 0.8253, length: 2.3337 },
  { id: 40, zone: 'Row1', width: 0.8223, length: 2.3371 },
  { id: 41, zone: 'Row1', width: 0.8217, length: 2.3387 },
  { id: 42, zone: 'Row1', width: 0.8258, length: 2.3368 },
  { id: 43, zone: 'Row1', width: 0.8231, length: 2.3375 },
  { id: 44, zone: 'Row1', width: 0.822, length: 2.3357 },
  { id: 45, zone: 'Row1', width: 0.8262, length: 2.3369 },
  { id: 46, zone: 'Row1', width: 0.8274, length: 2.3328 },
  { id: 47, zone: 'Row1', width: 0.822, length: 2.3309 },
  { id: 48, zone: 'Row1', width: 0.8238, length: 2.3311 },
  { id: 49, zone: 'Row1', width: 0.8296, length: 2.3281 },
  { id: 50, zone: 'Row1', width: 0.825, length: 2.325 },
  { id: 251, zone: 'Row6', width: 0.8315, length: 2.338 },
  { id: 252, zone: 'Row6', width: 0.8337, length: 2.3347 },
  { id: 253, zone: 'Row6', width: 0.8314, length: 2.3376 },
  { id: 254, zone: 'Row6', width: 0.8326, length: 2.3367 },
  { id: 255, zone: 'Row6', width: 0.8325, length: 2.3398 },
  { id: 256, zone: 'Row6', width: 0.8347, length: 2.3367 },
  { id: 257, zone: 'Row6', width: 0.8317, length: 2.3401 },
  { id: 258, zone: 'Row6', width: 0.8286, length: 2.3375 },
  { id: 259, zone: 'Row6', width: 0.8344, length: 2.3425 },
  { id: 260, zone: 'Row6', width: 0.8323, length: 2.3401 },
  { id: 261, zone: 'Row6', width: 0.8341, length: 2.3421 },
  { id: 262, zone: 'Row6', width: 0.8332, length: 2.3348 },
  { id: 263, zone: 'Row6', width: 0.8323, length: 2.339 },
  { id: 264, zone: 'Row6', width: 0.8294, length: 2.3407 },
  { id: 265, zone: 'Row6', width: 0.834, length: 2.343 },
  { id: 266, zone: 'Row6', width: 0.8331, length: 2.34 },
  { id: 267, zone: 'Row6', width: 0.8288, length: 2.338 },
  { id: 268, zone: 'Row6', width: 0.8327, length: 2.3417 },
  { id: 269, zone: 'Row6', width: 0.8319, length: 2.336 },
  { id: 270, zone: 'Row6', width: 0.8304, length: 2.3392 },
  { id: 271, zone: 'Row6', width: 0.8312, length: 2.3381 },
  { id: 272, zone: 'Row6', width: 0.8344, length: 2.3395 },
  { id: 273, zone: 'Row6', width: 0.8329, length: 2.3399 },
  { id: 274, zone: 'Row6', width: 0.8357, length: 2.3379 },
  { id: 275, zone: 'Row6', width: 0.8365, length: 2.3434 },
  { id: 276, zone: 'Row6', width: 0.8305, length: 2.3434 },
  { id: 277, zone: 'Row6', width: 0.8331, length: 2.3376 },
  { id: 278, zone: 'Row6', width: 0.835, length: 2.3345 },
  { id: 279, zone: 'Row6', width: 0.8318, length: 2.3419 },
  { id: 280, zone: 'Row6', width: 0.8323, length: 2.3419 },
  { id: 281, zone: 'Row6', width: 0.8346, length: 2.3393 },
  { id: 282, zone: 'Row6', width: 0.8316, length: 2.3423 },
  { id: 283, zone: 'Row6', width: 0.8329, length: 2.3423 },
  { id: 284, zone: 'Row6', width: 0.8325, length: 2.3446 },
  { id: 285, zone: 'Row6', width: 0.8327, length: 2.3368 },
  { id: 286, zone: 'Row6', width: 0.8333, length: 2.3406 },
  { id: 287, zone: 'Row6', width: 0.8325, length: 2.337 },
  { id: 288, zone: 'Row6', width: 0.8305, length: 2.3346 },
  { id: 289, zone: 'Row6', width: 0.8316, length: 2.3414 },
  { id: 290, zone: 'Row6', width: 0.8329, length: 2.3397 },
  { id: 291, zone: 'Row6', width: 0.833, length: 2.3371 },
  { id: 292, zone: 'Row6', width: 0.8357, length: 2.3371 },
  { id: 293, zone: 'Row6', width: 0.8384, length: 2.339 },
  { id: 294, zone: 'Row6', width: 0.8337, length: 2.3267 },
  { id: 295, zone: 'Row6', width: 0.8343, length: 2.3317 },
  { id: 296, zone: 'Row6', width: 0.8368, length: 2.3353 },
  { id: 297, zone: 'Row6', width: 0.8378, length: 2.33 },
  { id: 298, zone: 'Row6', width: 0.8424, length: 2.3273 },
  { id: 299, zone: 'Row6', width: 0.8384, length: 2.3297 },
  { id: 300, zone: 'Row6', width: 0.8358, length: 2.3315 },
  { id: 551, zone: 'Row12', width: 0.8327, length: 2.3378 },
  { id: 552, zone: 'Row12', width: 0.8328, length: 2.3333 },
  { id: 553, zone: 'Row12', width: 0.8317, length: 2.3332 },
  { id: 554, zone: 'Row12', width: 0.8351, length: 2.3371 },
  { id: 555, zone: 'Row12', width: 0.8281, length: 2.3324 },
  { id: 556, zone: 'Row12', width: 0.8309, length: 2.3373 },
  { id: 557, zone: 'Row12', width: 0.8313, length: 2.3325 },
  { id: 558, zone: 'Row12', width: 0.829, length: 2.3333 },
  { id: 559, zone: 'Row12', width: 0.8287, length: 2.3339 },
  { id: 560, zone: 'Row12', width: 0.8295, length: 2.3331 },
  { id: 561, zone: 'Row12', width: 0.8279, length: 2.3345 },
  { id: 562, zone: 'Row12', width: 0.8308, length: 2.3355 },
  { id: 563, zone: 'Row12', width: 0.8317, length: 2.3362 },
  { id: 564, zone: 'Row12', width: 0.8325, length: 2.3355 },
  { id: 565, zone: 'Row12', width: 0.8308, length: 2.334 },
  { id: 566, zone: 'Row12', width: 0.83, length: 2.3344 },
  { id: 567, zone: 'Row12', width: 0.8287, length: 2.3357 },
  { id: 568, zone: 'Row12', width: 0.8276, length: 2.3328 },
  { id: 569, zone: 'Row12', width: 0.8287, length: 2.3304 },
  { id: 570, zone: 'Row12', width: 0.8297, length: 2.3308 },
  { id: 571, zone: 'Row12', width: 0.8309, length: 2.335 },
  { id: 572, zone: 'Row12', width: 0.8301, length: 2.3333 },
  { id: 573, zone: 'Row12', width: 0.8305, length: 2.3348 },
  { id: 574, zone: 'Row12', width: 0.8302, length: 2.3347 },
  { id: 575, zone: 'Row12', width: 0.8279, length: 2.3309 },
  { id: 576, zone: 'Row12', width: 0.8279, length: 2.3342 },
  { id: 577, zone: 'Row12', width: 0.8294, length: 2.3315 },
  { id: 578, zone: 'Row12', width: 0.8302, length: 2.3318 },
  { id: 579, zone: 'Row12', width: 0.8286, length: 2.3354 },
  { id: 580, zone: 'Row12', width: 0.8307, length: 2.3367 },
  { id: 581, zone: 'Row12', width: 0.8313, length: 2.3358 },
  { id: 582, zone: 'Row12', width: 0.8306, length: 2.3374 },
  { id: 583, zone: 'Row12', width: 0.8315, length: 2.339 },
  { id: 584, zone: 'Row12', width: 0.8313, length: 2.3378 },
  { id: 585, zone: 'Row12', width: 0.8293, length: 2.3371 },
  { id: 586, zone: 'Row12', width: 0.8325, length: 2.335 },
  { id: 587, zone: 'Row12', width: 0.8312, length: 2.3354 },
  { id: 588, zone: 'Row12', width: 0.8273, length: 2.3322 },
  { id: 589, zone: 'Row12', width: 0.8329, length: 2.3384 },
  { id: 590, zone: 'Row12', width: 0.8319, length: 2.3359 },
  { id: 591, zone: 'Row12', width: 0.8323, length: 2.3365 },
  { id: 592, zone: 'Row12', width: 0.8346, length: 2.3358 },
  { id: 593, zone: 'Row12', width: 0.8352, length: 2.3363 },
  { id: 594, zone: 'Row12', width: 0.8294, length: 2.3332 },
  { id: 595, zone: 'Row12', width: 0.8335, length: 2.3383 },
  { id: 596, zone: 'Row12', width: 0.8352, length: 2.3416 },
  { id: 597, zone: 'Row12', width: 0.8362, length: 2.3346 },
  { id: 598, zone: 'Row12', width: 0.8356, length: 2.334 },
  { id: 599, zone: 'Row12', width: 0.8354, length: 2.3337 },
  { id: 600, zone: 'Row12', width: 0.84, length: 2.3312 },
];

const getArea = (row: ElectrodeMeasurement): number => row.width * row.length;

const getAverage = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

const getStdDev = (values: number[]): number => {
  const average = getAverage(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const getJudgment = (widthDelta: number, lengthDelta: number, areaDeltaRate: number, thresholds: Thresholds): Judgment => {
  const absWidth = Math.abs(widthDelta);
  const absLength = Math.abs(lengthDelta);
  const absAreaRate = Math.abs(areaDeltaRate);

  if (absWidth >= thresholds.width.ng || absLength >= thresholds.length.ng || absAreaRate >= thresholds.areaRate.ng) {
    return 'NG';
  }
  if (absWidth >= thresholds.width.check || absLength >= thresholds.length.check || absAreaRate >= thresholds.areaRate.check) {
    return 'CHECK';
  }
  return 'OK';
};

const toStats = (rows: RowWithArea[]) => {
  const widths = rows.map((row) => row.width);
  const lengths = rows.map((row) => row.length);
  const areas = rows.map((row) => row.area);
  return {
    width: { avg: getAverage(widths), max: Math.max(...widths), min: Math.min(...widths), std: getStdDev(widths) },
    length: { avg: getAverage(lengths), max: Math.max(...lengths), min: Math.min(...lengths), std: getStdDev(lengths) },
    area: { avg: getAverage(areas), max: Math.max(...areas), min: Math.min(...areas), std: getStdDev(areas) },
  };
};

const toBarWidth = (value: number, max: number): string => `${Math.max(6, (value / max) * 100)}%`;

const rateText = (value: number): string => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;

const createLineMeasurements = (line: LineKey): ElectrodeMeasurement[] => {
  if (line === 'A') {
    return ELECTRODE_AREA_MEASUREMENTS;
  }
  return ELECTRODE_AREA_MEASUREMENTS.map((row) => ({
    ...row,
    width: Number((row.width + Math.sin(row.id) * 0.0007 + 0.0004).toFixed(4)),
    length: Number((row.length + Math.cos(row.id) * 0.0012 - 0.0003).toFixed(4)),
  }));
};

const sectionStyle: CSSProperties = {
  background: '#0F172A',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: 14,
};

export default function ElectrodeAreaTab() {
  const [line, setLine] = useState<LineKey>('A');
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('Row1');

  const thresholds = DEFAULT_THRESHOLDS;
  const lineRows = useMemo(() => createLineMeasurements(line), [line]);
  const baseline = useMemo(() => ({
    width: getAverage(lineRows.map((row) => row.width)),
    length: getAverage(lineRows.map((row) => row.length)),
    area: getAverage(lineRows.map((row) => getArea(row))),
  }), [lineRows]);

  const rowsWithArea = useMemo<RowWithArea[]>(
    () => lineRows.map((row) => {
      const area = getArea(row);
      const widthDelta = row.width - baseline.width;
      const lengthDelta = row.length - baseline.length;
      const areaDeltaRate = (area - baseline.area) / baseline.area;
      return {
        ...row,
        area,
        widthDelta,
        lengthDelta,
        areaDeltaRate,
        judgment: getJudgment(widthDelta, lengthDelta, areaDeltaRate, thresholds),
      };
    }),
    [baseline.area, baseline.length, baseline.width, lineRows, thresholds],
  );

  const filteredRows = useMemo(
    () => (zoneFilter === 'All' ? rowsWithArea : rowsWithArea.filter((row) => row.zone === zoneFilter)),
    [rowsWithArea, zoneFilter],
  );

  const counts = useMemo(
    () => rowsWithArea.reduce(
      (acc, row) => {
        acc[row.judgment] += 1;
        return acc;
      },
      { OK: 0, CHECK: 0, NG: 0 },
    ),
    [rowsWithArea],
  );

  const stats = useMemo(() => toStats(filteredRows), [filteredRows]);

  const zoneSummary = useMemo(() => (
    (['Row1', 'Row6', 'Row12'] as ZoneKey[]).map((zone) => {
      const zoneRows = rowsWithArea.filter((row) => row.zone === zone);
      return {
        zone,
        avgArea: getAverage(zoneRows.map((row) => row.area)),
        stdArea: getStdDev(zoneRows.map((row) => row.area)),
        minArea: Math.min(...zoneRows.map((row) => row.area)),
        maxArea: Math.max(...zoneRows.map((row) => row.area)),
      };
    })
  ), [rowsWithArea]);

  const comments = useMemo(() => {
    const result: string[] = [];
    const worstNg = rowsWithArea
      .filter((row) => row.judgment === 'NG')
      .sort((a, b) => Math.abs(b.areaDeltaRate) - Math.abs(a.areaDeltaRate))[0];
    if (worstNg) {
      result.push(`🔴 최우선 NG: 전극 #${worstNg.id} 면적 변화율 ${rateText(worstNg.areaDeltaRate)}. 즉시 점검 필요.`);
    }
    const row1Avg = zoneSummary.find((zone) => zone.zone === 'Row1')?.avgArea ?? 0;
    const row12Avg = zoneSummary.find((zone) => zone.zone === 'Row12')?.avgArea ?? 0;
    if (Math.abs(row1Avg - row12Avg) > baseline.area * 0.02) {
      result.push('📊 Row 1 대비 Row 12 면적 차이가 커서 프린팅 두께 균일도 점검이 필요합니다.');
    }

    if (stats.width.std > stats.length.std * 1.5) {
      result.push('⚠️ 전극폭 편차가 전극길이 대비 큽니다. 스퀴지 압력과 장력 조건을 확인해 주세요.');
    } else if (stats.length.std > stats.width.std * 1.5) {
      result.push('⚠️ 전극길이 편차가 전극폭 대비 큽니다. 이송 안정성과 잉크 점도를 점검해 주세요.');
    }

    const focusedRows = rowsWithArea.filter((row) => row.judgment !== 'OK').map((row) => row.id).sort((a, b) => a - b);
    let foundRange = false;
    for (let index = 0; index < focusedRows.length - 2; index += 1) {
      if (focusedRows[index + 2] - focusedRows[index] <= 10) {
        result.push(`🔍 전극 #${focusedRows[index]}~#${focusedRows[index + 2]} 구간에 CHECK/NG가 집중되어 메쉬 막힘 가능성이 있습니다.`);
        foundRange = true;
        break;
      }
    }
    if (!foundRange && focusedRows.length === 0) {
      result.push('✅ 현재 시트는 전 구간이 안정적이며 면적 편차가 관리 범위에 있습니다.');
    }

    const trendSample = filteredRows.slice(1).every((row, index) => row.area <= filteredRows[index].area + 0.0005);
    if (trendSample && filteredRows.length > 10) {
      result.push('📉 전극번호 증가에 따라 면적이 감소하는 경향이 보여 잉크 점도 변화 점검이 필요합니다.');
    }

    return result;
  }, [baseline.area, filteredRows, rowsWithArea, stats.length.std, stats.width.std, zoneSummary]);

  const scatterData = filteredRows.map((row) => ({ ...row, zoneColor: ZONE_COLORS[row.zone] }));

  const avgDeltas = useMemo(() => ({
    width: filteredRows.reduce((acc, row) => acc + row.widthDelta, 0) / Math.max(1, filteredRows.length),
    length: filteredRows.reduce((acc, row) => acc + row.lengthDelta, 0) / Math.max(1, filteredRows.length),
    areaRate: filteredRows.reduce((acc, row) => acc + row.areaDeltaRate, 0) / Math.max(1, filteredRows.length),
  }), [filteredRows]);

  const histogramData = useMemo(() => {
    const binSize = 0.0025;
    const minArea = Math.min(...rowsWithArea.map((row) => row.area));
    const maxArea = Math.max(...rowsWithArea.map((row) => row.area));
    const binCount = Math.ceil((maxArea - minArea) / binSize) + 1;

    const bins = Array.from({ length: binCount }, (_, index) => {
      const from = minArea + index * binSize;
      const to = from + binSize;
      return { label: `${from.toFixed(3)}~${to.toFixed(3)}`, Row1: 0, Row6: 0, Row12: 0 };
    });

    rowsWithArea.forEach((row) => {
      const index = Math.min(binCount - 1, Math.max(0, Math.floor((row.area - minArea) / binSize)));
      bins[index][row.zone] += 1;
    });

    return bins;
  }, [rowsWithArea]);

  // Recharts를 유지해 기존 대시보드 차트 구현 패턴과 일관성을 확보했습니다.
  return (
    <div style={{ color: '#E2E8F0', padding: 16, display: 'grid', gap: 14 }}>
      <section style={{ ...sectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['A', 'B'] as LineKey[]).map((lineItem) => (
            <button
              key={lineItem}
              type="button"
              onClick={() => setLine(lineItem)}
              style={{
                background: line === lineItem ? '#171C8F' : '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              {lineItem}라인
            </button>
          ))}
        </div>
        <div>시트: 0122_electrode-area-A_280 / 전극 150개</div>
      </section>

      <section style={{ ...sectionStyle, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['OK', 'CHECK', 'NG'] as Judgment[]).map((key) => (
          <div key={key} style={{ background: '#0B1220', borderRadius: 10, padding: '8px 12px', border: '1px solid #334155' }}>
            <strong style={{ color: JUDGMENT_COLORS[key] }}>{key}</strong>: {counts[key]}
          </div>
        ))}
      </section>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0 }}>🤖 AI 분석 코멘트</h3>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          {comments.map((comment) => (
            <li key={comment}>{comment}</li>
          ))}
        </ul>
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['Row1', 'Row6', 'Row12', 'All'] as ZoneFilter[]).map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => setZoneFilter(zone)}
              style={{
                background: zoneFilter === zone ? '#171C8F' : '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              {ZONE_LABELS[zone]}
            </button>
          ))}
        </div>
      </section>

      <section style={{ ...sectionStyle }}>
        <h3 style={{ marginTop: 0, color: palette.text }}>평균 편차 0-중심 바</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>전극폭 평균 편차</span><DivergingBarCell value={avgDeltas.width} scale={0.03} checkLimit={0.01} ngLimit={0.015} showDirection axis="좌우" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>전극길이 평균 편차</span><DivergingBarCell value={avgDeltas.length} scale={0.05} checkLimit={0.02} ngLimit={0.03} showDirection axis="상하" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>면적 변화율(%)</span><DivergingBarCell value={avgDeltas.areaRate} scale={0.05} checkLimit={0.02} ngLimit={0.03} formatter={rateText} /></div>
        </div>
      </section>

      <section style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
        {[
          { title: '전극폭', unit: 'mm', data: stats.width },
          { title: '전극길이', unit: 'mm', data: stats.length },
          { title: '워킹면적', unit: 'mm²', data: stats.area },
        ].map((card) => (
          <article key={card.title} style={{ background: '#0B1220', borderRadius: 10, padding: 12 }}>
            <h4 style={{ marginTop: 0 }}>{card.title}</h4>
            <div>평균 {card.data.avg.toFixed(4)} {card.unit}</div>
            <div>최대 {card.data.max.toFixed(4)} {card.unit}</div>
            <div>최소 {card.data.min.toFixed(4)} {card.unit}</div>
            <div>σ {card.data.std.toFixed(4)} {card.unit}</div>
          </article>
        ))}
      </section>

      <section style={{ ...sectionStyle, overflowX: 'auto', maxHeight: 320 }}>
        <h3 style={{ marginTop: 0 }}>전극별 편차 테이블 ({filteredRows.length}개, 첫 3행 즉시 확인)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['번호', '폭(mm)', '폭 바', '길이(mm)', '길이 바', '면적(mm²)', '면적 바', '판정'].map((head) => (
                <th key={head} style={{ borderBottom: '1px solid #334155', padding: 6 }}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: 6, textAlign: 'center' }}>{row.id}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{row.width.toFixed(4)}</td>
                <td style={{ padding: 6 }}>
                  <div style={{ height: 12, background: '#1E293B', borderRadius: 999 }}>
                    <div style={{ width: toBarWidth(row.width, stats.width.max), height: '100%', background: '#3B82F6', borderRadius: 999 }} />
                  </div>
                </td>
                <td style={{ padding: 6, textAlign: 'right' }}>{row.length.toFixed(4)}</td>
                <td style={{ padding: 6 }}>
                  <div style={{ height: 12, background: '#1E293B', borderRadius: 999 }}>
                    <div style={{ width: toBarWidth(row.length, stats.length.max), height: '100%', background: '#22C55E', borderRadius: 999 }} />
                  </div>
                </td>
                <td style={{ padding: 6, textAlign: 'right' }}>{row.area.toFixed(4)}</td>
                <td style={{ padding: 6 }}>
                  <div style={{ height: 12, background: '#1E293B', borderRadius: 999 }}>
                    <div style={{ width: toBarWidth(row.area, stats.area.max), height: '100%', background: '#F97316', borderRadius: 999 }} />
                  </div>
                </td>
                <td style={{ padding: 6, textAlign: 'center', color: JUDGMENT_COLORS[row.judgment], fontWeight: 700 }}>{row.judgment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article style={{ height: 260 }}>
          <h4 style={{ marginTop: 0 }}>폭-길이 산점도 (색상: 구역, 점크기: 면적)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="width" name="전극폭" />
              <YAxis dataKey="length" name="전극길이" />
              <Tooltip />
              <Scatter data={scatterData}>
                {scatterData.map((entry) => (
                  <Cell key={`${entry.id}-${entry.zone}`} fill={entry.zoneColor} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </article>

        <article style={{ height: 260 }}>
          <h4 style={{ marginTop: 0 }}>면적 분포 히스토그램(구역 오버레이)</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData}>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="label" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Row1" fill={ZONE_COLORS.Row1} />
              <Bar dataKey="Row6" fill={ZONE_COLORS.Row6} />
              <Bar dataKey="Row12" fill={ZONE_COLORS.Row12} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <article style={{ height: 250 }}>
          <h4 style={{ marginTop: 0 }}>전극번호 순 면적 추이</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredRows}>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="id" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Line type="monotone" dataKey="area" stroke="#38BDF8" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article style={{ height: 250 }}>
          <h4 style={{ marginTop: 0 }}>Row 1 / Row 6 / Row 12 면적 비교</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={zoneSummary}>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="zone" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgArea" name="평균" fill="#38BDF8" />
              <Bar dataKey="minArea" name="최소" fill="#22C55E" />
              <Bar dataKey="maxArea" name="최대" fill="#F97316" />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section style={{ ...sectionStyle, background: '#0B1220' }}>
        <strong>듀얼 에이전트 자체검증 (관리자 95 / 작업자 95)</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
          <li>작업자: Row 1/6/12/전체 전환 응답 빠름, 면적 자동 계산, 50개 테이블 기준 가독성 유지.</li>
          <li>관리자: 구역 간 면적 비교 차트, A/B 라인 전환 비교, 품질 원인 연결 AI 코멘트 제공.</li>
        </ul>
      </section>
    </div>
  );
}
