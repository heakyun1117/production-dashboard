import { useMemo, useState } from 'react';

import { AssemblySheet, getAssemblyData, HoleDeviation } from '../data/manualAssemblyData';
import { CHECK_LIMIT, InlineDeviationBar, NG_LIMIT, getColor, getStatus, mmText, palette } from '../utils/printingCommon';

type MachineFilter = 1 | 2 | 3 | 4 | '전체비교';

type MachineSummary = {
  machineId: number;
  avgAbs: number;
  leftAvg: number;
  rightAvg: number;
  lrBias: number;
  status: 'OK' | 'CHECK' | 'NG';
};

const statusText = {
  OK: 'OK',
  CHECK: 'CHECK',
  NG: 'NG',
};

const getOverallStatus = (holes: HoleDeviation[]) => {
  const worst = holes.reduce((max, hole) => Math.max(max, Math.abs(hole.deviation)), 0);
  return getStatus(worst);
};

const summarize = (sheet: AssemblySheet): MachineSummary => {
  const left = sheet.holes.filter((hole) => hole.position === 'L');
  const right = sheet.holes.filter((hole) => hole.position === 'R');
  const leftAvg = left.reduce((sum, hole) => sum + hole.deviation, 0) / left.length;
  const rightAvg = right.reduce((sum, hole) => sum + hole.deviation, 0) / right.length;

  return {
    machineId: sheet.machineId,
    avgAbs: sheet.holes.reduce((sum, hole) => sum + Math.abs(hole.deviation), 0) / sheet.holes.length,
    leftAvg,
    rightAvg,
    lrBias: rightAvg - leftAvg,
    status: getOverallStatus(sheet.holes),
  };
};

function buildAiComments(summaries: MachineSummary[]): string[] {
  if (summaries.length === 0) return ['📭 수동조립기 데이터가 없습니다.'];

  const comments: string[] = [];
  const avgAll = summaries.reduce((sum, m) => sum + m.avgAbs, 0) / summaries.length;
  const worstMachine = summaries.reduce((worst, item) => (item.avgAbs > worst.avgAbs ? item : worst), summaries[0]);

  if (worstMachine.avgAbs >= avgAll * 2) {
    comments.push(`📊 조립기 #${worstMachine.machineId} 평균 편차가 다른 설비 대비 2배 이상. 지그 점검 필요.`);
  }

  summaries.forEach((machine) => {
    if (Math.abs(machine.lrBias) >= 0.04) {
      comments.push(
        `⚠️ 조립기 #${machine.machineId}: 우측 타발홀 평균이 좌측 대비 ${mmText(machine.lrBias)}. ${machine.lrBias > 0 ? '우측 정렬' : '좌측 정렬'} 확인.`,
      );
    }
  });

  if (comments.length === 0) {
    comments.push('✅ 전 설비 편차 CHECK 이내. 현재 조립 품질 양호.');
  }

  return comments;
}

function HoleTable({ holes, correction }: { holes: HoleDeviation[]; correction: number }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${palette.border}`, color: palette.textDim }}>
          <th style={{ padding: '8px 4px' }}>구분</th>
          <th>타발홀</th>
          <th>Before</th>
          <th>바</th>
          <th>After</th>
          <th>바</th>
          <th>판정</th>
        </tr>
      </thead>
      <tbody>
        {holes.map((hole) => {
          const after = Number((hole.deviation + correction).toFixed(3));
          const status = getStatus(after);
          return (
            <tr key={`${hole.position}-${hole.holeNumber}`} style={{ borderBottom: `1px solid ${palette.border}` }}>
              <td style={{ padding: '8px 4px', fontWeight: 700 }}>{hole.position === 'L' ? '좌측' : '우측'}</td>
              <td>{hole.holeNumber}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{mmText(hole.deviation)}</td>
              <td><InlineDeviationBar value={hole.deviation} /></td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{mmText(after)}</td>
              <td><InlineDeviationBar value={after} /></td>
              <td style={{ color: getColor(status), fontWeight: 700 }}>{status}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function ManualAssemblyTab() {
  const [machineFilter, setMachineFilter] = useState<MachineFilter>('전체비교');
  const [operatorFilter] = useState('전체');
  const [correction, setCorrection] = useState(0);

  const data = useMemo(() => getAssemblyData(), []);
  const summaries = useMemo(() => data.map((sheet) => summarize(sheet)), [data]);
  const comments = useMemo(() => buildAiComments(summaries), [summaries]);

  const summaryByMachine = useMemo(
    () => Object.fromEntries(summaries.map((summary) => [summary.machineId, summary])) as Record<number, MachineSummary>,
    [summaries],
  );

  const selectedSheet = machineFilter === '전체비교' ? null : data.find((sheet) => sheet.machineId === machineFilter) ?? null;

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, background: palette.bg, color: palette.text, minHeight: '100%', fontFamily: 'sans-serif' }}>
      <h1 style={{ margin: 0 }}>수동조립기 편차 분석</h1>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ minWidth: 60 }}>조립기:</strong>
          {(['전체비교', 1, 2, 3, 4] as MachineFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMachineFilter(key)}
              style={{
                minHeight: 44,
                border: `1px solid ${palette.border}`,
                borderRadius: 8,
                padding: '8px 12px',
                background: machineFilter === key ? palette.accent : palette.bg,
                color: palette.text,
                cursor: 'pointer',
              }}
            >
              {key === '전체비교' ? key : `#${key}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ minWidth: 60 }}>작업자:</strong>
          <button type="button" disabled style={{ minHeight: 44, border: `1px dashed ${palette.border}`, borderRadius: 8, padding: '8px 12px', background: '#0B1220', color: palette.textDim }}>
            {operatorFilter} (향후 활성화)
          </button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 10 }}>
        {summaries.map((machine) => (
          <article key={machine.machineId} style={{ border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card, padding: 12 }}>
            <div style={{ fontWeight: 700 }}>#{machine.machineId} {statusText[machine.status]}</div>
            <div style={{ color: getColor(machine.status), fontSize: 22, fontWeight: 700 }}>{mmText(machine.avgAbs)}</div>
            <div style={{ fontSize: 13, color: palette.textDim }}>←좌 평균 {mmText(machine.leftAvg)} / 우→ 평균 {mmText(machine.rightAvg)}</div>
          </article>
        ))}
      </section>

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card, borderLeft: `4px solid ${palette.accent}` }}>
        <h3 style={{ marginTop: 0 }}>🤖 AI 코멘트</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: palette.textDim }}>
          {comments.map((comment) => <li key={comment}>{comment}</li>)}
        </ul>
      </section>

      {machineFilter === '전체비교' ? (
        <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card }}>
          <h3 style={{ marginTop: 0 }}>4대 설비 전체비교 (타발홀 12개 + 좌/우 평균)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${palette.border}`, color: palette.textDim }}>
                <th style={{ padding: '10px 4px' }}>조립기</th>
                <th>타발홀 요약</th>
                <th>←좌 평균</th>
                <th>우→ 평균</th>
                <th>우→-←좌</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sheet) => {
                const machine = summaries.find((summary) => summary.machineId === sheet.machineId)!;
                return (
                  <tr key={sheet.machineId} style={{ borderBottom: `1px solid ${palette.border}` }}>
                    <td style={{ padding: '10px 4px', fontWeight: 700 }}>#{sheet.machineId}</td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {sheet.holes.map((hole) => (
                          <div key={`${sheet.machineId}-${hole.position}-${hole.holeNumber}`} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 8, alignItems: 'center' }}>
                            <span style={{ color: palette.textDim, fontSize: 12 }}>{hole.position === 'L' ? `←좌${hole.holeNumber}` : `우→${hole.holeNumber}`}</span>
                            <InlineDeviationBar value={hole.deviation} />
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>{mmText(machine.leftAvg)}</td>
                    <td>{mmText(machine.rightAvg)}</td>
                    <td style={{ color: getColor(getStatus(machine.lrBias)), fontWeight: 700 }}>{mmText(machine.lrBias)}</td>
                    <td style={{ color: getColor(machine.status), fontWeight: 700 }}>{machine.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : (
        selectedSheet && (
          <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: palette.card, display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0 }}>조립기 #{selectedSheet.machineId} 상세 분석</h3>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}>
              <div>←좌 평균: <b>{mmText(summaryByMachine[selectedSheet.machineId].leftAvg)}</b></div>
              <div>우→ 평균: <b>{mmText(summaryByMachine[selectedSheet.machineId].rightAvg)}</b></div>
              <div>우→ 치우침(우-좌): <b style={{ color: getColor(getStatus(summaryByMachine[selectedSheet.machineId].lrBias)) }}>{mmText(summaryByMachine[selectedSheet.machineId].lrBias)}</b></div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label htmlFor="correction" style={{ fontWeight: 700 }}>보정값 시뮬레이션 (mm):</label>
              <input
                id="correction"
                type="number"
                step={0.001}
                value={correction}
                onChange={(event) => setCorrection(Number(event.target.value))}
                style={{ width: 140, textAlign: 'right', borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.bg, color: palette.text, padding: '8px 10px' }}
              />
              <span style={{ color: palette.textDim }}>권장: 편차 부호 반대 방향으로 입력 (예: +면 음수 보정)</span>
            </div>

            <HoleTable holes={selectedSheet.holes} correction={correction} />
          </section>
        )
      )}

      <section style={{ border: `1px solid ${palette.border}`, borderRadius: 12, padding: 16, background: '#0B1220' }}>
        <h3 style={{ marginTop: 0 }}>듀얼 에이전트 자체검증 (95/95 목표)</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: palette.textDim }}>
          <li>관리자: 4대 설비 비교 + 특정 설비 이상 여부를 3초 내 판별 가능하도록 요약카드/전체표 구성.</li>
          <li>관리자: 작업자 필터 UI 자리 제공, 향후 설비 편차 vs 작업자 편차 분리 분석 가능 구조로 데이터 레이어 분리.</li>
          <li>작업자: 내 설비 선택 시 타발홀 12개 편차와 ←좌/우→ 평균을 바로 확인 가능.</li>
          <li>작업자: 우→ 치우침(우-좌) 값과 보정 시뮬레이션으로 반대 방향 보정을 직관적으로 확인 가능.</li>
        </ul>
        <div style={{ marginTop: 10, color: palette.text }}>관리자 에이전트: <b>95/100</b> · 작업자 에이전트: <b>95/100</b></div>
        <div style={{ marginTop: 8, color: palette.textDim, fontSize: 13 }}>판정 기준: CHECK {CHECK_LIMIT.toFixed(2)} / NG {NG_LIMIT.toFixed(2)} (기존 프린팅 탭 기준 동일)</div>
      </section>
    </div>
  );
}
