import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

import useAppStore from "../../store/useAppStore";
import useBasketStore from "../../store/useBasketStore";

export default function DetailNavigation({ currentKey }) {
  const navigate = useNavigate();
  const sortedSheetKeys = useAppStore((s) => s.sortedSheetKeys);
  const setSelectedSheet = useAppStore((s) => s.setSelectedSheet);
  const basketItems = useBasketStore((s) => s.basketItems);

  const { prev, next, idx, total } = useMemo(() => {
    const keys = sortedSheetKeys;
    const i = keys.indexOf(currentKey);
    if (i < 0) return { prev: null, next: null, idx: -1, total: keys.length };
    return {
      prev: i > 0 ? keys[i - 1] : null,
      next: i < keys.length - 1 ? keys[i + 1] : null,
      idx: i,
      total: keys.length,
    };
  }, [currentKey, sortedSheetKeys]);

  const goTo = (key) => {
    if (!key) return;
    setSelectedSheet(key);
    navigate(`/detail/${encodeURIComponent(key)}`);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/explorer")}
        sx={{ color: "text.secondary" }}
      >
        Explorer
      </Button>

      <Button
        size="small"
        startIcon={<NavigateBeforeIcon />}
        disabled={!prev}
        onClick={() => goTo(prev)}
      >
        이전
      </Button>

      {/* 위치 표시 */}
      {idx >= 0 && total > 0 && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "text.secondary",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            minWidth: 48,
            textAlign: "center",
          }}
        >
          {idx + 1} / {total}
        </Typography>
      )}

      <Button
        size="small"
        endIcon={<NavigateNextIcon />}
        disabled={!next}
        onClick={() => goTo(next)}
      >
        다음
      </Button>

      {/* Margin 버튼 */}
      <Button
        size="small"
        variant="outlined"
        onClick={() => navigate(`/margin/${encodeURIComponent(currentKey)}`)}
        sx={{ ml: 1 }}
      >
        Margin
      </Button>

      {/* 바구니 드롭다운 */}
      {basketItems.length > 0 && (
        <FormControl size="small" sx={{ minWidth: 200, ml: 1 }}>
          <InputLabel>바구니 시트</InputLabel>
          <Select
            value={basketItems.includes(currentKey) ? currentKey : ""}
            label="바구니 시트"
            onChange={(e) => goTo(e.target.value)}
          >
            {basketItems.map((key) => (
              <MenuItem key={key} value={key}>
                <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                  {key}
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Stack>
  );
}
