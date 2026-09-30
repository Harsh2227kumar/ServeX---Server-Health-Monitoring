import React, { useState } from 'react'
import { useMetrics } from '../../context/MetricsContext';

export default function ProcessDetailsTable() {
  const [expandedRows, setExpandedRows] = useState({})
  const { networkProcessMetrics } = useMetrics();
  const byPid = networkProcessMetrics?.data?.connections_per_process ?? {};
  const topBandwidth = networkProcessMetrics?.data?.top_processes_by_bandwidth ?? [];
  const bwMap = Object.fromEntries(topBandwidth.map((p) => [p.pid, p.estimated_bandwidth]));

  const processes = Object.values(byPid)
    .map((p) => {
      const conns = p.connections || [];
      const established = conns.filter((c) => c.status === 'ESTABLISHED').length;
      const listen = conns.filter((c) => c.status === 'LISTEN').length;
      const bindPort = [...new Set(conns.map((c) => c.port))].slice(0, 4).join(', ') || '—';
      const status = conns.length > 0 ? 'ACTIVE' : 'IDLE';
      const throughputWeight = bwMap[p.pid] || 0;
      return {
        name: p.name,
        pid: p.pid,
        totalConn: conns.length,
        established,
        listen,
        bindPort,
        status,
        throughput: `${throughputWeight}`,
        errorRate: 'N/A',
      };
    })
    .sort((a, b) => b.totalConn - a.totalConn)
    .slice(0, 10);

  const toggleExpand = (idx) => {
    setExpandedRows(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }))
  }

  return (
    <div className="bg-[#1a2332] border border-slate-800/50 rounded overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 bg-[#151d2a]">
        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-100">Process Connection Details</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '35%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr className="bg-[#0f1521] border-b border-slate-800">
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Process Name</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">PID</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Conn</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Established</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Listen</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((proc, idx) => (
              <React.Fragment key={idx}>
                <tr className="hover:bg-slate-900/40 transition-colors border-b border-slate-800">
                  <td className="px-6 py-4 overflow-hidden">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 text-sm flex-shrink-0">dns</span>
                      <span className="text-xs font-bold text-slate-200 truncate">{proc.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">{proc.pid}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-100">{proc.totalConn.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-emerald-500">{proc.established.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">{proc.listen}</span>
                      <button onClick={() => toggleExpand(idx)} className="text-slate-500 hover:text-[#256af4] transition-colors flex-shrink-0">
                        <span className="material-symbols-outlined text-sm">
                          {expandedRows[idx] ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedRows[idx] && (
                  <tr className="bg-[#0f1521]/50 border-b border-slate-800">
                    <td colSpan="5" className="px-6 py-4">
                      <div className="grid grid-cols-4 gap-4 p-4 border border-slate-800 rounded bg-[#0f1521]">
                        <div>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Bind Port</p>
                          <p className="text-xs font-mono text-[#256af4]">{proc.bindPort}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Status</p>
                          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 inline-block rounded uppercase tracking-widest">{proc.status}</span>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Activity Weight</p>
                          <p className="text-xs font-mono text-slate-300">{proc.throughput}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">Error Rate</p>
                          <p className="text-xs font-mono text-slate-300">{proc.errorRate}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
