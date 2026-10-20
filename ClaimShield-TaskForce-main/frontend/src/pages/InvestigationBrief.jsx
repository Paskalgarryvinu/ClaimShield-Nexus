import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertTriangle,
  Shield,
  Clock,
  Network,
  TrendingUp,
  CheckCircle2,
  HelpCircle,
  Send,
  Printer
} from 'lucide-react';
import DossierExportModal from '../components/DossierExportModal';

export default function InvestigationBrief({ caseId, horizon = 30, currentRole = 'Investigator' }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('evidence'); // evidence | timeline | network | forecast
  const [selectedSignalId, setSelectedSignalId] = useState(null);
  const [decisionAction, setDecisionAction] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionSuccess, setDecisionSuccess] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      const res = await fetch(`http://localhost:8000/api/cases/${caseId}?horizon=${horizon}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
        if (data.signals?.length > 0) {
          setSelectedSignalId(data.signals[0].signal_id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [caseId, horizon]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const handleRecordDecision = async () => {
    if (!decisionAction || !decisionReason.trim()) return;
    try {
      setSubmittingDecision(true);
      const res = await fetch(`http://localhost:8000/api/cases/${caseId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: decisionAction,
          reason: decisionReason,
          role: currentRole
        })
      });
      if (res.ok) {
        setDecisionSuccess(`Decision '${decisionAction}' recorded in audit log. Case status updated.`);
        setDecisionAction(null);
        setDecisionReason('');
        await loadCase();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (!caseId) {
    return (
      <div className="content-view" style={{ textAlign: 'center', padding: '60px' }}>
        <HelpCircle size={36} color="#94a3b8" style={{ marginBottom: '12px' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 600 }}>No Case Selected</h3>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
          Please select an investigation dossier from the SIU Priority Queue or Command Center.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="content-view" style={{ textAlign: 'center', padding: '60px' }}>Loading case dossier {caseId}...</div>;
  }

  const c = detail?.case;
  const rb = detail?.risk_breakdown?.breakdown || {};
  const forecast = detail?.forecast;
  const isCapped = detail?.is_uncertainty_capped;

  return (
    <div className="content-view">
      {/* Dossier Header */}
      <div style={{ background: '#09131f', color: '#fff', padding: '18px 24px', borderRadius: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>
                {c?.case_id}
              </span>
              <span style={{ color: '#94a3b8' }}>•</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                {c?.case_type}
              </span>
              <span className="badge badge-normal" style={{ marginLeft: '6px', fontSize: '10px' }}>
                STATUS: {c?.status}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, maxWidth: '780px' }}>
              {c?.summary_description}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Financial Exposure
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
              ${c?.exposure_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <button
              onClick={() => setIsExportModalOpen(true)}
              style={{
                marginTop: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(96, 165, 250, 0.15)',
                color: '#93c5fd',
                border: '1px solid rgba(96, 165, 250, 0.4)',
                padding: '5px 10px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              title="Generate printable referral packet or export JSON"
            >
              <Printer size={12} />
              Export SIU Dossier
            </button>
          </div>
        </div>

        {/* Metric Badges Strip */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #1e293b', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#142234', padding: '4px 10px', borderRadius: '5px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Risk Score:</span>
            <strong style={{ color: '#fb923c' }}>{c?.risk_score} / 100</strong>
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>({c?.risk_band})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#142234', padding: '4px 10px', borderRadius: '5px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Member Impact:</span>
            <strong>{c?.member_impact_level}</strong>
            <span style={{ fontSize: '10px', color: '#cbd5e1' }}>({c?.member_count} members)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#142234', padding: '4px 10px', borderRadius: '5px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Evidence Strength:</span>
            <strong>{c?.evidence_strength}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#142234', padding: '4px 10px', borderRadius: '5px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Confidence:</span>
            <strong>{c?.confidence_score}%</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#142234', padding: '4px 10px', borderRadius: '5px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Severity:</span>
            <strong>{c?.severity_level}</strong>
          </div>
        </div>
      </div>

      {/* Uncertainty & Responsible AI Banner */}
      {isCapped && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', color: '#92400e', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <div>
            <strong>Uncertainty Policy Engaged:</strong> {detail?.recommendation_cap_note} Recommendation capped at <em>Request More Evidence</em> to prevent unwarranted actions.
          </div>
        </div>
      )}

      {decisionSuccess && (
        <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', color: '#065f46', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {decisionSuccess}
        </div>
      )}

      {/* 5-Component Risk Score Breakdown */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-header">
          <span className="card-title">Transparent 5-Factor Risk Breakdown</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Deterministic points sum to {c?.risk_score} pts</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>1. BEHAVIOR</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>
                {rb.behavior_points || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>/ 30</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Billing duplicates & timing</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>2. NETWORK</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>
                {rb.network_points || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>/ 25</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Referral loops & shared tax</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>3. ANOMALY</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>
                {rb.anomaly_points || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>/ 15</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Isolation Forest peer norm</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>4. HISTORY</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>
                {rb.history_points || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>/ 15</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Prior SIU investigations</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>5. TEMPORAL</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: '2px 0' }}>
                {rb.temporal_points || 0} <span style={{ fontSize: '11px', color: '#94a3b8' }}>/ 15</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Recency velocity surge</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
        <button
          className={`btn-secondary ${activeTab === 'evidence' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('evidence')}
          style={{ gap: '6px', fontSize: '12px' }}
        >
          <FileText size={14} /> Evidence Dossier ({detail?.claims?.length} claims)
        </button>
        <button
          className={`btn-secondary ${activeTab === 'network' ? 'active' : ''}`}
          onClick={() => setActiveTab('network')}
          style={{ gap: '6px', fontSize: '12px' }}
        >
          <Network size={14} /> Network Context ({detail?.entities?.length} entities)
        </button>
        <button
          className={`btn-secondary ${activeTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveTab('forecast')}
          style={{ gap: '6px', fontSize: '12px' }}
        >
          <TrendingUp size={14} /> Horizon Forecast ({horizon}d)
        </button>
        <button
          className={`btn-secondary ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
          style={{ gap: '6px', fontSize: '12px' }}
        >
          <Clock size={14} /> Audit & Activity Trail
        </button>
      </div>

      {/* TAB 1: Evidence Dossier */}
      {activeTab === 'evidence' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
          {/* Signal selector */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Correlated Signals</span>
            </div>
            <div className="card-body" style={{ padding: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {detail?.signals?.map((sig) => (
                  <div
                    key={sig.signal_id}
                    onClick={() => setSelectedSignalId(sig.signal_id)}
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: selectedSignalId === sig.signal_id ? '2px solid #1d4ed8' : '1px solid #e2e8f0',
                      background: selectedSignalId === sig.signal_id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span className="badge badge-normal" style={{ fontSize: '9.5px' }}>{sig.signal_type}</span>
                      <span className="badge badge-critical" style={{ fontSize: '9.5px' }}>{sig.severity}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#0f172a', lineHeight: 1.3 }}>
                      {sig.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Evidence Details and Claims */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Supporting Claims & Evidence Payload</span>
            </div>
            <div className="card-body" style={{ padding: '0' }}>
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Claim ID</th>
                      <th>Date</th>
                      <th>Provider</th>
                      <th>Member</th>
                      <th>Procedure</th>
                      <th>Billed</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail?.claims?.slice(0, 30).map((clm) => (
                      <tr key={clm.claim_id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{clm.claim_id}</td>
                        <td style={{ fontSize: '11px' }}>{clm.service_date}</td>
                        <td style={{ fontSize: '11px' }}>{clm.provider_name || clm.provider_id}</td>
                        <td style={{ fontSize: '11px' }}>{clm.synthetic_name || clm.member_id}</td>
                        <td><code>{clm.procedure_code}</code></td>
                        <td>${clm.billed_amount?.toFixed(2)}</td>
                        <td style={{ fontWeight: 600 }}>${clm.paid_amount?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Network Context */}
      {activeTab === 'network' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <span className="card-title">Involved Case Entity Cluster</span>
            <span className="badge badge-normal">{detail?.entities?.length} Coordinated Nodes</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {detail?.entities?.map((ent) => (
                <div key={ent.entity_id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="badge badge-normal" style={{ fontSize: '10px' }}>{ent.entity_type}</span>
                    <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{ent.role}</span>
                  </div>
                  <strong style={{ fontSize: '13px', color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                    {ent.entity_id}
                  </strong>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Connected via shared attributes and referral interactions.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Forecast */}
      {activeTab === 'forecast' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <span className="card-title">Risk Forecast ({horizon}d Evaluation Horizon)</span>
            <span className="badge badge-high">Escalation Probability: {(forecast?.repeat_risk_prob * 100)?.toFixed(1)}%</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Escalation Probability Estimate
                </h4>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#d97706', marginBottom: '4px' }}>
                  {(forecast?.repeat_risk_prob * 100)?.toFixed(1)}%
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '14px' }}>
                  95% Confidence Interval: [{(forecast?.confidence_interval_low * 100)?.toFixed(1)}% - {(forecast?.confidence_interval_high * 100)?.toFixed(1)}%]
                </div>
                <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11.5px', color: '#475569' }}>
                  <strong>Policy Notice:</strong> Forecast represents decision-support risk derived from pre-cutoff billing velocity, not a determination of fraud.
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Key Algorithmic Drivers
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {forecast?.top_drivers?.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', borderRadius: '5px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                      <span>{d.label}</span>
                      <strong style={{ color: '#1d4ed8' }}>+{d.contribution}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Timeline & Audit History */}
      {activeTab === 'timeline' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <span className="card-title">Case Activity & Adjudication Trail</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {detail?.activity?.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>No activity records logged for this case.</div>
              ) : (
                detail?.activity?.map((act, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #1d4ed8', paddingLeft: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      {act.timestamp?.replace('T', ' ').slice(0, 19)} • Actor: {act.actor_role}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 600, marginTop: '2px' }}>
                      {act.event_type}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#475569' }}>
                      {act.details}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Human Adjudication Decision Bar */}
      <div className="card" style={{ border: '2px solid #cbd5e1', background: '#f8fafc' }}>
        <div className="card-header" style={{ background: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} color="#1d4ed8" />
            <span className="card-title">Human Adjudication Decision Bar</span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Final decision authority belongs strictly to human investigator</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <button
              className={`btn-secondary ${decisionAction === 'INVESTIGATE' ? 'btn-primary' : ''}`}
              onClick={() => setDecisionAction('INVESTIGATE')}
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              Investigate
            </button>
            <button
              className={`btn-secondary ${decisionAction === 'REQUEST_MORE_EVIDENCE' ? 'btn-primary' : ''}`}
              onClick={() => setDecisionAction('REQUEST_MORE_EVIDENCE')}
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              Request More Evidence
            </button>
            <button
              className={`btn-secondary ${decisionAction === 'MARK_FALSE_POSITIVE' ? 'btn-primary' : ''}`}
              onClick={() => setDecisionAction('MARK_FALSE_POSITIVE')}
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              Mark False Positive
            </button>
            <button
              className={`btn-secondary ${decisionAction === 'ESCALATE' ? 'btn-primary' : ''}`}
              onClick={() => setDecisionAction('ESCALATE')}
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              Escalate Case
            </button>
            <button
              className={`btn-secondary ${decisionAction === 'CLOSE_CASE' ? 'btn-primary' : ''}`}
              onClick={() => setDecisionAction('CLOSE_CASE')}
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              Close Case
            </button>
          </div>

          {decisionAction && (
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Mandatory Investigator Rationale for Action: <em>{decisionAction}</em>
              </label>
              <textarea
                rows="3"
                placeholder="State specific evidentiary basis, interview notes, or rationale for this decision..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12.5px', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button className="btn-secondary" onClick={() => setDecisionAction(null)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleRecordDecision}
                  disabled={!decisionReason.trim() || submittingDecision}
                  style={{ gap: '6px' }}
                >
                  <Send size={13} />
                  {submittingDecision ? 'Writing Audit Event...' : 'Record & Commit Decision'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official SIU Referral Dossier Export Modal */}
      <DossierExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        caseDetail={detail}
        horizon={horizon}
      />
    </div>
  );
}
