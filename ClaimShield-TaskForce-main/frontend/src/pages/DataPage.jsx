import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { fetchStats, reloadDataset } from '../api';

export default function DataPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [msg, setMsg] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReload = async () => {
    try {
      setReloading(true);
      setMsg(null);
      await reloadDataset();
      setMsg("Synthetic dataset successfully regenerated with seed 42.");
      await loadData();
    } catch (err) {
      setMsg(`Error regenerating: ${err.message}`);
    } finally {
      setReloading(false);
    }
  };

  return (
    <div className="content-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Data Operations & Synthetic Warehouse</h2>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Deterministic dataset generated under AS_OF_DATE: 2026-03-31 with zero Protected Health Information.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={handleReload}
          disabled={reloading}
          style={{ gap: '8px' }}
        >
          <RefreshCw size={14} className={reloading ? "spin" : ""} />
          {reloading ? "Regenerating..." : "Reload Synthetic Dataset"}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#065f46', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading database statistics...</div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Claims Analyzed</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {stats?.claims?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>12-month historical span</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Providers in Network</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {stats?.providers?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>10 peer specialty groups</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Covered Members</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {stats?.members?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Active & terminated coverage</div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Facilities & ASCs</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {stats?.facilities?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Including University Decoy Hub</div>
            </div>
          </div>

          {/* Detailed Entity Breakdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Relational Tables & Volume</span>
                <span className="badge badge-normal">SQLite Verified</span>
              </div>
              <div className="card-body" style={{ padding: '0' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Table Name</th>
                      <th>Record Count</th>
                      <th>Primary Key</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>claims</code></td>
                      <td><strong>{stats?.claims?.toLocaleString()}</strong></td>
                      <td><code>claim_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td><code>providers</code></td>
                      <td><strong>{stats?.providers?.toLocaleString()}</strong></td>
                      <td><code>provider_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td><code>members</code></td>
                      <td><strong>{stats?.members?.toLocaleString()}</strong></td>
                      <td><code>member_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td><code>facilities</code></td>
                      <td><strong>{stats?.facilities?.toLocaleString()}</strong></td>
                      <td><code>facility_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td><code>referrals</code></td>
                      <td><strong>{stats?.referrals?.toLocaleString()}</strong></td>
                      <td><code>referral_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td><code>member_stays</code></td>
                      <td><strong>{stats?.member_stays?.toLocaleString()}</strong></td>
                      <td><code>stay_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                    <tr>
                      <td><code>ground_truth_scenarios</code></td>
                      <td><strong>{stats?.planted_scenarios}</strong></td>
                      <td><code>scenario_id</code></td>
                      <td><span className="badge badge-normal">ACTIVE</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Environment & Seed Integrity</span>
                <Clock size={15} color="#64748b" />
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Synthetic AS OF DATE</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{stats?.as_of_date}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Deterministic Seed</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>42</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Forecast Cutoff Date</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>2026-01-01</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Planted Ground Truth Scenarios</span>
                    <strong>5 Escalating + 2 Decoys</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Database Engine</span>
                    <strong>SQLite 3 (WAL mode)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
