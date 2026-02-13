import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";

import useBasketStore from "../../store/useBasketStore";
import useAppStore from "../../store/useAppStore";
import StatusChip from "../../components/shared/StatusChip";
import { fmt2 } from "../../components/shared/fmt";

export default function CompareBasketBar() {
  const navigate = useNavigate();
  const basketItems = useBasketStore((s) => s.basketItems);
  const removeFromBasket = useBasketStore((s) => s.removeFromBasket);
  const clearBasket = useBasketStore((s) => s.clearBasket);

  if (basketItems.length === 0) return null;

  return (
    <Card
      elevation={3}
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(23,28,143,0.12)",
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(8px)",
      }}
    >
      <CardContent sx={{ py: 1.2, "&:last-child": { pb: 1.2 } }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CompareArrowsIcon sx={{ color: "primary.main", fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main" }}>
              비교 바구니 ({basketItems.length}/6)
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={clearBasket}
              sx={{ color: "text.secondary" }}
            >
              전체 삭제
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={basketItems.length < 2}
              onClick={() => navigate("/compare")}
            >
              비교
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
            {basketItems.map((key) => {
              const sheet = useAppStore.getState().getSheetByKey(key);
              return (
                <Card
                  key={key}
                  variant="outlined"
                  sx={{
                    minWidth: 200,
                    flexShrink: 0,
                    borderRadius: 2,
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.main" },
                  }}
                  onClick={() => navigate(`/detail/${encodeURIComponent(key)}`)}
                >
                  <CardContent sx={{ py: 0.8, px: 1.2, "&:last-child": { pb: 0.8 } }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <StatusChip status={sheet?.status} />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={key}
                      >
                        {key}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); removeFromBasket(key); }}
                        sx={{ p: 0.2 }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Stack>
                    {sheet && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Score: {fmt2(sheet.qualityScore)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
