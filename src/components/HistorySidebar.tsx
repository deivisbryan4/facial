import { DetectionLog } from '../types';
import { formatTime } from '../lib/utils';
import { User, Box, Smile } from 'lucide-react';

interface Props {
  logs: DetectionLog[];
  onClear: () => void;
}

export default function HistorySidebar({ logs, onClear }: Props) {
  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const date = new Date(log.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, DetectionLog[]>);

  const getIcon = (type: string) => {
    switch (type) {
      case 'face': return <User className="w-5 h-5 text-indigo-500" />;
      case 'object': return <Box className="w-5 h-5 text-amber-500" />;
      case 'expression': return <Smile className="w-5 h-5 text-emerald-500" />;
      default: return null;
    }
  };

  const getIconWrapperColor = (type: string) => {
    switch (type) {
      case 'face': return 'bg-indigo-50';
      case 'object': return 'bg-amber-50';
      case 'expression': return 'bg-emerald-50';
      default: return 'bg-slate-50';
    }
  };

  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col shrink-0 min-w-[320px]">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-800">Live Stream Log</h3>
        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">ACTIVE</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(groupedLogs).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([date, dayLogs]) => (
          <div key={date}>
            <div className="bg-slate-50 px-4 py-1.5 border-b border-slate-100">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{date}</h3>
            </div>
            
            <div className="flex flex-col">
              {[...dayLogs].sort((a, b) => b.timestamp - a.timestamp).map(log => (
                <div key={log.id} className="p-3 border-b border-slate-50 flex gap-3 items-center hover:bg-slate-50/50 transition-colors">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getIconWrapperColor(log.type)}`}>
                    {getIcon(log.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate capitalize">
                      {log.type === 'expression' ? 'Gesto' : log.type === 'object' ? 'Objeto' : 'Rostro'}: {log.label}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Conf. {(log.confidence * 100).toFixed(0)}% • {formatTime(log.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="p-8 text-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-3">
               <User className="w-8 h-8" />
             </div>
             <p className="text-sm font-medium text-slate-500">Sin registros</p>
             <p className="text-xs text-slate-400 mt-1">Esperando detecciones en tiempo real.</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-50 mt-auto border-t border-slate-200">
        <button 
          onClick={onClear}
          className="w-full py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-100 transition-colors uppercase tracking-wider"
        >
          Limpiar Bitácora
        </button>
      </div>
    </div>
  );
}
