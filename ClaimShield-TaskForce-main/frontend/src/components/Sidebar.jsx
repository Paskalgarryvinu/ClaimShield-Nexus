import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Network,
  ListOrdered,
  FileSearch,
  TrendingUp,
  Database,
  PlayCircle,
  Sliders,
  Activity,
  ShieldCheck
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  onSelectTab,
  currentRole,
  queueCount = 0,
  activeCaseId = null
}) {
  const isProgramManager = currentRole === 'Program Manager';

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <div className="brand-title">CLAIMSHIELD</div>
          <div className="brand-sub">NEXUS INTELLIGENCE</div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav">
        <div className="nav-section-title">Investigation Suite</div>

        <div
          className={`nav-item ${activeTab === 'command-center' ? 'active' : ''}`}
          onClick={() => onSelectTab('command-center')}
        >
          <LayoutDashboard size={16} />
          <span>Command Center</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'claims' ? 'active' : ''}`}
          onClick={() => onSelectTab('claims')}
        >
          <FileSpreadsheet size={16} />
          <span>Claims Intelligence</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => onSelectTab('network')}
        >
          <Network size={16} />
          <span>Network Explorer</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'siu-queue' ? 'active' : ''}`}
          onClick={() => onSelectTab('siu-queue')}
        >
          <ListOrdered size={16} />
          <span>SIU Queue</span>
          {queueCount > 0 && <span className="nav-badge">{queueCount}</span>}
        </div>

        <div
          className={`nav-item ${activeTab === 'investigations' ? 'active' : ''}`}
          onClick={() => onSelectTab('investigations')}
        >
          <FileSearch size={16} />
          <span>Investigations</span>
          {activeCaseId && (
            <span className="nav-badge" style={{ background: '#3b82f6', color: '#fff', fontSize: '9px' }}>
              {activeCaseId}
            </span>
          )}
        </div>

        <div
          className={`nav-item ${activeTab === 'risk-forecast' ? 'active' : ''}`}
          onClick={() => onSelectTab('risk-forecast')}
        >
          <TrendingUp size={16} />
          <span>Risk Forecast</span>
        </div>

        <div
          className={`nav-item ${activeTab === 'demo-mode' ? 'active' : ''}`}
          onClick={() => onSelectTab('demo-mode')}
        >
          <PlayCircle size={16} />
          <span>Demo Mode</span>
          <span className="nav-badge" style={{ background: '#10b981', color: '#fff', fontSize: '9px' }}>
            LIVE
          </span>
        </div>

        <div
          className={`nav-item ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => onSelectTab('data')}
        >
          <Database size={16} />
          <span>Data Operations</span>
        </div>

        {/* Administration Section */}
        <div className="nav-section-title" style={{ marginTop: '12px' }}>
          Governance & Ops
        </div>

        {isProgramManager && (
          <div
            className={`nav-item ${activeTab === 'administration' ? 'active' : ''}`}
            onClick={() => onSelectTab('administration')}
          >
            <Sliders size={16} />
            <span>Administration</span>
            <span className="nav-badge" style={{ background: '#6366f1', color: '#fff', fontSize: '9px' }}>
              MGR
            </span>
          </div>
        )}

        <div
          className={`nav-item ${activeTab === 'system-status' ? 'active' : ''}`}
          onClick={() => onSelectTab('system-status')}
        >
          <Activity size={16} />
          <span>System Status</span>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b' }}>
          <span>AS OF DATE</span>
          <strong style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>2026-03-31</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', marginTop: '4px' }}>
          <span>SEED</span>
          <span style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>42 (FIXED)</span>
        </div>
      </div>
    </aside>
  );
}
