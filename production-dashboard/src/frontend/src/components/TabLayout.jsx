import { useDashboardStore } from '../store/useDashboardStore';

export default function TabLayout({ children }) {
  const { tabs, activeTab, setActiveTab } = useDashboardStore();

  return (
    <div className="min-h-screen bg-bg px-6 py-4 text-[16px]">
      <header className="mb-4 rounded-xl bg-primary px-6 py-4 text-white">
        <h1 className="text-2xl font-semibold">i-SENS 생산 대시보드 v3</h1>
      </header>
      <nav className="mb-4 grid grid-cols-5 gap-2 xl:grid-cols-10">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'border-primary bg-primary text-white'
                : 'border-accent bg-white text-primary'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {index + 1}. {tab}
          </button>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
