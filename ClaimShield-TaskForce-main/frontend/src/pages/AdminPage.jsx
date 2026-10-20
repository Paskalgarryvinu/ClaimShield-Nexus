import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { fetchConfig, updateConfig } from '../api';

export default function AdminPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const cfg = await fetchConfig();
        setConfig(cfg);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggleRule = (ruleKey) => {
    setConfig((prev) => ({
      ...prev,
      rules_enabled: {
        ...prev.rules_enabled,
        [ruleKey]: !prev.rules_enabled[ruleKey]
      }
    }));
  };

  const handleCapacityChange = (val) => {
    setConfig((prev) => ({
      ...prev,
      investigation_capacity: parseInt(val, 10) || 15
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatusMsg(null);
      await updateConfig(config);
      setStatusMsg("Configuration parameters updated and logged to audit trail.");
    } catch (e) {
      setStatusMsg(`Save error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="content-view" style={{ textAlign: 'center', padding: '50px' }}>Loading governance controls...</div>;
  }

  return (
    <div className="content-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Program Administration & Rule Governance</h2>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Supervisor controls: toggle detection rules, adjust sensitivity thresholds, and set SIU investigator capacity.
          </p>
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ gap: '6px' }}>
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {statusMsg && (
        <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#065f46', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {statusMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        {/* Detection Rules Toggles */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Algorithmic Detection Rules</span>
            <span className="badge badge-normal">Active in Pipeline</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {config?.rules_enabled && Object.entries(config.rules_enabled).map(([key, isEnabled]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: isEnabled ? '#f8fafc' : '#f1f5f9'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '12.5px', textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {key === 'duplicate_billing' && 'Detects identical member, provider, date, procedure'}
                      {key === 'unbundling' && 'Evaluates component codes billed together vs bundle definitions'}
                      {key === 'phantom_service' && 'Cross-checks inpatient stays, expired coverage, daily hours'}
                      {key === 'impossible_timing' && 'Flags geographic travel contradictions on same calendar date'}
                      {key === 'excessive_utilization' && 'Identifies outlier claim frequencies vs specialty peer group'}
                      {key === 'unusual_billing' && 'Monitors Level 5 code concentration & amount distribution'}
                      {key === 'referral_concentration' && 'Calculates referral concentration loop indices'}
                      {key === 'shared_identity_linkage' && 'Tracks shared owner, tax ID, and address clusters'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggleRule(key)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIU Capacity & Thresholds */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Investigation Capacity Constraint</span>
            </div>
            <div className="card-body">
              <label style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Active Case Quota (Top N Priority Slots):
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={config?.investigation_capacity || 15}
                onChange={(e) => handleCapacityChange(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Only the top {config?.investigation_capacity || 15} ranked cases are elevated into active investigation status; remaining cases stay queued in monitoring.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Default Priority Ranking Strategy</span>
            </div>
            <div className="card-body">
              <select
                value={config?.priority_strategy || 'Balanced'}
                onChange={(e) => setConfig({ ...config, priority_strategy: e.target.value })}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
              >
                <option value="Balanced">Balanced (Risk, Exposure, Impact & Evidence)</option>
                <option value="Exposure">Financial Exposure (Max Dollar Recovery)</option>
                <option value="MemberImpact">Member Impact (Patient Safety & Harm)</option>
                <option value="Evidence">Evidence Strength (High Conviction Cases)</option>
                <option value="Severity">Composite Severity Level</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
