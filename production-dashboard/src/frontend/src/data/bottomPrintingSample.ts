export type QualityStatus = 'OK' | 'CHECK' | 'NG';

export type RowDeviationRecord = {
  row: number;
  leftRightMm: number;
  upDownMm: number;
};

export type BottomPrintingDataset = {
  processCode: 'BOTTOM_PRINTING';
  sheetId: string;
  collectedAt: string;
  source: {
    type: 'sample';
    fileName: string;
    parserVersion: string;
  };
  limits: {
    checkMm: number;
    ngMm: number;
  };
  rows: RowDeviationRecord[];
};

// 연동 준비: API 응답 스키마와 동일하게 유지한 샘플 데이터
export const bottomPrintingSample: BottomPrintingDataset = {
  processCode: 'BOTTOM_PRINTING',
  sheetId: 'A-SET-298',
  collectedAt: '2026-01-22T10:12:00+09:00',
  source: {
    type: 'sample',
    fileName: '0122_printing-A_SET_298.csv',
    parserVersion: 'v0.3.0',
  },
  limits: {
    checkMm: 0.12,
    ngMm: 0.15,
  },
  rows: [
    { row: 1, leftRightMm: -0.0022, upDownMm: -0.019 },
    { row: 2, leftRightMm: -0.0343, upDownMm: -0.0425 },
    { row: 3, leftRightMm: -0.0271, upDownMm: -0.0243 },
    { row: 4, leftRightMm: -0.0189, upDownMm: -0.0496 },
    { row: 5, leftRightMm: 0.016, upDownMm: -0.031 },
    { row: 6, leftRightMm: 0.023, upDownMm: 0.018 },
    { row: 7, leftRightMm: -0.041, upDownMm: 0.061 },
    { row: 8, leftRightMm: 0.083, upDownMm: -0.02 },
    { row: 9, leftRightMm: 0.097, upDownMm: 0.114 },
    { row: 10, leftRightMm: 0.121, upDownMm: -0.108 },
    { row: 11, leftRightMm: 0.136, upDownMm: 0.129 },
    { row: 12, leftRightMm: -0.154, upDownMm: -0.142 },
  ],
};
