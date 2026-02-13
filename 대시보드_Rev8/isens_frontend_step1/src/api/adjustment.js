import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

/**
 * Worst Row 기준 추천 보정값 조회
 * @param {string} jobId
 * @param {string} sheetKey
 * @param {boolean} slitterAvailable - 슬리터 사용 가능 여부
 * @returns {Promise<{ printing_x, printing_y, slitter_y[12], assembly_x[12], assembly_y[12] }>}
 */
export async function getRecommendedOffsets(jobId, sheetKey, slitterAvailable = true) {
  const res = await axios.get(
    `${BASE_URL}/api/v1/measurements/sheets/${encodeURIComponent(jobId)}/${encodeURIComponent(sheetKey)}/recommended-offsets`,
    { params: { slitter_available: slitterAvailable } }
  );
  return res.data;
}

/**
 * 시뮬레이션 (서버 검증용 — 프론트 계산과 대조)
 * @param {string} jobId
 * @param {string} sheetKey
 * @param {Object} offsets - { printing_x, printing_y, slitter_y, assembly_x, assembly_y }
 * @returns {Promise<{ before, after, perRow }>}
 */
export async function simulateAdjustment(jobId, sheetKey, offsets) {
  const res = await axios.post(
    `${BASE_URL}/api/v1/measurements/sheets/${encodeURIComponent(jobId)}/${encodeURIComponent(sheetKey)}/simulate`,
    offsets
  );
  return res.data;
}
