import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import RowMiniCard from "./RowMiniCard";

export default function RowOverview12Grid({ rows }) {
  const rowList = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);

  if (rowList.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Row 데이터가 없습니다.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
        },
        gap: 1.5,
      }}
    >
      {rowList.map((row, idx) => (
        <RowMiniCard key={row?.Row ?? idx} row={row} index={idx} />
      ))}
    </Box>
  );
}
