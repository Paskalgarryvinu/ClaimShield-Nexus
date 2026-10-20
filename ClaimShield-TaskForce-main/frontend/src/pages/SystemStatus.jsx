import React, { useState, useEffect } from 'react';
import { Activity, Cpu } from 'lucide-react';
import { fetchHealth, fetchAuditLog } from '../api';

export default function SystemStatus() {
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [h, l] = await Promise.all([fetchHealth(), fetchAuditLog(15)]);
        setHealth(h);
        setLogs(l);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="content-view" style={{ textAlign: 'center', padding: '50px' }}>Loading system health telemetry...</div>;
  }

  return (
    <div className="content-view">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>System Health & Pipeline Telemetry</h2>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
          Real-time diagnostic health of analytical engines, database connectivity, and audit tracking.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>API STATUS</span>
            <span className="badge badge-normal">ONLINE</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: '#0f172a' }}>FastAPI 0.110+</div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>Port 8000 (Active)</div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>SQLITE DATABASE</span>
            <span className="badge badge-normal">{health?.database?.status}</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: '#0f172a' }}>claimshield.db</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{health?.database?.counts?.claims?.toLocaleString()} claims</div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ENVIRONMENT</span>
            <span className="badge badge-critical" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>SYNTHETIC</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: '#0f172a' }}>Zero PHI / PII</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Deterministic Seed: {health?.random_seed}</div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>DECISION SUPPORT</span>
            <span className="badge badge-normal">ENGAGED</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: '#0f172a' }}>Human-in-the-Loop</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>No Auto-Adjudication</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '16px' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Subsystem Engines</span>
            <Cpu size={15} color="#64748b" />
          </div>
          <div className="card-body" style={{ padding: '0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Engine / Subsystem</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {health?.subsystems && Object.entries(health.subsystems).map(([key, st]) => (
                  <tr key={key}>
                    <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                      {key.replace('_', ' ')}
                    </td>
                    <td><span className="badge badge-normal">{st}</span></td>
                    <td style={{ fontSize: '11px', color: '#64748b' }}>Seeded & Operational</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Audit Trail & Action Logs</span>
            <Activity size={15} color="#64748b" />
          </div>
          <div className="card-body" style={{ padding: '0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.log_id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                        {log.timestamp?.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td><strong>{log.actor_role}</strong></td>
                      <td><span className="badge badge-normal" style={{ fontSize: '10px' }}>{log.event_type}</span></td>
                      <td style={{ fontSize: '11px', color: '#475569', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
