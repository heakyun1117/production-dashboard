import React from "react";
import { Chip } from "@mui/material";
import { STATUS_STYLES, CI_GRAY } from "./colors";

const STATUS_MAP = {
  OK:    { label: "OK",    sx: { background: STATUS_STYLES.OK.bg,    color: STATUS_STYLES.OK.text } },
  CHECK: { label: "CHECK", sx: { background: STATUS_STYLES.CHECK.bg, color: STATUS_STYLES.CHECK.text } },
  NG:    { label: "NG",    sx: { background: STATUS_STYLES.NG.bg,    color: STATUS_STYLES.NG.text } },
};

export default function StatusChip({ status }) {
  const v = STATUS_MAP[status] ?? {
    label: status ?? "-",
    sx: { background: "rgba(0,0,0,0.06)", color: CI_GRAY },
  };
  return <Chip size="small" label={v.label} sx={{ ...v.sx, fontWeight: 700 }} />;
}
