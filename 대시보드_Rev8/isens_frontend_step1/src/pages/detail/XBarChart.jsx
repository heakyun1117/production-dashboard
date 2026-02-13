import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Typography } from "@mui/material";
import { asNumber } from "../../components/shared/fmt";

import { COLOR_NG, COLOR_CHECK, CI_PRIMARY as COLOR_NORMAL } from "../../components/shared/colors";
import useThresholdStore from "../../store/useThresholdStore";

function barColor(v, CHECK, NG) {
  const abs = Math.abs(Number(v ?? 0));
  if (abs >= NG) return COLOR_NG;
  if (abs >= CHECK) return COLOR_CHECK;
  return COLOR_NORMAL;
}

function CustomTooltip({ active, payload, label }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG = storeT.ng;

  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
      <Typography variant="caption" sx={{ fontWeight: 800 }}>Row {label}</Typography>
      {payload.map((p) => {
        const v = Number(p.value ?? 0);
        const abs = Math.abs(v);
        const status = abs >= NG ? "NG" : abs >= CHECK ? "CHECK" : "OK";
        return (
          <div key={p.dataKey} style={{ color: barColor(v, CHECK, NG) }}>
            {p.name}: {v.toFixed(2)} mm ({status})
          </div>
        );
      })}
    </div>
  );
}

export default function XBarChart({ rows }) {
  const storeT = useThresholdStore((s) => s.thresholds.assembly);
  const CHECK = storeT.check;
  const NG = storeT.ng;

  const data = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return rows.map((r, i) => ({
      row: r.Row ?? i + 1,
      L: asNumber(r["조립치우침L"]) ?? 0,
      R: asNumber(r["조립치우침R"]) ?? 0,
    }));
  }, [rows]);

  if (data.length === 0) {
    return <Typography variant="body2" sx={{ color: "text.secondary" }}>Row 데이터 없음</Typography>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <XAxis dataKey="row" tick={{ fontSize: 12 }} label={{ value: "Row", position: "insideBottomRight", offset: -5 }} />
        <YAxis domain={[-0.20, 0.20]} tick={{ fontSize: 11 }} tickFormatter={(v) => v.toFixed(2)} label={{ value: "mm", angle: -90, position: "insideLeft" }} />

        <ReferenceLine y={NG} stroke={COLOR_NG} strokeWidth={1.5} strokeDasharray="" label={{ value: "NG", position: "right", fontSize: 10, fill: COLOR_NG }} />
        <ReferenceLine y={-NG} stroke={COLOR_NG} strokeWidth={1.5} />
        <ReferenceLine y={CHECK} stroke={COLOR_CHECK} strokeWidth={1} strokeDasharray="4 3" label={{ value: "CHECK", position: "right", fontSize: 10, fill: COLOR_CHECK }} />
        <ReferenceLine y={-CHECK} stroke={COLOR_CHECK} strokeWidth={1} strokeDasharray="4 3" />
        <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />

        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        <Bar dataKey="L" name="조립치우침L" maxBarSize={24}>
          {data.map((d, i) => <Cell key={i} fill={barColor(d.L, CHECK, NG)} fillOpacity={0.85} />)}
        </Bar>
        <Bar dataKey="R" name="조립치우침R" maxBarSize={24}>
          {data.map((d, i) => <Cell key={i} fill={barColor(d.R, CHECK, NG)} fillOpacity={0.85} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
