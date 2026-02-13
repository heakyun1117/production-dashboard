import { useState } from 'react';
import BottomPrintingTab from './pages/BottomPrintingTab';
import RowSlittingTab from './pages/RowSlittingTab';
import TopPrintingTab from './pages/TopPrintingTab';

type TabKey = '하판 프린팅' | '상판 프린팅' | '로우슬리팅';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('하판 프린팅');

  return (
    <div style={{ minHeight: '100vh', background: '#020617' }}>
      <nav style={{ display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #334155', background: '#0F172A' }}>
        {(['하판 프린팅', '상판 프린팅', '로우슬리팅'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              border: '1px solid #334155',
              background: activeTab === tab ? '#171C8F' : '#1E293B',
              color: '#F1F5F9',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
      {activeTab === '하판 프린팅' && <BottomPrintingTab />}
      {activeTab === '상판 프린팅' && <TopPrintingTab />}
      {activeTab === '로우슬리팅' && <RowSlittingTab />}
    </div>
  );
}
