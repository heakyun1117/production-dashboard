# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import re
from typing import Dict, Tuple, List, Optional

import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# Filename parser
# 규칙: 일자_라인명_로트명_상태_시트넘버_메모(옵션).csv
# -----------------------------------------------------------------------------
def parse_filename(name: str) -> Dict:
    base = os.path.basename(name).strip()
    root, _ext = os.path.splitext(base)
    parts = root.split("_")
    if len(parts) < 5:
        return {
            "파일명": base,
            "일자": None,
            "라인명": None,
            "로트명": None,
            "상태": None,
            "시트넘버": None,
            "메모": "",
        }
    date, line, lot, status, sn = parts[0], parts[1], parts[2], parts[3], parts[4]
    memo = "_".join(parts[5:]) if len(parts) > 5 else ""
    try:
        sn_i = int(re.sub(r"\D", "", str(sn)))
    except Exception:
        sn_i = None
    return {
        "파일명": base,
        "일자": date,
        "라인명": line,
        "로트명": lot,
        "상태": status,
        "시트넘버": sn_i,
        "메모": memo,
    }

# -----------------------------------------------------------------------------
# Measurement CSV parser (실데이터 안정 파서)
# - 인코딩: UTF-16/UTF-8-sig/CP949 자동 시도
# - 구분자: 탭(\t) 우선, 없으면 콤마(,), 세미콜론(;) 시도
# - 항목명: '_' 여러 개 + ':'/'：' 콜론 모두 허용
# -----------------------------------------------------------------------------
# 패턴 예시:
# "거리 양면상하_좌_1: 거리 Y"
# "타원 타발홀__좌측_2: 단축"
ITEM_RE = re.compile(
    r'^\s*"?\s*(?P<test>.+?)_+(?P<pos>좌측|우측|좌|우|중|센터|L|R|C)_+(?P<row>\d+)\s*[:：]\s*(?P<metric>.+?)\s*"?\s*$'
)

_POS_MAP = {
    "좌측": "좌",
    "우측": "우",
    "좌": "좌",
    "우": "우",
    "중": "중",
    "센터": "중",
    "L": "좌",
    "R": "우",
    "C": "중",
}

def _to_f(x) -> float:
    try:
        if x is None:
            return np.nan
        s = str(x).strip().strip('"').strip()
        if s == "":
            return np.nan
        return float(s)
    except Exception:
        return np.nan

def _decode_bytes(file_bytes: bytes) -> str:
    for enc in ("utf-16", "utf-16-le", "utf-8-sig", "utf-8", "cp949"):
        try:
            return file_bytes.decode(enc)
        except Exception:
            continue
    return file_bytes.decode("utf-8", errors="ignore")

def read_measurement_csv(file_bytes: bytes) -> pd.DataFrame:
    """
    반환 컬럼:
      - 검사종류, 위치(좌/중/우), Row(int), 측정항목, 계산값(float)
    """
    text = _decode_bytes(file_bytes)

    lines = []
    for ln in text.splitlines():
        t = ln.strip()
        if not t or t == ":BEGIN":
            continue
        lines.append(ln)

    # delimiter guess: prefer tab
    delim = "\t" if any("\t" in ln for ln in lines[:20]) else ","
    if delim != "\t" and any(";" in ln for ln in lines[:20]):
        delim = ";"

    out_rows: List[Dict] = []
    unmatched: List[str] = []

    for ln in lines:
        parts = [p.strip() for p in ln.split(delim)]
        if not parts:
            continue

        item = parts[0].strip().strip('"').strip()
        if not item:
            continue

        # 면적 항목 제외(대시보드 지표에서 사용 안 함)
        if "면적" in item:
            continue

        # 계산값: 뒤에서부터 숫자 변환 가능한 값 찾기
        calc = np.nan
        for token in reversed(parts[1:]):
            v = _to_f(token)
            if pd.notna(v):
                calc = v
                break

        m = ITEM_RE.match(item)
        if not m:
            if len(unmatched) < 50:
                unmatched.append(item)
            continue

        d = m.groupdict()
        test = (d.get("test") or "").strip()
        pos_raw = (d.get("pos") or "").strip()
        pos = _POS_MAP.get(pos_raw, pos_raw)
        row = int(d.get("row"))
        metric = (d.get("metric") or "").strip()

        out_rows.append(
            {
                "검사종류": test,
                "위치": pos,
                "Row": row,
                "측정항목": metric,
                "계산값": float(calc) if pd.notna(calc) else np.nan,
            }
        )

    df = pd.DataFrame(out_rows)
    # 디버그용(원하면 나중에 화면에 노출 가능)
    df.attrs["unmatched_items"] = unmatched
    return df

# -----------------------------------------------------------------------------
# Pivot: Row별 주요 지표로 표준화 (Streamlit 로직 기반)
# -----------------------------------------------------------------------------
def pivot_row_values(long_df: pd.DataFrame) -> pd.DataFrame:
    df = long_df.copy()
    if df.empty:
        return pd.DataFrame(columns=[
            "Row","조립치우침L","조립치우침R","상하치우침L","상하치우침C","상하치우침R","타발홀L","타발홀R"
        ])

    def pick(test_name: str, metric_kw: Tuple[str, ...], pos: str) -> pd.Series:
        sub = df[
            (df["검사종류"].astype(str).str.contains(test_name, na=False))
            & (df["측정항목"].apply(lambda x: any(k in str(x) for k in metric_kw)))
            & (df["위치"] == pos)
        ]
        if sub.empty:
            return pd.Series(dtype=float)
        # Row별 abs 최대값을 대표값으로 사용
        g = sub.groupby("Row")["계산값"]
        return g.apply(lambda s: float(s.loc[s.abs().idxmax()]) if s.notna().any() else np.nan)

    rows = sorted(set(pd.to_numeric(df["Row"], errors="coerce").dropna().astype(int).tolist()))
    out = pd.DataFrame({"Row": rows}).set_index("Row")

    out["조립치우침L"] = pick("계산기 양면", ("숫자",), "좌")
    out["조립치우침R"] = pick("계산기 양면", ("숫자",), "우")
    out["상하치우침L"] = pick("거리 양면상하", ("거리", "Y"), "좌")
    out["상하치우침C"] = pick("거리 양면상하", ("거리", "Y"), "중")
    out["상하치우침R"] = pick("거리 양면상하", ("거리", "Y"), "우")
    out["타발홀L"] = pick("타원 타발홀", ("단축",), "좌")
    out["타발홀R"] = pick("타원 타발홀", ("단축",), "우")

    return out.reset_index()

# -----------------------------------------------------------------------------
# Scoring helpers
# -----------------------------------------------------------------------------
def worst_abs(vals) -> float:
    s = pd.to_numeric(pd.Series(list(vals)), errors="coerce").dropna()
    if s.empty:
        return np.nan
    return float(s.abs().max())

def compute_constraints(r: pd.Series) -> Tuple[float, float]:
    """
    c_asym: 좌/우 비대칭(절댓값 차이)
    diag  : 사선(좌-우 기울기 proxy)
    """
    xl = pd.to_numeric(r.get("상하치우침L"), errors="coerce")
    xr = pd.to_numeric(r.get("상하치우침R"), errors="coerce")
    if pd.isna(xl) or pd.isna(xr):
        return np.nan, np.nan
    c_asym = float(abs(xl - xr))
    diag = float(abs(xl + xr) / 2.0)  # 단순 proxy
    return c_asym, diag

def _th(th: Dict[str, float] | None, *keys: str, default: float) -> float:
    """threshold dict에서 여러 키(별칭)를 허용."""
    th = th or {}
    for k in keys:
        if k in th and th[k] is not None:
            try:
                return float(th[k])
            except Exception:
                pass
    return float(default)

def tags_and_reco(r: pd.Series, th: Dict[str, float]):
    worst_x = worst_abs([r.get("조립치우침L"), r.get("조립치우침R")])
    worst_y = worst_abs([r.get("상하치우침L"), r.get("상하치우침C"), r.get("상하치우침R")])
    punch_w = worst_abs([r.get("타발홀L"), r.get("타발홀R")])
    c_asym, diag = compute_constraints(r)

    tag_x = _th(th, "tag_x", "x_tag", default=0.10)
    tag_y = _th(th, "tag_y", "y_tag", default=0.10)
    tag_p = _th(th, "tag_punch", "punch", "tag_p", default=0.10)
    th_asym = _th(th, "th_asym", "casym", "asym", default=0.10)
    th_diag = _th(th, "th_diag", "diag", default=0.10)

    tags = []
    if pd.notna(worst_x) and abs(worst_x) >= tag_x:
        tags.append("X")
    if pd.notna(worst_y) and abs(worst_y) >= tag_y:
        tags.append("Y")
    if pd.notna(punch_w) and abs(punch_w) >= tag_p:
        tags.append("타발홀")
    if pd.notna(c_asym) and c_asym >= th_asym:
        tags.append("중앙비대칭")
    if pd.notna(diag) and diag >= th_diag:
        tags.append("사선")

    # 추천 문구(스캐폴드용 최소)
    reco = []
    if "X" in tags:
        reco.append("X 보정(절연/조립기)")
    if "Y" in tags:
        reco.append("Y 보정(카본/슬리터/조립기)")
    if "타발홀" in tags:
        reco.append("타발홀 확인")
    return ",".join(tags), "; ".join(reco), punch_w

def sheet_status(worst_x, worst_y, c_asym, diag, punch_w, th):
    ng_x = _th(th, "ng_x", default=0.15)
    ng_y = _th(th, "ng_y", default=0.15)

    tag_x = _th(th, "tag_x", "x_tag", default=0.10)
    tag_y = _th(th, "tag_y", "y_tag", default=0.10)
    tag_p = _th(th, "tag_punch", "punch", default=0.10)
    th_asym = _th(th, "th_asym", "casym", default=0.10)
    th_diag = _th(th, "th_diag", "diag", default=0.10)

    if (pd.notna(worst_x) and worst_x >= ng_x) or (pd.notna(worst_y) and worst_y >= ng_y):
        return "MUST"

    conds = []
    if pd.notna(worst_x):
        conds.append(worst_x >= tag_x)
    if pd.notna(worst_y):
        conds.append(worst_y >= tag_y)
    if pd.notna(c_asym):
        conds.append(c_asym >= th_asym)
    if pd.notna(diag):
        conds.append(diag >= th_diag)
    if pd.notna(punch_w):
        conds.append(punch_w >= tag_p)

    return "CHECK" if any(conds) else "OK"


def quality_score_xy(worst_x, worst_y, sheet_status_or_th=None, th=None):
    """
    0~100 (높을수록 안전)
    - MUST는 0점 고정
    """
    # 호출 호환
    if isinstance(sheet_status_or_th, dict) and th is None:
        th = sheet_status_or_th
        st = None
    else:
        st = sheet_status_or_th
    th = th or {}

    ng_x = _th(th, "ng_x", default=0.15)
    ng_y = _th(th, "ng_y", default=0.15)

    if st == "MUST":
        return 0.0

    # worst를 ng 대비 비율로
    wx = float(worst_x) if pd.notna(worst_x) else 0.0
    wy = float(worst_y) if pd.notna(worst_y) else 0.0
    rx = min(abs(wx) / ng_x, 1.5) if ng_x > 0 else 0.0
    ry = min(abs(wy) / ng_y, 1.5) if ng_y > 0 else 0.0

    risk = max(rx, ry)  # 0~1.5
    # 안전 점수: risk=0 => 100, risk=1 => 40, risk>1 => 0 근처
    score = 100.0 - 60.0 * min(risk, 1.0) - 40.0 * max(0.0, risk - 1.0)
    if st == "CHECK":
        score = min(score, 79.9)
    return float(np.clip(score, 0.0, 100.0))


# -----------------------------------------------------------------------------
# Step1 Detail: Diagnosis / Problem Rows / Mini Strip Card (React용 스키마)
# - 계산(원본정밀도)은 그대로, 표시는 프론트에서 소수점 2자리로 처리
# - 방향 텍스트는 설비 매핑 기준: X(+) 우측, X(-) 좌측 / Y(+) 상측, Y(-) 하측
# - Mini Strip Card(B안) 기준 스펙(고정):
#   * 스케일: 항상 ±ng 기준 (넘으면 clip + overflow flag)
#   * deadband: 기본 0.02 (settings 주입 가능)
#   * tilt/bow 감지 임계: 기본 0.03 (settings 주입 가능)
# -----------------------------------------------------------------------------

# =============================================================================
# [STEP2] 공정마진 — 프린팅/슬리터 CSV 파싱 & 마진 계산
# =============================================================================

# 숫자 추출 정규식
_NUM_RE = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")

# 4포인트 → Row1/Row12 매핑 후보 (3가지)
ROW_POINTS_CANDIDATES = {
    "A(1,3→Row1 / 2,4→Row12)": {1: (1, 3), 12: (2, 4)},
    "B(1,2→Row1 / 3,4→Row12)": {1: (1, 2), 12: (3, 4)},
    "C(1,4→Row1 / 2,3→Row12)": {1: (1, 4), 12: (2, 3)},
}

# 슬리터 위치 정규화
_SLIT_POS_MAP = {"좌": "좌", "좌측": "좌", "중": "중", "중앙": "중", "우": "우", "우측": "우"}

# 공정마진 임계값 (기본)
LIMIT_PRINT = 0.15     # 프린팅: ±0.15mm
WATCH_PRINT = 0.12     # 프린팅 관찰 경계
LIMIT_SLIT  = 0.15     # 슬리터: ±0.15mm
WATCH_SLIT  = 0.12     # 슬리터 관찰 경계
TH_DIR      = 0.02     # 쏠림 방향 판정 임계

# 원단 (Fabric) 임계값
DEADBAND_FABRIC = 0.01   # mm (이 이내 = "변화없음")
WARN_FABRIC     = 0.05   # mm (경계)
DANGER_FABRIC   = 0.07   # mm (원단 이상)

# 스텐실 (Stencil) 임계값
LAYER_WATCH     = 0.12   # 레이어간 차이 관찰
LAYER_STOP      = 0.15   # 레이어간 차이 교체/폐기
ASYM_WATCH      = 0.10   # 비대칭 관찰
ASYM_STRONG     = 0.12   # 비대칭 강관찰

# 슬리터 전체폭 균일성 임계값
TOTAL_WARN_RANGE = 0.05
TOTAL_BAD_RANGE  = 0.07
TOTAL_WARN_STD   = 0.02
TOTAL_BAD_STD    = 0.03

# 방향 목록 (원단/스텐실 분석용)
_SIDES = ["좌측", "우측", "상측", "하측"]


def _parse_numbers(s: str) -> List[float]:
    """문자열에서 모든 숫자를 추출."""
    return [float(x) for x in _NUM_RE.findall(s)] if s else []


def _read_text_auto(file_bytes: bytes) -> str:
    """바이트 → 텍스트 (여러 인코딩 시도)."""
    for enc in ("utf-16", "utf-16-le", "utf-16-be", "utf-8-sig", "cp949", "utf-8"):
        try:
            return file_bytes.decode(enc)
        except Exception:
            continue
    return file_bytes.decode("utf-8", errors="replace")


def _iter_rows_tabular(txt: str):
    """텍스트에서 (item, cols) 쌍을 생성 — :BEGIN/:END 무시."""
    for line in txt.splitlines():
        s = line.strip().strip("\ufeff").strip('"')
        if not s or s in (":BEGIN", ":END"):
            continue
        parts = [p.strip().strip('"') for p in re.split(r"\t+", s) if p.strip() != ""]
        if len(parts) >= 2 and (":" in parts[0] or "：" in parts[0]):
            yield parts[0], parts[1:]
            continue
        if ":" in s:
            k, v = s.split(":", 1)
            yield k.strip(), [v.strip()]
        elif "：" in s:
            k, v = s.split("：", 1)
            yield k.strip(), [v.strip()]


def parse_tabular_like(file_bytes: bytes) -> pd.DataFrame:
    """프린팅/슬리터 CSV → [item, actual, target, tol1, tol2, calc] DataFrame."""
    txt = _read_text_auto(file_bytes)
    rows = []
    for item, cols in _iter_rows_tabular(txt):
        if len(cols) == 1:
            nums = _parse_numbers(str(cols[0]))
        else:
            nums = [_to_f(c) for c in cols]

        actual = nums[0] if len(nums) > 0 else np.nan
        target = nums[1] if len(nums) > 1 else np.nan
        tol1   = nums[2] if len(nums) > 2 else np.nan
        tol2   = nums[3] if len(nums) > 3 else np.nan

        if len(nums) > 4:
            calc = nums[4]
        else:
            if str(item).startswith("계산기") and len(nums) == 1 and pd.notna(actual):
                calc = float(actual)
            else:
                calc = (actual - target) if (pd.notna(actual) and pd.notna(target)) else np.nan

        # 계산기 항목: calc가 0/NaN이면 actual 사용
        if str(item).startswith("계산기") and pd.notna(actual):
            if pd.isna(calc) or abs(float(calc)) < 1e-12:
                calc = float(actual)

        rows.append([item, actual, target, tol1, tol2, calc])

    return pd.DataFrame(rows, columns=["item", "actual", "target", "tol1", "tol2", "calc"])


def extract_printing_calc(df_long: pd.DataFrame) -> Dict[Tuple, float]:
    """(ref, layer, axis, point) → e(mm) 추출.

    item 패턴: '계산기 타발기준_카본좌우_1: ...'
    """
    out: Dict[Tuple, float] = {}
    for _, r in df_long.iterrows():
        item = str(r.get("item", ""))
        m = re.match(r"^계산기\s+(.+?)_(.+?)_(\d+)\s*[：:]", item)
        if not m:
            continue

        ref = m.group(1).strip()
        layerdir = m.group(2).strip()
        pt = int(m.group(3))

        m2 = re.match(r"^(카본|절연)(좌우|상하)$", layerdir)
        if not m2:
            continue

        layer = m2.group(1)
        axis = "X" if m2.group(2) == "좌우" else "Y"

        calc_f = _to_f(r.get("calc"))
        actual_f = _to_f(r.get("actual"))
        target_f = _to_f(r.get("target"))

        val = calc_f
        if (pd.isna(val) or abs(val) <= 1e-12) and pd.notna(actual_f):
            if pd.isna(target_f) or abs(target_f - actual_f) <= 1e-12:
                val = actual_f
        if (pd.isna(val) or abs(val) <= 1e-12) and pd.notna(target_f):
            val = target_f

        out[(ref, layer, axis, pt)] = val
    return out


def _worst_of_points(points: Tuple[int, ...], pvals: Dict[int, float]) -> float:
    """주어진 포인트들 중 |값| 최대를 반환."""
    cand = [pvals[p] for p in points if (p in pvals) and pd.notna(pvals[p])]
    if not cand:
        return np.nan
    return float(cand[int(np.argmax([abs(x) for x in cand]))])


def _pick_row_points(calc_map: Dict[Tuple, float], layer: str,
                     ref: str = "타발기준") -> Tuple[str, Dict[int, Tuple]]:
    """4포인트 → Row1/Row12 매핑 자동 선택 (가장 보수적인 후보)."""
    best_name = list(ROW_POINTS_CANDIDATES.keys())[0]
    best_map = ROW_POINTS_CANDIDATES[best_name]
    best_score = -1.0

    pX = {p: calc_map.get((ref, layer, "X", p), np.nan) for p in (1, 2, 3, 4)}
    pY = {p: calc_map.get((ref, layer, "Y", p), np.nan) for p in (1, 2, 3, 4)}

    for name, mp in ROW_POINTS_CANDIDATES.items():
        e1x = _worst_of_points(mp[1], pX)
        e12x = _worst_of_points(mp[12], pX)
        e1y = _worst_of_points(mp[1], pY)
        e12y = _worst_of_points(mp[12], pY)

        vals = [e1x, e12x, e1y, e12y]
        vals = [abs(float(v)) for v in vals if pd.notna(v)]
        score = max(vals) if vals else -1.0

        if score > best_score:
            best_score = score
            best_name = name
            best_map = mp

    return best_name, best_map


def _interp_row12(v1: float, v12: float) -> Dict[int, float]:
    """Row1~Row12 선형 보간."""
    out = {}
    for r in range(1, 13):
        if pd.isna(v1) or pd.isna(v12):
            out[r] = np.nan
        else:
            t = (r - 1) / 11.0
            out[r] = float(v1 + t * (v12 - v1))
    return out


def _tilt_dir_x(v: float, th: float) -> str:
    if pd.isna(v):
        return "-"
    if abs(float(v)) < float(th):
        return "정위치"
    return "좌측쏠림" if float(v) < 0 else "우측쏠림"


def _tilt_dir_y(v: float, th: float) -> str:
    if pd.isna(v):
        return "-"
    if abs(float(v)) < float(th):
        return "정위치"
    return "상측쏠림" if float(v) > 0 else "하측쏠림"


def _judge_abs(v: float, watch: float, limit: float) -> str:
    if pd.isna(v):
        return "데이터없음"
    av = abs(float(v))
    if av >= float(limit):
        return "조정 비권장"
    if av >= float(watch):
        return "관찰"
    return "양호"


def compute_printing_layer(calc_map: Dict[Tuple, float], layer: str,
                           limit: float = LIMIT_PRINT, watch: float = WATCH_PRINT,
                           th_dir: float = TH_DIR, row_points=None,
                           ref: str = "타발기준") -> List[Dict]:
    """프린팅 레이어(카본/절연)의 12행 마진 계산."""
    if row_points is None:
        _, row_points = _pick_row_points(calc_map, layer=layer, ref=ref)

    pX = {p: calc_map.get((ref, layer, "X", p), np.nan) for p in (1, 2, 3, 4)}
    pY = {p: calc_map.get((ref, layer, "Y", p), np.nan) for p in (1, 2, 3, 4)}
    e1x = _worst_of_points(row_points[1], pX)
    e12x = _worst_of_points(row_points[12], pX)
    e1y = _worst_of_points(row_points[1], pY)
    e12y = _worst_of_points(row_points[12], pY)

    X = _interp_row12(e1x, e12x)
    Y = _interp_row12(e1y, e12y)

    rows = []
    judge_order = {"데이터없음": 0, "양호": 1, "관찰": 2, "조정 비권장": 3}
    for r in range(1, 13):
        ex, ey = X[r], Y[r]
        x_move = (float(limit) - abs(float(ex))) if pd.notna(ex) else np.nan
        y_move = (float(limit) - abs(float(ey))) if pd.notna(ey) else np.nan
        x_move = max(0.0, x_move) if pd.notna(x_move) else np.nan
        y_move = max(0.0, y_move) if pd.notna(y_move) else np.nan

        jx = _judge_abs(ex, watch, limit)
        jy = _judge_abs(ey, watch, limit)
        judgment = max([jx, jy], key=lambda s: judge_order.get(s, 0))

        rows.append({
            "Row": r,
            "X쏠림방향": _tilt_dir_x(ex, th_dir),
            "X쏠림(mm)": round(float(ex), 4) if pd.notna(ex) else None,
            "X이동가능(mm)": round(float(x_move), 4) if pd.notna(x_move) else None,
            "X잔여율(%)": round(float(x_move / limit * 100.0), 1) if pd.notna(x_move) else None,
            "Y쏠림방향": _tilt_dir_y(ey, th_dir),
            "Y쏠림(mm)": round(float(ey), 4) if pd.notna(ey) else None,
            "Y이동가능(mm)": round(float(y_move), 4) if pd.notna(y_move) else None,
            "Y잔여율(%)": round(float(y_move / limit * 100.0), 1) if pd.notna(y_move) else None,
            "판정": judgment,
        })
    return rows


def extract_slitter_items(df_long: pd.DataFrame) -> pd.DataFrame:
    """슬리터 CSV에서 거리 항목 추출."""
    out = []
    for _, r in df_long.iterrows():
        item = str(r.get("item", ""))
        m = re.match(
            r"^거리\s+(전체폭|타발폭)_(좌측|우측|중앙|좌|우|중)_(\d+)\s*[：:]\s*거리\s*(X|Y)",
            item,
        )
        if not m:
            continue
        kind = m.group(1)
        pos_raw = m.group(2)
        row = int(m.group(3))
        axis = m.group(4)
        pos = _SLIT_POS_MAP.get(pos_raw, pos_raw)
        out.append([kind, pos, row, axis, r.get("actual", np.nan), r.get("target", np.nan), r.get("calc", np.nan)])
    return pd.DataFrame(out, columns=["kind", "pos", "Row", "axis", "actual", "target", "dev"])


def _interp_general(rows_arr, vals_arr, all_rows):
    """일반 선형 보간 (numpy)."""
    rows_a = np.asarray(rows_arr, dtype=float)
    vals_a = np.asarray(vals_arr, dtype=float)
    all_r = np.asarray(all_rows, dtype=float)
    mask = np.isfinite(rows_a) & np.isfinite(vals_a)
    rows_a = rows_a[mask]
    vals_a = vals_a[mask]
    if len(rows_a) == 0:
        return np.full_like(all_r, np.nan, dtype=float)
    if len(rows_a) == 1:
        return np.full_like(all_r, float(vals_a[0]), dtype=float)
    order = np.argsort(rows_a)
    rows_a = rows_a[order]
    vals_a = vals_a[order]
    return np.interp(all_r, rows_a, vals_a)


def compute_slitter_punch(df_items: pd.DataFrame,
                          limit: float = LIMIT_SLIT, watch: float = WATCH_SLIT,
                          th_dir: float = TH_DIR) -> List[Dict]:
    """슬리터 타발폭 Y축 12행 마진 계산."""
    sub = df_items[(df_items["kind"] == "타발폭") & (df_items["axis"] == "Y")].copy()
    if sub.empty:
        return []

    all_rows = np.arange(1, 13, dtype=float)
    pos_series = {}
    for pos in ["좌", "중", "우"]:
        s = sub[sub["pos"] == pos].groupby("Row")["dev"].apply(
            lambda x: float(x.iloc[0]) if len(x) else np.nan
        )
        pos_series[pos] = _interp_general(
            np.array(s.index, dtype=float),
            np.array(s.values, dtype=float),
            all_rows,
        )

    out = []
    for i, r in enumerate(range(1, 13)):
        vals = {pos: pos_series[pos][i] for pos in ["좌", "중", "우"] if pos in pos_series}
        if any(pd.notna(v) for v in vals.values()):
            best_pos = max(vals.keys(), key=lambda k: abs(vals[k]) if pd.notna(vals[k]) else -1)
            best_v = float(vals[best_pos])
        else:
            best_pos = "-"
            best_v = np.nan
        move = (limit - abs(best_v)) if pd.notna(best_v) else np.nan
        move = max(0.0, float(move)) if pd.notna(move) else np.nan
        rate = (move / limit * 100.0) if pd.notna(move) else np.nan

        out.append({
            "Row": r,
            "쏠림방향": _tilt_dir_y(best_v, th_dir),
            "Y쏠림(mm)": round(float(best_v), 4) if pd.notna(best_v) else None,
            "이동가능(mm)": round(float(move), 4) if pd.notna(move) else None,
            "잔여율(%)": round(float(rate), 1) if pd.notna(rate) else None,
            "판정": _judge_abs(best_v, watch, limit),
            "Pos(worst)": best_pos,
        })
    return out


# =============================================================================
# [STEP2-B] 공정마진 — 원단 / 스텐실 / 간섭 / 전체폭 분석
# =============================================================================

def _deadband_dir(v: float, deadband: float) -> str:
    """편차 → 방향해석 (변화없음 / 늘어남 / 줄어듦)."""
    if pd.isna(v):
        return "-"
    if abs(float(v)) < float(deadband):
        return "변화없음"
    return "늘어남" if float(v) > 0 else "줄어듦"


def _judge_abs3(av: float, warn: float, danger: float, danger_label: str = "이상") -> str:
    """3단계 판정 (양호 / 경계 / danger_label)."""
    if pd.isna(av):
        return "데이터없음"
    av = float(av)
    if av >= float(danger):
        return danger_label
    if av >= float(warn):
        return "경계"
    return "양호"


# ─── 거리 항목 추출 (원단·스텐실 공용) ───

def extract_distances(df_long: pd.DataFrame) -> pd.DataFrame:
    """
    parse_tabular_like() 결과에서 '거리 (타발|카본|절연)_{방향}_{번호}' 항목 추출.
    출력 columns: [group, side, axis, point, actual, target, dev]
    """
    out = []
    for _, r in df_long.iterrows():
        item = str(r["item"])
        m = re.match(
            r"^거리\s+(타발|카본|절연)_(좌측|우측|상측|하측)_(\d+)\s*[：:]\s*거리\s*(X|Y)",
            item,
        )
        if not m:
            continue
        group, side, pt, axis = m.group(1), m.group(2), int(m.group(3)), m.group(4)
        out.append([group, side, axis, pt, r["actual"], r["target"], r["calc"]])
    return pd.DataFrame(out, columns=["group", "side", "axis", "point", "actual", "target", "dev"])


# ─── (1) 원단 분석 ───

def compute_fabric(
    dist_df: pd.DataFrame,
    deadband: float = DEADBAND_FABRIC,
    warn: float = WARN_FABRIC,
    danger: float = DANGER_FABRIC,
) -> list:
    """
    원단(타발 기준) 편차 분석.
    출력: list of dict [방향, 축, 기준값(mm), 측정값(mm), 편차(mm), 방향해석, |편차|(mm), 판정]
    """
    df = dist_df[dist_df["group"] == "타발"].copy()
    if df.empty:
        return []

    df["기준값(mm)"] = pd.to_numeric(df["target"], errors="coerce")
    df["측정값(mm)"] = pd.to_numeric(df["actual"], errors="coerce")
    dev = pd.to_numeric(df["dev"], errors="coerce")
    df["편차(mm)"] = np.where(dev.notna(), dev, df["측정값(mm)"] - df["기준값(mm)"])
    df["방향해석"] = df["편차(mm)"].apply(lambda v: _deadband_dir(v, deadband))
    df["|편차|(mm)"] = df["편차(mm)"].abs()
    df["판정"] = df["|편차|(mm)"].apply(lambda av: _judge_abs3(av, warn, danger, danger_label="원단 이상"))

    rows = []
    for _, r in df.iterrows():
        rows.append({
            "방향": r["side"],
            "축": r["axis"],
            "기준값(mm)": round(float(r["기준값(mm)"]), 4) if pd.notna(r["기준값(mm)"]) else None,
            "측정값(mm)": round(float(r["측정값(mm)"]), 4) if pd.notna(r["측정값(mm)"]) else None,
            "편차(mm)": round(float(r["편차(mm)"]), 4) if pd.notna(r["편차(mm)"]) else None,
            "방향해석": r["방향해석"],
            "|편차|(mm)": round(float(r["|편차|(mm)"]), 4) if pd.notna(r["|편차|(mm)"]) else None,
            "판정": r["판정"],
        })
    return rows


# ─── (2) 스텐실 분석 ───

def compute_stencil(
    dist_df: pd.DataFrame,
    layer_watch: float = LAYER_WATCH,
    layer_stop: float = LAYER_STOP,
    asym_watch: float = ASYM_WATCH,
    asym_strong: float = ASYM_STRONG,
) -> Tuple[list, list]:
    """
    스텐실 분석: 레이어간 차이 + 비대칭.
    반환: (detail_rows, summary_rows)
    """

    def _pick(group: str, side: str):
        sub = dist_df[(dist_df["group"] == group) & (dist_df["side"] == side)]
        if sub.empty:
            return (np.nan, np.nan, np.nan)
        r = sub.iloc[0]
        return (
            float(r["target"]) if pd.notna(r["target"]) else np.nan,
            float(r["actual"]) if pd.notna(r["actual"]) else np.nan,
            float(r["dev"]) if pd.notna(r["dev"]) else np.nan,
        )

    # Part A: 방향별 레이어간 차이
    detail_rows = []
    carbon_devs = {}  # side → dev
    insul_devs = {}

    for side in _SIDES:
        c_t, c_a, c_d = _pick("카본", side)
        i_t, i_a, i_d = _pick("절연", side)
        carbon_devs[side] = c_d
        insul_devs[side] = i_d

        layer_diff = abs(i_d - c_d) if (pd.notna(i_d) and pd.notna(c_d)) else np.nan
        if pd.isna(layer_diff):
            j = "데이터없음"
        elif layer_diff >= layer_stop:
            j = "교체/폐기 권장"
        elif layer_diff >= layer_watch:
            j = "관찰"
        else:
            j = "양호"

        detail_rows.append({
            "방향": side,
            "카본 편차(mm)": round(float(c_d), 4) if pd.notna(c_d) else None,
            "절연 편차(mm)": round(float(i_d), 4) if pd.notna(i_d) else None,
            "레이어간 차이(mm)": round(float(layer_diff), 4) if pd.notna(layer_diff) else None,
            "판정": j,
        })

    # Part B: 비대칭
    def _safe_abs_diff(a, b):
        if pd.notna(a) and pd.notna(b):
            return abs(a - b)
        return np.nan

    c_lr = _safe_abs_diff(carbon_devs.get("좌측", np.nan), carbon_devs.get("우측", np.nan))
    c_tb = _safe_abs_diff(carbon_devs.get("상측", np.nan), carbon_devs.get("하측", np.nan))
    i_lr = _safe_abs_diff(insul_devs.get("좌측", np.nan), insul_devs.get("우측", np.nan))
    i_tb = _safe_abs_diff(insul_devs.get("상측", np.nan), insul_devs.get("하측", np.nan))

    def _asym_judge(v):
        if pd.isna(v):
            return "데이터없음"
        if v >= asym_strong:
            return "강관찰"
        if v >= asym_watch:
            return "관찰"
        return "양호"

    summary_rows = [
        {"지표": "카본 비대칭", "구분": "좌우", "값(mm)": round(float(c_lr), 4) if pd.notna(c_lr) else None, "판정": _asym_judge(c_lr)},
        {"지표": "카본 비대칭", "구분": "상하", "값(mm)": round(float(c_tb), 4) if pd.notna(c_tb) else None, "판정": _asym_judge(c_tb)},
        {"지표": "절연 비대칭", "구분": "좌우", "값(mm)": round(float(i_lr), 4) if pd.notna(i_lr) else None, "판정": _asym_judge(i_lr)},
        {"지표": "절연 비대칭", "구분": "상하", "값(mm)": round(float(i_tb), 4) if pd.notna(i_tb) else None, "판정": _asym_judge(i_tb)},
    ]

    return detail_rows, summary_rows


# ─── (5b) 슬리터 전체폭 균일성 ───

def compute_slitter_total(
    df_items: pd.DataFrame,
    warn_range: float = TOTAL_WARN_RANGE,
    bad_range: float = TOTAL_BAD_RANGE,
    warn_std: float = TOTAL_WARN_STD,
    bad_std: float = TOTAL_BAD_STD,
) -> list:
    """
    슬리터 전체폭 균일성: Row별 좌/중/우 편차의 Range, Std.
    출력: list of dict [Row, 좌(dev), 중(dev), 우(dev), Range(mm), Std(mm), 판정]
    """
    sub = df_items[(df_items["kind"] == "전체폭") & (df_items["axis"] == "Y")].copy()
    if sub.empty:
        return []

    all_rows = np.arange(1, 13, dtype=float)
    pos_series = {}
    for pos in ["좌", "중", "우"]:
        s = sub[sub["pos"] == pos].groupby("Row")["dev"].apply(
            lambda x: float(x.iloc[0]) if len(x) else np.nan
        )
        pos_series[pos] = _interp_general(
            np.array(s.index, dtype=float),
            np.array(s.values, dtype=float),
            all_rows,
        )

    out = []
    for i, r in enumerate(range(1, 13)):
        vL = pos_series["좌"][i]
        vC = pos_series["중"][i]
        vR = pos_series["우"][i]
        vals = np.array([vL, vC, vR], dtype=float)
        finite = vals[np.isfinite(vals)]
        if len(finite) == 0:
            rng, sd, j = np.nan, np.nan, "데이터없음"
        else:
            rng = float(np.max(finite) - np.min(finite))
            sd = float(np.std(finite))
            jr = _judge_abs3(rng, warn_range, bad_range, danger_label="이상")
            js = _judge_abs3(sd, warn_std, bad_std, danger_label="이상")
            rank = {"데이터없음": 0, "양호": 1, "경계": 2, "이상": 3}
            j = jr if rank.get(jr, 0) >= rank.get(js, 0) else js

        out.append({
            "Row": r,
            "좌(dev)": round(float(vL), 4) if pd.notna(vL) else None,
            "중(dev)": round(float(vC), 4) if pd.notna(vC) else None,
            "우(dev)": round(float(vR), 4) if pd.notna(vR) else None,
            "Range(mm)": round(float(rng), 4) if pd.notna(rng) else None,
            "Std(mm)": round(float(sd), 4) if pd.notna(sd) else None,
            "판정": j,
        })
    return out


# =============================================================================
# [STEP1 ORIGINAL] 방향 텍스트/진단 함수
# =============================================================================

def direction_label(axis: str, value: float, deadband: float) -> str:
    """부호 → 방향 텍스트(현장용). deadband 이내면 '중심'."""
    if value is None or pd.isna(value):
        return "-"
    if abs(float(value)) <= float(deadband):
        return "중심"
    if axis.upper() == "X":
        return "우측쏠림" if float(value) > 0 else "좌측쏠림"
    if axis.upper() == "Y":
        return "상측쏠림" if float(value) > 0 else "하측쏠림"
    return "-"


def _argmax_abs(df: pd.DataFrame, cols: List[str]) -> Optional[Dict]:
    """주어진 컬럼들에서 |값| 최대의 (rowId, side, value)를 찾는다."""
    best = None
    for c in cols:
        if c not in df.columns:
            continue
        s = pd.to_numeric(df[c], errors="coerce")
        if not s.notna().any():
            continue
        idx = s.abs().idxmax()
        v = float(s.loc[idx])
        row_id = df.loc[idx, "Row"] if "Row" in df.columns else None
        cand = (abs(v), c, v, row_id)
        if best is None or cand[0] > best[0]:
            best = cand
    if best is None:
        return None
    _abs, col, val, row_id = best
    # side 파싱
    side = "C" if col.endswith("C") else ("L" if col.endswith("L") else ("R" if col.endswith("R") else "-"))
    return {"rowId": int(row_id) if pd.notna(row_id) else None, "side": side, "value": float(val), "col": col}


def _row_severity_and_rep(df: pd.DataFrame) -> pd.DataFrame:
    """Row별 severity(max(|X|,|Y|))와 대표 축/면/값을 생성."""
    out = df.copy()
    # numeric
    for c in [
        "조립치우침L","조립치우침R",
        "상하치우침L","상하치우침C","상하치우침R",
        "타발홀L","타발홀R",
    ]:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors="coerce")

    out["sev_x"] = out[[c for c in ["조립치우침L","조립치우침R"] if c in out.columns]].abs().max(axis=1)
    out["sev_y"] = out[[c for c in ["상하치우침L","상하치우침C","상하치우침R"] if c in out.columns]].abs().max(axis=1)
    out["severity"] = pd.concat([out["sev_x"], out["sev_y"]], axis=1).max(axis=1)

    # 대표 축 선택: sev_x > sev_y => X, else Y (동률이면 Y)
    rep_axis = np.where(out["sev_x"] > out["sev_y"], "X", "Y")
    out["rep_axis"] = rep_axis

    # 대표 side/value
    def _pick_rep(row: pd.Series):
        if row.get("rep_axis") == "X":
            a = row.get("조립치우침L")
            b = row.get("조립치우침R")
            if pd.isna(a) and pd.isna(b):
                return pd.Series({"rep_side": "-", "rep_value": np.nan})
            if pd.isna(a):
                return pd.Series({"rep_side": "R", "rep_value": float(b)})
            if pd.isna(b):
                return pd.Series({"rep_side": "L", "rep_value": float(a)})
            return pd.Series({"rep_side": "L" if abs(float(a)) >= abs(float(b)) else "R", "rep_value": float(a) if abs(float(a)) >= abs(float(b)) else float(b)})
        # Y
        cand = {
            "L": row.get("상하치우침L"),
            "C": row.get("상하치우침C"),
            "R": row.get("상하치우침R"),
        }
        cand = {k: v for k, v in cand.items() if v is not None and pd.notna(v)}
        if not cand:
            return pd.Series({"rep_side": "-", "rep_value": np.nan})
        k = max(cand.keys(), key=lambda kk: abs(float(cand[kk])))
        return pd.Series({"rep_side": k, "rep_value": float(cand[k])})

    rep = out.apply(_pick_rep, axis=1)
    out["rep_side"] = rep["rep_side"]
    out["rep_value"] = rep["rep_value"]
    return out


def build_step1_detail_summary(
    row_df: pd.DataFrame,
    th: Dict[str, float] | None = None,
    *,
    deadband_x: float = 0.02,
    deadband_y: float = 0.02,
    tilt_thresh_y: float = 0.03,
    bow_thresh_y: float = 0.03,
) -> Dict:
    """React 디테일(진단/TopN/미니카드)을 위한 요약 스키마 생성."""
    th = th or {}
    ng_x = _th(th, "ng_x", default=0.15)
    ng_y = _th(th, "ng_y", default=0.15)
    check_x = _th(th, "tag_x", "x_tag", default=0.10)
    check_y = _th(th, "tag_y", "y_tag", default=0.10)
    check_p = _th(th, "tag_punch", "punch", default=0.10)
    th_asym = _th(th, "th_asym", "casym", "asym", default=0.10)
    th_diag = _th(th, "th_diag", "diag", default=0.10)

    df = row_df.copy()
    if df.empty:
        return {
            "diagnosis": {"sheetStatus": "-", "summary": "Row 데이터가 없습니다.", "worstX": None, "worstY": None, "tags": []},
            "problemRowsTop5": [],
            "punchTop3": [],
            "mini": {"x": None, "y": None},
        }

    # worstX / worstY
    worst_x = _argmax_abs(df, ["조립치우침L", "조립치우침R"])
    worst_y = _argmax_abs(df, ["상하치우침L", "상하치우침C", "상하치우침R"])

    wx_val = worst_x["value"] if worst_x else np.nan
    wy_val = worst_y["value"] if worst_y else np.nan

    # constraints (시트 단위): Row별 compute_constraints를 최대값으로 집계
    cas, dig = [], []
    for _i, r in df.iterrows():
        c_asym, diag = compute_constraints(r)
        cas.append(c_asym)
        dig.append(diag)
    c_asym_sheet = worst_abs(cas)
    diag_sheet = worst_abs(dig)
    _pL = pd.to_numeric(df["타발홀L"], errors="coerce").dropna().tolist() if "타발홀L" in df.columns else []
    _pR = pd.to_numeric(df["타발홀R"], errors="coerce").dropna().tolist() if "타발홀R" in df.columns else []
    punch_w_sheet = worst_abs(_pL + _pR)

    st_raw = sheet_status(abs(wx_val) if pd.notna(wx_val) else np.nan, abs(wy_val) if pd.notna(wy_val) else np.nan, c_asym_sheet, diag_sheet, punch_w_sheet, th)
    sheet_st = "NG" if st_raw == "MUST" else st_raw

    # tags (구조화)
    tags = []
    if pd.notna(c_asym_sheet) and c_asym_sheet >= th_asym:
        tags.append({"name": "C_ASYM", "value": float(c_asym_sheet), "limit": float(th_asym)})
    if pd.notna(diag_sheet) and diag_sheet >= th_diag:
        tags.append({"name": "diag", "value": float(diag_sheet), "limit": float(th_diag)})

    # X/Y tag
    if pd.notna(wx_val) and abs(float(wx_val)) >= check_x:
        tags.append({"name": "X", "value": float(abs(wx_val)), "limit": float(check_x)})
    if pd.notna(wy_val) and abs(float(wy_val)) >= check_y:
        tags.append({"name": "Y", "value": float(abs(wy_val)), "limit": float(check_y)})

    # punch tag
    pL = pd.to_numeric(df.get("타발홀L"), errors="coerce") if "타발홀L" in df.columns else pd.Series(dtype=float)
    pR = pd.to_numeric(df.get("타발홀R"), errors="coerce") if "타발홀R" in df.columns else pd.Series(dtype=float)
    punch_w = worst_abs(list(pL.dropna().tolist()) + list(pR.dropna().tolist()))
    if pd.notna(punch_w) and punch_w >= check_p:
        tags.append({"name": "Punch", "value": float(punch_w), "limit": float(check_p)})

    # summary sentence (대표 축: worst 중 더 큰 축)
    # NOTE: 표시는 프론트에서 2자리. 여기서는 값/row/side만 제공.
    def _summary():
        # choose representative axis
        ax = "X" if (pd.notna(wx_val) and (pd.isna(wy_val) or abs(wx_val) >= abs(wy_val))) else "Y"
        if sheet_st == "NG":
            if ax == "X" and worst_x:
                return {"axis": "X", "value": float(wx_val), "rowId": worst_x["rowId"], "side": worst_x["side"], "limit": float(ng_x)}
            if worst_y:
                return {"axis": "Y", "value": float(wy_val), "rowId": worst_y["rowId"], "side": worst_y["side"], "limit": float(ng_y)}
        if sheet_st == "CHECK":
            # punch 우선
            if pd.notna(punch_w) and punch_w >= check_p:
                return {"axis": "PUNCH", "value": float(punch_w), "rowId": None, "side": "-", "limit": float(check_p)}
            if ax == "X" and worst_x:
                return {"axis": "X", "value": float(wx_val), "rowId": worst_x["rowId"], "side": worst_x["side"], "limit": float(check_x)}
            if worst_y:
                return {"axis": "Y", "value": float(wy_val), "rowId": worst_y["rowId"], "side": worst_y["side"], "limit": float(check_y)}
        return {"axis": "OK", "value": None, "rowId": None, "side": "-", "limit": None}

    summary = _summary()

    # mini card data (Row-level view uses L/R or L/C/R points)
    def _mini_x():
        if not ("조립치우침L" in df.columns or "조립치우침R" in df.columns):
            return None
        # 대표는 worst row 우선 (타입 불일치 방어: int 비교)
        rid = worst_x["rowId"] if worst_x and worst_x.get("rowId") is not None else int(df["Row"].iloc[0])
        matched = df[pd.to_numeric(df["Row"], errors="coerce") == int(rid)]
        if matched.empty:
            matched = df.head(1)
        rr = matched.iloc[0]
        xL = pd.to_numeric(rr.get("조립치우침L"), errors="coerce")
        xR = pd.to_numeric(rr.get("조립치우침R"), errors="coerce")
        x_center = float((xL + xR) / 2.0) if pd.notna(xL) and pd.notna(xR) else float(xL if pd.notna(xL) else (xR if pd.notna(xR) else np.nan))
        x_skew = float((xR - xL) / 2.0) if pd.notna(xL) and pd.notna(xR) else np.nan
        flags = []
        if pd.notna(x_skew):
            if abs(x_skew) >= float(max(2 * deadband_x, 0.03)):
                flags.append({"type": "SKEW", "text": "R면 더 큼" if x_skew > 0 else "L면 더 큼", "value": float(x_skew), "thresh": float(max(2 * deadband_x, 0.03))})
        pts = []
        for side, v in [("L", xL), ("R", xR)]:
            if pd.notna(v):
                pts.append({"pos": side, "value": float(v)})
        # worst mark
        if pts:
            worst_idx = max(range(len(pts)), key=lambda i: abs(float(pts[i]["value"])))
            for i in range(len(pts)):
                pts[i]["isWorst"] = (i == worst_idx)

        return {
            "axis": "X",
            "ng": float(ng_x),
            "deadband": float(deadband_x),
            "centerValue": float(x_center) if pd.notna(x_center) else None,
            "direction": direction_label("X", x_center, deadband_x),
            "points": pts,
            "flags": flags,
            "rowId": int(rid),
        }

    def _mini_y():
        if not any(c in df.columns for c in ["상하치우침L", "상하치우침C", "상하치우침R"]):
            return None
        rid = worst_y["rowId"] if worst_y and worst_y.get("rowId") is not None else int(df["Row"].iloc[0])
        matched = df[pd.to_numeric(df["Row"], errors="coerce") == int(rid)]
        if matched.empty:
            matched = df.head(1)
        rr = matched.iloc[0]
        yL = pd.to_numeric(rr.get("상하치우침L"), errors="coerce")
        yC = pd.to_numeric(rr.get("상하치우침C"), errors="coerce")
        yR = pd.to_numeric(rr.get("상하치우침R"), errors="coerce")
        vals = [v for v in [yL, yC, yR] if pd.notna(v)]
        y_center = float(np.median(vals)) if vals else np.nan
        y_tilt = float((yR - yL) / 2.0) if pd.notna(yL) and pd.notna(yR) else np.nan
        y_bow = float(yC - (yL + yR) / 2.0) if pd.notna(yC) and pd.notna(yL) and pd.notna(yR) else np.nan
        flags = []
        if pd.notna(y_tilt) and abs(y_tilt) >= float(tilt_thresh_y):
            flags.append({"type": "TILT", "text": "우측이 더 상측" if y_tilt > 0 else "좌측이 더 상측", "value": float(y_tilt), "thresh": float(tilt_thresh_y)})
        if pd.notna(y_bow) and abs(y_bow) >= float(bow_thresh_y):
            flags.append({"type": "BOW", "text": "가운데가 더 상측(뜸)" if y_bow > 0 else "가운데가 더 하측(처짐)", "value": float(y_bow), "thresh": float(bow_thresh_y)})

        pts = []
        for side, v in [("L", yL), ("C", yC), ("R", yR)]:
            if pd.notna(v):
                pts.append({"pos": side, "value": float(v)})
        if pts:
            worst_idx = max(range(len(pts)), key=lambda i: abs(float(pts[i]["value"])))
            for i in range(len(pts)):
                pts[i]["isWorst"] = (i == worst_idx)

        return {
            "axis": "Y",
            "ng": float(ng_y),
            "deadband": float(deadband_y),
            "centerValue": float(y_center) if pd.notna(y_center) else None,
            "direction": direction_label("Y", y_center, deadband_y),
            "points": pts,
            "flags": flags,
            "rowId": int(rid),
        }

    mini_x = _mini_x()
    mini_y = _mini_y()

    # Problem Rows Top5
    tmp = _row_severity_and_rep(df)

    # rowStatus (선택) — 대표값 기준
    def _row_status(row: pd.Series) -> str:
        # NG if any exceed ng
        x_ok = True
        y_ok = True
        if pd.notna(row.get("sev_x")):
            x_ok = float(row.get("sev_x")) < float(ng_x)
        if pd.notna(row.get("sev_y")):
            y_ok = float(row.get("sev_y")) < float(ng_y)
        if not (x_ok and y_ok):
            return "NG"
        # CHECK if exceed check or punch
        if pd.notna(row.get("sev_x")) and float(row.get("sev_x")) >= float(check_x):
            return "CHECK"
        if pd.notna(row.get("sev_y")) and float(row.get("sev_y")) >= float(check_y):
            return "CHECK"
        # punch
        psev = worst_abs([row.get("타발홀L"), row.get("타발홀R")])
        if pd.notna(psev) and float(psev) >= float(check_p):
            return "CHECK"
        return "OK"

    tmp["rowStatus"] = tmp.apply(_row_status, axis=1)
    status_rank = tmp["rowStatus"].map({"NG": 2, "CHECK": 1, "OK": 0}).fillna(0)
    tmp["_sr"] = status_rank
    top5_df = tmp.sort_values(["_sr", "severity", "Row"], ascending=[False, False, True]).head(5)

    top5 = []
    for _, r in top5_df.iterrows():
        axis = r.get("rep_axis")
        side = r.get("rep_side")
        val = r.get("rep_value")
        db = deadband_x if axis == "X" else deadband_y
        dir_txt = direction_label(axis, val, db)
        top5.append({
            "rowId": int(r.get("Row")) if pd.notna(r.get("Row")) else None,
            "axis": axis,
            "side": side,
            "value": float(val) if pd.notna(val) else None,
            "direction": dir_txt,
            "rowStatus": str(r.get("rowStatus")),
            "severity": float(r.get("severity")) if pd.notna(r.get("severity")) else None,
        })

    # Punch Top3
    punch_rows = []
    if "타발홀L" in df.columns or "타발홀R" in df.columns:
        ptmp = df[[c for c in ["Row","타발홀L","타발홀R"] if c in df.columns]].copy()
        ptmp["타발홀L"] = pd.to_numeric(ptmp.get("타발홀L"), errors="coerce") if "타발홀L" in ptmp.columns else np.nan
        ptmp["타발홀R"] = pd.to_numeric(ptmp.get("타발홀R"), errors="coerce") if "타발홀R" in ptmp.columns else np.nan
        ptmp["severity"] = ptmp[[c for c in ["타발홀L","타발홀R"] if c in ptmp.columns]].abs().max(axis=1)
        ptmp = ptmp.sort_values(["severity","Row"], ascending=[False, True]).head(3)
        for _, r in ptmp.iterrows():
            a = r.get("타발홀L")
            b = r.get("타발홀R")
            if pd.isna(a) and pd.isna(b):
                continue
            side = "L" if (pd.notna(a) and (pd.isna(b) or abs(float(a)) >= abs(float(b)))) else "R"
            val = float(a) if side == "L" else float(b)
            punch_rows.append({
                "rowId": int(r.get("Row")) if pd.notna(r.get("Row")) else None,
                "axis": "PUNCH",
                "side": side,
                "value": val,
                "direction": "기준초과" if abs(val) >= check_p else "정상",
                "rowStatus": "CHECK" if abs(val) >= check_p else "OK",
                "severity": float(r.get("severity")) if pd.notna(r.get("severity")) else None,
            })

    # worst objects with direction
    worstX_obj = None
    if worst_x:
        worstX_obj = {
            "value": float(wx_val),
            "rowId": worst_x.get("rowId"),
            "side": worst_x.get("side"),
            "direction": direction_label("X", wx_val, deadband_x),
            "ng": float(ng_x),
            "check": float(check_x),
        }
    worstY_obj = None
    if worst_y:
        worstY_obj = {
            "value": float(wy_val),
            "rowId": worst_y.get("rowId"),
            "side": worst_y.get("side"),
            "direction": direction_label("Y", wy_val, deadband_y),
            "ng": float(ng_y),
            "check": float(check_y),
        }

    return {
        "diagnosis": {
            "sheetStatus": sheet_st,
            "summary": summary,
            "worstX": worstX_obj,
            "worstY": worstY_obj,
            "C_ASYM": float(c_asym_sheet) if pd.notna(c_asym_sheet) else None,
            "diag": float(diag_sheet) if pd.notna(diag_sheet) else None,
            "tags": tags,
        },
        "problemRowsTop5": top5,
        "punchTop3": punch_rows,
        "mini": {"x": mini_x, "y": mini_y},
    }


# =============================================================================
# [STEP3] 보정 시뮬레이션 — 장비 오프셋 적용 및 추천값 산출
# =============================================================================

def _metrics_from_df(df: pd.DataFrame, th=None):
    """row_df → (worstX, worstY, punchW, cAsym, diag, status, score, rows_list)"""
    wx = worst_abs(df["조립치우침L"].tolist() + df["조립치우침R"].tolist())
    wy = worst_abs(df["상하치우침L"].tolist() + df["상하치우침C"].tolist() + df["상하치우침R"].tolist())
    pw = worst_abs(df["타발홀L"].tolist() + df["타발홀R"].tolist())

    c_asym_max = 0.0
    diag_max = 0.0
    for _, r in df.iterrows():
        ca, dg = compute_constraints(r)
        if pd.notna(ca):
            c_asym_max = max(c_asym_max, ca)
        if pd.notna(dg):
            diag_max = max(diag_max, dg)

    st = sheet_status(wx, wy, c_asym_max, diag_max, pw, th)
    st_for_score = "MUST" if st == "NG" else st
    score = quality_score_xy(
        wx if pd.notna(wx) else 0.0,
        wy if pd.notna(wy) else 0.0,
        st_for_score, th=th,
    )

    rows_out = []
    for _, r in df.iterrows():
        row_dict = {}
        for c in df.columns:
            v = r[c]
            row_dict[c] = round(float(v), 4) if pd.notna(v) and isinstance(v, (int, float, np.floating, np.integer)) else v
        rows_out.append(row_dict)

    return {
        "worstX": round(float(wx), 4) if pd.notna(wx) else None,
        "worstY": round(float(wy), 4) if pd.notna(wy) else None,
        "score": round(float(score), 1),
        "status": st,
        "rows": rows_out,
    }


def simulate_adjustment(
    row_df: pd.DataFrame,
    offsets: Dict[str, object],
    th: Dict[str, float] | None = None,
) -> Dict:
    """
    장비 오프셋을 적용하여 Before/After 비교 결과를 반환한다.

    Parameters
    ----------
    row_df : 원본 12행 DataFrame
    offsets : {"printing_x", "printing_y", "slitter_y"[12], "assembly_x"[12], "assembly_y"[12]}
    th : 임계값 오버라이드

    Returns
    -------
    {"before": {...}, "after": {...}, "perRow": [...]}
    """
    px = float(offsets.get("printing_x", 0.0) or 0.0)
    py = float(offsets.get("printing_y", 0.0) or 0.0)
    sy = list(offsets.get("slitter_y") or [])
    ax = list(offsets.get("assembly_x") or [])
    ay = list(offsets.get("assembly_y") or [])
    # 12개로 패딩
    while len(sy) < 12:
        sy.append(0.0)
    while len(ax) < 12:
        ax.append(0.0)
    while len(ay) < 12:
        ay.append(0.0)

    before = _metrics_from_df(row_df, th)

    adj = row_df.copy()
    for i in range(len(adj)):
        idx = i if i < 12 else 11
        adj.iloc[i, adj.columns.get_loc("조립치우침L")] = (
            _safe_sub(row_df.iloc[i]["조립치우침L"], px + ax[idx])
        )
        adj.iloc[i, adj.columns.get_loc("조립치우침R")] = (
            _safe_sub(row_df.iloc[i]["조립치우침R"], px + ax[idx])
        )
        adj.iloc[i, adj.columns.get_loc("상하치우침L")] = (
            _safe_sub(row_df.iloc[i]["상하치우침L"], py + sy[idx] + ay[idx])
        )
        adj.iloc[i, adj.columns.get_loc("상하치우침C")] = (
            _safe_sub(row_df.iloc[i]["상하치우침C"], py + sy[idx] + ay[idx])
        )
        adj.iloc[i, adj.columns.get_loc("상하치우침R")] = (
            _safe_sub(row_df.iloc[i]["상하치우침R"], py + sy[idx] + ay[idx])
        )

    after = _metrics_from_df(adj, th)

    # perRow 비교
    per_row = []
    for i in range(len(row_df)):
        r_orig = row_df.iloc[i]
        r_adj = adj.iloc[i]
        row_num = int(r_orig.get("Row", i + 1))
        bx = worst_abs([r_orig.get("조립치우침L"), r_orig.get("조립치우침R")])
        by = worst_abs([r_orig.get("상하치우침L"), r_orig.get("상하치우침C"), r_orig.get("상하치우침R")])
        ax_ = worst_abs([r_adj.get("조립치우침L"), r_adj.get("조립치우침R")])
        ay_ = worst_abs([r_adj.get("상하치우침L"), r_adj.get("상하치우침C"), r_adj.get("상하치우침R")])
        per_row.append({
            "row": row_num,
            "beforeX": round(float(bx), 4) if pd.notna(bx) else None,
            "beforeY": round(float(by), 4) if pd.notna(by) else None,
            "afterX": round(float(ax_), 4) if pd.notna(ax_) else None,
            "afterY": round(float(ay_), 4) if pd.notna(ay_) else None,
        })

    return {"before": before, "after": after, "perRow": per_row}


def _safe_sub(v, offset):
    """NaN-safe 뺄셈."""
    fv = pd.to_numeric(v, errors="coerce")
    if pd.isna(fv):
        return np.nan
    return float(fv) - float(offset)


def compute_recommended_offsets(
    row_df: pd.DataFrame,
    slitter_available: bool = True,
) -> Dict:
    """
    Worst Row 기준 3단계 추천 오프셋 산출.

    Step 1 (프린팅 전역):
      worst_x_val = 부호 포함 worst X값 → printing_x = -(worst_x_val / 2)
      worst_y_val = 부호 포함 worst Y값 → printing_y = -(worst_y_val / 2)

    Step 2 (슬리터 Row별 Y):
      프린팅 적용 후, 각 Row의 잔여 Y 평균 → slitter_y[r] = -mean(잔여 L, C, R)

    Step 3 (조립기 Row별 X+Y):
      프린팅+슬리터 적용 후, 각 Row의 잔여 → assembly_x/y
    """
    nrows = len(row_df)
    if nrows == 0:
        return {
            "printing_x": 0.0, "printing_y": 0.0,
            "slitter_y": [0.0] * 12,
            "assembly_x": [0.0] * 12,
            "assembly_y": [0.0] * 12,
        }

    # --- Step 1: 프린팅 전역 (Worst Row 기준) ---
    # X: 부호 포함으로 worst 찾기
    all_x = []
    for _, r in row_df.iterrows():
        for col in ("조립치우침L", "조립치우침R"):
            v = pd.to_numeric(r.get(col), errors="coerce")
            if pd.notna(v):
                all_x.append(float(v))
    worst_x_val = max(all_x, key=abs) if all_x else 0.0
    printing_x = round(worst_x_val / 2.0, 4)

    all_y = []
    for _, r in row_df.iterrows():
        for col in ("상하치우침L", "상하치우침C", "상하치우침R"):
            v = pd.to_numeric(r.get(col), errors="coerce")
            if pd.notna(v):
                all_y.append(float(v))
    worst_y_val = max(all_y, key=abs) if all_y else 0.0
    printing_y = round(worst_y_val / 2.0, 4)

    # --- Step 2: 슬리터 Row별 Y (프린팅 적용 후) ---
    slitter_y_out = [0.0] * 12
    if slitter_available:
        for i in range(min(nrows, 12)):
            r = row_df.iloc[i]
            residuals = []
            for col in ("상하치우침L", "상하치우침C", "상하치우침R"):
                v = pd.to_numeric(r.get(col), errors="coerce")
                if pd.notna(v):
                    residuals.append(float(v) - printing_y)
            if residuals:
                slitter_y_out[i] = round(np.mean(residuals), 4)

    # --- Step 3: 조립기 Row별 X+Y (프린팅+슬리터 적용 후) ---
    assembly_x_out = [0.0] * 12
    assembly_y_out = [0.0] * 12
    for i in range(min(nrows, 12)):
        r = row_df.iloc[i]
        # X 잔여
        x_res = []
        for col in ("조립치우침L", "조립치우침R"):
            v = pd.to_numeric(r.get(col), errors="coerce")
            if pd.notna(v):
                x_res.append(float(v) - printing_x)
        if x_res:
            assembly_x_out[i] = round(np.mean(x_res), 4)

        # Y 잔여 (프린팅 + 슬리터 적용 후)
        y_res = []
        for col in ("상하치우침L", "상하치우침C", "상하치우침R"):
            v = pd.to_numeric(r.get(col), errors="coerce")
            if pd.notna(v):
                y_res.append(float(v) - printing_y - slitter_y_out[i])
        if y_res:
            assembly_y_out[i] = round(np.mean(y_res), 4)

    return {
        "printing_x": printing_x,
        "printing_y": printing_y,
        "slitter_y": slitter_y_out,
        "assembly_x": assembly_x_out,
        "assembly_y": assembly_y_out,
    }
