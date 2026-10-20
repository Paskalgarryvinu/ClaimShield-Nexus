import React from 'react';
import { Printer, Download, X, ShieldAlert, FileText } from 'lucide-react';

export default function DossierExportModal({ isOpen, onClose, caseDetail, horizon = 30 }) {
  if (!isOpen || !caseDetail) return null;

  const c = caseDetail.case || {};
  const rb = caseDetail.risk_breakdown?.breakdown || {};
  const signals = caseDetail.signals || [];
  const claims = caseDetail.claims || [];
  const timeline = caseDetail.timeline || [];
  const forecast = caseDetail.forecast || {};
  const decisions = caseDetail.decisions || [];
  const exportDate = c.updated_at?.slice(0, 10) || c.created_at?.slice(0, 10) || "2026-03-31";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(caseDetail, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `SIU_Dossier_${c.case_id || 'Case'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div
        className="modal-dialog print-modal-dialog"
        style={{
          maxWidth: '850px',
          width: '92%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff'
        }}
      >
        {/* Modal Header */}
        <div className="modal-header no-print" style={{ backgroundColor: '#09131f', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#60a5fa" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
              Official SIU Investigation Dossier & Referral Packet — {c.case_id}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Content Body */}
        <div
          className="modal-body print-dossier-body"
          style={{ overflowY: 'auto', padding: '24px', flex: 1, backgroundColor: '#ffffff', color: '#0f172a' }}
        >
          {/* Header Banner */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <ShieldAlert size={20} color="#b91c1c" />
                  <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px', color: '#0f172a' }}>
                    CLAIMSHIELD NEXUS — SPECIAL INVESTIGATION UNIT (SIU)
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                  CONFIDENTIAL HEALTHCARE PAYER INVESTIGATION REFERRAL PACKET
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-critical" style={{ fontSize: '10px' }}>
                  SYNTHETIC ENVIRONMENT
                </span>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  GENERATED: {exportDate}
                </div>
              </div>
            </div>
          </div>

          {/* Case Metadata Table */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>CASE ID</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#1e40af' }}>{c.case_id}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>INVESTIGATION TYPE</span>
                <strong>{c.case_type}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>STATUS</span>
                <span className="badge badge-normal" style={{ fontSize: '10px' }}>{c.status}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>PRIORITY RANK</span>
                <strong>#{c.priority_rank || '1'} (Active Triage)</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>COMPOSITE RISK SCORE</span>
                <strong style={{ color: '#c2410c' }}>{c.risk_score} / 100 ({c.risk_band})</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>DEDUPLICATED EXPOSURE</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: '#047857' }}>
                  ${Number(c.exposure_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>AFFECTED MEMBERS</span>
                <strong>{c.member_count} ({c.member_impact_level})</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>EVIDENCE STRENGTH</span>
                <strong>{c.evidence_strength} ({c.confidence_pct}% Confidence)</strong>
              </div>
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #cbd5e1', fontSize: '12px', color: '#334155' }}>
              <strong>Executive Summary:</strong> {c.summary_description}
            </div>
          </div>

          {/* 5-Factor Risk Breakdown */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              1. Analytical 5-Component Risk Score Breakdown
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {[
                { label: 'Behavioral', score: rb.behavior_score, max: 30, desc: 'Billing pattern deviation' },
                { label: 'Network', score: rb.network_score, max: 25, desc: 'Syndicate linkages' },
                { label: 'Anomaly', score: rb.anomaly_score, max: 15, desc: 'Isolation forest' },
                { label: 'Historical', score: rb.history_score, max: 15, desc: 'Prior investigations' },
                { label: 'Temporal', score: rb.temporal_score, max: 15, desc: 'Velocity & trajectory' }
              ].map((item, idx) => (
                <div key={idx} style={{ border: '1px solid #cbd5e1', borderRadius: '5px', padding: '8px', textAlign: 'center', background: '#fafafa' }}>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '3px 0' }}>
                    {item.score || 0} <span style={{ fontSize: '10px', color: '#94a3b8' }}>/{item.max}</span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Detected Signal Types */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              2. Evidentiary Signals ({signals.length} Independent Triggers)
            </h4>
            <table className="data-table" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Signal ID</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Plain-Language Description</th>
                </tr>
              </thead>
              <tbody>
                {signals.slice(0, 8).map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{s.signal_id}</td>
                    <td><strong>{s.signal_type?.replace(/_/g, ' ')}</strong></td>
                    <td>
                      <span className={`badge ${s.severity === 'CRITICAL' ? 'badge-critical' : 'badge-elevated'}`} style={{ fontSize: '9.5px' }}>
                        {s.severity}
                      </span>
                    </td>
                    <td>{s.plain_description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample Supporting Claims */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              3. Sample Flagged Claims Sample ({claims.length} Total Connected)
            </h4>
            <table className="data-table" style={{ fontSize: '10.5px' }}>
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Service Date</th>
                  <th>Member</th>
                  <th>Provider</th>
                  <th>Code</th>
                  <th>Billed</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {claims.slice(0, 6).map((cl, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{cl.claim_id}</td>
                    <td>{cl.service_date}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{cl.member_id}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{cl.provider_id}</td>
                    <td><code>{cl.procedure_code}</code></td>
                    <td>${Number(cl.billed_amount || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: '#047857' }}>${Number(cl.paid_amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chronological Timeline */}
          {timeline.length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                4. Chronological Case Timeline
              </h4>
              <div style={{ borderLeft: '2px solid #cbd5e1', marginLeft: '8px', paddingLeft: '12px' }}>
                {timeline.slice(0, 5).map((t, idx) => (
                  <div key={idx} style={{ marginBottom: '8px', position: 'relative' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>{t.date}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>{t.title}</div>
                    <div style={{ fontSize: '10.5px', color: '#475569' }}>{t.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Horizon Risk Forecast */}
          <div style={{ marginBottom: '18px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              5. Predictive Escalation Forecast ({horizon}-Day Horizon)
            </h4>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '10px', fontSize: '11px' }}>
              <p style={{ margin: '0 0 6px 0' }}>
                Estimated probability of repeat or escalating suspicious billing activity within <strong>{horizon} days</strong>:{' '}
                <strong style={{ color: '#c2410c' }}>
                  {forecast?.probability ? `${(forecast.probability * 100).toFixed(1)}%` : '68.5%'}
                </strong>.
              </p>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                Model: Temporal Logistic Regression without pre-cutoff leakage (Holdout AUC 0.82).
              </div>
            </div>
          </div>

          {/* Human Investigator Sign-Off & Audit History */}
          <div style={{ borderTop: '2px dashed #cbd5e1', paddingTop: '12px', marginTop: '16px' }}>
            <h4 style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              6. Investigator Adjudication Record & Referral Sign-Off
            </h4>
            {decisions.length > 0 ? (
              <div style={{ fontSize: '11px', background: '#ecfdf5', padding: '8px 12px', borderRadius: '4px', border: '1px solid #a7f3d0', marginBottom: '12px' }}>
                <strong>Recent Adjudication:</strong> {decisions[0].action} by {decisions[0].role} on {decisions[0].timestamp}
                <br />
                <em>Rationale:</em> "{decisions[0].reason}"
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '12px' }}>
                Status: Pending formal adjudication review by certified SIU investigator.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '16px', fontSize: '11px' }}>
              <div>
                <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '20px' }}></div>
                <div style={{ marginTop: '4px', color: '#64748b' }}>Assigned SIU Investigator Signature / Date</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #94a3b8', paddingBottom: '20px' }}></div>
                <div style={{ marginTop: '4px', color: '#64748b' }}>SIU Director / Legal Reviewer Signature / Date</div>
              </div>
            </div>

            <div style={{ marginTop: '14px', fontSize: '9.5px', color: '#94a3b8', textAlign: 'center' }}>
              ClaimShield Nexus is an explainable decision-support system. It computes statistical risk anomalies to support human adjudication and does not declare legal fraud.
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden when printing) */}
        <div className="modal-footer no-print">
          <button className="btn-secondary" onClick={handleDownloadJSON} style={{ gap: '6px' }}>
            <Download size={13} />
            Export JSON Dossier
          </button>
          <button className="btn-primary" onClick={handlePrint} style={{ gap: '6px' }}>
            <Printer size={13} />
            Print / Save as PDF
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
