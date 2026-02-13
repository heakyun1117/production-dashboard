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

const OK = '#2D68C4';
const CHECK = '#F59E0B';
const NG = '#EF4444';

const CHECK_LIMIT = 0.12;
const NG_LIMIT = 0.15;

type RowDeviation = {
  row: number;
  leftRight: number;
  upDown: number;
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

type Status = 'OK' | 'CHECK' | 'NG';

type SimulationOffsets = {
  q: number;
  leftRightOffset: number;
  upDownOffset: number;
};

const getStatus = (value: number): Status => {
  const abs = Math.abs(value);
  if (abs >= NG_LIMIT) return 'NG';
  if (abs >= CHECK_LIMIT) return 'CHECK';
  return 'OK';
};

const getColor = (status: Status) => {
  if (status === 'NG') return NG;
  if (status === 'CHECK') return CHECK;
  return OK;
};

const mmText = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(3)} mm`;

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

const calcRecommendedOffsets = (rows: RowDeviation[]): SimulationOffsets => {
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
      <div style={{ position: 'relative', width: half * 2, height: 14, background: '#edf1fe', borderRadius: 999 }}>
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
      <span style={{ minWidth: 70, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{mmText(value)}</span>
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
      <circle cx="44" cy="44" r="34" fill="#f6f8ff" stroke="#d4dcf6" />
      <circle cx="44" cy="44" r={34 * (CHECK_LIMIT / scale)} fill="none" stroke={CHECK} strokeDasharray="3 3" />
      <circle cx="44" cy="44" r={34 * (NG_LIMIT / scale)} fill="none" stroke={NG} strokeDasharray="3 3" />
      <line x1="44" y1="10" x2="44" y2="78" stroke="#c3cbe5" />
      <line x1="10" y1="44" x2="78" y2="44" stroke="#c3cbe5" />
      <circle cx={x} cy={y} r="5" fill={getColor(status)} />
      <text x="44" y="14" textAnchor="middle" style={{ fontSize: 10, fill: '#425a96' }}>↑상</text>
      <text x="44" y="84" textAnchor="middle" style={{ fontSize: 10, fill: '#425a96' }}>하↓</text>
      <text x="12" y="47" textAnchor="middle" style={{ fontSize: 10, fill: '#425a96' }}>←좌</text>
      <text x="76" y="47" textAnchor="middle" style={{ fontSize: 10, fill: '#425a96' }}>우→</text>
    </svg>
  );
}

export default function BottomPrintingTab() {
  const recommended = useMemo(() => calcRecommendedOffsets(rowData), []);

  const [offsets, setOffsets] = useState<SimulationOffsets>(recommended);

  const simulatedRows = useMemo(
    () => rowData.map((row) => simulateRow(row, offsets, rowData.length)),
    [offsets],
  );

  const summary = useMemo(() => {
    const beforeWorst = Math.max(...rowData.map((row) => Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))));
    const afterWorst = Math.max(...simulatedRows.map((row) => Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))));
    const beforeNgCount = rowData.filter((row) => getStatus(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))) === 'NG').length;
    const afterNgCount = simulatedRows.filter((row) => getStatus(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))) === 'NG').length;

    return { beforeWorst, afterWorst, beforeNgCount, afterNgCount };
  }, [simulatedRows]);

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20, fontFamily: 'sans-serif' }}>
      <section style={{ border: '1px solid #d5d9ef', borderRadius: 12, padding: 16, background: '#EDF1FE' }}>
        <h2 style={{ margin: '0 0 8px', color: '#171C8F' }}>보정 추천 요약</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>자동 추천: 회전(Q) {mmText(recommended.q)}, 좌우 {mmText(recommended.leftRightOffset)}, 상하 {mmText(recommended.upDownOffset)}</li>
          <li>보정 방향 원칙: 편차가 +이면 반대(-) 방향, 편차가 -이면 반대(+) 방향으로 입력</li>
          <li>현재 시뮬레이션 기준 NG Row {summary.beforeNgCount}개 → {summary.afterNgCount}개</li>
        </ul>
      </section>

      <section style={{ border: '1px solid #e3e6f7', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, color: '#171C8F' }}>실시간 보정 시뮬레이션</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}>
          <label>
            회전(Q): <b>{mmText(offsets.q)}</b>
            <input type="range" min={-0.2} max={0.2} step={0.001} value={offsets.q} onChange={(event) => setOffsets((prev) => ({ ...prev, q: Number(event.target.value) }))} style={{ width: '100%' }} />
          </label>
          <label>
            좌우 오프셋: <b>{mmText(offsets.leftRightOffset)}</b>
            <input type="range" min={-0.2} max={0.2} step={0.001} value={offsets.leftRightOffset} onChange={(event) => setOffsets((prev) => ({ ...prev, leftRightOffset: Number(event.target.value) }))} style={{ width: '100%' }} />
          </label>
          <label>
            상하 오프셋: <b>{mmText(offsets.upDownOffset)}</b>
            <input type="range" min={-0.2} max={0.2} step={0.001} value={offsets.upDownOffset} onChange={(event) => setOffsets((prev) => ({ ...prev, upDownOffset: Number(event.target.value) }))} style={{ width: '100%' }} />
          </label>
        </div>
      </section>

      <section style={{ border: '1px solid #e3e6f7', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, color: '#171C8F' }}>Row별 편차와 즉시 조치</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f5f7ff' }}>
              <th>Row</th>
              <th>좌우 편차 (←좌 / 우→)</th>
              <th>상하 편차 (↑상 / 하↓)</th>
              <th>치우침 도형</th>
              <th>권장 보정</th>
              <th>시뮬레이션 후</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {rowData.map((beforeRow, index) => {
              const afterRow = simulatedRows[index];
              const beforeWorst = Math.max(Math.abs(beforeRow.leftRight), Math.abs(beforeRow.upDown));
              const afterWorst = Math.max(Math.abs(afterRow.leftRight), Math.abs(afterRow.upDown));
              const status = getStatus(beforeWorst);

              return (
                <tr key={beforeRow.row} style={{ borderTop: '1px solid #e7ecff' }}>
                  <td>{beforeRow.row}</td>
                  <td>
                    <InlineDeviationBar value={beforeRow.leftRight} />
                    <small>{axisDirectionText(beforeRow.leftRight, '좌우')}</small>
                  </td>
                  <td>
                    <InlineDeviationBar value={beforeRow.upDown} />
                    <small>{axisDirectionText(beforeRow.upDown, '상하')}</small>
                  </td>
                  <td>
                    <BiasCompass leftRight={beforeRow.leftRight} upDown={beforeRow.upDown} />
                  </td>
                  <td style={{ lineHeight: 1.6 }}>
                    <div>{correctionText(-beforeRow.leftRight, '좌우')}</div>
                    <div>{correctionText(-beforeRow.upDown, '상하')}</div>
                  </td>
                  <td style={{ lineHeight: 1.7 }}>
                    <div>좌우 {mmText(afterRow.leftRight)}</div>
                    <div>상하 {mmText(afterRow.upDown)}</div>
                    <div style={{ color: getColor(getStatus(afterWorst)), fontWeight: 700 }}>{getStatus(afterWorst)}</div>
                  </td>
                  <td style={{ color: getColor(status), fontWeight: 700 }}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section style={{ border: '1px solid #e3e6f7', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, color: '#171C8F' }}>Before / After 비교</h2>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <BarChart
              data={rowData.map((row, index) => ({
                row: row.row,
                beforeWorst: Number(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown)).toFixed(4)),
                afterWorst: Number(Math.max(Math.abs(simulatedRows[index].leftRight), Math.abs(simulatedRows[index].upDown)).toFixed(4)),
              }))}
              margin={{ top: 20, right: 24, left: 12, bottom: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="row" />
              <YAxis domain={[0, 0.2]} tickFormatter={(value) => `${value.toFixed(2)}mm`} />
              <Tooltip formatter={(value: number) => `${value.toFixed(3)} mm`} />
              <Legend />
              <ReferenceLine y={CHECK_LIMIT} stroke={CHECK} strokeDasharray="5 5" label="CHECK 0.12" />
              <ReferenceLine y={NG_LIMIT} stroke={NG} strokeDasharray="5 5" label="NG 0.15" />
              <Bar dataKey="beforeWorst" name="Before 최대 편차" fill="#9ca3af">
                {rowData.map((_, index) => (
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
        <p style={{ marginBottom: 0 }}>
          최대 편차(절댓값): Before {summary.beforeWorst.toFixed(3)}mm → After {summary.afterWorst.toFixed(3)}mm
        </p>
      </section>
    </div>
  );
}
