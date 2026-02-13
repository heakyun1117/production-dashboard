import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DivergingBarCell, getColor, palette, Status } from '../utils/printingCommon';

type DispensingRow = {
  index: number;
  area1: number;
  area2: number;
  areaAvg: number;
  spacing: number;
  outlier: boolean;
  outlierAreaCount: number;
  judgement: Status;
};

type MetricStats = {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  cv: number;
};

type DispensingData = {
  sourceFile: string;
  setCount: number;
  outlierCount: number;
  counts: Record<Status, number>;
  stats: {
    areaFiltered: MetricStats;
    areaAll: MetricStats;
    spacing: MetricStats;
  };
  rows: DispensingRow[];
};

const badgeStyle = (status: Status) => ({
  background: getColor(status),
  color: '#fff',
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  minWidth: 60,
  textAlign: 'center' as const,
});

const numberText = (value: number, unit: string) => `${value.toFixed(4)} ${unit}`;

function buildComments(data: DispensingData | null): string[] {
  if (!data) return ['📭 분주 데이터를 불러오지 못했습니다.'];

  const comments: string[] = [];
  if (data.counts.NG > 0) {
    comments.push(`🔴 NG ${data.counts.NG}건 감지. 노즐 막힘/압력 변동 여부를 즉시 점검하세요.`);
  }
  if (data.counts.CHECK > 0) {
    comments.push(`🟡 CHECK ${data.counts.CHECK}건. 최근 추이를 관찰하며 다음 SET에서 재확인 권장.`);
  }
  if (data.outlierCount > 0) {
    comments.push(`⚠️ 면적 이상치 ${data.outlierCount}건(3.0mm² 미만)은 통계에서 제외했고 표에 별도 표시했습니다.`);
  }

  const areaMean = data.stats.areaFiltered.mean;
  if (areaMean >= 5.8) comments.push(`📈 면적 평균 ${areaMean.toFixed(3)}mm²로 상단 경향입니다. 토출량 과다 여부를 확인하세요.`);
  else if (areaMean <= 5.3) comments.push(`📉 면적 평균 ${areaMean.toFixed(3)}mm²로 하단 경향입니다. 노즐 토출량/점도 점검이 필요합니다.`);
  else comments.push(`🔵 면적 평균 ${areaMean.toFixed(3)}mm²로 안정권입니다. 현재 조건 유지 권장.`);

  return comments;
}

export default function DispensingTab() {
  const [data, setData] = useState<DispensingData | null>(null);
  const [error, setError] = useState<string>('');
  const [includeOutliers, setIncludeOutliers] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch('/api/dispensing?file=0121_dispensing-A_SET_1.csv');
        if (!response.ok) throw new Error('분주 API 응답 오류');
        const payload = await response.json();
        setData(payload.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      }
    };
    run();
  }, []);

  const comments = useMemo(() => buildComments(data), [data]);

  const activeAreaStats = includeOutliers ? data?.stats.areaAll : data?.stats.areaFiltered;

  const areaChartRows = useMemo(
    () =>
      (data?.rows ?? []).map((row) => ({
        index: row.index,
        면적평균: row.areaAvg,
        이상치: row.outlier ? row.areaAvg : null,
      })),
    [data],
  );

  const spacingChartRows = useMemo(
    () =>
      (data?.rows ?? []).map((row) => ({
        index: row.index,
        간격: row.spacing,
      })),
    [data],
  );

  const areaMean = activeAreaStats?.mean ?? 0;
  const areaStd = activeAreaStats?.stdDev ?? 0;
  const spacingMean = data?.stats.spacing.mean ?? 0;
  const spacingStd = data?.stats.spacing.stdDev ?? 0;

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, background: '#0a1025', color: palette.text, minHeight: '100%', fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: 0 }}>분주</h1>

      {error && <div style={{ color: palette.ng }}>오류: {error}</div>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ background: palette.ok, padding: 12, borderRadius: 10 }}>OK <b>{data?.counts.OK ?? 0}</b></div>
        <div style={{ background: palette.check, color: '#111827', padding: 12, borderRadius: 10 }}>CHECK <b>{data?.counts.CHECK ?? 0}</b></div>
        <div style={{ background: palette.ng, padding: 12, borderRadius: 10 }}>NG <b>{data?.counts.NG ?? 0}</b></div>
        <div style={{ background: palette.card, border: `1px solid ${palette.border}`, padding: 12, borderRadius: 10 }}>시트 <b>{data?.sourceFile ?? '-'}</b></div>
        <div style={{ background: '#7f1d1d', border: `1px solid ${palette.ng}`, padding: 12, borderRadius: 10 }}>이상치 <b>{data?.outlierCount ?? 0}</b></div>
      </section>

      <section style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, borderLeft: `4px solid ${palette.accent}` }}>
        <h3 style={{ marginTop: 0 }}>🤖 AI 코멘트</h3>
        <ul style={{ margin: 0, paddingLeft: 20, color: palette.textDim, lineHeight: 1.7 }}>
          {comments.map((comment) => (
            <li key={comment}>{comment}</li>
          ))}
        </ul>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <article style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>면적 분포 차트</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={areaChartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="index" stroke={palette.textDim} />
                <YAxis stroke={palette.textDim} domain={['dataMin - 0.1', 'dataMax + 0.1']} />
                <Tooltip />
                <Legend />
                <ReferenceArea y1={areaMean - areaStd} y2={areaMean + areaStd} fill="#2D68C4" fillOpacity={0.12} />
                <ReferenceArea y1={areaMean - areaStd * 2} y2={areaMean + areaStd * 2} fill="#F59E0B" fillOpacity={0.08} />
                <ReferenceLine y={areaMean} stroke={palette.ok} label="평균" />
                <Line type="monotone" dataKey="면적평균" stroke={palette.ok} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="이상치" stroke={palette.ng} dot={{ r: 4, fill: palette.ng }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>간격 분포 차트</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={spacingChartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="index" stroke={palette.textDim} />
                <YAxis stroke={palette.textDim} domain={['dataMin - 0.05', 'dataMax + 0.05']} />
                <Tooltip />
                <Legend />
                <ReferenceArea y1={spacingMean - spacingStd} y2={spacingMean + spacingStd} fill="#2D68C4" fillOpacity={0.12} />
                <ReferenceArea y1={spacingMean - spacingStd * 2} y2={spacingMean + spacingStd * 2} fill="#F59E0B" fillOpacity={0.08} />
                <ReferenceLine y={spacingMean} stroke={palette.ok} label="평균" />
                <Line type="monotone" dataKey="간격" stroke={palette.accent} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>분주 세트 테이블</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${palette.border}`, color: palette.textDim }}>
              <th>#</th><th>면적1</th><th>면적2</th><th>면적평균</th><th>면적 바</th><th>간격</th><th>간격 바</th><th>판정</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.index} style={{ borderBottom: `1px solid ${palette.border}`, background: row.outlier ? 'rgba(239,68,68,0.16)' : 'transparent' }}>
                <td style={{ padding: '8px 4px' }}>{row.index}</td>
                <td>{row.area1.toFixed(4)}</td>
                <td>{row.area2.toFixed(4)}</td>
                <td>{row.areaAvg.toFixed(4)}</td>
                <td><DivergingBarCell value={row.areaAvg - areaMean} scale={0.5} checkLimit={areaStd || 0.1} ngLimit={(areaStd || 0.1) * 2} formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`} /></td>
                <td>{row.spacing.toFixed(4)}</td>
                <td><DivergingBarCell value={row.spacing - spacingMean} scale={0.35} checkLimit={spacingStd || 0.05} ngLimit={(spacingStd || 0.05) * 2} formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {row.outlier && <span style={{ background: palette.ng, borderRadius: 999, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>이상치</span>}
                    <span style={badgeStyle(row.judgement)}>{row.judgement}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>통계 요약</h3>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <input type="checkbox" checked={includeOutliers} onChange={(e) => setIncludeOutliers(e.target.checked)} />
          면적 통계에 이상치 포함
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>면적 {includeOutliers ? '(포함)' : '(제외)'}</h4>
            <div>평균: {numberText(activeAreaStats?.mean ?? 0, 'mm²')}</div>
            <div>표준편차: {numberText(activeAreaStats?.stdDev ?? 0, 'mm²')}</div>
            <div>최소~최대: {(activeAreaStats?.min ?? 0).toFixed(4)} ~ {(activeAreaStats?.max ?? 0).toFixed(4)}</div>
            <div>CV: {(activeAreaStats?.cv ?? 0).toFixed(2)}%</div>
          </div>
          <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, padding: 10 }}>
            <h4 style={{ margin: '0 0 8px' }}>간격</h4>
            <div>평균: {numberText(data?.stats.spacing.mean ?? 0, 'mm')}</div>
            <div>표준편차: {numberText(data?.stats.spacing.stdDev ?? 0, 'mm')}</div>
            <div>최소~최대: {(data?.stats.spacing.min ?? 0).toFixed(4)} ~ {(data?.stats.spacing.max ?? 0).toFixed(4)}</div>
            <div>CV: {(data?.stats.spacing.cv ?? 0).toFixed(2)}%</div>
          </div>
        </div>
      </section>
    </div>
  );
}
