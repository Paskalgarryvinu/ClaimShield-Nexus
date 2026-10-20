import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Search, Info, UserCheck, Settings, X, ArrowRight } from 'lucide-react';

export default function TopBar({
  currentRole,
  onOpenRoleModal,
  horizon,
  onSelectHorizon,
  onOpenTransparencyModal,
  onRouteSearchResult
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/network/search?q=${encodeURIComponent(searchTerm)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Failed to execute search:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result) => {
    setIsOpen(false);
    setSearchTerm('');
    if (onRouteSearchResult) {
      onRouteSearchResult(result.type, result.id);
    }
  };

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <div className="workspace-label">
          <span>ClaimShield Nexus</span>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>/</span>
          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>SIU Intelligence Suite</span>
        </div>

        <div className="synthetic-badge" title="Operating under zero-PHI synthetic data rules">
          <ShieldAlert size={13} />
          SYNTHETIC ENVIRONMENT
        </div>
      </div>

      <div className="top-bar-right">
        {/* Global Live Search */}
        <div ref={searchRef} style={{ position: 'relative', width: '280px' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search claim, provider, case ID..."
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              if (!val || val.length < 2) {
                setSearchResults([]);
                setIsOpen(false);
              }
            }}
            onFocus={() => { if (searchResults.length > 0) setIsOpen(true); }}
            style={{
              width: '100%',
              padding: '6px 28px 6px 28px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setIsOpen(false); }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
            >
              <X size={12} />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {isOpen && searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '36px',
              left: 0,
              right: 0,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 1000,
              maxHeight: '320px',
              overflowY: 'auto'
            }}>
              <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>
                Search Results ({searchResults.length})
              </div>
              {searchResults.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectResult(r)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f8fafc',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{r.id}</span>
                      <span style={{ color: '#475569' }}>{r.title}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                      {r.type.toUpperCase()} • {r.badge}
                    </div>
                  </div>
                  <ArrowRight size={12} color="#94a3b8" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Horizon Selector */}
        <div className="horizon-selector" title="Active Risk Forecast Evaluation Horizon">
          <span className="horizon-label">HORIZON</span>
          <button
            className={`horizon-btn ${horizon === 30 ? 'active' : ''}`}
            onClick={() => onSelectHorizon(30)}
          >
            30d
          </button>
          <button
            className={`horizon-btn ${horizon === 60 ? 'active' : ''}`}
            onClick={() => onSelectHorizon(60)}
          >
            60d
          </button>
          <button
            className={`horizon-btn ${horizon === 90 ? 'active' : ''}`}
            onClick={() => onSelectHorizon(90)}
          >
            90d
          </button>
        </div>

        {/* Decision Transparency Button */}
        <button
          className="btn-secondary"
          onClick={onOpenTransparencyModal}
          style={{ padding: '5px 10px', fontSize: '11.5px', gap: '5px' }}
          title="View Responsible AI Governance & Decision Limits"
        >
          <Info size={14} color="#1d4ed8" />
          Transparency
        </button>

        {/* Role Selector Button */}
        <button
          className="role-badge-btn"
          onClick={onOpenRoleModal}
          title="Switch Active Persona"
        >
          {currentRole === 'Program Manager' ? (
            <Settings size={14} color="#4338ca" />
          ) : (
            <UserCheck size={14} color="#1e40af" />
          )}
          <span>{currentRole}</span>
        </button>
      </div>
    </header>
  );
}
