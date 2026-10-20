import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2, Search, ZoomIn, ZoomOut, RefreshCw,
  Building, User, ArrowRight, X
} from 'lucide-react';

export default function NetworkExplorer({ onSelectCase }) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [entityIntel, setEntityIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState({});

  // Force-directed simulation logic
  const initializeSimulation = useCallback((nodes, edges) => {
    const width = 800;
    const height = 550;
    const pos = {};

    nodes.forEach((n, idx) => {
      const angle = (idx / nodes.length) * 2 * Math.PI;
      const radius = 180 + (idx % 3) * 60;
      pos[n.id] = {
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0
      };
    });

    // Run 40 iterations of spring embedder
    for (let iter = 0; iter < 45; iter++) {
      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        const u = nodes[i].id;
        for (let j = i + 1; j < nodes.length; j++) {
          const v = nodes[j].id;
          const dx = pos[u].x - pos[v].x;
          const dy = pos[u].y - pos[v].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 220) {
            const force = (220 - dist) / dist * 0.4;
            pos[u].x += dx * force;
            pos[u].y += dy * force;
            pos[v].x -= dx * force;
            pos[v].y -= dy * force;
          }
        }
      }

      // Edge spring attraction
      edges.forEach(e => {
        if (pos[e.source] && pos[e.target]) {
          const dx = pos[e.target].x - pos[e.source].x;
          const dy = pos[e.target].y - pos[e.source].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 90;
          const force = (dist - targetDist) * 0.04;
          pos[e.source].x += (dx / dist) * force;
          pos[e.source].y += (dy / dist) * force;
          pos[e.target].x -= (dx / dist) * force;
          pos[e.target].y -= (dy / dist) * force;
        }
      });
    }

    setPositions(pos);
  }, []);

  const fetchGraph = useCallback(async (focusEntity = null) => {
    setLoading(true);
    try {
      let url = 'http://localhost:8000/api/network/graph?limit=150';
      if (focusEntity) {
        url += `&entity_id=${focusEntity}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setGraphData(data);
      initializeSimulation(data.nodes, data.edges);
    } catch (err) {
      console.error('Failed to fetch graph data:', err);
    } finally {
      setLoading(false);
    }
  }, [initializeSimulation]);

  // Fetch initial graph
  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);


  // Fetch 360 Entity Intelligence when a node is clicked
  const handleNodeClick = async (node) => {
    setSelectedNode(node);
    setIntelLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/network/entity/${node.type}/${node.id}`);
      if (res.ok) {
        const intel = await res.json();
        setEntityIntel(intel);
      }
    } catch (err) {
      console.error('Failed to fetch entity intelligence:', err);
    } finally {
      setIntelLoading(false);
    }
  };

  // Node styles by entity type
  const getNodeColor = (type) => {
    switch (type) {
      case 'provider': return '#2563eb'; // blue
      case 'facility': return '#7c3aed'; // purple
      case 'member': return '#059669';   // emerald
      default: return '#64748b';
    }
  };

  const filteredNodes = graphData.nodes.filter(n => {
    if (filterType !== 'ALL' && n.type.toLowerCase() !== filterType.toLowerCase()) return false;
    if (searchQuery && !n.id.toLowerCase().includes(searchQuery.toLowerCase()) && !(n.name || '').toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = graphData.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>
      {/* Top Controls Toolbar */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={20} color="#2563eb" />
              Network Explorer & Entity Graph
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Visualize provider syndicates, shared addresses, concentrated referrals, and cross-facility overlap.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px' }}>
            <Search size={14} color="#64748b" style={{ marginRight: '6px' }} />
            <input
              type="text"
              placeholder="Search entity ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '200px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Entity Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
            {['ALL', 'PROVIDER', 'FACILITY', 'MEMBER'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                  background: filterType === t ? '#ffffff' : 'transparent',
                  color: filterType === t ? '#0f172a' : '#64748b',
                  boxShadow: filterType === t ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Zoom & Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 2.5))}
              style={{ padding: '6px 10px', background: '#ffffff', border: 'none', cursor: 'pointer', borderRight: '1px solid #cbd5e1' }}
              title="Zoom In"
            >
              <ZoomIn size={14} color="#475569" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.4))}
              style={{ padding: '6px 10px', background: '#ffffff', border: 'none', cursor: 'pointer', borderRight: '1px solid #cbd5e1' }}
              title="Zoom Out"
            >
              <ZoomOut size={14} color="#475569" />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
              style={{ padding: '6px 10px', background: '#ffffff', border: 'none', cursor: 'pointer' }}
              title="Reset View"
            >
              <RefreshCw size={14} color="#475569" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden', background: '#f8fafc' }}>
        {/* Interactive SVG Network Canvas */}
        <div
          style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            if (e.target.tagName === 'svg' || e.target.tagName === 'rect') {
              setIsDragging(true);
              setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
            }
          }}
          onMouseMove={(e) => {
            if (isDragging) {
              setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
        >
          {loading ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" />
              <span>Building relationship network...</span>
            </div>
          ) : (
            <svg
              style={{ width: '100%', height: '100%' }}
              viewBox="0 0 900 650"
            >
              <rect width="100%" height="100%" fill="#f8fafc" />

              <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                {/* Relationship Edges */}
                {filteredEdges.map((e, idx) => {
                  const p1 = positions[e.source];
                  const p2 = positions[e.target];
                  if (!p1 || !p2) return null;

                  const isHighlight = selectedNode && (selectedNode.id === e.source || selectedNode.id === e.target);
                  const strokeColor = isHighlight ? '#dc2626' : (e.type.includes('shared') ? '#f59e0b' : '#cbd5e1');
                  const strokeWidth = isHighlight ? 2.5 : Math.min(e.weight * 0.8, 3.5);

                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;

                  return (
                    <g key={`edge-${idx}`}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={e.type.includes('referral') ? '4 2' : 'none'}
                        opacity={isHighlight ? 1 : 0.75}
                      />
                      {isHighlight && (
                        <text
                          x={midX}
                          y={midY - 4}
                          fill="#475569"
                          fontSize="9"
                          textAnchor="middle"
                          fontWeight={600}
                          style={{ pointerEvents: 'none', background: '#ffffff' }}
                        >
                          {e.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Graph Nodes */}
                {filteredNodes.map((n) => {
                  const p = positions[n.id];
                  if (!p) return null;

                  const isSelected = selectedNode && selectedNode.id === n.id;
                  const color = getNodeColor(n.type);
                  const radius = n.type === 'provider' ? 14 : (n.type === 'facility' ? 16 : 10);

                  return (
                    <g
                      key={`node-${n.id}`}
                      transform={`translate(${p.x}, ${p.y})`}
                      onClick={() => handleNodeClick(n)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Selection Glow */}
                      {isSelected && (
                        <circle
                          r={radius + 8}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="3"
                          opacity="0.4"
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={color}
                        stroke={n.signal_count > 0 ? '#ef4444' : '#ffffff'}
                        strokeWidth={n.signal_count > 0 ? 3 : 2}
                        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))"
                      />

                      {/* Signal Badge indicator */}
                      {n.signal_count > 0 && (
                        <circle
                          cx={radius * 0.7}
                          cy={-radius * 0.7}
                          r={5}
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Label Text */}
                      <text
                        y={radius + 12}
                        fill="#0f172a"
                        fontSize="10"
                        fontWeight={isSelected ? 700 : 500}
                        textAnchor="middle"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {n.name ? (n.name.length > 18 ? n.name.slice(0, 16) + '...' : n.name) : n.id}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* Graph Legend Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>Network Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }} />
              <span style={{ color: '#475569' }}>Provider (Doctor / Practice)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#7c3aed' }} />
              <span style={{ color: '#475569' }}>Facility (Hospital / Clinic)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669' }} />
              <span style={{ color: '#475569' }}>Member (Patient)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', border: '2px solid #ffffff' }} />
              <span style={{ color: '#475569' }}>Entity with Flagged Signals</span>
            </div>
          </div>
        </div>

        {/* 360 Entity Intelligence Panel (Right Sidebar) */}
        {selectedNode && (
          <div style={{
            width: '420px',
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.05)',
            zIndex: 10,
            overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedNode.type === 'provider' ? <User size={18} color="#2563eb" /> : <Building size={18} color="#7c3aed" />}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {selectedNode.name || selectedNode.id}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {selectedNode.type.toUpperCase()} • {selectedNode.id}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            {intelLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
                <div>Loading Entity Intelligence...</div>
              </div>
            ) : entityIntel ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Stats Matrix */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Claims Ingested</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      {entityIntel.claim_stats.claim_count ? entityIntel.claim_stats.claim_count.toLocaleString() : 0}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Total Paid Amount</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      ${entityIntel.claim_stats.total_paid ? Math.round(entityIntel.claim_stats.total_paid).toLocaleString() : 0}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Unique Members</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      {entityIntel.claim_stats.unique_members || 0}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Risk History</div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: entityIntel.profile.risk_history === 'CLEAN' ? '#16a34a' : '#ea580c'
                    }}>
                      {entityIntel.profile.risk_history || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Profile Meta */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Profile Attributes
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                    {entityIntel.profile.specialty && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b' }}>Specialty</span>
                        <span style={{ fontWeight: 600 }}>{entityIntel.profile.specialty}</span>
                      </div>
                    )}
                    {entityIntel.profile.peer_group && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b' }}>Peer Baseline Group</span>
                        <span style={{ fontWeight: 600 }}>{entityIntel.profile.peer_group}</span>
                      </div>
                    )}
                    {entityIntel.profile.location && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b' }}>Location</span>
                        <span style={{ fontWeight: 600 }}>{entityIntel.profile.location}</span>
                      </div>
                    )}
                    {entityIntel.profile.tax_id && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ color: '#64748b' }}>Billing Tax ID</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{entityIntel.profile.tax_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Associated Cases */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Formed Investigation Cases ({entityIntel.associated_cases.length})
                  </div>
                  {entityIntel.associated_cases.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                      No active investigation cases formed for this entity.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {entityIntel.associated_cases.map(c => (
                        <div
                          key={c.case_id}
                          onClick={() => onSelectCase && onSelectCase(c.case_id)}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '13px' }}>{c.case_id}</span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: c.risk_band === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                              color: c.risk_band === 'CRITICAL' ? '#b91c1c' : '#b45309'
                            }}>
                              {c.risk_band} ({c.risk_score})
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            {c.case_type} • Role: {c.role}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Flagged Signals */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Flagged Signals ({entityIntel.signals.length})
                  </div>
                  {entityIntel.signals.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                      No independent signals detected for this entity.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                      {entityIntel.signals.map(s => (
                        <div key={s.signal_id} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '4px', padding: '6px 10px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#9f1239' }}>
                            <span>{s.signal_type.replace('_', ' ').toUpperCase()}</span>
                            <span>{s.severity}</span>
                          </div>
                          <div style={{ color: '#475569', marginTop: '2px' }}>{s.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connected Relationships */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Connected Network Entities ({entityIntel.connected_entities.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {entityIntel.connected_entities.map((ce, idx) => (
                      <div
                        key={idx}
                        onClick={() => fetchGraph(ce.entity_id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{ce.entity_id}</span>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>({ce.relationship_type.replace('_', ' ')})</span>
                        </div>
                        <ArrowRight size={12} color="#64748b" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
