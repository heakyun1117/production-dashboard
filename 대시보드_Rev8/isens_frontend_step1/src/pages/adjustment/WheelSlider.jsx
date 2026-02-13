import React, { useRef, useEffect, useCallback } from "react";
import { Box, Slider, Stack, Typography } from "@mui/material";
import {
  CI_PRIMARY, CI_GREEN, COLOR_NG, COLOR_CHECK,
} from "../../components/shared/colors";

/**
 * WheelSlider v3
 * - precision: 2 (슬리터/조립기) 또는 3 (프린팅)
 * - marginLimit: 공정 마진 한계, 초과 시 경고
 * - 마진 한계 세로바 표시
 */
export default function WheelSlider({
  value = 0, onChange,
  min = -0.20, max = 0.20,
  step = 0.001, wheelStep = 0.001,
  warningZone = "normal",
  recommended, label = "",
  size = "medium", inline = false,
  precision = 3, disabled = false,
  marginLimit,
}) {
  const sliderRef = useRef(null);
  const isOverMargin = Number.isFinite(marginLimit) && Math.abs(value) > marginLimit;

  const trackColor = isOverMargin ? COLOR_NG
    : warningZone === "ng" ? COLOR_NG
    : warningZone === "check" ? COLOR_CHECK
    : CI_PRIMARY;

  const marks = [];
  if (Number.isFinite(recommended) && Math.abs(recommended) >= (precision === 2 ? 0.005 : 0.0005)) {
    marks.push({ value: recommended, label: "" });
  }

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY > 0 ? -1 : 1;
    const raw = value + direction * wheelStep;
    const clamped = Math.max(min, Math.min(max, raw));
    const factor = Math.pow(10, precision);
    const rounded = Math.round(clamped * factor) / factor;
    if (rounded !== value) onChange(rounded);
  }, [value, onChange, wheelStep, min, max, precision]);

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const isSmall = size === "small";
  const thumbSize = isSmall ? 12 : 16;
  const labelWidth = inline ? 14 : isSmall ? 24 : 64;
  const valueWidth = isSmall ? 44 : 60;
  const valueFontSize = isSmall ? 10 : 13;
  const hasMargin = Number.isFinite(marginLimit) && marginLimit > 0;
  const toPercent = (v) => ((v - min) / (max - min)) * 100;

  return (
    <Stack direction="row" spacing={isSmall ? 0.5 : 1.5} alignItems="center" sx={{ minWidth: 0 }}>
      <Typography
        variant={isSmall ? "caption" : "body2"}
        sx={{
          width: labelWidth, fontWeight: inline ? 600 : isSmall ? 700 : 600,
          flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          color: inline ? "text.secondary" : isSmall ? "text.primary" : "text.secondary",
          fontSize: isSmall ? 10 : 12,
        }}
      >{label}</Typography>

      <Box ref={sliderRef} sx={{ flex: 1, display: "flex", alignItems: "center", position: "relative" }}>
        {/* 마진 한계 세로바 */}
        {hasMargin && [-marginLimit, marginLimit].map((v, idx) => (
          <Box key={idx} sx={{
            position: "absolute", left: `${toPercent(v)}%`, top: "50%",
            transform: "translate(-50%, -50%)", width: 2, height: isSmall ? 14 : 18,
            bgcolor: COLOR_CHECK, opacity: 0.55, borderRadius: 1, zIndex: 1, pointerEvents: "none",
          }} />
        ))}
        <Slider
          value={value} min={min} max={max} step={step}
          onChange={(_, v) => onChange(v)} marks={marks}
          size={isSmall ? "small" : "medium"} valueLabelDisplay="auto" disabled={disabled}
          valueLabelFormat={(v) => (v >= 0 ? "+" : "") + v.toFixed(precision)}
          sx={{
            color: trackColor, transition: "color 0.3s ease",
            "& .MuiSlider-mark": {
              bgcolor: CI_GREEN, width: isSmall ? 6 : 8, height: isSmall ? 6 : 8,
              borderRadius: "50%", top: "50%", transform: "translate(-50%, -50%)",
            },
            "& .MuiSlider-thumb": {
              width: thumbSize, height: thumbSize, transition: "box-shadow 0.2s",
              "&:hover, &.Mui-focusVisible": { boxShadow: `0 0 0 6px ${trackColor}22` },
            },
            "& .MuiSlider-rail": { opacity: isSmall ? 0.2 : 0.28 },
          }}
        />
      </Box>

      <Typography
        variant={isSmall ? "caption" : "body2"}
        sx={{
          width: valueWidth, fontWeight: 700, textAlign: "right", fontFamily: "monospace",
          fontSize: valueFontSize,
          color: isOverMargin ? COLOR_NG : warningZone === "ng" ? COLOR_NG
            : warningZone === "check" ? COLOR_CHECK : "text.primary",
        }}
      >{value >= 0 ? "+" : ""}{value.toFixed(precision)}</Typography>

      {isOverMargin && (
        <Typography variant="caption" sx={{ color: COLOR_NG, fontWeight: 700, fontSize: 9, whiteSpace: "nowrap" }}>
          초과
        </Typography>
      )}
    </Stack>
  );
}
