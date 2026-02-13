import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

/**
 * 시트 마진 데이터 조회 (조립 기반)
 */
export async function getSheetMargin(jobId, sheetKey) {
  const res = await axios.get(
    `${BASE_URL}/api/v1/measurements/sheets/${encodeURIComponent(jobId)}/${encodeURIComponent(sheetKey)}/margin`
  );
  return res.data;
}

/**
 * 공정마진 파일 업로드 (프린팅 + 슬리터 CSV 각각 분리)
 * @param {string} jobId - 기존 업로드 jobId
 * @param {File[]} printingFiles - 프린팅 CSV 파일 배열
 * @param {File[]} slitterFiles - 슬리터 CSV 파일 배열
 * @returns {Promise<Object>} { jobId, carbon, insulation, slitter, rowPointsCarbon, rowPointsInsulation }
 */
export async function uploadProcessFiles(jobId, printingFiles, slitterFiles) {
  const form = new FormData();
  for (const f of (printingFiles ?? [])) form.append("printing_files", f);
  for (const f of (slitterFiles ?? [])) form.append("slitter_files", f);

  const res = await axios.post(
    `${BASE_URL}/api/v1/measurements/upload-process/${encodeURIComponent(jobId)}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data;
}

/**
 * 저장된 공정마진 데이터 조회
 */
export async function getProcessData(jobId) {
  const res = await axios.get(
    `${BASE_URL}/api/v1/measurements/process/${encodeURIComponent(jobId)}`
  );
  return res.data;
}
