import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell.jsx";
import ExplorerPage from "./pages/ExplorerPage.jsx";
import DetailPage from "./pages/DetailPage.jsx";
import ComparePage from "./pages/ComparePage.jsx";
import MarginPage from "./pages/MarginPage.jsx";
import AdjustmentPage from "./pages/adjustment/AdjustmentPage.jsx";
import PrintingAdjustmentPage from "./pages/PrintingAdjustmentPage.jsx";
import TrendPage from "./pages/TrendPage.jsx";
import ChartDraftPage from "./pages/adjustment/ChartDraftPage.jsx";

import "./styles/aggrid.css";

/**
 * App.jsx — 라우터 구조
 * Phase 0: Explorer + Detail
 * Phase 2: Compare + Margin
 * Phase 3: Adjustment
 */
export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/explorer" replace />} />
        <Route path="/explorer" element={<ExplorerPage />} />
        <Route path="/detail" element={<DetailPage />} />
        <Route path="/detail/:sheetKey" element={<DetailPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/margin" element={<MarginPage />} />
        <Route path="/margin/:sheetKey" element={<MarginPage />} />
        <Route path="/adjustment" element={<AdjustmentPage />} />
        <Route path="/adjustment/:sheetKey" element={<AdjustmentPage />} />
        <Route path="/printing-adjustment" element={<PrintingAdjustmentPage />} />
        <Route path="/trend" element={<TrendPage />} />
        <Route path="/chart-draft" element={<ChartDraftPage />} />
        <Route path="/chart-draft/:sheetKey" element={<ChartDraftPage />} />
      </Routes>
    </AppShell>
  );
}
