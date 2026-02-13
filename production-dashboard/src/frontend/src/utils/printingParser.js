const CHECK_LIMIT = 0.12;
const NG_LIMIT = 0.15;

const namePattern = /계산기\s+(.+?)_(\d+):/;

export function getStatusColor(status) {
  if (status === 'NG') return '#EF4444';
  if (status === 'CHECK') return '#F59E0B';
  return '#2D68C4';
}

export function judgeDeviation(value) {
  const abs = Math.abs(value);
  if (abs >= NG_LIMIT) return 'NG';
  if (abs >= CHECK_LIMIT) return 'CHECK';
  return 'OK';
}

function normalizeMetric(raw) {
  return raw
    .replace('타발기준_', '')
    .replace('카본기준_', '카본대비_')
    .replace('좌우', '←좌 / 우→')
    .replace('상하', '↑상 / 하↓');
}

export function parsePrintingCsvText(text, fileName = '로컬 업로드') {
  const lines = text.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim() === ':BEGIN');
  const end = lines.findIndex((line) => line.trim() === ':END');

  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error(':BEGIN ~ :END 블록을 찾을 수 없습니다.');
  }

  const block = lines.slice(begin + 1, end);
  const rowMap = new Map();

  for (const line of block) {
    const cols = line.split('\t').map((item) => item.trim().replaceAll('"', ''));
    const label = cols[0] || '';
    const match = label.match(namePattern);
    if (!match) continue;

    const metricName = normalizeMetric(match[1]);
    const row = Number(match[2]);
    const deviation = Number(cols[1]);
    if (Number.isNaN(deviation) || !Number.isFinite(row)) continue;

    if (!rowMap.has(row)) {
      rowMap.set(row, []);
    }

    rowMap.get(row).push({
      metricName,
      deviation,
      status: judgeDeviation(deviation),
      direction: deviation >= 0 ? '우측/상' : '좌측/하',
    });
  }

  const rows = Array.from({ length: 12 }, (_, index) => {
    const rowNo = index + 1;
    const points = rowMap.get(rowNo) ?? [];
    return {
      rowNo,
      points,
      maxAbsDeviation: points.length ? Math.max(...points.map((point) => Math.abs(point.deviation))) : 0,
      rowStatus: points.some((point) => point.status === 'NG')
        ? 'NG'
        : points.some((point) => point.status === 'CHECK')
          ? 'CHECK'
          : 'OK',
    };
  });

  const overallStatus = rows.some((row) => row.rowStatus === 'NG')
    ? 'NG'
    : rows.some((row) => row.rowStatus === 'CHECK')
      ? 'CHECK'
      : 'OK';

  const riskRows = rows.filter((row) => row.rowStatus !== 'OK').map((row) => row.rowNo);
  const aiComment =
    riskRows.length === 0
      ? '레벨1 코멘트: 현재 하판 프린팅 편차는 모두 OK 범위입니다. 주기 점검을 유지해 주세요.'
      : `레벨1 코멘트: Row ${riskRows.join(', ')}에서 편차 리스크가 확인되었습니다. 편차 부호의 반대 방향으로 보정을 검토해 주세요.`;

  return {
    process: 'printing-bottom',
    source: fileName,
    checkedAt: new Date().toISOString(),
    limits: { check: CHECK_LIMIT, ng: NG_LIMIT },
    overallStatus,
    aiComment,
    rows,
  };
}

export async function parsePrintingCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const decoded = new TextDecoder('utf-16le').decode(uint8[0] === 0xff && uint8[1] === 0xfe ? uint8.slice(2) : uint8);
  return parsePrintingCsvText(decoded, file.name);
}
