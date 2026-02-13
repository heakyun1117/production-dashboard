import React from "react";
import { Box, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { CI_PRIMARY } from "../components/shared/colors";

export default function TrendPage() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "60vh",
        gap: 2,
      }}
    >
      <TrendingUpIcon sx={{ fontSize: 64, color: CI_PRIMARY, opacity: 0.3 }} />
      <Typography variant="h5" sx={{ fontWeight: 800, color: "text.secondary" }}>
        트렌드 분석
      </Typography>
      <Typography variant="body2" sx={{ color: "text.disabled" }}>
        준비 중입니다.
      </Typography>
    </Box>
  );
}
