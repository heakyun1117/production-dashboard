# csv-parser SKILL

## 목적
바이오센서 QC CSV 5종을 안정적으로 파싱해 공정별 표준 JSON으로 변환한다.

## 핵심 규칙
1. 인코딩은 반드시 **UTF-16 LE BOM**로 디코딩한다.
2. 구분자는 탭(`\t`)이다.
3. `:BEGIN` ~ `:END` 블록만 데이터 본문으로 사용한다.
4. 원본 CSV는 절대 수정하지 않는다(raw 보존).

## 파일 식별 키워드
- 프린팅: `타발기준_카본`, `거리 타발`
- 전극면적: `전극폭`, `전극길이`
- 분주형상: `분주면적`, `분주간격`
- 로우슬리터: `전체폭`, `타발폭`
- 샘플검사: `타발홀`, `양면`, `양면상하`

## Python 파싱 패턴
```python
from pathlib import Path
import csv

def read_utf16_tab_csv(path: str):
    text = Path(path).read_text(encoding="utf-16")
    lines = text.splitlines()

    start = next((i for i, line in enumerate(lines) if line.strip() == ":BEGIN"), None)
    end = next((i for i, line in enumerate(lines) if line.strip() == ":END"), None)
    if start is None or end is None or end <= start:
        raise ValueError(":BEGIN/:END 블록을 찾을 수 없습니다.")

    block = lines[start + 1 : end]
    rows = list(csv.reader(block, delimiter="\t"))
    return rows
```

## 출력 권장 구조
```json
{
  "process": "printing",
  "setNo": 298,
  "measuredAt": "2026-02-13T09:21:00+09:00",
  "points": [],
  "judgement": {"status": "CHECK", "maxDeviation": 0.123}
}
```

## 검증 체크리스트
- BOM 포함 파일에서도 한글 컬럼명이 정상 파싱되는가?
- 탭 분리 컬럼 수가 행마다 비정상적으로 달라지지 않는가?
- 블록 외 메타 라인을 본문 데이터로 오인하지 않는가?
