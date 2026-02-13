import React, { useState } from "react";
import { Box, Collapse, Divider, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import NivoRadarChart from "./NivoRadarChart";
import NivoGroupedBarChart from "./NivoGroupedBarChart";
import { CARD_RADIUS, BORDER_LIGHT, CI_PRIMARY } from "../../components/shared/colors";

/**
 * BeforeAfterChart v5
 * 레이더 (항상 표시) + 멀티패널 가로 막대 (접기/펼치기)
 * 시안 비교는 별도 페이지(ChartDraftPage)로 이동
 */

function SectionHeader({ num, title, subtitle, open, onClick }) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={1}
      onClick={onClick}
      sx={{
        cursor: "pointer",
        py: 1,
        px: 1.5,
        borderRadius: 2,
        "&:hover": { bgcolor: "rgba(0,0,0,0.015)" },
        userSelect: "none",
      }}
    >
      {/* 번호 뱃지 */}
      <Box sx={{
        width: 22, height: 22, borderRadius: "50%",
        bgcolor: CI_PRIMARY, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, flexShrink: 0, mt: 0.2,
      }}>
        {num}
      </Box>

      {/* 제목 + 부제목 */}
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#1a1a2e", lineHeight: 1.3 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.2 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {/* 접기/펼치기 아이콘 */}
      <ExpandMoreIcon
        sx={{
          fontSize: 18,
          color: "text.disabled",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 0.2s ease",
          mt: 0.3,
        }}
      />
    </Stack>
  );
}

export default function BeforeAfterChart({ perRow, modeLabel }) {
  const [barOpen, setBarOpen] = useState(true);

  if (!perRow || perRow.length === 0) return null;

  return (
    <Paper variant="outlined"
      sx={{ p: 2, borderRadius: CARD_RADIUS, border: `1px solid ${BORDER_LIGHT}`, height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        12-Row Before/After 비교
      </Typography>

      {/* 레이더 (항상 표시) */}
      <Stack direction="row" spacing={1}>
        <Box sx={{ flex: 1 }}><NivoRadarChart perRow={perRow} axis="x" modeLabel={modeLabel} /></Box>
        <Box sx={{ flex: 1 }}><NivoRadarChart perRow={perRow} axis="y" modeLabel={modeLabel} /></Box>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      {/* ① 멀티패널 가로 막대 */}
      <SectionHeader
        num={1}
        title="멀티패널 가로 막대 (좌 / 중 / 우)"
        subtitle="위치별 Before(반투명) · After(상태색) 겹침 비교 · ± 부호 방향"
        open={barOpen}
        onClick={() => setBarOpen((v) => !v)}
      />
      <Collapse in={barOpen} timeout={300}>
        <Stack spacing={1.5} sx={{ mt: 0.5, px: 0.5 }}>
          <NivoGroupedBarChart perRow={perRow} axis="x" />
          <NivoGroupedBarChart perRow={perRow} axis="y" />
        </Stack>
      </Collapse>
    </Paper>
  );
}
