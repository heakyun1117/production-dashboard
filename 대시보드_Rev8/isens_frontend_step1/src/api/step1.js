import axios from "axios";

// 백엔드 주소 (FastAPI)
const BASE_URL = "http://127.0.0.1:8000";

export async function uploadMeasurements(files) {
  const form = new FormData();
  for (const f of files) form.append("files", f);

  const res = await axios.post(`${BASE_URL}/api/v1/measurements/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // { jobId, parsed, failedSamples, sheets }
}

export async function getSheetDetail(jobId, sheetKey) {
  // sheetKey는 한글/특수문자 포함 가능 → URL 인코딩
  const res = await axios.get(
    `${BASE_URL}/api/v1/measurements/sheets/${encodeURIComponent(jobId)}/${encodeURIComponent(sheetKey)}`
  );
  return res.data;
}
