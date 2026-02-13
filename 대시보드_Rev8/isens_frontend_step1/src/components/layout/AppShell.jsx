import React, { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ShoppingBasketIcon from "@mui/icons-material/ShoppingBasket";
import TuneIcon from "@mui/icons-material/Tune";
import ExploreIcon from "@mui/icons-material/Explore";
import DescriptionIcon from "@mui/icons-material/Description";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import StraightenIcon from "@mui/icons-material/Straighten";
import PrintIcon from "@mui/icons-material/Print";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import BarChartIcon from "@mui/icons-material/BarChart";

import useAppStore from "../../store/useAppStore";
import useBasketStore from "../../store/useBasketStore";
import { uploadMeasurements } from "../../api/step1";
import ThresholdSettingsPanel from "../shared/ThresholdSettingsPanel";

// 탭 인덱스 ↔ 경로 매핑
const TAB_ROUTES = ["/explorer", "/detail", "/compare", "/margin", "/adjustment", "/printing-adjustment", "/trend", "/chart-draft"];

function routeToTab(pathname) {
  const idx = TAB_ROUTES.findIndex((r) => pathname.startsWith(r));
  return idx >= 0 ? idx : 0;
}

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef(null);

  const busy = useAppStore((s) => s.busy);
  const setBusy = useAppStore((s) => s.setBusy);
  const setMessage = useAppStore((s) => s.setMessage);
  const setJob = useAppStore((s) => s.setJob);
  const basketCount = useBasketStore((s) => s.basketItems.length);

  // 기준값 설정 상태 (D2)
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const handleThresholdClick = () => {
    if (authenticated) {
      setThresholdOpen(true);
    } else {
      setPwValue("");
      setPwError(false);
      setPwDialogOpen(true);
    }
  };

  const handlePwSubmit = () => {
    if (pwValue === "1117") {
      setPwDialogOpen(false);
      setAuthenticated(true);
      setThresholdOpen(true);
    } else {
      setPwError(true);
    }
  };

  const tabIdx = routeToTab(location.pathname);

  // CSV 업로드 핸들러
  async function onUploadFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setBusy(true);
    setMessage(`업로드 중... (${files.length}개)`);

    try {
      const res = await uploadMeasurements(files);
      setJob(res?.jobId ?? null, res?.sheets ?? []);
      setMessage(
        `업로드 완료: parsed=${res?.parsed?.count ?? "-"} / failed=${(res?.failedSamples ?? []).length}`
      );
      // 업로드 후 Explorer로 이동
      navigate("/explorer");
    } catch (e) {
      setMessage(`업로드 실패: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  function handleTabChange(_e, newVal) {
    const route = TAB_ROUTES[newVal];
    // Detail 탭: 선택된 시트가 있으면 해당 시트 Detail로, 없으면 Explorer로
    if (route === "/detail") {
      const selectedKey = useAppStore.getState().selectedSheetKey;
      if (selectedKey) {
        navigate(`/detail/${encodeURIComponent(selectedKey)}`);
      } else {
        navigate("/explorer");
      }
      return;
    }
    // Margin 탭: 선택된 시트가 있으면 해당 시트 Margin으로
    if (route === "/margin") {
      const selectedKey = useAppStore.getState().selectedSheetKey;
      if (selectedKey) {
        navigate(`/margin/${encodeURIComponent(selectedKey)}`);
      } else {
        navigate("/margin");
      }
      return;
    }
    // Adjustment 탭: 선택된 시트가 있으면 해당 시트 Adjustment로
    if (route === "/adjustment") {
      const selectedKey = useAppStore.getState().selectedSheetKey;
      if (selectedKey) {
        navigate(`/adjustment/${encodeURIComponent(selectedKey)}`);
      } else {
        navigate("/explorer");
      }
      return;
    }
    // 시안 비교 탭: 선택된 시트가 있으면 해당 시트로
    if (route === "/chart-draft") {
      const selectedKey = useAppStore.getState().selectedSheetKey;
      if (selectedKey) {
        navigate(`/chart-draft/${encodeURIComponent(selectedKey)}`);
      } else {
        navigate("/chart-draft");
      }
      return;
    }
    navigate(route);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", background: "background.default" }}>
      {/* ─── 상단 네비게이션 바 (Clean Data Studio 스타일) ─── */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: "#fff",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          color: "text.primary",
        }}
      >
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <Typography
            variant="subtitle1"
            component="div"
            sx={{ fontWeight: 900, mr: 2, letterSpacing: "-0.02em", display: "flex", alignItems: "baseline" }}
          >
            <Box component="span" sx={{ color: "#171C8F", position: "relative", display: "inline-block" }}>
              <Box component="span" sx={{ visibility: "hidden" }}>i</Box>
              <Box component="span" sx={{ position: "absolute", left: 0, bottom: 0, color: "#171C8F" }}>ı</Box>
              <Box component="span" sx={{
                position: "absolute", left: "50%", top: "-0.05em",
                transform: "translateX(-50%)",
                width: 5, height: 5, borderRadius: "50%",
                backgroundColor: "#78BE20", display: "inline-block",
              }} />
            </Box>
            <Box component="span" sx={{ color: "#171C8F" }}>-SENS</Box>
            <Box component="span" sx={{ color: "#53565A", fontWeight: 600, ml: 0.5 }}>Dashboard</Box>
          </Typography>

          <Tabs
            value={tabIdx}
            onChange={handleTabChange}
            sx={{ minHeight: 42, flex: 1 }}
            TabIndicatorProps={{ sx: { height: 2.5 } }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<ExploreIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Explorer" sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<DescriptionIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Detail" sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<CompareArrowsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Compare" sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<StraightenIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Margin" sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<TuneIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Adjustment" sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<PrintIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Print Adj." sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<TrendingUpIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Trend" sx={{ minHeight: 42, fontWeight: 700 }} />
            <Tab icon={<BarChartIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="시안 비교" sx={{ minHeight: 42, fontWeight: 700 }} />
          </Tabs>

          {/* 기준값 설정 버튼 */}
          <Tooltip title="기준값 설정" arrow>
            <IconButton size="small" onClick={handleThresholdClick}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* 비교 바구니 뱃지 */}
          <IconButton
            size="small"
            title="비교 바구니"
            onClick={() => navigate("/compare")}
          >
            <Badge badgeContent={basketCount} color="primary" max={6}>
              <ShoppingBasketIcon fontSize="small" />
            </Badge>
          </IconButton>

          {/* CSV 업로드 버튼 */}
          <Button
            variant="contained"
            size="small"
            startIcon={<UploadFileIcon />}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            sx={{ whiteSpace: "nowrap" }}
          >
            CSV 업로드
          </Button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept=".csv,text/csv"
            onChange={(e) => {
              onUploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </Toolbar>
      </AppBar>

      {/* ─── 페이지 콘텐츠 ─── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>{children}</Box>

      {/* ─── 하단 상태 바 ─── */}
      <Box
        sx={{
          px: 2,
          py: 0.5,
          borderTop: "1px solid rgba(0,0,0,0.06)",
          background: "#fff",
        }}
      >
        <Typography variant="caption" sx={{ color: busy ? "text.primary" : "text.secondary" }}>
          {useAppStore.getState().message || "대기 중"} · Job: {useAppStore.getState().jobId ?? "-"}
        </Typography>
      </Box>

      {/* ─── 비밀번호 다이얼로그 (기준값 설정) ─── */}
      <Dialog open={pwDialogOpen} onClose={() => setPwDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>기준값 설정 접근</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>비밀번호를 입력하세요</Typography>
          <TextField
            type="password"
            autoFocus
            fullWidth
            size="small"
            value={pwValue}
            onChange={(e) => { setPwValue(e.target.value); setPwError(false); }}
            error={pwError}
            helperText={pwError ? "비밀번호가 틀렸습니다" : ""}
            onKeyDown={(e) => { if (e.key === "Enter") handlePwSubmit(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwDialogOpen(false)}>취소</Button>
          <Button onClick={handlePwSubmit} variant="contained">확인</Button>
        </DialogActions>
      </Dialog>

      {/* ─── 기준값 설정 Drawer ─── */}
      <Drawer
        anchor="right"
        open={thresholdOpen}
        onClose={() => setThresholdOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 2 } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>기준값 설정</Typography>
          <Button size="small" onClick={() => setThresholdOpen(false)}>닫기</Button>
        </Stack>
        <ThresholdSettingsPanel />
      </Drawer>
    </Box>
  );
}
