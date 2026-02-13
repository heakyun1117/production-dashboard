import React from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { fmt2 } from "./fmt";

/**
 * MiniStripCard — X 또는 Y 미니 스트립 카드
 * [SPEC LOCK] ±ng 스케일, deadband=0.02, tilt/bow=0.03
 */
export default function MiniStripCard({ mini, title }) {
  const NG = mini?.ng ?? 0.15;
  const db = mini?.deadband ?? 0.02;
  const points = Array.isArray(mini?.points) ? mini.points : [];

  const halfW = 120;
  const trackH = 46;

  const mapX = (v) => {
    const vc = Math.max(-NG, Math.min(NG, Number(v ?? 0)));
    return halfW + (vc / NG) * halfW;
  };

  const dbW = (db / NG) * halfW;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {title} · {mini?.direction ?? "-"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.6)" }}>
              ng ±{fmt2(NG)} / db ±{fmt2(db)}
            </Typography>
          </Stack>

          <Box
            sx={{
              position: "relative", width: halfW * 2, height: trackH,
              borderRadius: 2, background: "rgba(0,0,0,0.03)", overflow: "hidden",
            }}
          >
            {/* 0 line */}
            <Box sx={{ position: "absolute", left: halfW, top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.18)" }} />
            {/* deadband band */}
            <Box sx={{ position: "absolute", left: halfW - dbW, width: dbW * 2, top: 0, bottom: 0, background: "rgba(0,0,0,0.05)" }} />
            {/* points */}
            {points.map((p, idx) => {
              const x = mapX(p.value);
              const y = 12 + idx * 10;
              return (
                <Box
                  key={`${p.pos}-${idx}`}
                  title={`${p.pos}: ${fmt2(p.value)} mm`}
                  sx={{
                    position: "absolute",
                    left: x - (p.isWorst ? 6 : 5),
                    top: y,
                    width: p.isWorst ? 12 : 10,
                    height: p.isWorst ? 12 : 10,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.55)",
                    border: p.isWorst ? "2px solid rgba(0,0,0,0.22)" : "1px solid rgba(0,0,0,0.18)",
                  }}
                />
              );
            })}
          </Box>

          <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap" }}>
            {(mini?.flags ?? []).map((f, i) => (
              <Chip
                key={i}
                size="small"
                label={`${f.type}: ${f.text} (${fmt2(f.value)})`}
                sx={{ background: "rgba(0,0,0,0.06)" }}
              />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
