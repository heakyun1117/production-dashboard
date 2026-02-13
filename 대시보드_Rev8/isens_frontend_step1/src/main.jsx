import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

// AG Grid Community 모듈 등록 (v33+ 필수)
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

// ── i-SENS CI 테마 ──
const theme = createTheme({
  palette: {
    mode: "light",
    primary:    { main: "#171C8F", light: "#4549A5", dark: "#101464" },   // i-SENS Blue
    secondary:  { main: "#78BE20", light: "#A1D263", dark: "#548516" },   // i-SENS Green
    error:      { main: "#DC2626" },   // NG
    warning:    { main: "#E8860C" },   // CHECK
    success:    { main: "#78BE20" },   // OK = Green
    text:       { primary: "#53565A", secondary: "#87898C" },             // i-SENS Gray
    background: { default: "#F5F6FA", paper: "#FFFFFF" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Inter, Pretendard, Segoe UI, Roboto, sans-serif",
    h6:        { fontWeight: 800 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 8 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <App />
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);
