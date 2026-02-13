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
import { getStatusColor } from '../utils/printingParser';

function RowChart({ rows }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h3 className="mb-3 text-lg font-semibold text-primary">Row별 최대 편차 막대차트</h3>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rowNo" label={{ value: 'Row', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: '편차(mm)', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(4)} mm`} />
            <Legend />
            <ReferenceLine y={0.12} stroke="#F59E0B" strokeDasharray="5 5" label="+CHECK" />
            <ReferenceLine y={-0.12} stroke="#F59E0B" strokeDasharray="5 5" label="-CHECK" />
            <ReferenceLine y={0.15} stroke="#EF4444" strokeDasharray="5 5" label="+NG" />
            <ReferenceLine y={-0.15} stroke="#EF4444" strokeDasharray="5 5" label="-NG" />
            <Bar dataKey="maxAbsDeviation" name="최대 절대 편차(mm)">
              {rows.map((row) => (
                <Cell key={row.rowNo} fill={getStatusColor(row.rowStatus)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PrintingTab({ data, onUpload }) {
  if (!data) {
    return <div className="rounded-xl bg-white p-6 shadow">데이터를 불러오는 중입니다...</div>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-accent bg-white p-4 shadow">
        <h2 className="text-lg font-semibold text-primary">AI 코멘트 패널</h2>
        <p className="mt-2 text-base">{data.aiComment}</p>
        <p className="mt-1 text-sm text-gray-600">
          부호 규칙: 양수(+)는 우측/위, 음수(-)는 좌측/아래입니다.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow">
        <span className="font-semibold text-primary">CSV 업로드</span>
        <input
          type="file"
          accept=".csv"
          className="min-h-11 rounded border border-accent px-2"
          onChange={(event) => onUpload(event.target.files?.[0])}
        />
        <span className="text-sm text-gray-600">또는 자동 로딩된 샘플 데이터 사용</span>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white p-4 shadow">
        <h3 className="mb-3 text-lg font-semibold text-primary">Row 1~12 포인트별 편차 테이블</h3>
        <table className="w-full table-auto border-collapse text-center">
          <thead>
            <tr className="bg-bg text-sm text-primary">
              <th className="border border-accent px-2 py-2">Row</th>
              <th className="border border-accent px-2 py-2">항목</th>
              <th className="border border-accent px-2 py-2">편차(mm)</th>
              <th className="border border-accent px-2 py-2">방향(←좌/우→, ↑상/하↓)</th>
              <th className="border border-accent px-2 py-2">판정</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) =>
              row.points.length ? (
                row.points.map((point, index) => (
                  <tr key={`${row.rowNo}-${point.metricName}`}>
                    {index === 0 && (
                      <td rowSpan={row.points.length} className="border border-accent px-2 py-2 font-semibold">
                        {row.rowNo}
                      </td>
                    )}
                    <td className="border border-accent px-2 py-2">{point.metricName}</td>
                    <td className="border border-accent px-2 py-2">{point.deviation.toFixed(4)}</td>
                    <td className="border border-accent px-2 py-2">{point.direction}</td>
                    <td className="border border-accent px-2 py-2" style={{ color: getStatusColor(point.status) }}>
                      {point.status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr key={`empty-${row.rowNo}`}>
                  <td className="border border-accent px-2 py-2 font-semibold">{row.rowNo}</td>
                  <td className="border border-accent px-2 py-2" colSpan={4}>
                    측정 포인트 없음
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <RowChart rows={data.rows} />
    </section>
  );
}
