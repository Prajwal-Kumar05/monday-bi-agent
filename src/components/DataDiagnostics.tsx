import React, { useState } from 'react';
import { Database, AlertTriangle, CheckCircle } from 'lucide-react';
import type { CleanedData } from '../utils/dataProcessor';

interface DataDiagnosticsProps {
  data: CleanedData | null;
  dealsMapping: Record<string, string>;
  woMapping: Record<string, string>;
}

export const DataDiagnostics: React.FC<DataDiagnosticsProps> = ({
  data,
  dealsMapping,
  woMapping
}) => {
  const [boardFilter, setBoardFilter] = useState<'All' | 'Deals' | 'Work Orders'>('All');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Warning/Critical' | 'Info'>('All');

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        <Database size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <p>No active board data loaded. Configure settings to run diagnostics.</p>
      </div>
    );
  }

  const { diagnostics, warnings } = data;

  // Filter warnings
  const filteredWarnings = warnings.filter((w) => {
    const matchesBoard = boardFilter === 'All' || w.board === boardFilter;
    const matchesSeverity =
      severityFilter === 'All' ||
      (severityFilter === 'Warning/Critical' && (w.severity === 'warning' || w.severity === 'critical')) ||
      (severityFilter === 'Info' && w.severity === 'info');
    return matchesBoard && matchesSeverity;
  });

  const getHealthBadgeClass = (score: number) => {
    if (score >= 90) return 'health-badge-excellent';
    if (score >= 70) return 'health-badge-warning';
    return 'health-badge-danger';
  };

  const getHealthStatusText = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Needs Cleanup';
    return 'Severe Issues';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Overview stats */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-title">Deals Board Health</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="stat-value">{diagnostics.dealsHealthScore}%</span>
            <span className={`health-badge ${getHealthBadgeClass(diagnostics.dealsHealthScore)}`}>
              {getHealthStatusText(diagnostics.dealsHealthScore)}
            </span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${diagnostics.dealsHealthScore}%`, background: diagnostics.dealsHealthScore >= 70 ? 'var(--color-success)' : 'var(--color-danger)' }} />
          </div>
          <span className="stat-subtitle">{diagnostics.cleanedDealsCount} parsed rows</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-title">Work Orders Health</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="stat-value">{diagnostics.woHealthScore}%</span>
            <span className={`health-badge ${getHealthBadgeClass(diagnostics.woHealthScore)}`}>
              {getHealthStatusText(diagnostics.woHealthScore)}
            </span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${diagnostics.woHealthScore}%`, background: diagnostics.woHealthScore >= 70 ? 'var(--color-success)' : 'var(--color-danger)' }} />
          </div>
          <span className="stat-subtitle">{diagnostics.cleanedWorkOrdersCount} parsed rows</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-title">Excel Formula Errors</span>
          <span className="stat-value" style={{ color: diagnostics.excelErrorsCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {diagnostics.excelErrorsCount}
          </span>
          <span className="stat-subtitle">E.g. #VALUE! or #REF! formula values</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-title">Missing Fields</span>
          <span className="stat-value" style={{ color: diagnostics.missingValuesCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {diagnostics.missingValuesCount}
          </span>
          <span className="stat-subtitle">Null values in required columns</span>
        </div>
      </div>

      {/* Grid: Column Mapping Details & Active Warnings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        {/* Schema Mapping Column */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} style={{ color: 'var(--color-primary)' }} />
            Dynamic Schema Resolver
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Mapping canonical CSV headers to Monday.com Column IDs. Resolved dynamically by title.
          </p>

          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', marginBottom: '8px' }}>Deals Board (Sales Pipeline)</h4>
          <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '16px' }}>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>CSV Header Title</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Monday ID</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dealsMapping).map(([title, id]) => (
                  <tr key={title} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{title}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--color-accent)', fontFamily: 'monospace' }}>{id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', marginBottom: '8px' }}>Work Orders Board</h4>
          <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>CSV Header Title</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>Monday ID</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(woMapping).map(([title, id]) => (
                  <tr key={title} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{title}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--color-accent)', fontFamily: 'monospace' }}>{id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warnings Table */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
              Active Warnings ({filteredWarnings.length})
            </h3>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value as any)}
                className="glass-input"
                style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(15,23,42,0.6)' }}
              >
                <option value="All">All Boards</option>
                <option value="Deals">Deals Board</option>
                <option value="Work Orders">Work Orders</option>
              </select>
              <select 
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as any)}
                className="glass-input"
                style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(15,23,42,0.6)' }}
              >
                <option value="All">All Severities</option>
                <option value="Warning/Critical">Warnings Only</option>
                <option value="Info">Info/Formats Only</option>
              </select>
            </div>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {filteredWarnings.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CheckCircle size={32} style={{ color: 'var(--color-success)', marginBottom: '10px', opacity: 0.8 }} />
                <p>No diagnostics warnings match current filter settings.</p>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Board</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Deal/Row</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Column</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWarnings.map((w, idx) => (
                    <tr 
                      key={idx} 
                      className={`warning-row-${w.severity}`}
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                      }}
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600 }}>{w.board}</td>
                      <td style={{ padding: '8px 12px', color: 'white' }}>{w.row}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-accent)', fontWeight: 500 }}>{w.column}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', lineBreak: 'anywhere' }}>{w.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
