import { useMetrics } from '../../context/MetricsContext';

export default function PortSummaryCards() {
  const { networkProcessMetrics } = useMetrics();
  const d = networkProcessMetrics?.data ?? {};
  const processList = d.network_process_list ?? [];
  const byPid = d.connections_per_process ?? {};

  const processes = Object.values(byPid);

  const totalProcesses = processList.length;
  const activeProcesses = processes.filter((p) => (p.connections?.length || 0) > 0).length;

  const allConnections = processes.flatMap((p) => p.connections || []);
  const totalConnections = allConnections.length;

  const isTcp = (c) => (c.type ? c.type === 'tcp' : c.status && c.status !== 'NONE');
  const isUdp = (c) => (c.type ? c.type === 'udp' : !c.status || c.status === 'NONE');

  const tcpCount = allConnections.filter(isTcp).length;
  const udpCount = allConnections.filter(isUdp).length;
  const otherCount = Math.max(0, totalConnections - tcpCount - udpCount);

  const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const allocationPct = pct(activeProcesses, totalProcesses);

  const tcpPct = pct(tcpCount, totalConnections);
  const udpPct = pct(udpCount, totalConnections);
  const otherPct = Math.max(0, 100 - tcpPct - udpPct);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Total Processes */}
      <div className="bg-[#1a2332] border border-slate-800/50 rounded p-6">
        <p className="uppercase tracking-widest text-[10px] font-bold text-slate-500 mb-2">Total Processes</p>
        <div className="flex items-end space-x-3 mb-4">
          <h3 className="text-4xl font-bold tracking-tighter text-slate-100">{totalProcesses.toLocaleString()}</h3>
          <span className="text-emerald-500 text-xs font-bold mb-1 flex items-center">
            <span className="material-symbols-outlined text-xs">arrow_drop_up</span>
            {activeProcesses.toLocaleString()} active
          </span>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-[#256af4]" style={{ width: `${allocationPct}%` }}></div>
        </div>
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
          {allocationPct}% Resource Allocation
        </p>
      </div>

      {/* Total Connections */}
      <div className="bg-[#1a2332] border border-slate-800/50 rounded p-6">
        <p className="uppercase tracking-widest text-[10px] font-bold text-slate-500 mb-2">Total Connections</p>
        <div className="flex items-end space-x-3 mb-4">
          <h3 className="text-4xl font-bold tracking-tighter text-slate-100">{totalConnections.toLocaleString()}</h3>
          <span className="text-blue-400 text-xs font-bold mb-1 flex items-center">
            <span className="material-symbols-outlined text-xs">trending_up</span> Active
          </span>
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0 mb-2">
          <div className="h-full bg-[#256af4]" style={{ width: `${tcpPct}%` }}></div>
          <div className="h-full bg-amber-500" style={{ width: `${udpPct}%` }}></div>
          <div className="h-full bg-slate-700" style={{ width: `${otherPct}%` }}></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
          <span>TCP: {tcpCount.toLocaleString()}</span>
          <span>UDP: {udpCount.toLocaleString()}</span>
          <span>Other: {otherCount.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
