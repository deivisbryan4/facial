import { useEffect, useState } from 'react';
import Detector from './components/Detector';
import HistorySidebar from './components/HistorySidebar';
import { visionEngine } from './lib/vision';
import { DetectionLog } from './types';
import { ScanLine, Crosshair, Users, HardDrive, Settings } from 'lucide-react';

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [logs, setLogs] = useState<DetectionLog[]>([]);

  useEffect(() => {
    // Load persisted daily logs on mount
    const saved = localStorage.getItem('vision_daily_logs');
    if (saved) {
      try {
        setLogs(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load logs', e);
      }
    }

    // Connect vision engine callbacks
    visionEngine.callbacks.onModelsLoaded = () => setIsLoaded(true);
    visionEngine.callbacks.onLogAdded = (newLog) => {
      setLogs(prev => {
        const updated = [newLog, ...prev].slice(0, 500); // keep max 500
        localStorage.setItem('vision_daily_logs', JSON.stringify(updated));
        return updated;
      });
    };

    // Initialize Vision AI
    visionEngine.initialize();
  }, []);

  const handleClearLogs = () => {
    if (confirm('¿Estás seguro de que deseas limpiar el historial de detecciones?')) {
      setLogs([]);
      localStorage.removeItem('vision_daily_logs');
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#F1F5F9] font-sans text-slate-900 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 text-indigo-400 mb-8">
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white font-bold text-xl">V</div>
            <span className="text-white font-bold text-lg tracking-tight">VisionCore Pro</span>
          </div>
          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2 bg-slate-800 text-white rounded-md text-sm font-medium">
              <Crosshair className="w-5 h-5 opacity-70" />
              Live Analysis
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white rounded-md text-sm font-medium transition-colors">
              <Users className="w-5 h-5 opacity-70" />
              Biometrics
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white rounded-md text-sm font-medium transition-colors">
              <HardDrive className="w-5 h-5 opacity-70" />
              Database
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white rounded-md text-sm font-medium transition-colors">
              <Settings className="w-5 h-5 opacity-70" />
              Configuration
            </a>
          </nav>
        </div>
        <div className="mt-auto p-6">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-2">Daily Quota Status</p>
            <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: '65%' }}></div>
            </div>
            <p className="text-xs text-slate-300 mt-2">{logs.length} / 5,000 Scans</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Surveillance Terminal A-12</h1>
            <p className="text-xs text-slate-500">Region: Main Office Entrance • Status: Active</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold border border-green-100">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time Uplink Stable
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Live Camera Feed & Stats */}
          <div className="flex-[3] flex flex-col gap-4 min-h-0">
            <Detector isLoaded={isLoaded} logs={logs} />
          </div>

          {/* History Sidebar */}
          <HistorySidebar logs={logs} onClear={handleClearLogs} />
        </div>

      </main>
    </div>
  );
}
