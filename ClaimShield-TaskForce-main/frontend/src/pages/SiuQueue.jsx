import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  AlertTriangle,
  ExternalLink,
  Sliders,
  Download
} from 'lucide-react';

export default function SiuQueue({ onSelectCase, activeHorizon = 30 }) {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState('Balanced');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('priority');
  const [searchTerm, setSearchTerm] = useState('');

  const loadQueue = useCallback(async (selectedStrategy = strategy) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStrategy) params.set('strategy', selectedStrategy);
      if (riskFilter !== 'ALL') params.set('risk_band', riskFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sortBy) params.set('sort_by', sortBy);
      if (searchTerm) params.set('search', searchTerm);

      const res = await fetch(`http://localhost:8000/api/queue?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
        if (data.strategy && data.strategy !== strategy) setStrategy(data.strategy);
      }
    } catch (e) {
      console.error("Queue load error:", e);
    } finally {
      setLoading(false);
    }
  }, [strategy, riskFilter, statusFilter, sortBy, searchTerm]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const handleStrategyChange = async (newStrat) => {
    setStrategy(newStrat);
    try {
      await fetch('http://localhost:8000/api/queue/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: newStrat })
      });
      loadQueue(newStrat);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportQueueCSV = () => {
    if (!queueData?.cases || queueData.cases.length === 0) return;
    const headers = [
      'Rank',
      'Priority Category',
      'Case ID',
      'Case Type',
      'Risk Score',
      'Risk Band',
      'Exposure Amount',
      'Member Impact',
      'Member Count',
      'Severity',
      'Evidence Strength',
      'Confidence Pct',
      'Priority Score',
      'Status'
    ];
    const rows = queueData.cases.map((c, idx) => [
      idx + 1,
      idx < (queueData.capacity || 15) ? 'Priority Investigation' : 'Queued Candidate',
      c.case_id,
      `"${c.case_type}"`,
      c.risk_score,
      c.risk_band,
      c.exposure_amount,
      c.member_impact_level,
      c.member_count,
      c.severity,
      c.evidence_strength,
      c.confidence_pct,
      c.priority_score,
      c.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `siu_priority_queue_${strategy.replace(/\s+/g, '_')}_${activeHorizon}d.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getRiskBadgeClass = (band) => {
    switch (band) {
      case 'CRITICAL': return 'badge-critical';
      case 'HIGH': return 'badge-high';
      case 'ELEVATED': return 'badge-elevated';
      case 'MONITORED': return 'badge-monitored';
      default: return 'badge-normal';
    }
  };

  const getEvidenceBadgeClass = (str) => {
    switch (str) {
      case 'Strong': return 'badge-high';
      case 'Moderate': return 'badge-elevated';
      default: return 'badge-monitored';
    }
  };

  return (
    <div className="content-view">
      {/* Header and Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>SIU Priority Investigation Queue</h2>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Workload-bounded triage queue ranked by multi-component algorithmic priority.
          </p>
        </div>

        {/* Strategy Selector & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Ranking Strategy:</span>
            <select
              value={strategy}
              onChange={(e) => handleStrategyChange(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                fontWeight: 600,
                background: '#ffffff',
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              <option value="Balanced">Balanced (Standard SIU Matrix)</option>
              <option value="Financial Exposure">Financial Exposure (Max Recovery)</option>
              <option value="MemberImpact">Member Impact (Patient Safety)</option>
              <option value="Evidence Strength">Evidence Strength (High Conviction)</option>
              <option value="Severity">Composite Severity Level</option>
            </select>
          </div>

          <button
            onClick={handleExportQueueCSV}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            title="Export complete prioritized queue to CSV"
          >
            <Download size={13} />
            Export Queue (CSV)
          </button>
        </div>
      </div>

      {/* Capacity Quota Banner */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: '6px',
        padding: '10px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={16} color="#1d4ed8" />
          <span style={{ fontSize: '12.5px', color: '#1e40af', fontWeight: 500 }}>
            Investigation Capacity: <strong>{queueData?.capacity || 15} slots available</strong>; {queueData?.total_cases_ranked || 0} cases ranked; <strong>top {queueData?.priority_investigations_selected || 15} selected as Active Priority Investigations</strong>.
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
          HORIZON: {activeHorizon}d ACTIVE
        </span>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Filter Case or Entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadQueue()}
            style={{ width: '100%', padding: '5px 8px 5px 28px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }}
          />
        </div>

        {/* Risk Band Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Risk:</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
          >
            <option value="ALL">All Bands</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="ELEVATED">Elevated</option>
            <option value="MONITORED">Monitored</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="IN REVIEW">In Review</option>
            <option value="EVIDENCE REQUESTED">Evidence Requested</option>
            <option value="ESCALATED">Escalated</option>
            <option value="CLOSED">Closed</option>
            <option value="FALSE POSITIVE">False Positive</option>
          </select>
        </div>

        {/* Sort By */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }}
          >
            <option value="priority">Priority Rank</option>
            <option value="risk">Risk Score</option>
            <option value="exposure">Financial Exposure</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Calculating priority queue...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>Rank</th>
                <th>Case Dossier</th>
                <th>Category Pattern</th>
                <th>Risk Score</th>
                <th>Exposure ($)</th>
                <th>Member Impact</th>
                <th>Evidence</th>
                <th>Confidence</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queueData?.cases?.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No cases match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                queueData?.cases?.map((c) => {
                  const isTopPriority = c.is_priority_investigation === 1;
                  return (
                    <tr
                      key={c.case_id}
                      style={{
                        background: isTopPriority ? '#fafcff' : '#ffffff',
                        cursor: 'pointer'
                      }}
                      onClick={() => onSelectCase(c.case_id)}
                    >
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        {isTopPriority ? (
                          <span style={{ color: '#1d4ed8' }}>#{c.priority_rank}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>#{c.priority_rank}</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ color: '#1d4ed8', fontFamily: 'var(--font-mono)' }}>
                            {c.case_id}
                          </strong>
                          {isTopPriority && (
                            <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px' }}>
                              TOP
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          {c.primary_provider_id}
                        </div>
                      </td>

                      <td style={{ fontSize: '11.5px', fontWeight: 500 }}>
                        {c.case_type}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`badge ${getRiskBadgeClass(c.risk_band)}`}>
                            {c.risk_score}
                          </span>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>{c.risk_band}</span>
                        </div>
                      </td>

                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        ${c.exposure_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td>
                        <span style={{ fontSize: '11.5px' }}>
                          {c.member_impact_level} ({c.member_count})
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${getEvidenceBadgeClass(c.evidence_strength)}`}>
                          {c.evidence_strength}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{c.confidence_score}%</span>
                          {c.is_low_confidence && (
                            <span title="Low confidence: Evidence limited" style={{ color: '#d97706' }}>
                              <AlertTriangle size={12} />
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: isTopPriority ? '#0f172a' : '#64748b', fontSize: '13px' }}>
                          {c.priority_score}
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-normal" style={{ fontSize: '10px' }}>
                          {c.status}
                        </span>
                      </td>

                      <td>
                        <button
                          className="btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', gap: '4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(c.case_id);
                          }}
                        >
                          Review <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
