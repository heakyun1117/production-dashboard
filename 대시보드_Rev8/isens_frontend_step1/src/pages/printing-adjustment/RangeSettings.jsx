import React from "react";
import {
  Accordion, AccordionSummary, AccordionDetails,
  Stack, TextField, Typography, InputAdornment,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/**
 * RangeSettings — 이동 범위 제한 설정 (접이식)
 *
 * 대칭 방식: ±값 하나를 입력하면 min=-val, max=+val 자동 설정
 *
 * @param {{ qMin, qMax, xMin, xMax, yMin, yMax }} ranges
 * @param {(updated) => void} onChange
 */

const FIELDS = [
  { key: "q", label: "Q (시계방향)", step: 0.001, absMax: 0.10, precision: 4 },
  { key: "x", label: "좌우", step: 0.01, absMax: 0.20, precision: 3 },
  { key: "y", label: "상하", step: 0.01, absMax: 0.20, precision: 3 },
];

function RangeInput({ label, value, onChange, step, absMax, precision }) {
  const handleChange = (e) => {
    const raw = e.target.value;
    if (raw === "" || raw === "0" || raw === "0.") return;
    let v = parseFloat(raw);
    if (!Number.isFinite(v)) return;
    v = Math.max(0, Math.min(absMax, v));
    onChange(v);
  };

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="caption" sx={{ width: 80, fontWeight: 600, color: "text.secondary", fontSize: 11 }}>
        {label}
      </Typography>
      <TextField
        size="small"
        type="number"
        value={value.toFixed(precision)}
        onChange={handleChange}
        inputProps={{ step, min: 0, max: absMax, style: { textAlign: "center", fontSize: 12, padding: "2px 4px" } }}
        InputProps={{
          startAdornment: <InputAdornment position="start" sx={{ mr: 0 }}><Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>±</Typography></InputAdornment>,
        }}
        sx={{ width: 110, "& .MuiOutlinedInput-root": { height: 28 } }}
      />
    </Stack>
  );
}

export default function RangeSettings({ ranges, onChange }) {
  const handleFieldChange = (key) => (val) => {
    onChange({
      ...ranges,
      [`${key}Min`]: -val,
      [`${key}Max`]: val,
    });
  };

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        "&:before": { display: "none" },
        bgcolor: "transparent",
        mb: 0.5,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
        sx={{ minHeight: 28, py: 0, px: 0.5, "& .MuiAccordionSummary-content": { my: 0 } }}
      >
        <TuneIcon sx={{ fontSize: 14, mr: 0.5, color: "text.disabled" }} />
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 11, color: "text.secondary" }}>
          이동 범위 제한
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0.5, pt: 0, pb: 0.5 }}>
        <Stack spacing={0.5}>
          {FIELDS.map(({ key, label, step, absMax, precision }) => (
            <RangeInput
              key={key}
              label={label}
              value={ranges[`${key}Max`]}
              onChange={handleFieldChange(key)}
              step={step}
              absMax={absMax}
              precision={precision}
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
