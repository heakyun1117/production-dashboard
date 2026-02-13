import { useMemo, useState } from 'react';

import { getAssemblyData } from '../data/manualAssemblyData';
import { bottomPrintingLineRows } from './BottomPrintingTab';
import { slitterDataA, slitterDataB } from './RowSlittingTab';
import { topPrintingTrayRows } from './TopPrintingTab';
import { NG_LIMIT, getColor, getStatus, mmText, palette } from '../utils/printingCommon';

type NavTab = '하판 프린팅' | '상판 프린팅' | '워킹면적 검사' | '로우슬리팅' | '분주' | '수동조립기' | '조립/검사';
type LineFilter = 'A라인' | 'B라인' | '전체';
type Severity = 'urgent' | 'warning' | 'info';
type Status = 'OK' | 'CHECK' | 'NG';

type RowRemainRate = { row: number; remainRate: number; status: Status; deviation?: number };
type ProcessSummary = {
  processName: string;
  line: 'A' | 'B' | string;
  overallStatus: Status;
  avgRemainRate: number;
  worstRow: number;
  worstRemainRate: number;
  rowData: RowRemainRate[];
  keyMetric: string;
};
type CrossProcessAlert = { severity: Severity; message: string };

const processOrder: Array<{ key: NavTab; label: string }> = [
  { key: '하판 프린팅', label: '하판' },
  { key: '상판 프린팅', label: '상판' },
  { key: '워킹면적 검사', label: '면적' },
  { key: '로우슬리팅', label: '슬리팅' },
  { key: '분주', label: '분주' },
  { key: '수동조립기', label: '수동조립' },
  { key: '조립/검사', label: '조립검사' },
];

const remainRateColor = (rate: number) => {
  if (rate >= 70) return '#22C55E';
  if (rate >= 50) return '#84CC16';
  if (rate >= 30) return '#F59E0B';
  if (rate >= 15) return '#F97316';
  return '#EF4444';
};

const remainRateBg = (rate: number) => {
  if (rate >= 70) return 'rgba(34,197,94,0.15)';
  if (rate >= 50) return 'rgba(132,204,22,0.15)';
  if (rate >= 30) return 'rgba(245,158,11,0.15)';
  if (rate >= 15) return 'rgba(249,115,22,0.20)';
  return 'rgba(239,68,68,0.25)';
};

const toRemainRate = (deviation: number, limit: number) => Math.max(0, Number((((limit - Math.abs(deviation)) / limit) * 100).toFixed(1)));
const statusFromRemain = (rate: number): Status => (rate < 15 ? 'NG' : rate < 35 ? 'CHECK' : 'OK');

const buildPrintingSummary = (line: 'A' | 'B', source: { leftRight: number; upDown: number; row: number }[], name: string): ProcessSummary => {
  const rowData = source.map((row) => {
    const remain = Math.min(toRemainRate(row.leftRight, NG_LIMIT), toRemainRate(row.upDown, NG_LIMIT));
    return { row: row.row, remainRate: remain, status: statusFromRemain(remain), deviation: Math.max(Math.abs(row.leftRight), Math.abs(row.upDown)) };
  });
  const worst = rowData.reduce((a, b) => (b.remainRate < a.remainRate ? b : a), rowData[0]);
  const avg = rowData.reduce((acc, item) => acc + item.remainRate, 0) / rowData.length;
  return {
    processName: name,
    line,
    overallStatus: rowData.some((r) => r.status === 'NG') ? 'NG' : rowData.some((r) => r.status === 'CHECK') ? 'CHECK' : 'OK',
    avgRemainRate: Number(avg.toFixed(1)),
    worstRow: worst.row,
    worstRemainRate: worst.remainRate,
    rowData,
    keyMetric: `최악 Row ${worst.row} · 잔여율 ${worst.remainRate.toFixed(1)}%`,
  };
};

const buildSlittingSummary = (line: 'A' | 'B', source: typeof slitterDataA): ProcessSummary => {
  const byRow = Array.from({ length: 12 }, (_, idx) => idx + 1).map((row) => {
    const rowSamples = source.filter((item) => item.row === row || (row > 1 && row < 6 && item.row === 1) || (row > 6 && row < 12 && item.row === 12));
    const worstDev = rowSamples.length > 0 ? Math.max(...rowSamples.map((item) => Math.abs(item.dieWidth))) : 0;
    const remain = toRemainRate(worstDev, 0.1);
    return { row, remainRate: Number(remain.toFixed(1)), status: statusFromRemain(remain), deviation: worstDev };
  });
  const worst = byRow.reduce((a, b) => (b.remainRate < a.remainRate ? b : a), byRow[0]);
  return {
    processName: '로우슬리팅',
    line,
    overallStatus: byRow.some((r) => r.status === 'NG') ? 'NG' : byRow.some((r) => r.status === 'CHECK') ? 'CHECK' : 'OK',
    avgRemainRate: Number((byRow.reduce((acc, item) => acc + item.remainRate, 0) / byRow.length).toFixed(1)),
    worstRow: worst.row,
    worstRemainRate: worst.remainRate,
    rowData: byRow,
    keyMetric: `타발폭 평균 잔여율 ${Number((byRow.reduce((acc, item) => acc + item.remainRate, 0) / byRow.length).toFixed(1))}%`,
  };
};

const makeAssemblyRows = (line: 'A' | 'B') => {
  const aLr = [88, 84, 81, 78, 72, 52, 15, 47, 62, 68, 73, 76];
  const aUd = [90, 86, 83, 80, 76, 58, 28, 49, 65, 70, 74, 78];
  const bLr = [68, 66, 64, 62, 60, 57, 55, 53, 50, 48, 46, 44];
  const bUd = [72, 70, 69, 67, 65, 63, 60, 58, 56, 54, 52, 50];
  const lr = line === 'A' ? aLr : bLr;
  const ud = line === 'A' ? aUd : bUd;
  return lr.map((rate, i) => ({ row: i + 1, lr: rate, ud: ud[i] }));
};

const buildAssemblySummary = (line: 'A' | 'B'): ProcessSummary => {
  const rowData = makeAssemblyRows(line).map((row) => {
    const remainRate = Math.min(row.lr, row.ud);
    return { row: row.row, remainRate, status: statusFromRemain(remainRate) };
  });
  const worst = rowData.reduce((a, b) => (b.remainRate < a.remainRate ? b : a), rowData[0]);
  return {
    processName: '조립/검사',
    line,
    overallStatus: rowData.some((r) => r.status === 'NG') ? 'NG' : rowData.some((r) => r.status === 'CHECK') ? 'CHECK' : 'OK',
    avgRemainRate: Number((rowData.reduce((acc, item) => acc + item.remainRate, 0) / rowData.length).toFixed(1)),
    worstRow: worst.row,
    worstRemainRate: worst.remainRate,
    rowData,
    keyMetric: `양면 최저 잔여율 Row ${worst.row} (${worst.remainRate}%)`,
  };
};

function ManagerDashboardTab({ onNavigateProcess }: { onNavigateProcess: (tab: NavTab) => void }) {
  const [lineFilter, setLineFilter] = useState<LineFilter>('전체');
  const [manualFilter, setManualFilter] = useState<'#1' | '#2' | '#3' | '#4' | '전체'>('전체');

  const manualData = useMemo(() => getAssemblyData(), []);

  const processMap = useMemo(() => {
    const topA = topPrintingTrayRows.트레이1.map((row, idx) => ({ row: row.row, leftRight: row.leftRight, upDown: row.upDown }));
    const topB = topPrintingTrayRows.트레이2.map((row, idx) => ({ row: row.row, leftRight: row.leftRight, upDown: row.upDown }));

    const a = {
      '하판 프린팅': buildPrintingSummary('A', bottomPrintingLineRows.A라인, '하판 프린팅'),
      '상판 프린팅': buildPrintingSummary('A', topA, '상판 프린팅'),
      '로우슬리팅': buildSlittingSummary('A', slitterDataA),
      '조립/검사': buildAssemblySummary('A'),
      '워킹면적 검사': { processName: '워킹면적', line: 'A', overallStatus: 'OK', avgRemainRate: 84.5, worstRow: 6, worstRemainRate: 76.1, rowData: [], keyMetric: '폭/길이 표준편차 0.0042' } as ProcessSummary,
      분주: { processName: '분주', line: 'A', overallStatus: 'OK', avgRemainRate: 92.1, worstRow: 0, worstRemainRate: 90.2, rowData: [], keyMetric: '면적 이상치 0.0%' } as ProcessSummary,
      수동조립기: { processName: '수동조립기', line: 'A', overallStatus: 'CHECK', avgRemainRate: 61.3, worstRow: 2, worstRemainRate: 42, rowData: [], keyMetric: '#2 우→ 치우침 경향' } as ProcessSummary,
    };

    const b = {
      '하판 프린팅': buildPrintingSummary('B', bottomPrintingLineRows.A라인.map((row) => ({ ...row, leftRight: Number((row.leftRight * 1.2).toFixed(4)), upDown: Number((row.upDown * 1.1).toFixed(4)) })), '하판 프린팅'),
      '상판 프린팅': buildPrintingSummary('B', topB, '상판 프린팅'),
      '로우슬리팅': buildSlittingSummary('B', slitterDataB),
      '조립/검사': buildAssemblySummary('B'),
      '워킹면적 검사': { processName: '워킹면적', line: 'B', overallStatus: 'CHECK', avgRemainRate: 77.6, worstRow: 12, worstRemainRate: 62.5, rowData: [], keyMetric: '폭/길이 표준편차 0.0061' } as ProcessSummary,
      분주: { processName: '분주', line: 'B', overallStatus: 'CHECK', avgRemainRate: 80.2, worstRow: 0, worstRemainRate: 75.2, rowData: [], keyMetric: '면적 이상치 1.4%' } as ProcessSummary,
      수동조립기: { processName: '수동조립기', line: 'B', overallStatus: 'CHECK', avgRemainRate: 55.8, worstRow: 2, worstRemainRate: 36, rowData: [], keyMetric: '#2/#4 편차 확대' } as ProcessSummary,
    };

    return { a, b };
  }, []);

  const cards = useMemo(() => {
    return processOrder.map(({ key }) => {
      const a = processMap.a[key];
      const b = processMap.b[key];
      const overall = [a.overallStatus, b.overallStatus].includes('NG') ? 'NG' : [a.overallStatus, b.overallStatus].includes('CHECK') ? 'CHECK' : 'OK';
      return { key, a, b, overall };
    });
  }, [processMap]);

  const activeHeatRows = useMemo(() => {
    const aBottom = processMap.a['하판 프린팅'].rowData;
    const bBottom = processMap.b['하판 프린팅'].rowData;
    const aSlit = processMap.a['로우슬리팅'].rowData;
    const bSlit = processMap.b['로우슬리팅'].rowData;
    const aAsm = makeAssemblyRows('A');
    const bAsm = makeAssemblyRows('B');

    const pick = (a: RowRemainRate[], b: RowRemainRate[]) => (lineFilter === 'A라인' ? a : lineFilter === 'B라인' ? b : a.map((row, i) => ({ ...row, remainRate: Number(((row.remainRate + b[i].remainRate) / 2).toFixed(1)) })));

    const bottom = pick(aBottom, bBottom);
    const slit = pick(aSlit, bSlit);

    return Array.from({ length: 12 }, (_, idx) => {
      const row = idx + 1;
      const asm = lineFilter === 'A라인' ? aAsm[idx] : lineFilter === 'B라인' ? bAsm[idx] : { lr: Number(((aAsm[idx].lr + bAsm[idx].lr) / 2).toFixed(1)), ud: Number(((aAsm[idx].ud + bAsm[idx].ud) / 2).toFixed(1)) };
      return {
        row,
        bottomLr: bottom[idx].remainRate,
        bottomUd: Math.max(0, Number((bottom[idx].remainRate + 8).toFixed(1))),
        slit: slit[idx].remainRate,
        asmLr: asm.lr,
        asmUd: asm.ud,
      };
    });
  }, [lineFilter, processMap]);

  const alerts = useMemo<CrossProcessAlert[]>(() => {
    const list: CrossProcessAlert[] = [];
    if (processMap.a['조립/검사'].worstRemainRate < 20) list.push({ severity: 'urgent', message: '🚨 A라인 Row 7 조립/검사 양면좌우 잔여율 15%. 즉시 보정 필요.' });
    list.push({ severity: 'warning', message: '⚠️ A라인 로우슬리팅 Row 6~8 잔여율 하락. 슬리터와 조립 조건 동시 점검 권장.' });
    list.push({ severity: 'warning', message: '🔗 A라인 Row 7 집중 위험: 자동조립기 Row 7 개별 보정 우선, 프린팅 미세 보정 병행 검토.' });
    list.push({ severity: 'warning', message: '🔗 B라인 조립/검사 우→ 치우침 경향. 하판 프린팅 전역 ←좌 0.03mm 보정 추천.' });
    list.push({ severity: 'info', message: '📊 B라인이 A라인 대비 하판/조립 잔여율 5~10% 낮음. B라인 우선 점검.' });
    list.push({ severity: 'info', message: '✅ 상판 프린팅은 A/B 모두 안정권. 워킹면적 변동도 정상 범위.' });
    return list;
  }, [processMap]);

  const manualCards = useMemo(() => manualData.map((sheet) => {
    const avg = sheet.holes.reduce((acc, item) => acc + Math.abs(item.deviation), 0) / sheet.holes.length;
    const status = getStatus(Math.max(...sheet.holes.map((item) => Math.abs(item.deviation))));
    return { machine: `#${sheet.machineId}`, avg, status };
  }), [manualData]);

  const compareData = useMemo(() => processOrder.map((process) => ({ process: process.label, a: processMap.a[process.key].avgRemainRate, b: processMap.b[process.key].avgRemainRate })), [processMap]);

  return (
    <div style={{ padding: 20, display: 'grid', gap: 16, background: palette.bg, color: palette.text, minHeight: '100%', fontFamily: 'sans-serif' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0 }}>🏭 관리자 종합 대시보드</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['A라인', 'B라인', '전체'] as const).map((key) => (
            <button key={key} type="button" onClick={() => setLineFilter(key)} style={{ minHeight: 44, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: lineFilter === key ? palette.accent : palette.card, color: palette.text }}>{key}</button>
          ))}
          {(['#1', '#2', '#3', '#4', '전체'] as const).map((key) => (
            <button key={key} type="button" onClick={() => setManualFilter(key)} style={{ minHeight: 44, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: manualFilter === key ? '#1F4E9A' : palette.card, color: palette.text }}>{`수동조립 ${key}`}</button>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 8 }}>
        {cards.map((card) => (
          <article key={card.key} role="button" onClick={() => onNavigateProcess(card.key)} style={{ cursor: 'pointer', border: `1px solid ${palette.border}`, borderLeft: `4px solid ${getColor(card.overall)}`, borderRadius: 10, background: palette.card, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>{processOrder.find((p) => p.key === card.key)?.label}</div>
            <div style={{ color: getColor(card.overall), fontWeight: 700 }}>{card.overall === 'OK' ? '✅ OK' : card.overall === 'CHECK' ? '⚠️ CHK' : '🚨 NG'}</div>
            <div style={{ fontSize: 12, color: palette.textDim }}>{card.a.keyMetric}</div>
            <div style={{ fontSize: 12 }}>A: {card.a.avgRemainRate}%</div>
            <div style={{ fontSize: 12 }}>B: {card.b.avgRemainRate}%</div>
          </article>
        ))}
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>공정별 상세 잔여율 히트맵 (Row 1~12)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${palette.border}`, color: palette.textDim }}><th>Row</th><th>하판LR</th><th>하판UD</th><th>슬리팅</th><th>조립LR</th><th>조립UD</th></tr>
          </thead>
          <tbody>
            {activeHeatRows.map((row) => (
              <tr key={row.row} style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td style={{ padding: '8px 4px', fontWeight: 700 }}>{row.row}</td>
                {[row.bottomLr, row.bottomUd, row.slit, row.asmLr, row.asmUd].map((rate, idx) => (
                  <td key={`${row.row}-${idx}`} style={{ background: remainRateBg(rate), color: remainRateColor(rate), fontWeight: 700, border: rate < 20 ? `2px solid ${palette.ng}` : 'none' }}>{rate.toFixed(1)}%</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <article style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>공정 간 마진 흐름</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr 60px 1fr', alignItems: 'center', gap: 8 }}>
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10 }}>프린팅<br />좌우: {processMap.a['하판 프린팅'].avgRemainRate}%<br />상하: {Math.min(95, processMap.a['하판 프린팅'].avgRemainRate + 6)}%</div>
            <div style={{ textAlign: 'center' }}>→</div>
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10 }}>로우슬리팅<br />타발폭: {processMap.a['로우슬리팅'].avgRemainRate}%</div>
            <div style={{ textAlign: 'center' }}>→</div>
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10 }}>조립/검사<br />양면LR: {processMap.a['조립/검사'].avgRemainRate}%<br />양면UD: {Math.min(95, processMap.a['조립/검사'].avgRemainRate + 8)}%</div>
          </div>
          <div style={{ marginTop: 10, color: palette.check }}>보정 요청: 조립 → 프린팅 (권장 {mmText(-0.03)})</div>
        </article>

        <article style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>AI 종합 코멘트</h3>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            {alerts.map((alert, idx) => (
              <li key={`${alert.severity}-${idx}`} style={{ color: alert.severity === 'urgent' ? palette.ng : alert.severity === 'warning' ? palette.check : palette.textDim }}>{alert.message}</li>
            ))}
          </ul>
        </article>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>A/B 라인 비교 (전체)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <strong>A라인</strong>
            {compareData.map((item) => <div key={`a-${item.process}`} style={{ marginTop: 6 }}>{item.process}: {item.a.toFixed(1)}% <span style={{ color: remainRateColor(item.a) }}>{'█'.repeat(Math.max(1, Math.round(item.a / 10)))}</span></div>)}
          </div>
          <div>
            <strong>B라인</strong>
            {compareData.map((item) => <div key={`b-${item.process}`} style={{ marginTop: 6 }}>{item.process}: {item.b.toFixed(1)}% <span style={{ color: remainRateColor(item.b) }}>{'█'.repeat(Math.max(1, Math.round(item.b / 10)))}</span></div>)}
          </div>
        </div>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>수동조립기 요약 ({manualFilter})</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', gap: 8 }}>
          {manualCards.filter((card) => manualFilter === '전체' || manualFilter === card.machine).map((card) => (
            <article key={card.machine} style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10, background: '#0B1220' }}>
              <div style={{ fontWeight: 700 }}>{card.machine}</div>
              <div style={{ color: getColor(card.status) }}>{card.status}</div>
              <div style={{ fontSize: 13, color: palette.textDim }}>평균 편차 {mmText(card.avg)}</div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ManagerDashboardTab;
