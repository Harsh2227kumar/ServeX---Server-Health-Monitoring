import { useMetrics } from '../../context/MetricsContext';

export default function ConnectionMetrics() {
  const { networkConnectionMetrics, connectionTrendsHistory } = useMetrics();
  const d = networkConnectionMetrics?.data ?? {};

  const total = d.total_connections ?? 0;
  const tcp = d.tcp_connections ?? 0;
  const udp = d.udp_connections ?? 0;

  // Derive the change from the collected trend history (was a hard-coded value).
  const history = connectionTrendsHistory ?? [];
  let deltaLabel = 'Awaiting data';
  let deltaClass = 'text-slate-500';
  let deltaIcon = '•';
  if (history.length >= 2) {
    const first = history[0]?.total ?? 0;
    const last = history[history.length - 1]?.total ?? 0;
    if (first > 0) {
      const pct = ((last - first) / first) * 100;
      deltaLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% since tracking`;
      deltaClass = pct >= 0 ? 'text-emerald-500' : 'text-red-500';
      deltaIcon = pct >= 0 ? '📈' : '📉';
    } else {
      deltaLabel = `${history.length} samples`;
      deltaClass = 'text-slate-400';
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800/50 rounded-lg p-8 flex flex-col justify-between h-full">
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Connection Metrics</h3>
        <div className="space-y-8">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Active</p>
            <p className="text-4xl font-bold text-white tracking-tight">{total.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-800/30">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">TCP Established</p>
              <p className="text-2xl font-bold">{tcp.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-slate-900/40 rounded-lg border border-slate-800/30">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">UDP Active</p>
              <p className="text-2xl font-bold">{udp.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
      <div className={`pt-6 border-t border-slate-800/50 flex items-center gap-2 ${deltaClass}`}>
        <span className="text-sm">{deltaIcon}</span>
        <span className="text-xs font-semibold">{deltaLabel}</span>
      </div>
    </div>
  );
}
