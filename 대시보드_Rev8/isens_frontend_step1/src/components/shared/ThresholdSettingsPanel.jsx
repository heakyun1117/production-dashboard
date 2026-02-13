import React, { useCallback } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import useThresholdStore from "../../store/useThresholdStore";
import { CI_PRIMARY } from "./colors";

/**
 * ThresholdSettingsPanel — 기준값 설정 패널
 * 기본 닫힘, 클릭 시 확장. 값 변경 즉시 반영.
 */
export default function ThresholdSettingsPanel() {
  const thresholds = useThresholdStore((s) => s.thresholds);
  const updateCategory = useThresholdStore((s) => s.updateCategory);
  const resetAll = useThresholdStore((s) => s.resetAll);

  const handleChange = useCallback(
    (category, field, raw) => {
      const v = parseFloat(raw);
      if (!isNaN(v) && v >= 0) {
        updateCategory(category, { [field]: v });
      }
    },
    [updateCategory]
  );

  const row = (label, category, field, unit = "mm") => (
    <Stack direction="row" spacing={1} alignItems="center" key={`${category}-${field}`}>
      <Typography variant="caption" sx={{ width: 110, fontWeight: 600, flexShrink: 0 }}>
        {label}
      </Typography>
      <TextField
        type="number"
        size="small"
        value={thresholds[category]?.[field] ?? ""}
        onChange={(e) => handleChange(category, field, e.target.value)}
        inputProps={{ step: 0.01, min: 0, style: { width: 72, padding: "4px 8px", fontSize: 13 } }}
      />
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {unit}
      </Typography>
    </Stack>
  );

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "8px !important",
        "&:before": { display: "none" },
        mt: 1,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, px: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: CI_PRIMARY }}>
          기준값 설정
        </Typography>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
        <Stack spacing={1.5}>
          {/* 측정 기준값 (Assembly) */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", mb: 0.5, display: "block" }}>
              측정 기준값
            </Typography>
            <Stack spacing={0.5}>
              {row("NG 한계", "assembly", "ng")}
              {row("CHECK 한계", "assembly", "check")}
              {row("표시 범위", "assembly", "scale")}
            </Stack>
          </Box>

          <Divider />

          {/* 마진 기준값 — 프린팅 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", mb: 0.5, display: "block" }}>
              마진 기준값 (프린팅/슬리터)
            </Typography>
            <Stack spacing={0.5}>
              {row("NG 한계", "marginPrinting", "ng")}
              {row("CHECK 한계", "marginPrinting", "check")}
            </Stack>
          </Box>

          {/* 마진 기준값 — 원단/전체폭 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", mb: 0.5, display: "block" }}>
              마진 기준값 (원단/전체폭)
            </Typography>
            <Stack spacing={0.5}>
              {row("NG 한계", "marginFabric", "ng")}
              {row("CHECK 한계", "marginFabric", "check")}
              {row("표시 범위", "marginFabric", "scale")}
            </Stack>
          </Box>

          <Divider />

          {/* 레이더 */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", mb: 0.5, display: "block" }}>
              레이더 차트
            </Typography>
            <Stack spacing={0.5}>
              {row("최대값", "radar", "maxValue")}
              {row("타겟", "radar", "target")}
            </Stack>
          </Box>

          <Divider />

          <Button
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={resetAll}
            sx={{ alignSelf: "flex-start", textTransform: "none", fontWeight: 700 }}
          >
            기본값으로 리셋
          </Button>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
