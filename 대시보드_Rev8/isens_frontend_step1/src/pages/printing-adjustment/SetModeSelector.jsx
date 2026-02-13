import React from "react";
import { ToggleButton, ToggleButtonGroup, Stack, Typography } from "@mui/material";

const MODES = [
  { value: "SET1", title: "SET1", sub: "타발 최적" },
  { value: "SET2", title: "SET2", sub: "차이(절연만)" },
  { value: "SET3", title: "SET3", sub: "차이(양쪽)" },
];

export default function SetModeSelector({ mode, onChange }) {
  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_, v) => v && onChange(v)}
      size="small"
      sx={{ ml: 2 }}
    >
      {MODES.map((m) => (
        <ToggleButton key={m.value} value={m.value} sx={{ px: 1.5, py: 0.5 }}>
          <Stack alignItems="center" spacing={0}>
            <Typography variant="caption" sx={{ fontWeight: 800, fontSize: 11, lineHeight: 1.2 }}>
              {m.title}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 9, lineHeight: 1, color: "text.secondary" }}>
              {m.sub}
            </Typography>
          </Stack>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
