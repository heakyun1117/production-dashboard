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

const getStatus = (value: number): 'OK' | 'CHECK' | 'NG' => {
  const abs = Math.abs(value);
  if (abs >= NG_LIMIT) return 'NG';
  if (abs >= CHECK_LIMIT) return 'CHECK';
  return 'OK';
};

const getColor = (status: 'OK' | 'CHECK' | 'NG') => {
  if (status === 'NG') return NG;
  if (status === 'CHECK') return CHECK;
  return OK;
};

const directionText = (value: number, axis: '좌우' | '상하') => {
  if (value === 0) return '기준';
  if (axis === '좌우') return value > 0 ? '+ (우측)' : '- (좌측)';
  return value > 0 ? '+ (위)' : '- (아래)';
};

export default function BottomPrintingTab() {
  return (
    <div style={{ padding: 24, display: 'grid', gap: 20, fontFamily: 'sans-serif' }}>
      <section style={{ border: '1px solid #d5d9ef', borderRadius: 12, padding: 16, background: '#EDF1FE' }}>
        <h2 style={{ margin: '0 0 8px', color: '#171C8F' }}>AI 코멘트</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Row 12 좌우 편차가 -0.154mm로 NG입니다. 우측 방향 보정 검토가 필요합니다.</li>
          <li>Row 11은 CHECK 구간(±0.12mm 이상)입니다. 생산 전 TEST 1시트 추가 권장합니다.</li>
          <li>상하 편차는 전반적으로 안정적이며, Row 9~12 구간 집중 점검을 권장합니다.</li>
        </ul>
      </section>

      <section style={{ border: '1px solid #e3e6f7', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, color: '#171C8F' }}>Row 1~12 편차 테이블</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr>
              <th>Row</th>
              <th>좌우 편차 (←좌 / 우→)</th>
              <th>상하 편차 (↑상 / 하↓)</th>
              <th>좌우 방향</th>
              <th>상하 방향</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {rowData.map((row) => {
              const worst = Math.max(Math.abs(row.leftRight), Math.abs(row.upDown));
              const status = getStatus(worst);
              return (
                <tr key={row.row}>
                  <td>{row.row}</td>
                  <td>{row.leftRight.toFixed(3)} mm</td>
                  <td>{row.upDown.toFixed(3)} mm</td>
                  <td>{directionText(row.leftRight, '좌우')}</td>
                  <td>{directionText(row.upDown, '상하')}</td>
                  <td style={{ color: getColor(status), fontWeight: 700 }}>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section style={{ border: '1px solid #e3e6f7', borderRadius: 12, padding: 16 }}>
        <h2 style={{ marginTop: 0, color: '#171C8F' }}>Row별 편차 막대차트 + 허용범위</h2>
        <div style={{ width: '100%', height: 420 }}>
          <ResponsiveContainer>
            <BarChart data={rowData} margin={{ top: 20, right: 24, left: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="row" />
              <YAxis domain={[-0.2, 0.2]} tickFormatter={(v) => `${v.toFixed(2)}mm`} />
              <Tooltip formatter={(value: number) => `${value.toFixed(3)} mm`} />
              <Legend />
              <ReferenceLine y={CHECK_LIMIT} stroke={CHECK} strokeDasharray="5 5" label="+0.12" />
              <ReferenceLine y={-CHECK_LIMIT} stroke={CHECK} strokeDasharray="5 5" label="-0.12" />
              <ReferenceLine y={NG_LIMIT} stroke={NG} strokeDasharray="5 5" label="+0.15" />
              <ReferenceLine y={-NG_LIMIT} stroke={NG} strokeDasharray="5 5" label="-0.15" />

              <Bar dataKey="leftRight" name="좌우 편차">
                {rowData.map((r) => (
                  <Cell key={`lr-${r.row}`} fill={getColor(getStatus(r.leftRight))} />
                ))}
              </Bar>
              <Bar dataKey="upDown" name="상하 편차">
                {rowData.map((r) => (
                  <Cell key={`ud-${r.row}`} fill={getColor(getStatus(r.upDown))} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
