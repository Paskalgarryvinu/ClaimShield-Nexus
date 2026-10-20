import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, ArrowRight, Terminal } from 'lucide-react';

export default function DemoMode({ onOpenCase }) {
  const [scenarios, setScenarios] = useState([]);
  const [runningScenarioId, setRunningScenarioId] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [readyResult, setReadyResult] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('http://localhost:8000/api/demo/scenarios');
        if (res.ok) {
          const data = await res.json();
          setScenarios(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, []);

  const handleRunScenario = (scenarioId) => {
    setRunningScenarioId(scenarioId);
    setProgress(0);
    setCurrentStage("Initializing Pipeline...");
    setLogs([]);
    setReadyResult(null);

    const eventSource = new EventSource(`http://localhost:8000/api/demo/run-scenario?scenario_id=${scenarioId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setCurrentStage(data.description);
        setProgress(data.progress);
        setLogs((prev) => [
          ...prev,
          {
            time: `${data.total_elapsed_ms}ms`,
            stage: data.stage,
            text: `${data.description} — ${data.details}`
          }
        ]);

        if (data.status === "INVESTIGATION_READY") {
          setReadyResult({
            matched_case_id: data.matched_case_id,
            overlap_entities: data.overlap_entities,
            matched_case: data.matched_case,
            total_time: data.total_elapsed_ms
          });
          eventSource.close();
          setRunningScenarioId(null);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection closed or error:", err);
      eventSource.close();
      setRunningScenarioId(null);
    };
  };

  return (
    <div className="content-view">
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="badge badge-normal" style={{ fontSize: '10px' }}>DETERMINISTIC EVALUATION</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Seed: 42 • AS_OF_DATE: 2026-03-31</span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Live Demo Mode (Real Pipeline Replay)</h2>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
          Execute the full, real end-to-end analytical pipeline via Server-Sent Events (SSE). Pre-trained models stream in under 5 seconds.
        </p>
      </div>

      {/* Scenario Selection Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {scenarios.map((sc) => {
          const isCurrent = runningScenarioId === sc.scenario_id;
          return (
            <div
              key={sc.scenario_id}
              className="card"
              style={{
                border: sc.is_primary ? '2px solid #2563eb' : '1px solid #cbd5e1',
                position: 'relative'
              }}
            >
              {sc.is_primary && (
                <div style={{ position: 'absolute', top: '-10px', right: '14px', background: '#2563eb', color: '#fff', fontSize: '9.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                  PRIMARY DEMO
                </div>
              )}
              <div className="card-header" style={{ padding: '12px 16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#2563eb', fontWeight: 700 }}>
                    {sc.scenario_id}
                  </span>
                  <h3 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0 0' }}>
                    {sc.name}
                  </h3>
                </div>
                <span className="badge badge-high" style={{ fontSize: '10px' }}>
                  {sc.expected_risk_band}
                </span>
              </div>
              <div className="card-body" style={{ padding: '14px 16px' }}>
                <p style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.4, marginBottom: '12px' }}>
                  {sc.pattern}
                </p>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {sc.main_signals.map((sig, i) => (
                    <span key={i} className="badge badge-normal" style={{ fontSize: '9.5px' }}>
                      {sig}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Planted: <strong>{sc.planted_entities.length} entities</strong>
                  </span>

                  <button
                    className="btn-primary"
                    onClick={() => handleRunScenario(sc.scenario_id)}
                    disabled={runningScenarioId !== null}
                    style={{ gap: '6px', padding: '6px 12px', fontSize: '11.5px' }}
                  >
                    <Play size={12} fill="#fff" />
                    {isCurrent ? 'Streaming Pipeline...' : 'Run Scenario'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Streaming Execution Monitor */}
      {(runningScenarioId || logs.length > 0) && (
        <div className="card" style={{ marginBottom: '20px', border: '1px solid #1e293b' }}>
          <div className="card-header" style={{ background: '#09131f', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={16} color="#38bdf8" />
              <span className="card-title" style={{ color: '#fff', fontSize: '13px' }}>
                Live Analytical Pipeline Stream (SSE)
              </span>
            </div>
            {runningScenarioId ? (
              <span className="badge badge-normal" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid #3b82f6' }}>
                RUNNING: {runningScenarioId}
              </span>
            ) : (
              <span className="badge badge-normal" style={{ background: '#ecfdf5', color: '#065f46' }}>
                PIPELINE COMPLETE
              </span>
            )}
          </div>

          <div className="card-body" style={{ background: '#0f172a', padding: '16px' }}>
            {/* Progress Bar */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px' }}>
                <span>Active Stage: <strong style={{ color: '#f8fafc' }}>{currentStage}</strong></span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{progress}%</span>
              </div>
              <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>

            {/* Terminal Console Logs */}
            <div style={{
              background: '#060e17',
              borderRadius: '6px',
              padding: '12px',
              height: '180px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              border: '1px solid #1e293b'
            }}>
              {logs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#64748b' }}>[{log.time}]</span>
                  <span style={{ color: '#38bdf8' }}>{log.stage}:</span>
                  <span style={{ color: '#e2e8f0' }}>{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Investigation Ready Result Card */}
      {readyResult && (
        <div className="card" style={{ border: '2px solid #10b981', background: '#f0fdf4', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <CheckCircle2 size={20} color="#059669" />
                <span style={{ background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                  INVESTIGATION READY
                </span>
                <span style={{ fontSize: '12px', color: '#065f46' }}>
                  Pipeline finished in <strong>{readyResult.total_time}ms</strong>
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#065f46', margin: '4px 0' }}>
                Matched Dossier: {readyResult.matched_case_id} ({readyResult.matched_case?.case_type})
              </h3>
              <p style={{ fontSize: '12px', color: '#166534', margin: 0 }}>
                Matched via <strong>{readyResult.overlap_entities?.length} overlapping entities</strong>: {readyResult.overlap_entities?.join(', ')}.
                Risk Score: <strong>{readyResult.matched_case?.risk_score} / 100</strong> • Financial Exposure: <strong>${readyResult.matched_case?.exposure_amount?.toLocaleString()}</strong>
              </p>
            </div>

            <button
              className="btn-primary"
              onClick={() => onOpenCase(readyResult.matched_case_id)}
              style={{ background: '#059669', padding: '10px 18px', fontSize: '13px', gap: '8px' }}
            >
              Open Matched Case Brief
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
