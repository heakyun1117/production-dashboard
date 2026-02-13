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
import { bottomPrintingSample, type QualityStatus, type RowDeviationRecord } from '../data/bottomPrintingSample';

const palette = {
  bg: '#0B1020',
  panel: '#151C33',
  panelStrong: '#1B2544',
  text: '#E8EEFF',
  textMuted: '#AAB7DE',
  border: '#2A3661',
  ok: '#2D68C4',
  check: '#F59E0B',
  ng: '#EF4444',
};

type RowSummary = RowDeviationRecord & {
  worst: number;
  status: QualityStatus;
};

const getStatus = (value: number, checkLimit: number, ngLimit: number): QualityStatus => {
  const abs = Math.abs(value);
  if (abs >= ngLimit) return 'NG';
  if (abs >= checkLimit) return 'CHECK';
  return 'OK';
};

const getColor = (status: QualityStatus) => {
  if (status === 'NG') return palette.ng;
  if (status === 'CHECK') return palette.check;
  return palette.ok;
};

const directionText = (value: number, axis: '좌우' | '상하') => {
  if (value === 0) return '기준';
  if (axis === '좌우') return value > 0 ? '우→ 치우침' : '←좌 치우침';
  return value > 0 ? '↑상 치우침' : '하↓ 치우침';
};

const correctionText = (value: number, axis: '좌우' | '상하') => {
  if (value === 0) return '보정 불필요';
  if (axis === '좌우') return value > 0 ? '←좌 방향 보정' : '우→ 방향 보정';
  return value > 0 ? '하↓ 방향 보정' : '↑상 방향 보정';
};

const summarizeRows = (rows: RowDeviationRecord[], checkLimit: number, ngLimit: number): RowSummary[] => {
  return rows.map((row) => {
    const worst = Math.max(Math.abs(row.leftRightMm), Math.abs(row.upDownMm));
    return {
      ...row,
      worst,
      status: getStatus(worst, checkLimit, ngLimit),
    };
  });
};

const buildComments = (rows: RowSummary[], checkLimit: number) => {
  const ngRows = rows.filter((row) => row.status === 'NG');
  const checkRows = rows.filter((row) => row.status === 'CHECK');
  const sortedByWorst = [...rows].sort((a, b) => b.worst - a.worst);
  const topRisk = sortedByWorst[0];

  const comments: string[] = [];

  if (ngRows.length > 0) {
    const target = ngRows[0];
    const axis = Math.abs(target.leftRightMm) >= Math.abs(target.upDownMm) ? '좌우' : '상하';
    const value = axis === '좌우' ? target.leftRightMm : target.upDownMm;

    comments.push(
      `Row ${target.row} ${axis} 편차 ${value.toFixed(3)}mm는 NG 구간입니다. ${correctionText(value, axis)}을 1순위로 적용하세요.`
    );
  }

  if (checkRows.length > 0) {
    const rowNumbers = checkRows.map((row) => row.row).join(', ');
    comments.push(
      `CHECK 구간 Row (${rowNumbers})는 기준(${checkLimit.toFixed(2)}mm) 근접 상태입니다. 생산 전 추가 1시트 검증을 권장합니다.`
    );
  }

  const nearLimitRows = rows.filter((row) => row.worst >= checkLimit * 0.9 && row.status === 'OK').map((row) => row.row);
  if (nearLimitRows.length > 0) {
    comments.push(`OK 판정이지만 한계 근접 Row (${nearLimitRows.join(', ')})는 집중 모니터링 대상입니다.`);
  }

  if (topRisk) {
    comments.push(`최대 리스크 Row는 ${topRisk.row}번(최대편차 ${topRisk.worst.toFixed(3)}mm)입니다. 교정 후 Before/After 비교를 기록하세요.`);
  }

  return comments;
};

export default function BottomPrintingTab() {
  const { limits, rows, sheetId, collectedAt, source } = bottomPrintingSample;
  const rowSummaries = summarizeRows(rows, limits.checkMm, limits.ngMm);
  const comments = buildComments(rowSummaries, limits.checkMm);

  return (
    <div
      style={{
        padding: 24,
        display: 'grid',
        gap: 20,
        fontFamily: 'Pretendard, sans-serif',
        background: palette.bg,
        color: palette.text,
        minHeight: '100vh',
      }}
    >
      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.panelStrong }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>하판 프린팅 실시간 판단</h2>
        <p style={{ margin: '0 0 6px', color: palette.textMuted }}>
          시트 {sheetId} · 수집시각 {new Date(collectedAt).toLocaleString('ko-KR')} · 데이터 {source.fileName}
        </p>
        <p style={{ margin: 0, color: palette.textMuted }}>기준: CHECK ±{limits.checkMm}mm / NG ±{limits.ngMm}mm</p>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.panel }}>
        <h2 style={{ margin: '0 0 8px' }}>AI 코멘트 (데이터 기반 자동생성)</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          {comments.map((comment) => (
            <li key={comment}>{comment}</li>
          ))}
        </ul>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.panel }}>
        <h2 style={{ marginTop: 0 }}>Row 1~12 편차 테이블</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: 16 }}>
          <thead>
            <tr>
              <th>Row</th>
              <th>좌우 편차 (←좌 / 우→)</th>
              <th>상하 편차 (↑상 / 하↓)</th>
              <th>좌우 판정 방향</th>
              <th>상하 판정 방향</th>
              <th>최종 판정</th>
            </tr>
          </thead>
          <tbody>
            {rowSummaries.map((row) => (
              <tr key={row.row} style={{ borderTop: `1px solid ${palette.border}`, height: 44 }}>
                <td>{row.row}</td>
                <td>{row.leftRightMm.toFixed(3)} mm</td>
                <td>{row.upDownMm.toFixed(3)} mm</td>
                <td>{directionText(row.leftRightMm, '좌우')}</td>
                <td>{directionText(row.upDownMm, '상하')}</td>
                <td style={{ color: getColor(row.status), fontWeight: 700 }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.panel }}>
        <h2 style={{ marginTop: 0 }}>Row별 편차 막대차트 + 허용범위</h2>
        <div style={{ width: '100%', height: 420 }}>
          <ResponsiveContainer>
            <BarChart data={rowSummaries} margin={{ top: 20, right: 24, left: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#34406F" />
              <XAxis dataKey="row" tick={{ fill: palette.textMuted, fontSize: 13 }} />
              <YAxis domain={[-0.2, 0.2]} tickFormatter={(v) => `${v.toFixed(2)}mm`} tick={{ fill: palette.textMuted, fontSize: 13 }} />
              <Tooltip
                contentStyle={{ background: '#0F1730', border: `1px solid ${palette.border}`, color: palette.text }}
                formatter={(value: number, name) => [`${value.toFixed(3)} mm (${name})`, `${getStatus(value, limits.checkMm, limits.ngMm)}`]}
              />
              <Legend wrapperStyle={{ color: palette.textMuted }} />
              <ReferenceLine y={limits.checkMm} stroke={palette.check} strokeDasharray="5 5" label={{ value: '+CHECK', fill: palette.check }} />
              <ReferenceLine y={-limits.checkMm} stroke={palette.check} strokeDasharray="5 5" label={{ value: '-CHECK', fill: palette.check }} />
              <ReferenceLine y={limits.ngMm} stroke={palette.ng} strokeDasharray="5 5" label={{ value: '+NG', fill: palette.ng }} />
              <ReferenceLine y={-limits.ngMm} stroke={palette.ng} strokeDasharray="5 5" label={{ value: '-NG', fill: palette.ng }} />

              <Bar dataKey="leftRightMm" name="좌우 편차">
                {rowSummaries.map((row) => (
                  <Cell key={`lr-${row.row}`} fill={getColor(getStatus(row.leftRightMm, limits.checkMm, limits.ngMm))} />
                ))}
              </Bar>
              <Bar dataKey="upDownMm" name="상하 편차">
                {rowSummaries.map((row) => (
                  <Cell key={`ud-${row.row}`} fill={getColor(getStatus(row.upDownMm, limits.checkMm, limits.ngMm))} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
