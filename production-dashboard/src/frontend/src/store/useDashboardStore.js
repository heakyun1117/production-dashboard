import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const tabs = [
  '하판 프린팅',
  '상판 프린팅',
  '분주',
  '로우슬리팅',
  '50T 타발',
  '개별 슬리팅',
  '조립/검사',
  '관리자 종합',
  '트렌드',
  '보고서',
];

export const useDashboardStore = create(
  persist(
    (set) => ({
      tabs,
      activeTab: tabs[0],
      printingData: null,
      setActiveTab: (activeTab) => set({ activeTab }),
      setPrintingData: (printingData) => set({ printingData }),
    }),
    {
      name: 'production-dashboard-store',
    },
  ),
);
