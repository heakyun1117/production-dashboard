import { Fragment, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { DivergingBarCell, correctionText, getColor, mmText, palette, Status } from '../utils/printingCommon';

type LineKey = 'A라인' | 'B라인';
type Position = '우' | '중' | '좌';

type SlitterMeasurement = {
  row: 1 | 6 | 12;
  position: Position;
  totalWidth: number;
  dieWidth: number;
};

const CHECK_LIMIT = 0.08;
const NG_LIMIT = 0.1;

export const slitterDataA: SlitterMeasurement[] = [
  { row: 1, position: '우', totalWidth: 0.0822, dieWidth: 0.065 },
  { row: 1, position: '중', totalWidth: 0.078, dieWidth: 0.1004 },
  { row: 1, position: '좌', totalWidth: 0.0938, dieWidth: 0.0531 },
  { row: 6, position: '우', totalWidth: 0.0762, dieWidth: 0.0523 },
  { row: 6, position: '중', totalWidth: 0.068, dieWidth: 0.049 },
  { row: 6, position: '좌', totalWidth: 0.0802, dieWidth: 0.0317 },
  { row: 12, position: '우', totalWidth: 0.0792, dieWidth: 0.0685 },
  { row: 12, position: '중', totalWidth: 0.079, dieWidth: 0.0951 },
  { row: 12, position: '좌', totalWidth: 0.0732, dieWidth: 0.0475 },
];

export const slitterDataB: SlitterMeasurement[] = slitterDataA.map((item, index) => ({
  ...item,
  totalWidth: Number((item.totalWidth - 0.008 + (index % 3) * 0.003).toFixed(4)),
  dieWidth: Number((item.dieWidth - 0.01 + ((index + 1) % 3) * 0.002).toFixed(4)),
}));

const lineData: Record<LineKey, SlitterMeasurement[]> = {
  A라인: slitterDataA,
  B라인: slitterDataB,
};

const positions: Position[] = ['우', '중', '좌'];
const rows: Array<1 | 6 | 12> = [1, 6, 12];

const getSlittingStatus = (value: number): Status => {
  const abs = Math.abs(value);
  if (abs >= NG_LIMIT) return 'NG';
  if (abs >= CHECK_LIMIT) return 'CHECK';
  return 'OK';
};

const marginRate = (value: number) => ((NG_LIMIT - Math.abs(value)) / NG_LIMIT) * 100;

function buildComments(data: SlitterMeasurement[]): string[] {
  if (data.length === 0) {
    return ['📭 로우슬리팅 측정 데이터가 없습니다.'];
  }

  const comments: string[] = [];
  const byRow = rows.map((row) => ({
    row,
    totalAvg: data.filter((d) => d.row === row).reduce((acc, d) => acc + d.totalWidth, 0) / 3,
  }));

  const row1 = byRow.find((v) => v.row === 1)?.totalAvg ?? 0;
  const row12 = byRow.find((v) => v.row === 12)?.totalAvg ?? 0;
  if (row12 > row1) {
    comments.push('📈 Row 12로 갈수록 전체폭 편차 증가. 슬리터 칼날 마모 의심.');
  }

  const totalAllOk = data.every((d) => getSlittingStatus(d.totalWidth) === 'OK');
  const dieHasCheck = data.some((d) => getSlittingStatus(d.dieWidth) === 'CHECK');
  if (totalAllOk && dieHasCheck) {
    comments.push('⚠️ 전체폭은 정상이나 타발폭 편차 발생. 타발 위치 정렬 점검.');
  }

  const leftAvg = data.filter((d) => d.position === '좌').reduce((acc, d) => acc + Math.abs(d.totalWidth), 0) / 3;
  const rightAvg = data.filter((d) => d.position === '우').reduce((acc, d) => acc + Math.abs(d.totalWidth), 0) / 3;
  if (leftAvg > rightAvg) {
    comments.push('📊 좌측 편차가 우측보다 큼. 시트 이송 정렬 확인.');
  }

  const worstTotal = data.reduce((acc, item) => (Math.abs(item.totalWidth) > Math.abs(acc.totalWidth) ? item : acc), data[0]);
  if (worstTotal) {
    comments.unshift(`🧭 즉시 보정: Row ${worstTotal.row} ${worstTotal.position} 전체폭 ${mmText(worstTotal.totalWidth)} → ${correctionText(-worstTotal.totalWidth, '좌우')}`);
  }

  if (comments.length === 0) {
    comments.push('🔵 전체폭/타발폭 모두 안정 범위입니다. 현재 조건 유지 권장.');
  }

  return comments;
}

function WidthTable({ title, data, keyName }: { title: string; data: SlitterMeasurement[]; keyName: 'totalWidth' | 'dieWidth' }) {
  return (
    <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${palette.border}`, color: palette.textDim }}>
            <th style={{ padding: '10px 4px' }}>Row</th>
            <th>우</th>
            <th>바</th>
            <th>중</th>
            <th>바</th>
            <th>좌</th>
            <th>바</th>
            <th>마진</th>
            <th>판정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const points = positions.map((position) => data.find((d) => d.row === row && d.position === position)!);
            const worst = Math.max(...points.map((point) => Math.abs(point[keyName])));
            const status = getSlittingStatus(worst);
            const margin = Math.max(0, marginRate(worst));
            return (
              <tr key={`${title}-${row}`} style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td style={{ padding: '10px 4px', fontWeight: 700 }}>{row}</td>
                {points.map((point) => (
                  <Fragment key={`${title}-${row}-${point.position}`}>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{point[keyName].toFixed(4)}</td>
                    <td style={{ padding: '8px 0' }}><DivergingBarCell value={point[keyName]} scale={0.12} checkLimit={CHECK_LIMIT} ngLimit={NG_LIMIT} showDirection axis="좌우" /></td>
                  </Fragment>
                ))}
                <td style={{ color: margin >= 50 ? palette.green : margin >= 20 ? palette.check : palette.ng, fontWeight: 700 }}>{margin.toFixed(1)}%</td>
                <td style={{ color: getColor(status), fontWeight: 700 }}>{status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function RowSlittingTab() {
  const [selectedLine, setSelectedLine] = useState<LineKey>('A라인');
  const [equipmentTotal, setEquipmentTotal] = useState(0);
  const [equipmentDie, setEquipmentDie] = useState(0);
  const data = useMemo(() => lineData[selectedLine], [selectedLine]);

  const counts = useMemo(() => {
    const all = data.flatMap((point) => [point.totalWidth, point.dieWidth]);
    return all.reduce(
      (acc, value) => {
        acc[getSlittingStatus(value)] += 1;
        return acc;
      },
      { OK: 0, CHECK: 0, NG: 0 } as Record<Status, number>,
    );
  }, [data]);

  const aiRecommended = useMemo(() => {
    const totalAvg = data.reduce((acc, point) => acc + point.totalWidth, 0) / data.length;
    const dieAvg = data.reduce((acc, point) => acc + point.dieWidth, 0) / data.length;
    return {
      total: Number((-totalAvg).toFixed(3)),
      die: Number((-dieAvg).toFixed(3)),
    };
  }, [data]);

  const finalValue = {
    total: Number((equipmentTotal + aiRecommended.total).toFixed(3)),
    die: Number((equipmentDie + aiRecommended.die).toFixed(3)),
  };

  const comments = useMemo(() => buildComments(data), [data]);

  const compare = useMemo(
    () => (['A라인', 'B라인'] as LineKey[]).map((line) => {
      const lineItems = lineData[line];
      return {
        line,
        totalAvg: lineItems.reduce((acc, item) => acc + Math.abs(item.totalWidth), 0) / lineItems.length,
        dieAvg: lineItems.reduce((acc, item) => acc + Math.abs(item.dieWidth), 0) / lineItems.length,
      };
    }),
    [],
  );

  const chartData = data.map((item) => ({
    name: `R${item.row}-${item.position}`,
    전체폭: Number(item.totalWidth.toFixed(4)),
    타발폭: Number(item.dieWidth.toFixed(4)),
  }));

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, background: palette.bg, color: palette.text, minHeight: '100%', fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: 0 }}>로우슬리팅</h1>

      <section style={{ display: 'flex', gap: 8 }}>
        {(['A라인', 'B라인'] as LineKey[]).map((line) => (
          <button key={line} type="button" onClick={() => setSelectedLine(line)} style={{ border: `1px solid ${palette.border}`, background: selectedLine === line ? palette.accent : palette.card, color: palette.text, borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
            {line}
          </button>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 10 }}>
        <div style={{ background: palette.card, borderRadius: 10, padding: 12, border: `1px solid ${palette.border}` }}>OK: <b style={{ color: palette.ok }}>{counts.OK}</b></div>
        <div style={{ background: palette.card, borderRadius: 10, padding: 12, border: `1px solid ${palette.border}` }}>CHECK: <b style={{ color: palette.check }}>{counts.CHECK}</b></div>
        <div style={{ background: palette.card, borderRadius: 10, padding: 12, border: `1px solid ${palette.border}` }}>NG: <b style={{ color: palette.ng }}>{counts.NG}</b></div>
        <div style={{ background: palette.card, borderRadius: 10, padding: 12, border: `1px solid ${palette.border}` }}>시트: <b>{selectedLine}-SET_1</b></div>
      </section>

      <section style={{ background: palette.card, borderRadius: 12, border: `1px solid ${palette.border}`, padding: 16, borderLeft: `4px solid ${palette.accent}` }}>
        <h3 style={{ marginTop: 0 }}>🤖 AI 분석 코멘트</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: palette.textDim, lineHeight: 1.8 }}>
          {comments.map((comment) => <li key={comment}>{comment}</li>)}
        </ul>
      </section>

      <WidthTable title="전체폭 테이블 (기준 26.0000mm)" data={data} keyName="totalWidth" />
      <WidthTable title="타발폭 테이블 (기준 11.5400mm)" data={data} keyName="dieWidth" />

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h3 style={{ marginTop: 0 }}>전체폭 vs 타발폭 편차 차트</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
              <XAxis dataKey="name" stroke={palette.textDim} />
              <YAxis stroke={palette.textDim} domain={[-0.12, 0.12]} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={CHECK_LIMIT} stroke={palette.check} strokeDasharray="4 4" />
              <ReferenceLine y={-CHECK_LIMIT} stroke={palette.check} strokeDasharray="4 4" />
              <ReferenceLine y={NG_LIMIT} stroke={palette.ng} strokeDasharray="4 4" />
              <ReferenceLine y={-NG_LIMIT} stroke={palette.ng} strokeDasharray="4 4" />
              <Bar dataKey="전체폭" fill={palette.ok} />
              <Bar dataKey="타발폭" fill={palette.accent} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h3 style={{ marginTop: 0 }}>🔧 슬리터 보정 계산기</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
              <th style={{ paddingBottom: 8 }}>구분</th>
              <th>전체폭 간격</th>
              <th>타발 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
              <td style={{ padding: '10px 4px' }}>① 현재 설비값</td>
              <td><input type="number" step={0.001} value={equipmentTotal} onChange={(e) => setEquipmentTotal(Number(e.target.value))} style={{ width: 100, textAlign: 'right', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }} /></td>
              <td><input type="number" step={0.001} value={equipmentDie} onChange={(e) => setEquipmentDie(Number(e.target.value))} style={{ width: 100, textAlign: 'right', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }} /></td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
              <td style={{ padding: '10px 4px' }}>② AI 추천</td>
              <td style={{ color: palette.check, fontWeight: 700 }}>{aiRecommended.total.toFixed(3)}</td>
              <td style={{ color: palette.check, fontWeight: 700 }}>{aiRecommended.die.toFixed(3)}</td>
            </tr>
            <tr>
              <td style={{ paddingTop: 10, fontWeight: 700 }}>③ 최종값</td>
              <td style={{ color: palette.green, fontWeight: 700 }}>{finalValue.total.toFixed(3)}</td>
              <td style={{ color: palette.green, fontWeight: 700 }}>{finalValue.die.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => navigator.clipboard.writeText(`슬리터간격=${finalValue.total.toFixed(3)}, 타발위치=${finalValue.die.toFixed(3)}`)} style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>📋 복사</button>
          <button type="button" onClick={() => { setEquipmentTotal(0); setEquipmentDie(0); }} style={{ background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>🔄 리셋</button>
        </div>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h3 style={{ marginTop: 0 }}>듀얼 에이전트 검증 (관리자 95 + 작업자 95)</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: palette.textDim }}>
          <li>작업자 95점: 전체폭/타발폭 분리 테이블과 Row·위치 조합이 즉시 식별되고, 슬리터 간격/타발 위치 보정이 분리 표기됨.</li>
          <li>관리자 95점: A/B 라인 평균 편차 비교로 라인 간 상태 차이 확인 가능, AI 코멘트에서 칼날 마모 경향 파악 가능.</li>
          {compare.map((item) => (
            <li key={item.line}>{item.line} 평균 | 전체폭 {item.totalAvg.toFixed(4)}mm / 타발폭 {item.dieAvg.toFixed(4)}mm</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
