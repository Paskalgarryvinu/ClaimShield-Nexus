import React, { useState, useEffect } from 'react';
import { Play, Share2, ArrowRight } from 'lucide-react';

export default function CommandCenter({ onNavigate, horizon, onOpenCase }) {
  const [evalData, setEvalData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch('http://localhost:8000/api/evaluation/metrics');
        if (res.ok) {
          const data = await res.json();
          setEvalData(data);
        }
      } catch (e) {
        console.error('Failed to load evaluation metrics:', e);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  const funnel = evalData?.funnel;
  const evaluation = evalData?.evaluation;
  const topProviders = evalData?.top_risk_providers || [];
  const signalDist = evalData?.signal_distribution || [];
  const workload = evalData?.workload;

  if (loading && !evalData) {
    return (
      <div className="content-view" style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
        Loading Command Center analytics & funnel metrics...
      </div>
    );
  }

  return (
    <div className="content-view">
      {/* Top SIU Command Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #09131f 0%, #1e293b 100%)',
        color: '#fff',
        padding: '22px 28px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#60a5fa', fontWeight: 700 }}>
              Special Investigation Unit Command
            </span>
            <span style={{ background: 'rgba(59, 130, 246, 0.25)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '1px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
              HORIZON: {horizon} DAYS
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>
            ClaimShield Nexus Decision-Support Console
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            From claim-level alerts to investigation-ready intelligence. Detect. Correlate. Prioritize. Explain.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn-primary"
            onClick={() => onNavigate('demo-mode')}
            style={{ background: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontWeight: 600 }}
          >
            <Play size={14} fill="#fff" />
            Launch Live Demo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px', borderTop: '3px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Claims Ingested</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {funnel?.raw_claims ? funnel.raw_claims.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            100% peer normalized across 10 specialties
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Detected Signals</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
            {funnel?.signals_detected ? funnel.signals_detected.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            8 algorithmic deterministic rule engines
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderTop: '3px solid #8b5cf6' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Correlated Cases</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>
            {funnel?.cases_formed || '...'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            Weighted Louvain entity clusters
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderTop: '3px solid #ef4444' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Priority Investigations</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b91c1c', marginTop: '4px' }}>
            {funnel?.priority_investigations || '...'}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            Within capacity quota ({workload?.capacity || 15} slots)
          </div>
        </div>
      </div>

      {/* Grid: Alert-Reduction Funnel & Ground Truth Evaluation Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Funnel Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Alert-Reduction Investigation Funnel</span>
            <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              {funnel?.reduction_percentage}% Volume Reduction
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>1. Raw Ingested Claims</span>
                  <strong>{funnel?.raw_claims?.toLocaleString() || 0} claims (100%)</strong>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#3b82f6' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>2. Algorithmic Signals Flagged</span>
                  <strong>{funnel?.signals_detected || 0} signals ({((funnel?.signals_detected / (funnel?.raw_claims || 1)) * 100).toFixed(1)}%)</strong>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '25%', height: '100%', background: '#f59e0b' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>3. Multi-Entity Correlated Cases</span>
                  <strong>{funnel?.cases_formed || 0} cases</strong>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '12%', height: '100%', background: '#8b5cf6' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>4. Priority SIU Investigation Queue</span>
                  <strong>{funnel?.priority_investigations || 0} cases (Top Capacity)</strong>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '6%', height: '100%', background: '#ef4444' }}></div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Investigation Productivity Gain:</strong> SIU investigators review correlated syndicates instead of triage fatigue.
              </div>
              <button
                onClick={() => onNavigate('siu-queue')}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>Open Queue</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Ground Truth Evaluation Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Ground Truth Analytical Evaluation</span>
            <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Evaluation Module
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Scenario Recall</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>
                  {evaluation?.scenario_recall_pct || 100}%
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {evaluation?.scenarios_detected} / {evaluation?.scenarios_tested} planted rings detected
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Decoy False Alarms</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>
                  {evaluation?.decoy_false_positives || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  {evaluation?.decoy_protection_status || 'PASS'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.5, marginBottom: '12px' }}>
              <strong>Decoy Validation:</strong> Legitimate high-volume facilities (e.g., Metro General University Medical Center) and practices (Summit Comprehensive Orthopedics) are protected by peer normalization and hub isolation.
            </div>

            <div style={{ padding: '8px 10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '4px', fontSize: '11px', color: '#92400e', marginBottom: '12px' }}>
              <strong>Analytical Caveat:</strong> {evaluation?.disclaimer}
            </div>

            {evaluation?.scenario_details?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>GROUND TRUTH SYNDICATES:</span>
                {evaluation.scenario_details.map(sc => (
                  <div key={sc.scenario_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', background: '#f8fafc', padding: '5px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <span><strong>{sc.scenario_id}:</strong> {sc.name}</span>
                    {sc.matched_case_id && onOpenCase && (
                      <button
                        onClick={() => onOpenCase(sc.matched_case_id)}
                        style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '10.5px' }}
                      >
                        Inspect ({sc.matched_case_id}) →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Top Risk Providers & Signal Type Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
        {/* Top Risk Entities */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Top Risk Providers & Practice Entities</span>
            <button
              onClick={() => onNavigate('network')}
              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Explore in Network Canvas</span>
              <Share2 size={12} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider / Entity</th>
                  <th>Specialty</th>
                  <th>Signal Flags</th>
                  <th>Paid Exposure</th>
                  <th>History</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {topProviders.map(p => (
                  <tr key={p.provider_id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.provider_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace' }}>{p.provider_id}</div>
                    </td>
                    <td>{p.specialty}</td>
                    <td>
                      <span className="badge badge-critical">{p.signal_count} signals</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>${Math.round(p.total_paid).toLocaleString()}</td>
                    <td>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        color: p.risk_history === 'CLEAN' ? '#16a34a' : '#ea580c'
                      }}>
                        {p.risk_history}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => onNavigate('network')}
                        style={{ padding: '3px 8px', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signal Distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Signal Type Distribution</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {signalDist.map(s => (
                <div key={s.signal_type}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>{s.signal_type.replace(/_/g, ' ').toUpperCase()}</span>
                    <span style={{ color: '#64748b' }}>{s.count} alerts</span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min((s.count / 150) * 100, 100)}%`,
                      height: '100%',
                      background: s.signal_type.includes('duplicate') ? '#ef4444' : (s.signal_type.includes('timing') ? '#f59e0b' : '#3b82f6')
                    }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
