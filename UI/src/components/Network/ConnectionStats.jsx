import { useMetrics } from '../../context/MetricsContext';

export default function ConnectionStats() {
  const { networkConnectionMetrics } = useMetrics();
  const d = networkConnectionMetrics?.data ?? {};
  
  const est = d.established_connections ?? 0;
  const listen = d.listening_sockets ?? 0;
  const tw = d.time_wait_connections ?? 0;

  // Derive status from the live values instead of hard-coded labels.
  const timeWaitRatio = est > 0 ? tw / est : tw;
  const timeWaitStatus =
    timeWaitRatio > 1
      ? { label: 'ELEVATED', color: 'text-amber-500' }
      : timeWaitRatio > 0.3
        ? { label: 'NORMAL', color: 'text-emerald-500' }
        : { label: 'LOW', color: 'text-slate-400' };

  const stats = [
    {
      label: 'Established Connections',
      value: est.toLocaleString(),
      status: est > 0 ? 'ACTIVE' : 'IDLE',
      statusColor: est > 0 ? 'text-emerald-500' : 'text-slate-400',
    },
    {
      label: 'Listening Sockets',
      value: listen.toLocaleString(),
      status: listen > 0 ? 'BOUND' : 'NONE',
      statusColor: 'text-slate-400',
    },
    {
      label: 'Time Wait Connections',
      value: tw.toLocaleString(),
      status: timeWaitStatus.label,
      statusColor: timeWaitStatus.color,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-slate-900 border border-slate-800/50 rounded-lg p-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{stat.label}</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
            <span className={`text-xs font-bold ${stat.statusColor} mb-1`}>{stat.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
