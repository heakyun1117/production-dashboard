import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHECK = '#F59E0B';
const NG = '#EF4444';

const palette = {
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
};

const CHECK_LIMIT = 0.12;
const NG_LIMIT = 0.15;

type RowDeviation = {
  row: number;
  leftRight: number;
  upDown: number;
};

type RowSummary = RowDeviation & {
  worst: number;
  worstAxis: '좌우' | '상하';
  status: Status;
};

type Status = 'OK' | 'CHECK' | 'NG';
type LineKey = 'A라인' | 'B라인';

type SimulationOffsets = {
  q: number;
  leftRightOffset: number;
  upDownOffset: number;
};

const rowData: RowDeviation[] = [
  { row: 1, leftRight: -0.0022, upDown: -0.019 },
  { row: 2, leftRight: -0.0343, upDown: -0.0425 },
  { row: 3, leftRight: -0.0271, upDown: -0.0243 },
  { row: 4, leftRight: -0.0189, upDown: -0.0496 },
  { row: 5, leftRight: 0.016, upDown: -0.031 },
  { row: 6, leftRight: 0.023, upDown: 0.018 },
  { row: 7, leftRight: -0.041, upDown: 0.061 },
  { row: 8, leftRight: 0.083, upDown: -0.02 },
  { row: 9, leftRight: 0.097, upDown: 0.114 },
  { row: 10, leftRight: 0.121, upDown: -0.108 },
  { row: 11, leftRight: 0.136, upDown: 0.129 },
  { row: 12, leftRight: -0.154, upDown: -0.142 },
];

const getStatus = (value: number): Status => {
  const abs = Math.abs(value);
  if (abs >= NG_LIMIT) return 'NG';
  if (abs >= CHECK_LIMIT) return 'CHECK';
  return 'OK';
};

const getColor = (status: Status) => {
  if (status === 'NG') return palette.ng;
  if (status === 'CHECK') return palette.check;
  return palette.ok;
};

const mmText = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)} mm`;
const plainMmText = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;

const marginRate = (deviation: number, limit: number = NG_LIMIT): number => ((limit - Math.abs(deviation)) / limit) * 100;

const getMarginColor = (margin: number) => {
  if (margin >= 50) return palette.green;
  if (margin >= 20) return palette.check;
  return palette.ng;
};

const axisDirectionText = (value: number, axis: '좌우' | '상하') => {
  if (Math.abs(value) < 0.001) return '기준';
  if (axis === '좌우') return value > 0 ? '우→' : '←좌';
  return value > 0 ? '↑상' : '하↓';
};

const correctionText = (value: number, axis: '좌우' | '상하') => {
  if (Math.abs(value) < 0.001) return '유지';
  if (axis === '좌우') return value > 0 ? `우→ ${value.toFixed(3)}mm` : `←좌 ${Math.abs(value).toFixed(3)}mm`;
  return value > 0 ? `↑상 ${value.toFixed(3)}mm` : `하↓ ${Math.abs(value).toFixed(3)}mm`;
};

const toRowSummary = (row: RowDeviation): RowSummary => {
  const worstAxis = Math.abs(row.leftRight) >= Math.abs(row.upDown) ? '좌우' : '상하';
  const worst = worstAxis === '좌우' ? row.leftRight : row.upDown;
  return {
    ...row,
    worst,
    worstAxis,
    status: getStatus(worst),
  };
};

const calcRecommendedOffsets = (rows: RowDeviation[]): SimulationOffsets => {
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

function buildComments(rows: RowSummary[]): string[] {
  const comments: string[] = [];

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

  const avgLeftRight = rows.reduce((acc, row) => acc + row.leftRight, 0) / rows.length;
  const avgUpDown = rows.reduce((acc, row) => acc + row.upDown, 0) / rows.length;
  const trendLimit = CHECK_LIMIT * 0.5;

  if (Math.abs(avgLeftRight) >= trendLimit) {
    comments.push(`📈 좌우 평균 편차 ${mmText(avgLeftRight)} (${axisDirectionText(avgLeftRight, '좌우')}) 경향. ${correctionText(-avgLeftRight, '좌우')} 보정 권장.`);
  }

  if (Math.abs(avgUpDown) >= trendLimit) {
    comments.push(`📈 상하 평균 편차 ${mmText(avgUpDown)} (${axisDirectionText(avgUpDown, '상하')}) 경향. ${correctionText(-avgUpDown, '상하')} 보정 권장.`);
  }

  if (ngRows.length > 0 || checkRows.length >= 3) {
    const rec = calcRecommendedOffsets(rows);
    comments.push(`🔧 추천 보정: Q ${mmText(rec.q)}, 좌우 ${mmText(rec.leftRightOffset)}, 상하 ${mmText(rec.upDownOffset)} → 보정값 계산기에서 현재 설비값과 합산하세요.`);
  }

  const lowMarginRows = rows.filter((row) => Math.min(marginRate(row.leftRight), marginRate(row.upDown)) < 20);
  if (lowMarginRows.length > 0) {
    comments.push(`⚠️ 마진 20% 미만 Row: ${lowMarginRows.map((row) => row.row).join(', ')}. 추가 보정 없으면 NG 전환 위험.`);
  }

  return comments;
}

const simulateRow = (row: RowDeviation, offsets: SimulationOffsets, rowCount: number): RowDeviation => {
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

function InlineDeviationBar({ value }: { value: number }) {
  const status = getStatus(value);
  const scale = 0.2;
  const half = 72;
  const clamped = Math.max(-scale, Math.min(scale, value));
  const width = Math.max((Math.abs(clamped) / scale) * half, 1);
  const left = clamped >= 0 ? half : half - width;

  const toPx = (target: number) => half + (target / scale) * half;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: half * 2, height: 14, background: '#1E293B', borderRadius: 999, border: `1px solid ${palette.border}` }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: half, width: 1, background: '#8aa0cf' }} />
        <div style={{ position: 'absolute', top: 1, bottom: 1, left: toPx(-CHECK_LIMIT), borderLeft: `1px dashed ${CHECK}` }} />
        <div style={{ position: 'absolute', top: 1, bottom: 1, left: toPx(CHECK_LIMIT), borderLeft: `1px dashed ${CHECK}` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: toPx(-NG_LIMIT), borderLeft: `1px dashed ${NG}` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: toPx(NG_LIMIT), borderLeft: `1px dashed ${NG}` }} />
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
      <span style={{ minWidth: 70, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: palette.text }}>{mmText(value)}</span>
    </div>
  );
}

function BiasCompass({ leftRight: leftRightValue, upDown: upDownValue }: { leftRight: number; upDown: number }) {
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

export default function BottomPrintingTab() {
  const lineData = useMemo<Record<LineKey, RowDeviation[]>>(() => ({ A라인: rowData, B라인: [] }), []);
  const [selectedLine, setSelectedLine] = useState<LineKey>('A라인');
  const currentRows = lineData[selectedLine];
  const hasLineData = currentRows.length > 0;

  const recommended = useMemo(() => calcRecommendedOffsets(currentRows), [currentRows]);
  const [secondaryOffsets, setSecondaryOffsets] = useState<SimulationOffsets>(recommended);
  const [equipmentOffsets, setEquipmentOffsets] = useState<SimulationOffsets>({ q: 0, leftRightOffset: 0, upDownOffset: 0 });
  const [copied, setCopied] = useState(false);

  const simulatedRows = useMemo(() => currentRows.map((row) => simulateRow(row, secondaryOffsets, currentRows.length)), [currentRows, secondaryOffsets]);
  const actualAfterRows = useMemo(() => currentRows.map((row) => simulateRow(row, recommended, currentRows.length)), [currentRows, recommended]);

  const rowSummaries = useMemo(() => currentRows.map((row) => toRowSummary(row)), [currentRows]);
  const comments = useMemo(() => buildComments(rowSummaries), [rowSummaries]);
  const worstRow = useMemo(
    () => (rowSummaries.length > 0 ? rowSummaries.reduce((a, b) => (Math.abs(b.worst) > Math.abs(a.worst) ? b : a), rowSummaries[0]) : undefined),
    [rowSummaries],
  );

  const statusCounts = useMemo(() => {
    return rowSummaries.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { OK: 0, CHECK: 0, NG: 0 } as Record<Status, number>,
    );
  }, [rowSummaries]);

  const summary = useMemo(() => {
    if (!hasLineData) return { beforeWorst: 0, afterWorst: 0, beforeNgCount: 0, afterNgCount: 0 };

    const beforeWorst = Math.max(...currentRows.map((row) => Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))));
    const afterWorst = Math.max(...simulatedRows.map((row) => Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))));
    const beforeNgCount = rowSummaries.filter((row) => row.status === 'NG').length;
    const afterNgCount = simulatedRows.filter((row) => getStatus(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))) === 'NG').length;

    return { beforeWorst, afterWorst, beforeNgCount, afterNgCount };
  }, [currentRows, hasLineData, rowSummaries, simulatedRows]);

  const finalOffsets = useMemo(
    () => ({
      q: Number((equipmentOffsets.q + secondaryOffsets.q).toFixed(3)),
      leftRightOffset: Number((equipmentOffsets.leftRightOffset + secondaryOffsets.leftRightOffset).toFixed(3)),
      upDownOffset: Number((equipmentOffsets.upDownOffset + secondaryOffsets.upDownOffset).toFixed(3)),
    }),
    [equipmentOffsets, secondaryOffsets],
  );

  const sheetInfo = {
    sheetId: 'BP-2026-0213-A01',
    collectedAt: '2026-02-13 09:32',
    fileName: 'bottom_printing_sample_0213.csv',
  };

  const applyRecommendedToSecondary = () => setSecondaryOffsets(recommended);

  const copyFinalOffsets = async () => {
    const text = `Q=${plainMmText(finalOffsets.q)}, 좌우=${plainMmText(finalOffsets.leftRightOffset)}, 상하=${plainMmText(finalOffsets.upDownOffset)}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const renderOffsetControl = (label: string, value: number, onChange: (next: number) => void) => (
    <label style={{ color: palette.textDim }}>
      <div style={{ marginBottom: 6 }}>
        {label}: <b>{mmText(value)}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" step={0.001} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ width: 90, textAlign: 'right' }} />
        <input type="range" min={-0.2} max={0.2} step={0.001} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ flex: 1 }} />
      </div>
    </label>
  );

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20, fontFamily: 'sans-serif', background: palette.bg, color: palette.text, minHeight: '100%' }}>
      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>라인 선택</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['A라인', 'B라인'] as LineKey[]).map((line) => (
            <button
              key={line}
              type="button"
              onClick={() => {
                setSelectedLine(line);
                const nextRows = lineData[line];
                setSecondaryOffsets(calcRecommendedOffsets(nextRows));
              }}
              style={{
                border: `1px solid ${selectedLine === line ? palette.green : palette.border}`,
                background: selectedLine === line ? '#1f3b1d' : palette.bg,
                color: palette.text,
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 700,
              }}
            >
              {line}
            </button>
          ))}
        </div>
      </section>

      {!hasLineData ? (
        <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 20, background: palette.card, color: palette.textDim }}>
          <h2 style={{ marginTop: 0, color: palette.text }}>B라인 데이터 없음</h2>
          <p style={{ margin: 0 }}>현재는 샘플 데이터로 A라인만 제공됩니다. B라인은 측정 데이터 업로드 후 표시됩니다.</p>
        </section>
      ) : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12 }}>
            <article style={{ background: palette.ok, borderRadius: 12, padding: 16, border: `1px solid ${palette.border}` }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>OK</h3>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{statusCounts.OK}</div>
            </article>
            <article style={{ background: palette.check, borderRadius: 12, padding: 16, border: `1px solid ${palette.border}`, color: '#111827' }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>CHECK</h3>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{statusCounts.CHECK}</div>
            </article>
            <article style={{ background: palette.ng, borderRadius: 12, padding: 16, border: `1px solid ${palette.border}` }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>NG</h3>
              <div style={{ fontSize: 32, fontWeight: 700 }}>{statusCounts.NG}</div>
            </article>
            <article style={{ background: palette.card, borderRadius: 12, padding: 16, border: `1px solid ${palette.border}` }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, color: palette.green }}>시트 정보</h3>
              <div style={{ fontSize: 13, color: palette.textDim, lineHeight: 1.6 }}>
                <div>시트ID: {sheetInfo.sheetId}</div>
                <div>수집시각: {sheetInfo.collectedAt}</div>
                <div>파일명: {sheetInfo.fileName}</div>
              </div>
            </article>
          </section>

          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
            <h2 style={{ marginTop: 0, color: palette.text }}>보정 추천 요약</h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, color: palette.textDim }}>
              <li>자동 추천: 회전(Q) {mmText(recommended.q)}, 좌우 {mmText(recommended.leftRightOffset)}, 상하 {mmText(recommended.upDownOffset)}</li>
              <li>보정 방향 원칙: 편차가 +이면 반대(-) 방향, 편차가 -이면 반대(+) 방향으로 입력</li>
              <li>현재 시뮬레이션 기준 NG Row {summary.beforeNgCount}개 → {summary.afterNgCount}개</li>
            </ul>
          </section>

          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
            <h2 style={{ marginTop: 0 }}>🔧 보정값 계산기</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                  <th style={{ textAlign: 'left', paddingBottom: 8 }}>항목</th>
                  <th>Q(회전)</th>
                  <th>←좌/우→</th>
                  <th>↑상/하↓</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', padding: '10px 0' }}>① 현재 설비값</td>
                  <td><input type="number" step="0.001" value={equipmentOffsets.q} onChange={(e) => setEquipmentOffsets((prev) => ({ ...prev, q: Number(e.target.value) }))} /></td>
                  <td><input type="number" step="0.001" value={equipmentOffsets.leftRightOffset} onChange={(e) => setEquipmentOffsets((prev) => ({ ...prev, leftRightOffset: Number(e.target.value) }))} /></td>
                  <td><input type="number" step="0.001" value={equipmentOffsets.upDownOffset} onChange={(e) => setEquipmentOffsets((prev) => ({ ...prev, upDownOffset: Number(e.target.value) }))} /></td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'left', padding: '10px 0' }}>② AI 추천 보정</td>
                  <td><input type="number" step="0.001" value={secondaryOffsets.q} onChange={(e) => setSecondaryOffsets((prev) => ({ ...prev, q: Number(e.target.value) }))} /></td>
                  <td><input type="number" step="0.001" value={secondaryOffsets.leftRightOffset} onChange={(e) => setSecondaryOffsets((prev) => ({ ...prev, leftRightOffset: Number(e.target.value) }))} /></td>
                  <td><input type="number" step="0.001" value={secondaryOffsets.upDownOffset} onChange={(e) => setSecondaryOffsets((prev) => ({ ...prev, upDownOffset: Number(e.target.value) }))} /></td>
                </tr>
                <tr style={{ borderTop: `1px solid ${palette.border}` }}>
                  <td style={{ textAlign: 'left', paddingTop: 10 }}>③ 최종 입력값</td>
                  <td style={{ color: palette.green, fontWeight: 800 }}>{plainMmText(finalOffsets.q)}</td>
                  <td style={{ color: palette.green, fontWeight: 800 }}>{plainMmText(finalOffsets.leftRightOffset)}</td>
                  <td style={{ color: palette.green, fontWeight: 800 }}>{plainMmText(finalOffsets.upDownOffset)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button type="button" onClick={copyFinalOffsets} style={{ padding: '8px 12px', borderRadius: 8 }}>{copied ? '✅ 복사됨' : '📋 최종값 복사'}</button>
              <button type="button" onClick={applyRecommendedToSecondary} style={{ padding: '8px 12px', borderRadius: 8 }}>🔄 추천값으로 리셋</button>
            </div>
          </section>

          <section style={{ background: palette.card, borderRadius: 12, border: `1px solid ${palette.border}`, padding: 16, borderLeft: `4px solid ${palette.accent}` }}>
            <h2 style={{ marginTop: 0, marginBottom: 10, color: palette.text }}>🤖 AI 분석 코멘트</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: palette.textDim, lineHeight: 1.8 }}>
              {comments.map((comment) => (
                <li key={comment}>{comment}</li>
              ))}
            </ul>
          </section>

          {worstRow && (
            <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
              <h2 style={{ marginTop: 0, color: palette.text }}>치우침 도형 (최대 편차 Row)</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <BiasCompass leftRight={worstRow.leftRight} upDown={worstRow.upDown} />
                <div style={{ color: palette.textDim, lineHeight: 1.7 }}>
                  <div>대상 Row: {worstRow.row}</div>
                  <div>최대 축: {worstRow.worstAxis}</div>
                  <div>편차: {mmText(worstRow.worst)}</div>
                </div>
              </div>
            </section>
          )}

          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
            <h2 style={{ marginTop: 0, color: palette.text }}>실시간 보정 시뮬레이션</h2>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}>
              {renderOffsetControl('회전(Q)', secondaryOffsets.q, (next) => setSecondaryOffsets((prev) => ({ ...prev, q: next })))}
              {renderOffsetControl('좌우 오프셋', secondaryOffsets.leftRightOffset, (next) => setSecondaryOffsets((prev) => ({ ...prev, leftRightOffset: next })))}
              {renderOffsetControl('상하 오프셋', secondaryOffsets.upDownOffset, (next) => setSecondaryOffsets((prev) => ({ ...prev, upDownOffset: next })))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={applyRecommendedToSecondary}>AI 추천값 적용</button>
              <button type="button" onClick={() => setSecondaryOffsets((prev) => ({ ...prev }))}>보정 계산기 값 적용</button>
              <button type="button" onClick={() => setSecondaryOffsets({ q: 0, leftRightOffset: 0, upDownOffset: 0 })}>초기화 (0)</button>
            </div>
          </section>

          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
            <h2 style={{ marginTop: 0, color: palette.text }}>Row별 편차와 즉시 조치</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', color: palette.text }}>
              <thead>
                <tr style={{ background: palette.accent, color: '#fff' }}>
                  <th>Row</th>
                  <th>←좌/우→</th>
                  <th>인라인바(좌우)</th>
                  <th>↑상/하↓</th>
                  <th>인라인바(상하)</th>
                  <th>마진</th>
                  <th>방향</th>
                  <th>보정 권장</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((beforeRow) => {
                  const beforeWorst = Math.max(Math.abs(beforeRow.leftRight), Math.abs(beforeRow.upDown));
                  const status = getStatus(beforeWorst);
                  const minMargin = Math.min(marginRate(beforeRow.leftRight), marginRate(beforeRow.upDown));

                  return (
                    <tr key={beforeRow.row} style={{ borderTop: `1px solid ${palette.border}`, background: beforeRow.row % 2 === 0 ? palette.bg : palette.card }}>
                      <td>{beforeRow.row}</td>
                      <td>{mmText(beforeRow.leftRight)}</td>
                      <td>
                        <InlineDeviationBar value={beforeRow.leftRight} />
                      </td>
                      <td>{mmText(beforeRow.upDown)}</td>
                      <td>
                        <InlineDeviationBar value={beforeRow.upDown} />
                      </td>
                      <td style={{ color: getMarginColor(minMargin), fontWeight: 700 }}>{Math.max(0, Math.round(minMargin))}%</td>
                      <td style={{ lineHeight: 1.7 }}>
                        <div>{axisDirectionText(beforeRow.leftRight, '좌우')}</div>
                        <div>{axisDirectionText(beforeRow.upDown, '상하')}</div>
                      </td>
                      <td style={{ lineHeight: 1.6 }}>
                        <div>좌우: {correctionText(-beforeRow.leftRight, '좌우')}</div>
                        <div>상하: {correctionText(-beforeRow.upDown, '상하')}</div>
                      </td>
                      <td>
                        <span style={{ color: '#fff', fontWeight: 700, background: getColor(status), borderRadius: 999, padding: '4px 10px', fontSize: 12 }}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
            <h2 style={{ marginTop: 0 }}>보정 후 재검사 결과 (실제 Before/After 샘플)</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: palette.accent, color: '#fff' }}>
                  <th>Row</th>
                  <th>Before 최대편차</th>
                  <th>After 최대편차</th>
                  <th>개선량</th>
                  <th>판정 변화</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row, index) => {
                  const before = Math.max(Math.abs(row.leftRight), Math.abs(row.upDown));
                  const after = Math.max(Math.abs(actualAfterRows[index].leftRight), Math.abs(actualAfterRows[index].upDown));
                  return (
                    <tr key={`actual-${row.row}`} style={{ borderTop: `1px solid ${palette.border}` }}>
                      <td>{row.row}</td>
                      <td>{before.toFixed(3)} mm</td>
                      <td>{after.toFixed(3)} mm</td>
                      <td style={{ color: after <= before ? palette.green : palette.ng, fontWeight: 700 }}>{(before - after).toFixed(3)} mm</td>
                      <td>{getStatus(before)} → {getStatus(after)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
            <h2 style={{ marginTop: 0, color: palette.text }}>Before / After 비교</h2>
            <div style={{ width: '100%', height: 360 }}>
              <ResponsiveContainer>
                <BarChart
                  data={currentRows.map((row, index) => ({
                    row: row.row,
                    beforeWorst: Number(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown)).toFixed(4)),
                    afterWorst: Number(Math.max(Math.abs(simulatedRows[index].leftRight), Math.abs(simulatedRows[index].upDown)).toFixed(4)),
                  }))}
                  margin={{ top: 20, right: 24, left: 12, bottom: 12 }}
                >
                  <CartesianGrid stroke={palette.border} strokeDasharray="3 3" />
                  <XAxis dataKey="row" tick={{ fill: palette.textDim }} axisLine={{ stroke: palette.border }} tickLine={{ stroke: palette.border }} />
                  <YAxis domain={[0, 0.2]} tickFormatter={(value) => `${value.toFixed(2)}mm`} tick={{ fill: palette.textDim }} axisLine={{ stroke: palette.border }} tickLine={{ stroke: palette.border }} />
                  <Tooltip
                    contentStyle={{ background: palette.card, border: `1px solid ${palette.border}`, color: palette.text }}
                    formatter={(value: number) => `${value.toFixed(3)} mm`}
                  />
                  <Legend />
                  <ReferenceLine y={CHECK_LIMIT} stroke={CHECK} strokeDasharray="5 5" label="CHECK 0.12" />
                  <ReferenceLine y={NG_LIMIT} stroke={NG} strokeDasharray="5 5" label="NG 0.15" />
                  <Bar dataKey="beforeWorst" name="Before 최대 편차" fill="#9ca3af">
                    {currentRows.map((_, index) => (
                      <Cell key={`before-${index + 1}`} fill="#9ca3af" />
                    ))}
                  </Bar>
                  <Bar dataKey="afterWorst" name="After 최대 편차">
                    {simulatedRows.map((row) => {
                      const worst = Math.max(Math.abs(row.leftRight), Math.abs(row.upDown));
                      return <Cell key={`after-${row.row}`} fill={getColor(getStatus(worst))} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ marginBottom: 0, color: palette.textDim }}>
              최대 편차(절댓값): Before {summary.beforeWorst.toFixed(3)}mm → After {summary.afterWorst.toFixed(3)}mm
            </p>
          </section>
        </>
      )}
    </div>
  );
}
