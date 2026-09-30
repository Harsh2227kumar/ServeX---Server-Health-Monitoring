import { useMetrics } from '../../context/MetricsContext';

export default function TopProcessesCharts() {
  const { networkProcessMetrics } = useMetrics();
  const d = networkProcessMetrics?.data ?? {};
  const topConnRaw = d.top_processes_by_connections ?? [];
  const topBwRaw = d.top_processes_by_bandwidth ?? [];

  const maxConn = Math.max(...topConnRaw.map((p) => p.connections?.length || 0), 1);
  const topByConnections = topConnRaw.slice(0, 5).map((p) => ({
    name: p.name,
    value: p.connections?.length || 0,
    percent: Math.round(((p.connections?.length || 0) / maxConn) * 100),
  }));

  const maxBw = Math.max(...topBwRaw.map((p) => p.estimated_bandwidth || 0), 1);
  const topByActivity = topBwRaw.slice(0, 5).map((p) => ({
    name: p.name,
    value: `${p.estimated_bandwidth || 0}`,
    percent: Math.round(((p.estimated_bandwidth || 0) / maxBw) * 100),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Top Processes by Connections */}
      <div className="bg-[#1a2332] border border-slate-800/50 rounded p-6">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-100">Top Processes by Connections</h4>
          <span className="material-symbols-outlined text-slate-500 text-sm">more_vert</span>
        </div>
        <div className="space-y-4">
          {topByConnections.map((proc, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
                <span className="text-slate-300">{proc.name}</span>
                <span className="text-[#256af4]">{proc.value.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full bg-slate-800/50 rounded-sm overflow-hidden">
                <div className="h-full bg-[#256af4] rounded-sm" style={{ width: `${proc.percent}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Processes by Activity */}
      <div className="bg-[#1a2332] border border-slate-800/50 rounded p-6">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-100">Top Processes by Activity Score</h4>
          <span className="material-symbols-outlined text-slate-500 text-sm">more_vert</span>
        </div>
        <div className="space-y-4">
          {topByActivity.map((proc, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
                <span className="text-slate-300">{proc.name}</span>
                <span className="text-amber-500">{proc.value}</span>
              </div>
              <div className="h-2 w-full bg-slate-800/50 rounded-sm overflow-hidden">
                <div className="h-full bg-amber-500 rounded-sm" style={{ width: `${proc.percent}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
