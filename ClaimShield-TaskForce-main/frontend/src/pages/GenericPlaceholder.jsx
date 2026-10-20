import React from 'react';

export default function GenericPlaceholder({ title, description, badge = "Phase Scheduled" }) {
  return (
    <div className="content-view">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{title}</h2>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{description}</p>
      </div>
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '420px', margin: '0 auto' }}>
          <span className="badge badge-monitored" style={{ marginBottom: '12px' }}>{badge}</span>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
            {title} Module
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
            Data pipeline and storage tables are active. Run the pipeline detection and clustering in subsequent build phases to populate this workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
