import React from 'react';
import { Shield, UserCheck, Settings, AlertTriangle, ArrowRight } from 'lucide-react';

export default function RoleModal({ currentRole, onSelectRole, isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-dialog" style={{ maxWidth: '580px' }}>
        <div className="modal-header" style={{ background: '#09131f', color: '#fff', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Enter ClaimShield Nexus</h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Select Investigation Persona to Continue</p>
            </div>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>
            SYNTHETIC DEMO
          </div>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
              <strong>Decision Support Environment:</strong> ClaimShield Nexus provides algorithmic correlation and evidence synthesis. It does <em>not</em> determine fraud. Final adjudication requires human SIU review.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Investigator Persona */}
            <div
              onClick={() => onSelectRole('Investigator')}
              style={{
                border: currentRole === 'Investigator' ? '2px solid #1d4ed8' : '1px solid #e2e8f0',
                background: currentRole === 'Investigator' ? '#eff6ff' : '#ffffff',
                borderRadius: '8px',
                padding: '18px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <UserCheck size={20} />
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Investigator</h4>
              <p style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4, marginBottom: '14px' }}>
                Primary role. Command Center, SIU Priority Queue, Investigation Workspace, Claims & Network Explorer. Read-only on configurations.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#1d4ed8' }}>
                Select Role <ArrowRight size={14} />
              </div>
            </div>

            {/* Program Manager Persona */}
            <div
              onClick={() => onSelectRole('Program Manager')}
              style={{
                border: currentRole === 'Program Manager' ? '2px solid #1d4ed8' : '1px solid #e2e8f0',
                background: currentRole === 'Program Manager' ? '#eff6ff' : '#ffffff',
                borderRadius: '8px',
                padding: '18px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Settings size={20} />
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Program Manager</h4>
              <p style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4, marginBottom: '14px' }}>
                Supervisory role. Full investigator view plus Administration (detection rule toggles, thresholds, SIU capacity, system status).
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#4338ca' }}>
                Select Role <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Current Persona: <strong>{currentRole}</strong>
          </span>
          <button className="btn-primary" onClick={onClose}>
            Enter Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
