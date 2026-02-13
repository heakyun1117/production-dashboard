# -*- coding: utf-8 -*-
"""
# [FILE] main.py
# [PURPOSE] FastAPI 백엔드 엔트리(로컬 실행용) — Step1(조립시트 분석) API 제공
#
# [INPUT]
# - /api/v1/measurements/upload : 멀티 CSV 업로드(조립시트 측정 CSV)
# - 파일명 규칙: 일자_라인명_로트명_상태_시트넘버_메모(옵션).csv
#
# [OUTPUT]
# - 시트 리스트 요약(sheets) + jobId
# - 시트 디테일(row 데이터 + 진단/Top5/미니카드)
#
# [CALLER]
# - React 프론트엔드가 이 API를 호출(추후 연결)
#
# [SPEC LOCK]
# - 단위: mm
# - 표시는 프론트에서 소수점 2자리(계산은 원본 정밀도 유지)
# - 방향: X(+) 우측, X(-) 좌측 / Y(+) 상측, Y(-) 하측
# - Mini Strip Card(B안): ±ng 스케일(clip), deadband=0.02, tilt/bow=0.03
"""
from __future__ import annotations

import os
import time
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pandas as pd

# =============================================================================
# [STEP1] 로직 엔진 import (계산/판정/요약)
# =============================================================================
import core


# =============================================================================
# [STEP1] In-memory store (최소 제품용)
# - React 붙이기 전까지는 메모리에만 저장해도 충분
# - 나중에 필요하면 디스크 캐시/DB로 확장
# =============================================================================
@dataclass
class SheetData:
    sheet_key: str
    meta: Dict
    row_df: pd.DataFrame
    detail: Dict
    score: float


@dataclass
class ProcessData:
    """프린팅/슬리터 공정마진 데이터 — 5대 분석"""
    printing_calc: Dict           # {(ref, layer, axis, pt): value}
    carbon_rows: List[Dict]       # 카본 프린팅 12행 마진
    insulation_rows: List[Dict]   # 절연 프린팅 12행 마진
    slitter_rows: List[Dict]      # 슬리터 타발폭 12행 마진
    row_points_carbon: str        # 선택된 매핑명 (카본)
    row_points_insulation: str    # 선택된 매핑명 (절연)
    # 추가: 원단, 스텐실, 간섭, 전체폭
    fabric_rows: List[Dict] = None          # (1) 원단 분석
    stencil_detail: List[Dict] = None       # (2) 스텐실 레이어간 차이
    stencil_summary: List[Dict] = None      # (2) 스텐실 비대칭
    interference_rows: List[Dict] = None    # (4) 간섭 12행
    row_points_interference: str = ""       # 간섭 매핑명
    slitter_total_rows: List[Dict] = None   # (5b) 전체폭 균일성
    # v4.8: 파일별 분리 데이터 (Compare 페이지용)
    slitter_by_file: Dict = None           # { filename: [12 rows] }
    slitter_total_by_file: Dict = None     # { filename: [12 rows] }
    slitter_filenames: List = None         # 슬리터 파일명 목록
    printing_filenames: List = None        # 프린팅 파일명 목록


@dataclass
class JobData:
    job_id: str
    created_at: float
    sheets: Dict[str, SheetData]  # sheet_key -> SheetData
    process_data: Optional[ProcessData] = None  # 공정마진 데이터 (업로드 시 저장)


_JOBS: Dict[str, JobData] = {}
_MAX_JOBS = 5  # 메모리 보호


def _evict_old_jobs():
    if len(_JOBS) <= _MAX_JOBS:
        return
    # 오래된 job부터 제거
    items = sorted(_JOBS.items(), key=lambda kv: kv[1].created_at)
    for job_id, _job in items[: max(0, len(_JOBS) - _MAX_JOBS)]:
        _JOBS.pop(job_id, None)


# =============================================================================
# [STEP1] 유틸: 중복 시트 최신 선택
# - 파일명에 시간이 있으면 그걸 우선 사용(예: ..._235959_... / ...-235959... 등)
# - 시간이 없으면 업로드 순서가 최신
# =============================================================================
def _extract_time_key(filename: str) -> Tuple[int, int]:
    """
    기능: 파일명에서 HHMMSS(또는 HHMM) 패턴을 찾아 시간 key로 변환
    출력: (has_time, time_int)  has_time=1이면 시간 존재
    규칙: 파일명 규칙(일자_라인_로트_상태_시트넘버_메모.csv)에서
          6번째 필드(메모) 이후의 연속 숫자 6자리(HHMMSS) 또는 4자리(HHMM)만 시간으로 인정
    """
    import re as _re
    base = os.path.splitext(os.path.basename(filename))[0]
    parts = base.split("_")
    # 메모 영역(6번째 필드 이후)에서만 시간 탐색
    memo_part = "_".join(parts[5:]) if len(parts) > 5 else ""
    if not memo_part:
        return (0, 0)
    # 연속 숫자 6자리(HHMMSS) 우선, 4자리(HHMM) 차선
    for pat in (r'(\d{6})', r'(\d{4})'):
        m = _re.search(pat, memo_part)
        if m:
            t = int(m.group(1))
            # 유효 시간 범위 검증: HHMMSS(0~235959), HHMM(0~2359)
            if len(m.group(1)) == 6 and t <= 235959:
                return (1, t)
            if len(m.group(1)) == 4 and t <= 2359:
                return (1, t)
    return (0, 0)


def _sheet_key(meta: Dict) -> str:
    # sheet_key는 React에서도 안정적으로 쓰기 위해 문자열로 고정
    # NOTE: meta 값이 None이면 빈 문자열로 통일
    return "|".join(
        [
            str(meta.get("일자") or ""),
            str(meta.get("라인명") or ""),
            str(meta.get("로트명") or ""),
            str(meta.get("상태") or ""),
            str(meta.get("시트넘버") if meta.get("시트넘버") is not None else ""),
        ]
    )


# =============================================================================
# [API] FastAPI 앱
# =============================================================================
app = FastAPI(title="i-SENS Dashboard Backend (Step1)", version="0.1.0")

# React 개발 서버에서 호출 가능하도록 CORS 허용(개발용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# [API CONTRACT] Step1 · 업로드
# =============================================================================
@app.post("/api/v1/measurements/upload")
async def upload_measurements(
    files: List[UploadFile] = File(...),
):
    """
    기능: 멀티 CSV 업로드 → 시트 리스트 요약 생성
    입력: files (CSV 여러 개)
    출력: { jobId, parsed{count, failed}, failedSamples, sheets[] }
    """
    if not files:
        raise HTTPException(status_code=400, detail="업로드 파일이 없습니다.")

    job_id = str(uuid.uuid4())
    created_at = time.time()

    failed_samples = []
    sheets_map: Dict[str, Tuple[int, Tuple[int, int], Dict, pd.DataFrame]] = {}
    # sheet_key -> (upload_index, time_key, meta, row_df)

    for idx, f in enumerate(files):
        try:
            raw = await f.read()
            meta = core.parse_filename(f.filename)
            skey = _sheet_key(meta)

            # 파일명 파싱 실패(필수 메타 없음) 처리
            if meta.get("시트넘버") is None or not meta.get("일자") or not meta.get("라인명") or not meta.get("로트명"):
                failed_samples.append({"filename": f.filename, "reason": "filename_parse_failed"})
                continue

            long_df = core.read_measurement_csv(raw)
            row_df = core.pivot_row_values(long_df)

            # 중복 시트: 최신 선택
            time_key = _extract_time_key(f.filename)
            prev = sheets_map.get(skey)
            if prev is None:
                sheets_map[skey] = (idx, time_key, meta, row_df)
            else:
                prev_idx, prev_time, _prev_meta, _prev_df = prev
                # 시간이 있으면 시간 비교, 없으면 업로드 순서 비교
                if time_key[0] and prev_time[0]:
                    if time_key[1] >= prev_time[1]:
                        sheets_map[skey] = (idx, time_key, meta, row_df)
                elif time_key[0] and not prev_time[0]:
                    sheets_map[skey] = (idx, time_key, meta, row_df)
                else:
                    # 둘 다 시간 없으면 업로드 순서 마지막
                    if idx >= prev_idx:
                        sheets_map[skey] = (idx, time_key, meta, row_df)

        except Exception as e:
            failed_samples.append({"filename": f.filename, "reason": f"parse_failed: {type(e).__name__}"})

    # job store build
    job = JobData(job_id=job_id, created_at=created_at, sheets={})

    sheets_out = []
    for skey, (_idx, _tkey, meta, row_df) in sheets_map.items():
        detail = core.build_step1_detail_summary(row_df, th=None)  # th는 추후 settings에서 주입
        st = detail.get("diagnosis", {}).get("sheetStatus", "-")
        worstX = detail.get("diagnosis", {}).get("worstX") or {}
        worstY = detail.get("diagnosis", {}).get("worstY") or {}

        wx = abs(float(worstX.get("value"))) if worstX.get("value") is not None else float("nan")
        wy = abs(float(worstY.get("value"))) if worstY.get("value") is not None else float("nan")

        # score: NG면 0, 그 외는 기존 함수 사용
        st_for_score = "MUST" if st == "NG" else st
        score = core.quality_score_xy(wx if wx == wx else 0.0, wy if wy == wy else 0.0, st_for_score, th=None)

        job.sheets[skey] = SheetData(sheet_key=skey, meta=meta, row_df=row_df, detail=detail, score=score)

        # tags는 구조화된 tags의 name만 내려줌(프론트가 툴팁은 detail에서 사용)
        tags = [t.get("name") for t in (detail.get("diagnosis", {}).get("tags") or []) if isinstance(t, dict)]
        sheets_out.append(
            {
                "sheetKey": skey,
                "meta": meta,
                "status": st,
                "qualityScore": score,
                "worstX": wx if wx == wx else None,
                "worstY": wy if wy == wy else None,
                "tags": tags,
            }
        )

    # 기본 정렬: score 낮은(위험) 순, 그 다음 시트넘버
    def _sort_key(x):
        sc = x.get("qualityScore")
        sc = float(sc) if sc is not None else 999.0
        sn = x.get("meta", {}).get("시트넘버")
        sn = int(sn) if sn is not None else 999999
        return (sc, sn)

    sheets_out.sort(key=_sort_key)

    _JOBS[job_id] = job
    _evict_old_jobs()

    return {
        "jobId": job_id,
        "parsed": {"count": len(sheets_out), "failed": len(failed_samples)},
        "failedSamples": failed_samples[:10],
        "sheets": sheets_out,
    }


# =============================================================================
# [API CONTRACT] Step1 · 시트 디테일
# =============================================================================
@app.get("/api/v1/measurements/sheets/{job_id}/{sheet_key}")
def get_sheet_detail(job_id: str, sheet_key: str):
    """
    기능: 선택된 시트의 Row 데이터 + 디테일 요약(진단/Top5/미니카드) 반환
    입력: job_id, sheet_key
    출력: { sheetKey, meta, rows[], detail }
    """
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="jobId를 찾을 수 없습니다. 먼저 업로드를 진행하세요.")

    sd = job.sheets.get(sheet_key)
    if sd is None:
        raise HTTPException(status_code=404, detail="sheetKey를 찾을 수 없습니다.")

    rows = sd.row_df.to_dict("records")

    return {
        "sheetKey": sd.sheet_key,
        "meta": sd.meta,
        "rows": rows,
        "detail": sd.detail,
        "qualityScore": sd.score,
    }


# =============================================================================
# [API CONTRACT] Step1 · 시트 마진 분석 (Phase 2)
# =============================================================================
@app.get("/api/v1/measurements/sheets/{job_id}/{sheet_key}/margin")
def get_sheet_margin(job_id: str, sheet_key: str):
    """
    기능: 시트의 공정별 마진 분석 데이터 반환
    입력: job_id, sheet_key
    출력: { assembly: {x,y}, processes: {공정명: {x,y}} }

    각 공정별로 마진 소모량(consumed), 예산(budget), 잔여(remaining), 상태(zone) 제공
    NOTE: 현재는 측정 데이터 기반 추정치. 실제 공정 데이터 연결 시 정확도 향상 가능.
    """
    import math

    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="jobId를 찾을 수 없습니다.")

    sd = job.sheets.get(sheet_key)
    if sd is None:
        raise HTTPException(status_code=404, detail="sheetKey를 찾을 수 없습니다.")

    # 기본 임계값
    ng_x = 0.15
    ng_y = 0.15
    check_x = 0.10
    check_y = 0.10
    scale = 0.20

    # WorstX/Y 추출
    diag = sd.detail.get("diagnosis", {})
    worst_x_info = diag.get("worstX") or {}
    worst_y_info = diag.get("worstY") or {}
    abs_x = abs(float(worst_x_info.get("value", 0))) if worst_x_info.get("value") is not None else 0.0
    abs_y = abs(float(worst_y_info.get("value", 0))) if worst_y_info.get("value") is not None else 0.0

    # Punch worst
    rows = sd.row_df.to_dict("records")
    punch_worst = 0.0
    for r in rows:
        pl = abs(float(r.get("타발홀L", 0) or 0))
        pr = abs(float(r.get("타발홀R", 0) or 0))
        punch_worst = max(punch_worst, pl, pr)

    def zone_label(consumed_val, ng_limit, check_limit):
        if consumed_val >= ng_limit:
            return "danger"
        if consumed_val >= check_limit:
            return "observe"
        return "normal"

    # 조립(최종) 마진
    assembly = {
        "x": {
            "worst_mm": abs_x,
            "ng_mm": ng_x,
            "margin_mm": round(ng_x - abs_x, 4),
            "zone": zone_label(abs_x, ng_x, check_x),
        },
        "y": {
            "worst_mm": abs_y,
            "ng_mm": ng_y,
            "margin_mm": round(ng_y - abs_y, 4),
            "zone": zone_label(abs_y, ng_y, check_y),
        },
    }

    # 공정별 마진 추정 (비율 기반 — 실제 공정 데이터 연결 시 교체)
    # 총 편차를 공정별 기여도로 분배
    process_ratios = {
        "원단": {"x_ratio": 0.0, "y_ratio": 0.0},
        "카본 프린팅": {"x_ratio": 0.10, "y_ratio": 0.40},
        "절연 프린팅": {"x_ratio": 0.40, "y_ratio": 0.10},
        "로우 슬리팅": {"x_ratio": 0.15, "y_ratio": 0.20},
        "자동 조립": {"x_ratio": 0.35, "y_ratio": 0.30},
    }

    processes = {}
    for name, ratios in process_ratios.items():
        x_consumed = round(abs_x * ratios["x_ratio"], 4)
        y_consumed = round(abs_y * ratios["y_ratio"], 4)
        x_budget = scale if name == "자동 조립" else ng_x
        y_budget = scale if name == "자동 조립" else ng_y

        processes[name] = {
            "x": {
                "consumed_mm": x_consumed,
                "budget_mm": x_budget,
                "remaining_mm": round(x_budget - x_consumed, 4),
                "zone": zone_label(x_consumed, ng_x, check_x),
            },
            "y": {
                "consumed_mm": y_consumed,
                "budget_mm": y_budget,
                "remaining_mm": round(y_budget - y_consumed, 4),
                "zone": zone_label(y_consumed, ng_y, check_y),
            },
        }

    return {
        "sheetKey": sd.sheet_key,
        "assembly": assembly,
        "processes": processes,
    }


# =============================================================================
# [API CONTRACT] Step2 · 공정마진 파일 업로드 (프린팅 + 슬리터)
# =============================================================================
@app.post("/api/v1/measurements/upload-process/{job_id}")
async def upload_process_files(
    job_id: str,
    printing_files: Optional[List[UploadFile]] = File(None),
    slitter_files: Optional[List[UploadFile]] = File(None),
):
    """
    기능: 프린팅/슬리터 CSV 업로드 → 공정마진 계산
    입력: job_id, printing_files (프린팅 CSV), slitter_files (슬리터 CSV)
    출력: { jobId, carbon: [...], insulation: [...], slitter: [...] }

    프론트엔드에서 FormData 필드명으로 파일 종류를 구분하여 전송
    """
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="jobId를 찾을 수 없습니다. 먼저 측정 CSV를 업로드하세요.")

    # None → 빈 리스트 변환 (Optional 파라미터)
    if printing_files is None:
        printing_files = []
    if slitter_files is None:
        slitter_files = []

    printing_dfs = []
    slitter_dfs = []
    printing_filenames = []
    slitter_filenames = []

    # 프린팅 파일 처리
    for f in printing_files:
        raw = await f.read()
        df = core.parse_tabular_like(raw)
        printing_dfs.append(df)
        printing_filenames.append(f.filename or f"printing_{len(printing_filenames)+1}")

    # 슬리터 파일 처리
    for f in slitter_files:
        raw = await f.read()
        df = core.parse_tabular_like(raw)
        slitter_dfs.append(df)
        slitter_filenames.append(f.filename or f"slitter_{len(slitter_filenames)+1}")

    # ── 프린팅 파일에서 5가지 분석 ──
    calc_map = {}
    carbon_rows = []
    insulation_rows = []
    rp_carbon_name = ""
    rp_insulation_name = ""
    fabric_rows = []
    stencil_detail = []
    stencil_summary = []
    interference_rows = []
    rp_intf_name = ""

    if printing_dfs:
        printing_all = pd.concat(printing_dfs, ignore_index=True)

        # (1) 원단 분석 — "거리 타발" 항목
        dist_df = core.extract_distances(printing_all)
        if not dist_df.empty:
            fabric_rows = core.compute_fabric(dist_df)

        # (2) 스텐실 분석 — "거리 카본/절연" 항목
        if not dist_df.empty:
            stencil_detail, stencil_summary = core.compute_stencil(dist_df)

        # (3) 프린팅 마진 — "계산기 타발기준" 항목
        calc_map = core.extract_printing_calc(printing_all)
        if calc_map:
            has_carbon = any(k[1] == "카본" for k in calc_map.keys())
            if has_carbon:
                rp_carbon_name, rp_carbon = core._pick_row_points(calc_map, layer="카본")
                carbon_rows = core.compute_printing_layer(calc_map, "카본", row_points=rp_carbon)

            has_insulation = any(k[1] == "절연" for k in calc_map.keys())
            if has_insulation:
                rp_insulation_name, rp_insulation = core._pick_row_points(calc_map, layer="절연")
                insulation_rows = core.compute_printing_layer(calc_map, "절연", row_points=rp_insulation)

            # (4) 레이어간 간섭 — "계산기 카본기준" 항목
            has_intf = any(k[0] == "카본기준" for k in calc_map.keys())
            if has_intf:
                rp_intf_name, rp_intf = core._pick_row_points(calc_map, layer="절연", ref="카본기준")
                interference_rows = core.compute_printing_layer(
                    calc_map, "절연", ref="카본기준", row_points=rp_intf
                )

    # ── 슬리터 파일에서 분석 (v4.8: 파일별 개별 처리) ──
    slitter_rows = []
    slitter_total_rows = []
    slitter_by_file = {}
    slitter_total_by_file = {}

    if slitter_dfs:
        # 파일별 개별 처리 (파일 identity 보존)
        for fname, sdf in zip(slitter_filenames, slitter_dfs):
            slit_items = core.extract_slitter_items(sdf)
            if not slit_items.empty:
                slitter_by_file[fname] = core.compute_slitter_punch(slit_items)
                slitter_total_by_file[fname] = core.compute_slitter_total(slit_items)

        # 합산 결과 (MarginPage 호환 — 첫 번째 파일 데이터)
        if slitter_by_file:
            first_key = slitter_filenames[0]
            slitter_rows = slitter_by_file.get(first_key, [])
            slitter_total_rows = slitter_total_by_file.get(first_key, [])

    # ── 저장 ──
    process_data = ProcessData(
        printing_calc={str(k): v for k, v in calc_map.items()},
        carbon_rows=carbon_rows,
        insulation_rows=insulation_rows,
        slitter_rows=slitter_rows,
        row_points_carbon=rp_carbon_name,
        row_points_insulation=rp_insulation_name,
        fabric_rows=fabric_rows,
        stencil_detail=stencil_detail,
        stencil_summary=stencil_summary,
        interference_rows=interference_rows,
        row_points_interference=rp_intf_name,
        slitter_total_rows=slitter_total_rows,
        slitter_by_file=slitter_by_file,
        slitter_total_by_file=slitter_total_by_file,
        slitter_filenames=slitter_filenames,
        printing_filenames=printing_filenames,
    )
    job.process_data = process_data

    return {
        "jobId": job_id,
        "carbon": carbon_rows,
        "insulation": insulation_rows,
        "slitter": slitter_rows,
        "rowPointsCarbon": rp_carbon_name,
        "rowPointsInsulation": rp_insulation_name,
        "fabric": fabric_rows,
        "stencilDetail": stencil_detail,
        "stencilSummary": stencil_summary,
        "interference": interference_rows,
        "rowPointsInterference": rp_intf_name,
        "slitterTotal": slitter_total_rows,
        "printingCalc": {str(k): v for k, v in calc_map.items()},
        "slitterByFile": slitter_by_file,
        "slitterTotalByFile": slitter_total_by_file,
        "slitterFilenames": slitter_filenames,
        "printingFilenames": printing_filenames,
    }


@app.get("/api/v1/measurements/process/{job_id}")
def get_process_data(job_id: str):
    """기능: 저장된 공정마진 데이터 조회"""
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="jobId를 찾을 수 없습니다.")

    pd_data = job.process_data
    if pd_data is None:
        return {"jobId": job_id, "carbon": [], "insulation": [], "slitter": [],
                "fabric": [], "stencilDetail": [], "stencilSummary": [],
                "interference": [], "slitterTotal": [],
                "slitterByFile": {}, "slitterTotalByFile": {},
                "slitterFilenames": [], "printingFilenames": []}

    return {
        "jobId": job_id,
        "carbon": pd_data.carbon_rows,
        "insulation": pd_data.insulation_rows,
        "slitter": pd_data.slitter_rows,
        "rowPointsCarbon": pd_data.row_points_carbon,
        "rowPointsInsulation": pd_data.row_points_insulation,
        "fabric": pd_data.fabric_rows or [],
        "stencilDetail": pd_data.stencil_detail or [],
        "stencilSummary": pd_data.stencil_summary or [],
        "interference": pd_data.interference_rows or [],
        "rowPointsInterference": pd_data.row_points_interference or "",
        "slitterTotal": pd_data.slitter_total_rows or [],
        "printingCalc": pd_data.printing_calc or {},
        "slitterByFile": pd_data.slitter_by_file or {},
        "slitterTotalByFile": pd_data.slitter_total_by_file or {},
        "slitterFilenames": pd_data.slitter_filenames or [],
        "printingFilenames": pd_data.printing_filenames or [],
    }


# =============================================================================
# [STEP3] 보정 시뮬레이션
# =============================================================================

class SimulationRequest(BaseModel):
    printing_x: float = 0.0
    printing_y: float = 0.0
    slitter_y: List[float] = [0.0] * 12
    assembly_x: List[float] = [0.0] * 12
    assembly_y: List[float] = [0.0] * 12


@app.post("/api/v1/measurements/sheets/{job_id}/{sheet_key}/simulate")
def simulate_sheet_adjustment(job_id: str, sheet_key: str, req: SimulationRequest):
    """
    장비 오프셋을 적용한 Before/After 시뮬레이션 결과를 반환한다.
    """
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="jobId not found")
    sd = job.sheets.get(sheet_key)
    if sd is None:
        raise HTTPException(status_code=404, detail="sheetKey not found")

    offsets = {
        "printing_x": req.printing_x,
        "printing_y": req.printing_y,
        "slitter_y": req.slitter_y,
        "assembly_x": req.assembly_x,
        "assembly_y": req.assembly_y,
    }
    result = core.simulate_adjustment(sd.row_df, offsets, th=None)
    return result


@app.get("/api/v1/measurements/sheets/{job_id}/{sheet_key}/recommended-offsets")
def get_recommended_offsets(
    job_id: str,
    sheet_key: str,
    slitter_available: bool = Query(True),
):
    """
    Worst Row 기준 추천 보정값을 반환한다.
    """
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="jobId not found")
    sd = job.sheets.get(sheet_key)
    if sd is None:
        raise HTTPException(status_code=404, detail="sheetKey not found")

    recommended = core.compute_recommended_offsets(sd.row_df, slitter_available=slitter_available)
    return recommended


# =============================================================================
# [DEBUG] 헬스 체크
# =============================================================================
@app.get("/health")
def health():
    return {"ok": True, "jobs": len(_JOBS)}
