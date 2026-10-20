import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Search, AlertCircle, ChevronLeft, ChevronRight,
  User, X, Download
} from 'lucide-react';

export default function ClaimsIntelligence({ onOpenCase }) {
  const [claims, setClaims] = useState([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [sortBy, setSortBy] = useState('service_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      let url = `http://localhost:8000/api/claims?page=${currentPage}&page_size=${pageSize}&sort_by=${sortBy}&sort_order=${sortOrder}`;
      if (serviceType) url += `&service_type=${serviceType}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setClaims(data.items);
        setTotalClaims(data.total);
        setTotalPages(data.total_pages);
      }
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, serviceType, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchClaims();
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const openClaimDetail = async (claimId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/claims/${claimId}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedClaim(detail);
      }
    } catch (err) {
      console.error('Failed to fetch claim detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!claims || claims.length === 0) return;
    const headers = [
      'Claim ID',
      'Service Date',
      'Member ID',
      'Provider ID',
      'Facility ID',
      'Service Type',
      'Procedure Code',
      'Diagnosis Code',
      'Billed Amount',
      'Paid Amount',
      'Signal Flag'
    ];
    const rows = claims.map((c) => [
      c.claim_id,
      c.service_date,
      c.member_id,
      c.provider_id,
      c.facility_id || 'N/A',
      c.service_type,
      `"${c.procedure_code}"`,
      `"${c.diagnosis_code || ''}"`,
      c.billed_amount,
      c.paid_amount,
      c.signal_id ? `FLAGGED: ${c.signal_type}` : 'NONE'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `claims_export_${serviceType || 'all'}_page${currentPage}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="content-view" style={{ position: 'relative' }}>
      {/* Page Title & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="#2563eb" />
            Claims Intelligence & Outlier Inspection
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Inspect raw and correlated claim records across professional, facility, pharmacy, and laboratory lines.
          </p>
        </div>

        {/* Search & Service Filter */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px' }}>
            <Search size={14} color="#64748b" style={{ marginRight: '6px' }} />
            <input
              type="text"
              placeholder="Search claim, code, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '220px' }}
            />
          </div>

          <select
            value={serviceType}
            onChange={(e) => { setServiceType(e.target.value); setCurrentPage(1); }}
            style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', background: '#ffffff' }}
          >
            <option value="">All Service Types</option>
            <option value="professional">Professional</option>
            <option value="facility">Facility</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="laboratory">Laboratory</option>
            <option value="ambulance">Ambulance</option>
            <option value="dme">DME</option>
            <option value="behavioral_health">Behavioral Health</option>
            <option value="home_health">Home Health</option>
          </select>

          <button type="submit" className="btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }}>
            Filter
          </button>
        </form>
      </div>

      {/* Claims Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            Claims Ingested ({totalClaims.toLocaleString()} Total)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleExportCSV}
              disabled={claims.length === 0}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Export current page view to CSV"
            >
              <Download size={12} />
              Export CSV
            </button>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              Analyzing claims...
            </div>
          ) : claims.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No claims found matching the active criteria.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('claim_id')} style={{ cursor: 'pointer' }}>
                    Claim ID {sortBy === 'claim_id' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th onClick={() => handleSort('service_date')} style={{ cursor: 'pointer' }}>
                    Service Date {sortBy === 'service_date' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th>Provider</th>
                  <th>Member ID</th>
                  <th>Service Type</th>
                  <th>Proc / Diag</th>
                  <th onClick={() => handleSort('billed_amount')} style={{ cursor: 'pointer' }}>
                    Billed {sortBy === 'billed_amount' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th onClick={() => handleSort('paid_amount')} style={{ cursor: 'pointer' }}>
                    Paid {sortBy === 'paid_amount' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                  </th>
                  <th>Status</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr
                    key={c.claim_id}
                    onClick={() => openClaimDetail(c.claim_id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>
                      {c.claim_id}
                    </td>
                    <td>{c.service_date}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.provider_name || c.provider_id}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>{c.specialty}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{c.member_id}</td>
                    <td>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#f1f5f9',
                        color: '#334155',
                        fontWeight: 500
                      }}>
                        {c.service_type}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{c.procedure_code}</span>
                      <span style={{ color: '#64748b', marginLeft: '4px', fontSize: '11px' }}>({c.diagnosis_code})</span>
                    </td>
                    <td>${c.billed_amount?.toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>${c.paid_amount?.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${c.claim_status === 'PAID' ? 'badge-normal' : 'badge-monitored'}`}>
                        {c.claim_status}
                      </span>
                    </td>
                    <td>
                      {c.is_flagged ? (
                        <span className="badge badge-critical" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <AlertCircle size={10} />
                          Case Flag
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {totalClaims === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalClaims)} of {totalClaims.toLocaleString()} claims
            </div>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ fontSize: '11px', padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff' }}
            >
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: '4px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                background: '#ffffff',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: '4px 10px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                background: '#ffffff',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Claim Detail Drawer / Modal */}
      {selectedClaim && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '520px',
          background: '#ffffff',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.15)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#09131f',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600 }}>Claim Dossier</div>
              <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace' }}>{selectedClaim.claim_id}</div>
            </div>
            <button
              onClick={() => setSelectedClaim(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          {detailLoading ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
              Loading claim dossier...
            </div>
          ) : (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Financial Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Billed Amount</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>${selectedClaim.billed_amount?.toFixed(2)}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Paid Amount</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>${selectedClaim.paid_amount?.toFixed(2)}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Service Units</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{selectedClaim.units}</div>
              </div>
            </div>

            {/* Provider and Member Cards */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Connected Parties</div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color="#2563eb" />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{selectedClaim.provider_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{selectedClaim.provider_id} • {selectedClaim.specialty}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>Tax: {selectedClaim.tax_id}</span>
                </div>

                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} color="#059669" />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{selectedClaim.member_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{selectedClaim.member_id} • {selectedClaim.age_group}</div>
                    </div>
                  </div>
                  <span className={`badge ${selectedClaim.enrollment_status === 'ACTIVE' ? 'badge-normal' : 'badge-critical'}`}>
                    {selectedClaim.enrollment_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Associated Cases */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Correlated SIU Cases ({selectedClaim.associated_cases?.length || 0})
              </div>
              {selectedClaim.associated_cases?.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  This claim has not been correlated into an active investigation case.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedClaim.associated_cases?.map(c => (
                    <div
                      key={c.case_id}
                      onClick={() => onOpenCase && onOpenCase(c.case_id)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#2563eb', fontSize: '13px' }}>{c.case_id}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{c.case_type}</div>
                      </div>
                      <span className={`badge ${c.risk_band === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}>
                        {c.risk_band} ({c.risk_score})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Flagged Signals */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Flagged Rule Signals ({selectedClaim.signals?.length || 0})
              </div>
              {selectedClaim.signals?.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No standalone algorithmic signals associated directly with this claim.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedClaim.signals?.map(s => (
                    <div key={s.signal_id} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#9f1239' }}>
                        <span>{s.signal_type.replace(/_/g, ' ').toUpperCase()}</span>
                        <span>{s.severity}</span>
                      </div>
                      <div style={{ color: '#475569', marginTop: '2px' }}>{s.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Temporal Cluster Claims (+/- 3 days) */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Temporal Neighbor Claims (Member ±3 Days)
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                {selectedClaim.temporal_cluster_claims?.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No other claims for this member within the ±3 day window.
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Claim ID</th>
                        <th>Procedure</th>
                        <th>Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClaim.temporal_cluster_claims?.map(tc => (
                        <tr key={tc.claim_id} onClick={() => openClaimDetail(tc.claim_id)} style={{ cursor: 'pointer' }}>
                          <td>{tc.service_date}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2563eb' }}>{tc.claim_id}</td>
                          <td>{tc.procedure_code}</td>
                          <td style={{ fontWeight: 600 }}>${tc.paid_amount?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )}
    </div>
  );
}
