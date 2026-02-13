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

import {
  BiasCompass,
  BullseyeCell,
  CHECK_LIMIT,
  DivergingBarCell,
  FourPointVizPanel,
  NG_LIMIT,
  SimulationOffsets,
  Status,
  RowDeviation,
  axisDirectionText,
  buildComments,
  extractCorners,
  calcRecommendedOffsets,
  correctionText,
  getColor,
  getStatus,
  marginRate,
  mmText,
  palette,
  simulateRow,
  toRowSummary,
} from '../utils/printingCommon';

type LineKey = 'A라인' | 'B라인';

const marginColor = (margin: number) => {
  if (margin >= 50) return palette.green;
  if (margin >= 20) return palette.check;
  return palette.ng;
};

const lineRows: Record<LineKey, RowDeviation[]> = {
  A라인: [
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
  ],
  B라인: [],
};


export default function BottomPrintingTab() {
  const [selectedLine, setSelectedLine] = useState<LineKey>('A라인');
  const rows = useMemo(() => lineRows[selectedLine] ?? [], [selectedLine]);
  const hasData = rows.length > 0;

  const recommended = useMemo(() => calcRecommendedOffsets(rows), [rows]);
  const [equipmentOffsets, setEquipmentOffsets] = useState<SimulationOffsets>({ q: 0, leftRightOffset: 0, upDownOffset: 0 });
  const [secondaryOffsets, setSecondaryOffsets] = useState<SimulationOffsets>(recommended);
  const [offsets, setOffsets] = useState<SimulationOffsets>(recommended);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSecondaryOffsets(recommended);
    setOffsets(recommended);
    setEquipmentOffsets({ q: 0, leftRightOffset: 0, upDownOffset: 0 });
    setCopied(false);
  }, [recommended]);

  const finalOffsets = useMemo(
    () => ({
      q: Number((equipmentOffsets.q + offsets.q).toFixed(3)),
      leftRightOffset: Number((equipmentOffsets.leftRightOffset + offsets.leftRightOffset).toFixed(3)),
      upDownOffset: Number((equipmentOffsets.upDownOffset + offsets.upDownOffset).toFixed(3)),
    }),
    [equipmentOffsets, offsets],
  );

  const simulatedRows = useMemo(
    () => rows.map((row) => simulateRow(row, offsets, rows.length)),
    [offsets, rows],
  );

  const beforeCorners = useMemo(() => extractCorners(rows), [rows]);
  const afterCorners = useMemo(() => extractCorners(simulatedRows), [simulatedRows]);

  const rowSummaries = useMemo(() => rows.map((row) => toRowSummary(row)), [rows]);
  const comments = useMemo(() => buildComments(rowSummaries), [rowSummaries]);
  const worstRow = useMemo(
    () => rowSummaries.reduce((a, b) => (Math.abs(b.worst) > Math.abs(a.worst) ? b : a), rowSummaries[0]),
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
    const beforeWorst = rows.length > 0 ? Math.max(...rows.map((row) => Math.max(Math.abs(row.leftRight), Math.abs(row.upDown)))) : 0;
    const afterWorst = simulatedRows.length > 0 ? Math.max(...simulatedRows.map((row) => Math.max(Math.abs(row.leftRight), Math.abs(row.upDown)))) : 0;
    const beforeNgCount = rowSummaries.filter((row) => row.status === 'NG').length;
    const afterNgCount = simulatedRows.filter((row) => getStatus(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown))) === 'NG').length;

    return { beforeWorst, afterWorst, beforeNgCount, afterNgCount };
  }, [rowSummaries, rows, simulatedRows]);

  const handleCopy = async () => {
    const text = `Q=${finalOffsets.q.toFixed(3)}, 좌우=${finalOffsets.leftRightOffset >= 0 ? '+' : ''}${finalOffsets.leftRightOffset.toFixed(3)}, 상하=${finalOffsets.upDownOffset >= 0 ? '+' : ''}${finalOffsets.upDownOffset.toFixed(3)}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sheetInfo = {
    sheetId: `BP-2026-0213-${selectedLine === 'A라인' ? 'A01' : 'B01'}`,
    collectedAt: selectedLine === 'A라인' ? '2026-02-13 09:32' : '-',
    fileName: selectedLine === 'A라인' ? 'bottom_printing_sample_0213.csv' : '-',
  };

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20, fontFamily: 'sans-serif', background: palette.bg, color: palette.text, minHeight: '100%' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>하판 프린팅</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="line-select" style={{ color: palette.textDim }}>라인 선택</label>
          <select
            id="line-select"
            value={selectedLine}
            onChange={(event) => setSelectedLine(event.target.value as LineKey)}
            style={{ background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 10px' }}
          >
            <option value="A라인">A라인</option>
            <option value="B라인">B라인</option>
          </select>
        </div>
      </section>

      {!hasData && (
        <section style={{ border: `1px dashed ${palette.border}`, borderRadius: 12, padding: 24, textAlign: 'center', background: palette.card }}>
          <h2 style={{ marginTop: 0 }}>B라인 데이터 없음</h2>
          <p style={{ marginBottom: 0, color: palette.textDim }}>현재 샘플 데이터는 A라인만 제공됩니다. 관리자 탭 연동을 위해 데이터 구조는 A/B 분리 상태로 준비되었습니다.</p>
        </section>
      )}

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
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: palette.green }}>시트 정보 (3도 인쇄: 카본→절연→실버)</h3>
          <div style={{ fontSize: 13, color: palette.textDim, lineHeight: 1.6 }}>
            <div>시트ID: {sheetInfo.sheetId}</div>
            <div>수집시각: {sheetInfo.collectedAt}</div>
            <div>파일명: {sheetInfo.fileName}</div>
          </div>
        </article>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h2 style={{ margin: '0 0 8px', color: palette.text }}>보정 추천 요약</h2>
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
            <tr style={{ color: palette.textDim, borderBottom: `1px solid ${palette.border}` }}>
              <th />
              <th>Q(회전)</th>
              <th>←좌/우→</th>
              <th>↑상/하↓</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
              <td style={{ textAlign: 'left', padding: '10px 4px' }}>① 현재 설비값</td>
              {(['q', 'leftRightOffset', 'upDownOffset'] as const).map((key) => (
                <td key={key} style={{ padding: '10px 0' }}>
                  <input
                    type="number"
                    step={0.001}
                    value={equipmentOffsets[key]}
                    onChange={(event) => setEquipmentOffsets((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                    style={{ width: 96, textAlign: 'right', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }}
                  />
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
              <td style={{ textAlign: 'left', padding: '10px 4px' }}>② AI 추천 보정</td>
              {(['q', 'leftRightOffset', 'upDownOffset'] as const).map((key) => (
                <td key={key} style={{ padding: '10px 0' }}>
                  <input
                    type="number"
                    step={0.001}
                    value={secondaryOffsets[key]}
                    onChange={(event) => setSecondaryOffsets((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                    style={{ width: 96, textAlign: 'right', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ textAlign: 'left', padding: '10px 4px', fontWeight: 700 }}>③ 최종 입력값</td>
              <td style={{ fontWeight: 700, color: palette.green }}>{finalOffsets.q.toFixed(3)}</td>
              <td style={{ fontWeight: 700, color: palette.green }}>{finalOffsets.leftRightOffset.toFixed(3)}</td>
              <td style={{ fontWeight: 700, color: palette.green }}>{finalOffsets.upDownOffset.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
          >
            {copied ? '✅ 복사됨' : '📋 최종값 복사'}
          </button>
          <button
            type="button"
            onClick={() => setSecondaryOffsets(recommended)}
            style={{ background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
          >
            🔄 추천값으로 리셋
          </button>
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

      {hasData && worstRow && (
        <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
          <h2 style={{ marginTop: 0, color: palette.text }}>치우침 도형 (최대 편차 Row)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <BiasCompass leftRight={worstRow.leftRight} upDown={worstRow.upDown} />
            <BullseyeCell leftRight={worstRow.leftRight} upDown={worstRow.upDown} />
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
        <div style={{ display: 'grid', gap: 12 }}>
          {([
            ['q', '회전(Q)'],
            ['leftRightOffset', '좌우 오프셋'],
            ['upDownOffset', '상하 오프셋'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ color: palette.textDim }}>
              {label}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <input
                  type="number"
                  step={0.001}
                  value={offsets[key]}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setOffsets((prev) => ({ ...prev, [key]: nextValue }));
                    setSecondaryOffsets((prev) => ({ ...prev, [key]: nextValue }));
                  }}
                  style={{ width: 90, textAlign: 'right', borderRadius: 6, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '6px 8px' }}
                />
                <input
                  type="range"
                  min={-0.2}
                  max={0.2}
                  step={0.001}
                  value={offsets[key]}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setOffsets((prev) => ({ ...prev, [key]: nextValue }));
                    setSecondaryOffsets((prev) => ({ ...prev, [key]: nextValue }));
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 96, textAlign: 'right', color: palette.text }}>{mmText(offsets[key])}</span>
              </div>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setOffsets(recommended);
              setSecondaryOffsets(recommended);
            }}
            style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
          >
            AI 추천값 적용
          </button>
          <button
            type="button"
            onClick={() => setOffsets({ ...secondaryOffsets })}
            style={{ background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
          >
            보정 계산기 값 적용
          </button>
          <button
            type="button"
            onClick={() => {
              const zeroOffsets = { q: 0, leftRightOffset: 0, upDownOffset: 0 };
              setOffsets(zeroOffsets);
              setSecondaryOffsets(zeroOffsets);
            }}
            style={{ background: palette.card, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
          >
            초기화 (0)
          </button>
        </div>
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
        <h2 style={{ marginTop: 0, color: palette.text }}>Row별 편차와 즉시 조치</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', color: palette.text }}>
          <thead>
            <tr style={{ background: palette.accent, color: '#fff' }}>
              <th>Row</th>
              <th>←좌/우→</th>
              <th>바</th>
              <th>↑상/하↓</th>
              <th>바</th>
              <th>마진</th>
              <th>방향</th>
              <th>보정 권장</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((beforeRow) => {
              const beforeWorst = Math.max(Math.abs(beforeRow.leftRight), Math.abs(beforeRow.upDown));
              const status = getStatus(beforeWorst);
              const rowMargin = Math.min(marginRate(beforeRow.leftRight), marginRate(beforeRow.upDown));

              return (
                <tr key={beforeRow.row} style={{ borderTop: `1px solid ${palette.border}`, background: beforeRow.row % 2 === 0 ? palette.bg : palette.card }}>
                  <td>{beforeRow.row}</td>
                  <td>{mmText(beforeRow.leftRight)}</td>
                  <td>
                    <DivergingBarCell value={beforeRow.leftRight} showDirection axis="좌우" />
                  </td>
                  <td>{mmText(beforeRow.upDown)}</td>
                  <td>
                    <DivergingBarCell value={beforeRow.upDown} showDirection axis="상하" />
                  </td>
                  <td style={{ color: marginColor(rowMargin), fontWeight: 700 }}>{`${Math.round(rowMargin)}%`}</td>
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
        <h2 style={{ marginTop: 0, color: palette.text }}>Before / After 비교</h2>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <FourPointVizPanel
            material="카본"
            showAfter={false}
            before={beforeCorners}
            after={afterCorners}
          />
          <FourPointVizPanel
            material="절연"
            showAfter
            before={beforeCorners}
            after={afterCorners}
          />
        </div>
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer>
            <LineChart
              data={rows.map((row, index) => ({
                row: row.row,
                beforeWorst: Number(Math.max(Math.abs(row.leftRight), Math.abs(row.upDown)).toFixed(4)),
                afterWorst: Number(Math.max(Math.abs(simulatedRows[index]?.leftRight ?? 0), Math.abs(simulatedRows[index]?.upDown ?? 0)).toFixed(4)),
              }))}
              margin={{ top: 20, right: 24, left: 12, bottom: 12 }}
            >
              <CartesianGrid stroke={palette.border} strokeDasharray="3 3" />
              <XAxis dataKey="row" tick={{ fill: palette.textDim }} axisLine={{ stroke: palette.border }} tickLine={{ stroke: palette.border }} />
              <YAxis domain={[0, 0.2]} tickFormatter={(value) => `${value.toFixed(2)}mm`} tick={{ fill: palette.textDim }} axisLine={{ stroke: palette.border }} tickLine={{ stroke: palette.border }} />
              <Tooltip contentStyle={{ background: palette.card, border: `1px solid ${palette.border}`, color: palette.text }} formatter={(value: number) => `${value.toFixed(3)} mm`} />
              <Legend />
              <ReferenceLine y={CHECK_LIMIT} stroke={palette.check} strokeDasharray="5 5" label="CHECK 0.12" />
              <ReferenceLine y={NG_LIMIT} stroke={palette.ng} strokeDasharray="5 5" label="NG 0.15" />
              <Line dataKey="beforeWorst" name="Before" stroke="#94A3B8" strokeWidth={2} strokeOpacity={0.45} dot={{ r: 3 }} />
              <Line dataKey="afterWorst" name="After" stroke={palette.accent} strokeWidth={2.6} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p style={{ marginBottom: 0, color: palette.textDim }}>
          최대 편차(절댓값): Before {summary.beforeWorst.toFixed(3)}mm → After {summary.afterWorst.toFixed(3)}mm · 점수 {((1 - summary.beforeWorst / 0.2) * 100).toFixed(1)} → {((1 - summary.afterWorst / 0.2) * 100).toFixed(1)}
        </p>
      </section>
    </div>
  );
}
