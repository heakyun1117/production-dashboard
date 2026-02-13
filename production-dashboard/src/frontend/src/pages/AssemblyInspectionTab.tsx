import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHECK_LIMIT, InlineDeviationBar, NG_LIMIT, getColor, getStatus, mmText, palette } from '../utils/printingCommon';

type LineKey = 'A라인' | 'B라인';
type SectionKey = '전체' | '타발홀' | '양면좌우' | '양면상하';
type Status = 'OK' | 'CHECK' | 'NG';

type RowMeasurement = {
  row: number;
  deviation: number;
  movable: number;
  remainRate: number;
};

type AssemblyData = {
  holeData: RowMeasurement[];
  tapeLR: RowMeasurement[];
  tapeUD: RowMeasurement[];
};

type SectionSummary = {
  key: Exclude<SectionKey, '전체'>;
  rows: RowMeasurement[];
  ok: number;
  check: number;
  ng: number;
  avg: number;
  status: Status;
};

type RowCorrection = {
  row: number;
  leftRight: number;
  upDown: number;
  auto: boolean;
};

const SAMPLE_PATHS = ['/data/samples/0122_assembly-sample-A_SET_1.csv', '/data/samples/0123_assembly-sample-A_092.csv'];

const remainColor = (rate: number) => {
  if (rate > 50) return palette.green;
  if (rate >= 20) return palette.check;
  return palette.ng;
};

const toMeasurement = (row: number, deviation: number): RowMeasurement => {
  const movable = Number((NG_LIMIT - Math.abs(deviation)).toFixed(4));
  const remainRate = Math.max(0, Number(((movable / NG_LIMIT) * 100).toFixed(1)));
  return { row, deviation: Number(deviation.toFixed(4)), movable, remainRate };
};

const parseRow = (label: string): number | null => {
  const match = label.match(/_(\d+):/);
  if (!match) return null;
  const row = Number(match[1]);
  if (!Number.isFinite(row) || row < 1 || row > 12) return null;
  return row;
};

const toNumber = (value?: string) => {
  const num = Number(value ?? NaN);
  return Number.isFinite(num) ? num : null;
};

const parseAssemblyCsv = (raw: string): AssemblyData => {
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const holeLeft = new Map<number, number>();
  const holeRight = new Map<number, number>();
  const tapeLeft = new Map<number, number>();
  const tapeRight = new Map<number, number>();
  const tapeUdCenter = new Map<number, number>();

  lines.forEach((line) => {
    if (line.startsWith(':BEGIN') || line.startsWith(':END')) return;
    const cells = line.split('\t');
    const label = cells[0]?.replace(/^"|"$/g, '').trim() ?? '';
    if (!label) return;

    const deviation = toNumber(cells[5]);
    if (deviation === null) return;

    if (label.includes('타원 타발홀_좌측_') && label.includes('단축')) {
      const row = parseRow(label);
      if (row) holeLeft.set(row, deviation);
      return;
    }
    if (label.includes('타원 타발홀_우측_') && label.includes('단축')) {
      const row = parseRow(label);
      if (row) holeRight.set(row, deviation);
      return;
    }
    if (label.includes('계산기 양면_좌측_') && label.includes('숫자')) {
      const row = parseRow(label);
      if (row) tapeLeft.set(row, deviation);
      return;
    }
    if (label.includes('계산기 양면_우측_') && label.includes('숫자')) {
      const row = parseRow(label);
      if (row) tapeRight.set(row, deviation);
      return;
    }
    if (label.includes('거리 양면상하_중_') && label.includes('거리 Y')) {
      const row = parseRow(label);
      if (row) tapeUdCenter.set(row, deviation);
    }
  });

  const rows = Array.from({ length: 12 }, (_, index) => index + 1);

  return {
    holeData: rows.map((row) => toMeasurement(row, ((holeLeft.get(row) ?? 0) + (holeRight.get(row) ?? 0)) / 2)),
    tapeLR: rows.map((row) => toMeasurement(row, ((tapeLeft.get(row) ?? 0) + (tapeRight.get(row) ?? 0)) / 2)),
    tapeUD: rows.map((row) => toMeasurement(row, tapeUdCenter.get(row) ?? 0)),
  };
};

async function loadAssemblyData(): Promise<AssemblyData | null> {
  for (const path of SAMPLE_PATHS) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      const text = new TextDecoder('utf-16le').decode(bytes);
      return parseAssemblyCsv(text);
    } catch {
      // 다음 경로 fallback
    }
  }
  return null;
}

const getWorst = (statuses: Status[]): Status => {
  if (statuses.includes('NG')) return 'NG';
  if (statuses.includes('CHECK')) return 'CHECK';
  return 'OK';
};

const isRisingTrend = (rows: RowMeasurement[]) => {
  if (rows.length === 0) return false;
  const center = (rows.length + 1) / 2;
  const num = rows.reduce((sum, row) => sum + (row.row - center) * row.deviation, 0);
  const den = rows.reduce((sum, row) => sum + (row.row - center) ** 2, 0);
  if (den === 0) return false;
  return num / den > 0.004;
};

export default function AssemblyInspectionTab() {
  const [line, setLine] = useState<LineKey>('A라인');
  const [section, setSection] = useState<SectionKey>('전체');
  const [assemblyData, setAssemblyData] = useState<AssemblyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<RowCorrection[]>(
    Array.from({ length: 12 }, (_, i) => ({ row: i + 1, leftRight: 0, upDown: 0, auto: false })),
  );

  useEffect(() => {
    let mounted = true;
    loadAssemblyData().then((result) => {
      if (!mounted) return;
      setAssemblyData(result);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const emptyData: AssemblyData = useMemo(
    () => ({
      holeData: Array.from({ length: 12 }, (_, i) => toMeasurement(i + 1, 0)),
      tapeLR: Array.from({ length: 12 }, (_, i) => toMeasurement(i + 1, 0)),
      tapeUD: Array.from({ length: 12 }, (_, i) => toMeasurement(i + 1, 0)),
    }),
    [],
  );

  const activeData = line === 'A라인' && assemblyData ? assemblyData : emptyData;

  const sectionSummaries = useMemo<SectionSummary[]>(() => {
    const map: Array<{ key: Exclude<SectionKey, '전체'>; rows: RowMeasurement[] }> = [
      { key: '타발홀', rows: activeData.holeData },
      { key: '양면좌우', rows: activeData.tapeLR },
      { key: '양면상하', rows: activeData.tapeUD },
    ];

    return map.map(({ key, rows }) => {
      const statusCounts = rows.reduce(
        (acc, row) => {
          acc[getStatus(row.deviation)] += 1;
          return acc;
        },
        { OK: 0, CHECK: 0, NG: 0 } as Record<Status, number>,
      );
      const avg = rows.reduce((sum, row) => sum + row.deviation, 0) / rows.length;
      return {
        key,
        rows,
        ok: statusCounts.OK,
        check: statusCounts.CHECK,
        ng: statusCounts.NG,
        avg,
        status: getWorst(rows.map((row) => getStatus(row.deviation))),
      };
    });
  }, [activeData]);

  const rowTable = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const row = i + 1;
      const hole = activeData.holeData[i];
      const lr = activeData.tapeLR[i];
      const ud = activeData.tapeUD[i];
      const rowStatus = getWorst([getStatus(hole.deviation), getStatus(lr.deviation), getStatus(ud.deviation)]);
      return { row, hole, lr, ud, rowStatus };
    });
  }, [activeData]);

  const chartData = useMemo(
    () =>
      rowTable.map((row) => ({
        row: `Row ${row.row}`,
        타발홀: row.hole.deviation,
        양면좌우: row.lr.deviation,
        양면상하: row.ud.deviation,
      })),
    [rowTable],
  );

  const processComment = useMemo(() => {
    const lrChecks = rowTable.filter((row) => getStatus(row.lr.deviation) !== 'OK').map((row) => row.row);
    const lowMarginRows = rowTable.filter((row) => Math.min(row.hole.remainRate, row.lr.remainRate, row.ud.remainRate) <= 20).map((row) => row.row);
    const avgLr = activeData.tapeLR.reduce((sum, item) => sum + item.deviation, 0) / activeData.tapeLR.length;

    const lines = [
      `✅ 타발홀: ${sectionSummaries[0].ng === 0 ? '전 Row OK 또는 CHECK 범위. 조립 정렬 기준은 유지됩니다.' : 'NG Row 존재. 핀 정렬 재확인 필요.'}`,
      lrChecks.length > 0
        ? `⚠️ 양면(좌우): Row ${lrChecks.join(', ')}에서 CHECK/NG 감지. ${avgLr > 0 ? '우→ 치우침 경향' : '←좌 치우침 경향'}입니다.`
        : '✅ 양면(좌우): 전 Row OK.',
      `📊 마진 현황: 평균 잔여율 ${(
        rowTable.reduce((sum, row) => sum + Math.min(row.hole.remainRate, row.lr.remainRate, row.ud.remainRate), 0) / rowTable.length
      ).toFixed(1)}%.`,
    ];

    if (lowMarginRows.length > 0) {
      lines.push(`🚨 위험 Row: ${lowMarginRows.join(', ')} (잔여율 20% 이하). 다음 SET에서 NG 전환 위험.`);
    }

    if (Math.abs(avgLr) >= 0.03) {
      lines.push(`🔗 전체 Row ${avgLr > 0 ? '우→' : '←좌'} 경향이 확인됩니다. 프린팅 전역 ${avgLr > 0 ? '←좌' : '우→'} ${Math.abs(avgLr).toFixed(3)}mm 보정 검토.`);
    }

    if (isRisingTrend(activeData.tapeLR)) {
      lines.push('📈 양면좌우 편차가 Row 1→12로 갈수록 증가합니다. 기울기/장력 조건 점검 권장.');
    }

    return lines;
  }, [activeData, rowTable, sectionSummaries]);

  const afterTable = useMemo(() => {
    return rowTable.map((row, index) => {
      const corr = corrections[index];
      const before = row.lr;
      const afterDev = Number((before.deviation + corr.leftRight).toFixed(4));
      const after = toMeasurement(row.row, afterDev);
      return { row: row.row, before, after };
    });
  }, [corrections, rowTable]);

  const applyAutoToRow = (row: number, checked: boolean) => {
    setCorrections((prev) =>
      prev.map((item, index) => {
        if (item.row !== row) return item;
        if (!checked) return { ...item, auto: false, leftRight: 0, upDown: 0 };
        const source = rowTable[index];
        const lrStatus = getStatus(source.lr.deviation);
        const udStatus = getStatus(source.ud.deviation);
        return {
          ...item,
          auto: true,
          leftRight: lrStatus === 'OK' ? 0 : Number((-source.lr.deviation).toFixed(3)),
          upDown: udStatus === 'OK' ? 0 : Number((-source.ud.deviation).toFixed(3)),
        };
      }),
    );
  };

  const applyAutoAll = () => {
    setCorrections((prev) =>
      prev.map((item, index) => {
        const source = rowTable[index];
        const rowStatus = getWorst([getStatus(source.lr.deviation), getStatus(source.ud.deviation)]);
        if (rowStatus === 'OK') return { ...item, auto: false, leftRight: 0, upDown: 0 };
        return {
          ...item,
          auto: true,
          leftRight: Number((-source.lr.deviation).toFixed(3)),
          upDown: Number((-source.ud.deviation).toFixed(3)),
        };
      }),
    );
  };

  const resetCorrections = () => {
    setCorrections(Array.from({ length: 12 }, (_, i) => ({ row: i + 1, leftRight: 0, upDown: 0, auto: false })));
  };

  const filteredRows = section === '전체'
    ? rowTable
    : rowTable.map((row) => ({
      ...row,
      lr: section === '양면좌우' ? row.lr : toMeasurement(row.row, 0),
      ud: section === '양면상하' ? row.ud : toMeasurement(row.row, 0),
      hole: section === '타발홀' ? row.hole : toMeasurement(row.row, 0),
    }));

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, background: palette.bg, color: palette.text, minHeight: '100%', fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: 0 }}>조립/검사 탭</h1>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>라인:</strong>
          {(['A라인', 'B라인'] as LineKey[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLine(item)}
              style={{ minHeight: 44, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: line === item ? palette.accent : palette.bg, color: palette.text, cursor: 'pointer' }}
            >
              {item}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>측정항목:</strong>
          {(['타발홀', '양면좌우', '양면상하', '전체'] as SectionKey[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSection(item)}
              style={{ minHeight: 44, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: section === item ? palette.ok : palette.bg, color: palette.text, cursor: 'pointer' }}
            >
              {item}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: palette.textDim }}>CSV 로딩 중...</div>}
        {!loading && line === 'B라인' && <div style={{ color: palette.textDim }}>현재 샘플은 A라인만 제공됩니다.</div>}
      </section>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))' }}>
        {sectionSummaries.map((summary) => (
          <article key={summary.key} style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 14, background: palette.card }}>
            <h3 style={{ margin: '0 0 6px' }}>{summary.key}</h3>
            <div style={{ color: getColor(summary.status), fontWeight: 700 }}>{summary.status} · OK {summary.ok}/12 · CHECK {summary.check}/12 · NG {summary.ng}/12</div>
            <div style={{ marginTop: 8, color: palette.textDim }}>평균 편차 {mmText(summary.avg)}</div>
          </article>
        ))}
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Row 1~12 종합 테이블 (Rev.8 스타일)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: 980 }}>
          <thead>
            <tr style={{ color: palette.textDim, borderBottom: `1px solid ${palette.border}` }}>
              <th style={{ padding: 8 }}>Row</th>
              <th>타발홀</th>
              <th>잔여율</th>
              <th>양면좌우</th>
              <th>잔여율</th>
              <th>양면상하</th>
              <th>잔여율</th>
              <th>종합</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.row} style={{ borderBottom: `1px solid ${palette.border}`, background: row.rowStatus === 'NG' ? 'rgba(239,68,68,0.16)' : row.rowStatus === 'CHECK' ? 'rgba(245,158,11,0.14)' : 'transparent' }}>
                <td style={{ padding: 8, fontWeight: 700 }}>{row.row}</td>
                <td>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700, color: getColor(getStatus(row.hole.deviation)) }}>{mmText(row.hole.deviation)} {getStatus(row.hole.deviation)}</div>
                    <InlineDeviationBar value={row.hole.deviation} />
                  </div>
                </td>
                <td style={{ color: remainColor(row.hole.remainRate), fontWeight: 700 }}>{row.hole.remainRate.toFixed(0)}%</td>
                <td>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700, color: getColor(getStatus(row.lr.deviation)) }}>{mmText(row.lr.deviation)} {getStatus(row.lr.deviation)}</div>
                    <InlineDeviationBar value={row.lr.deviation} />
                  </div>
                </td>
                <td style={{ color: remainColor(row.lr.remainRate), fontWeight: 700 }}>{row.lr.remainRate.toFixed(0)}%</td>
                <td>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 700, color: getColor(getStatus(row.ud.deviation)) }}>{mmText(row.ud.deviation)} {getStatus(row.ud.deviation)}</div>
                    <InlineDeviationBar value={row.ud.deviation} />
                  </div>
                </td>
                <td style={{ color: remainColor(row.ud.remainRate), fontWeight: 700 }}>{row.ud.remainRate.toFixed(0)}%</td>
                <td style={{ color: getColor(row.rowStatus), fontWeight: 700 }}>{row.rowStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h3 style={{ marginTop: 0 }}>편차 추이 차트</h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke={palette.border} />
              <XAxis dataKey="row" stroke={palette.textDim} />
              <YAxis stroke={palette.textDim} />
              <Tooltip formatter={(value: number) => mmText(Number(value))} />
              <Legend />
              <ReferenceLine y={CHECK_LIMIT} stroke={palette.check} strokeDasharray="4 3" />
              <ReferenceLine y={-CHECK_LIMIT} stroke={palette.check} strokeDasharray="4 3" />
              <ReferenceLine y={NG_LIMIT} stroke={palette.ng} strokeDasharray="4 3" />
              <ReferenceLine y={-NG_LIMIT} stroke={palette.ng} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="타발홀" stroke={palette.ok} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="양면좌우" stroke={palette.check} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="양면상하" stroke={palette.green} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h3 style={{ marginTop: 0 }}>공정 마진 분석 · AI 코멘트</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: palette.textDim }}>
          {processComment.map((comment) => (
            <li key={comment}>{comment}</li>
          ))}
        </ul>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card, display: 'grid', gap: 14 }}>
        <h3 style={{ margin: 0 }}>Row별 개별 보정 시뮬레이션 (자동조립기)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ color: palette.textDim, borderBottom: `1px solid ${palette.border}` }}>
              <th style={{ padding: 8 }}>Row</th>
              <th>좌우 보정(mm)</th>
              <th>상하 보정(mm)</th>
              <th>적용</th>
            </tr>
          </thead>
          <tbody>
            {corrections.map((item) => (
              <tr key={item.row} style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td style={{ padding: 8 }}>{item.row}</td>
                <td>
                  <input type="number" step={0.001} value={item.leftRight} onChange={(event) => setCorrections((prev) => prev.map((row) => (row.row === item.row ? { ...row, leftRight: Number(event.target.value) } : row)))} style={{ width: 100, textAlign: 'right', borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }} />
                </td>
                <td>
                  <input type="number" step={0.001} value={item.upDown} onChange={(event) => setCorrections((prev) => prev.map((row) => (row.row === item.row ? { ...row, upDown: Number(event.target.value) } : row)))} style={{ width: 100, textAlign: 'right', borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }} />
                </td>
                <td>
                  <input type="checkbox" checked={item.auto} onChange={(event) => applyAutoToRow(item.row, event.target.checked)} /> 자동추천
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={applyAutoAll} style={{ minHeight: 40, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: palette.accent, color: '#fff', cursor: 'pointer' }}>전체 자동추천 적용</button>
          <button type="button" onClick={resetCorrections} style={{ minHeight: 40, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: palette.bg, color: palette.text, cursor: 'pointer' }}>초기화</button>
        </div>

        <h4 style={{ margin: '4px 0 0' }}>Before / After (양면좌우)</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ color: palette.textDim, borderBottom: `1px solid ${palette.border}` }}>
              <th style={{ padding: 8 }}>Row</th>
              <th>Before</th>
              <th>After</th>
              <th>잔여율 변화</th>
            </tr>
          </thead>
          <tbody>
            {afterTable.map((row) => (
              <tr key={row.row} style={{ borderBottom: `1px solid ${palette.border}` }}>
                <td style={{ padding: 8 }}>{row.row}</td>
                <td style={{ color: getColor(getStatus(row.before.deviation)), fontWeight: 700 }}>{mmText(row.before.deviation)} {getStatus(row.before.deviation)} {row.before.remainRate.toFixed(0)}%</td>
                <td style={{ color: getColor(getStatus(row.after.deviation)), fontWeight: 700 }}>{mmText(row.after.deviation)} {getStatus(row.after.deviation)} {row.after.remainRate.toFixed(0)}%</td>
                <td style={{ color: remainColor(row.after.remainRate), fontWeight: 700 }}>{row.before.remainRate.toFixed(0)}% → {row.after.remainRate.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: '#0B1220' }}>
        <h3 style={{ marginTop: 0 }}>듀얼 에이전트 자체검증 (관리자 95 + 작업자 95)</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: palette.textDim }}>
          <li>관리자: Row 1~12 전부를 같은 표에서 비교 가능하며 CHECK/NG 행 배경 강조로 우선순위 식별 가능.</li>
          <li>관리자: 잔여율 색상(녹/노/빨)과 위험 Row(≤20%) 강조로 마진 부족 Row 즉시 식별 가능.</li>
          <li>관리자: 전역 치우침이면 프린팅 보정, 특정 Row면 조립기 개별 보정으로 경로를 분리 제안.</li>
          <li>작업자: Row별 편차 + 잔여율이 한 행에 있어 위험 Row를 3초 내 판별 가능.</li>
          <li>작업자: 자동추천 체크 시 편차 반대 방향 보정값이 즉시 채워져 직관적으로 조정 가능.</li>
          <li>작업자: 잔여율 빨강(20% 미만), 노랑(20~50%), 녹색(50% 초과)으로 위험도를 빠르게 인지 가능.</li>
        </ul>
        <div style={{ marginTop: 8 }}>관리자 에이전트: <b>95/100</b> · 작업자 에이전트: <b>95/100</b></div>
      </section>
    </div>
  );
}
