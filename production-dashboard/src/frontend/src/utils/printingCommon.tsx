const CHECK = '#F59E0B';
const NG = '#EF4444';

export const palette = {
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  textDim: '#94A3B8',
  ok: '#2D68C4',
  check: '#F59E0B',
  ng: '#EF4444',
  accent: '#171C8F',
  green: '#78BE20',
  carbon: '#F472B6',
  insulation: '#34D399',
};

export const CHECK_LIMIT = 0.12;
export const NG_LIMIT = 0.15;

export type Status = 'OK' | 'CHECK' | 'NG';

export type RowDeviation = {
  row: number;
  leftRight: number;
  upDown: number;
};

export type RowSummary = RowDeviation & {
  worst: number;
  worstAxis: '좌우' | '상하';
  status: Status;
};

export type SimulationOffsets = {
  q: number;
  leftRightOffset: number;
  upDownOffset: number;
};

export const getStatus = (value: number): Status => {
  const abs = Math.abs(value);
  if (abs >= NG_LIMIT) return 'NG';
  if (abs >= CHECK_LIMIT) return 'CHECK';
  return 'OK';
};

export const getColor = (status: Status) => {
  if (status === 'NG') return palette.ng;
  if (status === 'CHECK') return palette.check;
  return palette.ok;
};

export const mmText = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)} mm`;

export const axisDirectionText = (value: number, axis: '좌우' | '상하') => {
  if (Math.abs(value) < 0.001) return '기준';
  if (axis === '좌우') return value > 0 ? '우→' : '←좌';
  return value > 0 ? '↑상' : '하↓';
};

export const correctionText = (value: number, axis: '좌우' | '상하') => {
  if (Math.abs(value) < 0.001) return '유지';
  if (axis === '좌우') return value > 0 ? `우→ ${value.toFixed(3)}mm` : `←좌 ${Math.abs(value).toFixed(3)}mm`;
  return value > 0 ? `↑상 ${value.toFixed(3)}mm` : `하↓ ${Math.abs(value).toFixed(3)}mm`;
};

export const marginRate = (deviation: number, limit: number = NG_LIMIT): number => ((limit - Math.abs(deviation)) / limit) * 100;

export const toRowSummary = (row: RowDeviation): RowSummary => {
  const worstAxis = Math.abs(row.leftRight) >= Math.abs(row.upDown) ? '좌우' : '상하';
  const worst = worstAxis === '좌우' ? row.leftRight : row.upDown;
  return {
    ...row,
    worst,
    worstAxis,
    status: getStatus(worst),
  };
};

export function buildComments(rows: RowSummary[]): string[] {
  const comments: string[] = [];
  if (rows.length === 0) {
    return ['📭 현재 선택 라인의 측정 데이터가 없습니다.'];
  }

  const ngRows = rows.filter((row) => row.status === 'NG');
  if (ngRows.length > 0) {
    const target = ngRows.reduce((a, b) => (Math.abs(b.worst) > Math.abs(a.worst) ? b : a));
    comments.push(`🔴 Row ${target.row} ${target.worstAxis} ${mmText(target.worst)} — NG. 즉시 보정 필요.`);
  }

  const checkRows = rows.filter((row) => row.status === 'CHECK');
  if (checkRows.length > 0) {
    comments.push(`🟡 CHECK ${checkRows.length}건: Row ${checkRows.map((row) => row.row).join(', ')}. 추이 관찰 권장.`);
  }

  if (ngRows.length === 0 && checkRows.length === 0) {
    comments.push('🔵 전 Row 정상 범위. 현재 보정값 유지.');
  }

  if (ngRows.length > 0 || checkRows.length >= 3) {
    const rec = calcRecommendedOffsets(rows);
    comments.push(
      `🔧 추천 보정: Q ${mmText(rec.q)}, 좌우 ${mmText(rec.leftRightOffset)}, 상하 ${mmText(rec.upDownOffset)} → 보정값 계산기에서 현재 설비값과 합산하세요.`,
    );
  }

  const lowMarginRows = rows.filter((row) => {
    const minMargin = Math.min(marginRate(row.leftRight), marginRate(row.upDown));
    return minMargin < 20;
  });

  if (lowMarginRows.length > 0) {
    comments.push(`⚠️ 마진 20% 미만 Row: ${lowMarginRows.map((row) => row.row).join(', ')}. 추가 보정 없으면 NG 전환 위험.`);
  }

  const avgLeftRight = rows.reduce((acc, row) => acc + row.leftRight, 0) / rows.length;
  const avgUpDown = rows.reduce((acc, row) => acc + row.upDown, 0) / rows.length;
  const trendLimit = CHECK_LIMIT * 0.5;

  if (Math.abs(avgLeftRight) >= trendLimit) {
    comments.push(`📈 좌우 평균 편차 ${mmText(avgLeftRight)} (${axisDirectionText(avgLeftRight, '좌우')}) 경향. ${correctionText(-avgLeftRight, '좌우')} 보정 권장.`);
  }

  if (Math.abs(avgUpDown) >= trendLimit) {
    comments.push(`📈 상하 평균 편차 ${mmText(avgUpDown)} (${axisDirectionText(avgUpDown, '상하')}) 경향. ${correctionText(-avgUpDown, '상하')} 보정 권장.`);
  }

  return comments;
}

export const calcRecommendedOffsets = (rows: RowDeviation[]): SimulationOffsets => {
  if (rows.length === 0) {
    return { q: 0, leftRightOffset: 0, upDownOffset: 0 };
  }

  const avgLeftRight = rows.reduce((acc, row) => acc + row.leftRight, 0) / rows.length;
  const avgUpDown = rows.reduce((acc, row) => acc + row.upDown, 0) / rows.length;

  const center = (rows.length + 1) / 2;
  const slopeNumerator = rows.reduce((acc, row) => acc + (row.row - center) * row.leftRight, 0);
  const slopeDenominator = rows.reduce((acc, row) => acc + (row.row - center) ** 2, 0);
  const slope = slopeDenominator === 0 ? 0 : slopeNumerator / slopeDenominator;

  return {
    q: Number((-slope * 0.9).toFixed(3)),
    leftRightOffset: Number((-avgLeftRight).toFixed(3)),
    upDownOffset: Number((-avgUpDown).toFixed(3)),
  };
};

export const simulateRow = (row: RowDeviation, offsets: SimulationOffsets, rowCount: number): RowDeviation => {
  const center = (rowCount + 1) / 2;
  const positionFactor = (row.row - center) / center;
  const rotationalLeftRight = offsets.q * positionFactor;
  const rotationalUpDown = -offsets.q * positionFactor * 0.4;

  return {
    row: row.row,
    leftRight: Number((row.leftRight + offsets.leftRightOffset + rotationalLeftRight).toFixed(4)),
    upDown: Number((row.upDown + offsets.upDownOffset + rotationalUpDown).toFixed(4)),
  };
};

export function DivergingBarCell({
  value,
  scale = 0.2,
  checkLimit = CHECK_LIMIT,
  ngLimit = NG_LIMIT,
  showDirection = false,
  axis,
}: {
  value: number;
  scale?: number;
  checkLimit?: number;
  ngLimit?: number;
  showDirection?: boolean;
  axis?: '좌우' | '상하';
}) {
  const status = Math.abs(value) >= ngLimit ? 'NG' : Math.abs(value) >= checkLimit ? 'CHECK' : 'OK';
  const half = 72;
  const clamped = Math.max(-scale, Math.min(scale, value));
  const width = Math.max((Math.abs(clamped) / scale) * half, 1);
  const left = clamped >= 0 ? half : half - width;
  const toPx = (target: number) => half + (target / scale) * half;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: half * 2, height: 14, background: '#1E293B', borderRadius: 999, border: `1px solid ${palette.border}` }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: half, width: 1, background: '#8aa0cf' }} />
        <div style={{ position: 'absolute', top: 1, bottom: 1, left: toPx(-checkLimit), borderLeft: `1px dashed ${CHECK}` }} />
        <div style={{ position: 'absolute', top: 1, bottom: 1, left: toPx(checkLimit), borderLeft: `1px dashed ${CHECK}` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: toPx(-ngLimit), borderLeft: `1px dashed ${NG}` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: toPx(ngLimit), borderLeft: `1px dashed ${NG}` }} />
        <div
          style={{
            position: 'absolute',
            top: 2,
            height: 10,
            left,
            width,
            borderRadius: 999,
            background: getColor(status),
          }}
        />
      </div>
      {showDirection && axis && <span style={{ minWidth: 34, color: palette.textDim, fontSize: 12 }}>{axisDirectionText(value, axis)}</span>}
      <span style={{ minWidth: 70, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: palette.text }}>{mmText(value)}</span>
    </div>
  );
}

export function InlineDeviationBar({ value }: { value: number }) {
  return <DivergingBarCell value={value} />;
}

export function BiasCompass({ leftRight: leftRightValue, upDown: upDownValue }: { leftRight: number; upDown: number }) {
  const scale = 0.2;
  const clip = (value: number) => Math.max(-scale, Math.min(scale, value));
  const x = 44 + (clip(leftRightValue) / scale) * 34;
  const y = 44 - (clip(upDownValue) / scale) * 34;
  const status = getStatus(Math.max(Math.abs(leftRightValue), Math.abs(upDownValue)));

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label="치우침 나침반">
      <circle cx="44" cy="44" r="34" fill={palette.card} stroke={palette.border} />
      <circle cx="44" cy="44" r={34 * (CHECK_LIMIT / scale)} fill="none" stroke={CHECK} strokeDasharray="3 3" />
      <circle cx="44" cy="44" r={34 * (NG_LIMIT / scale)} fill="none" stroke={NG} strokeDasharray="3 3" />
      <line x1="44" y1="10" x2="44" y2="78" stroke={palette.border} />
      <line x1="10" y1="44" x2="78" y2="44" stroke={palette.border} />
      <circle cx={x} cy={y} r="5" fill={getColor(status)} />
      <text x="44" y="14" textAnchor="middle" style={{ fontSize: 10, fill: palette.text }}>↑상</text>
      <text x="44" y="84" textAnchor="middle" style={{ fontSize: 10, fill: palette.text }}>하↓</text>
      <text x="12" y="47" textAnchor="middle" style={{ fontSize: 10, fill: palette.text }}>←좌</text>
      <text x="76" y="47" textAnchor="middle" style={{ fontSize: 10, fill: palette.text }}>우→</text>
    </svg>
  );
}

export function BullseyeCell({ leftRight, upDown }: { leftRight: number; upDown: number }) {
  const scale = 0.2;
  const zones = [
    { id: 'L', marker: '▲', x: leftRight * 1.1, y: upDown * 0.9 },
    { id: 'C', marker: '●', x: leftRight, y: upDown },
    { id: 'R', marker: '◆', x: leftRight * 0.9, y: upDown * 1.1 },
  ];

  return (
    <svg width="220" height="108" viewBox="0 0 220 108" role="img" aria-label="L/C/R 치우침 도형">
      <rect x="1" y="1" width="218" height="106" rx="10" fill={palette.card} stroke={palette.border} />
      {[0, 1, 2].map((index) => (
        <g key={index} transform={`translate(${22 + index * 68},18)`}>
          <rect x="0" y="0" width="64" height="72" rx="8" fill="#0B1220" stroke={palette.border} />
          <line x1="32" y1="8" x2="32" y2="64" stroke={palette.border} strokeDasharray="3 2" />
          <line x1="8" y1="36" x2="56" y2="36" stroke={palette.border} strokeDasharray="3 2" />
          <rect x={32 - (CHECK_LIMIT / scale) * 24} y={36 - (CHECK_LIMIT / scale) * 24} width={(CHECK_LIMIT / scale) * 48} height={(CHECK_LIMIT / scale) * 48} fill="none" stroke={CHECK} strokeDasharray="3 2" />
          <rect x={32 - (NG_LIMIT / scale) * 24} y={36 - (NG_LIMIT / scale) * 24} width={(NG_LIMIT / scale) * 48} height={(NG_LIMIT / scale) * 48} fill="none" stroke={NG} strokeDasharray="2 2" />
          <text x="32" y="84" textAnchor="middle" fill={palette.textDim} style={{ fontSize: 10 }}>{zones[index].id}</text>
        </g>
      ))}
      {zones.map((zone, index) => {
        const px = 54 + index * 68 + (Math.max(-scale, Math.min(scale, zone.x)) / scale) * 24;
        const py = 54 - (Math.max(-scale, Math.min(scale, zone.y)) / scale) * 24;
        const status = getStatus(Math.max(Math.abs(zone.x), Math.abs(zone.y)));
        return <text key={zone.id} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fill={getColor(status)} style={{ fontSize: 14, fontWeight: 700 }}>{zone.marker}</text>;
      })}
    </svg>
  );
}

export function FourPointVizPanel({
  before,
  after,
  showAfter,
  material,
}: {
  before: Array<{ x: number; y: number }>;
  after: Array<{ x: number; y: number }>;
  showAfter: boolean;
  material: '카본' | '절연';
}) {
  const active = showAfter ? after : before;
  const color = material === '카본' ? palette.carbon : palette.insulation;
  const anchors = [
    { x: 32, y: 24 },
    { x: 168, y: 24 },
    { x: 32, y: 96 },
    { x: 168, y: 96 },
  ];

  return (
    <svg width="220" height="130" viewBox="0 0 220 130" role="img" aria-label="4코너 시각화">
      <rect x="20" y="12" width="180" height="96" rx="14" fill="#0B1220" stroke={palette.border} />
      <polyline points={anchors.map((a) => `${a.x},${a.y}`).join(' ')} fill="none" stroke={palette.border} strokeDasharray="4 3" />
      {active.map((point, index) => {
        const base = anchors[index];
        return (
          <circle
            key={`${index}-${showAfter}`}
            cx={base.x + point.x * 160}
            cy={base.y - point.y * 160}
            r="5"
            fill={color}
            style={{ transition: 'all 0.35s ease' }}
          />
        );
      })}
      <text x="110" y="124" textAnchor="middle" style={{ fill: palette.textDim, fontSize: 11 }}>{showAfter ? 'AFTER' : 'BEFORE'} · {material}</text>
    </svg>
  );
}
