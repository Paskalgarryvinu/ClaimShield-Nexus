import { Info, X } from 'lucide-react';

export default function DecisionTransparencyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={18} color="#1d4ed8" />
            <h3 className="card-title" style={{ fontSize: '15px' }}>Decision Transparency & Governance</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
              Core Policy: ClaimShield Nexus Does Not Adjudicate Fraud
            </h4>
            <p style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.4 }}>
              This platform serves strictly as an algorithmic decision-support tool for Special Investigation Unit (SIU) personnel. It flags statistical anomalies, correlates multi-entity patterns, and synthesizes evidence. All final decisions require human investigator review.
            </p>
          </div>

          <h5 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '8px', letterSpacing: '0.5px' }}>
            What Influences the Scores
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>1. Behavioral Analysis (30%)</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Peer-normalized deviations in billing frequency, duplicate patterns, unbundling, and impossible scheduling.
              </p>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>2. Network Density (25%)</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Shared addresses/tax IDs, referral concentration loops, and cross-facility coordinate structures.
              </p>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>3. Unsupervised Anomaly (15%)</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Isolation Forest multivariate score calculated across peer-normalized feature distributions.
              </p>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>4. Historical Risk (15%)</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Prior SIU investigations, historical audit restitution outcomes, and sanction registries.
              </p>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc', gridColumn: 'span 2' }}>
              <strong style={{ fontSize: '12px', color: '#0f172a' }}>5. Temporal Escalation (15%)</strong>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Month-over-month billing velocity surge, newly added billing codes, and sudden spike in patient volume.
              </p>
            </div>
          </div>

          <h5 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '8px', letterSpacing: '0.5px' }}>
            System Constraints & Uncertainty Boundaries
          </h5>
          <ul style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6, paddingLeft: '18px', marginBottom: '14px' }}>
            <li><strong>Synthetic Environment:</strong> All data is generated under controlled seeds with zero real Protected Health Information (PHI).</li>
            <li><strong>Missing Data Safeguard:</strong> When required fields or history are incomplete, recommendations are automatically capped at <em>"Request More Evidence"</em>.</li>
            <li><strong>Correlation vs Causation:</strong> Shared addresses or concentrated referrals indicate organizational linkage, not fraudulent intent.</li>
            <li><strong>Probabilistic Forecasts:</strong> Risk forecasts represent statistical escalation likelihood, subject to confidence intervals.</li>
          </ul>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
