import { useEffect, useState } from 'react';
import TabLayout from './components/TabLayout';
import PrintingTab from './components/PrintingTab';
import { useDashboardStore } from './store/useDashboardStore';
import { parsePrintingCsvFile } from './utils/printingParser';

const API_BASE = 'http://127.0.0.1:8000';

function Placeholder({ tab }) {
  return (
    <div className="rounded-xl bg-white p-8 text-center text-lg text-primary shadow">
      {tab} 탭 MVP 준비 중입니다.
    </div>
  );
}

export default function App() {
  const { activeTab, printingData, setPrintingData } = useDashboardStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLatest = async () => {
      if (printingData) return;
      try {
        const response = await fetch(`${API_BASE}/api/process/printing/latest`);
        if (!response.ok) {
          throw new Error('백엔드 응답 실패');
        }
        const payload = await response.json();
        setPrintingData(payload);
      } catch {
        setError('백엔드 연결에 실패했습니다. CSV를 직접 업로드해 주세요.');
      }
    };

    fetchLatest();
  }, [printingData, setPrintingData]);

  const handleUpload = async (file) => {
    if (!file) return;
    try {
      const parsed = await parsePrintingCsvFile(file);
      setPrintingData(parsed);
      setError('');
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  return (
    <TabLayout>
      {error && <div className="mb-4 rounded bg-ng/10 p-3 text-ng">{error}</div>}
      {activeTab === '하판 프린팅' ? (
        <PrintingTab data={printingData} onUpload={handleUpload} />
      ) : (
        <Placeholder tab={activeTab} />
      )}
    </TabLayout>
  );
}
