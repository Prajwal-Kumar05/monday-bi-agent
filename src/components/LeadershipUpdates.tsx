import React, { useState } from 'react';
import { FileText, Clipboard, Check, RefreshCw } from 'lucide-react';
import type { CleanedData } from '../utils/dataProcessor';

interface LeadershipUpdatesProps {
  data: CleanedData | null;
  apiKey: string;
  onGenerateReport: (prompt: string, reportType: string) => Promise<string>;
  isGenerating: boolean;
}

const reportTemplates = [
  {
    id: 'quarterly_brief',
    title: 'Quarterly Executive Brief',
    description: 'Summarizes overall revenue, pipeline value, deal win-rates, and sector summaries for this quarter.',
    prompt: 'Generate a Quarterly Executive Brief. Analyze won deal values, pipeline stage volume, and sector summaries. Detail which sectors are driving growth and outline overall pipeline health.'
  },
  {
    id: 'ar_audit',
    title: 'Financial Receivables & AR Audit',
    description: 'Focuses on unbilled work orders, outstanding collected amounts, and lists top risk accounts in AR priority.',
    prompt: 'Generate a Financial Receivables and AR Audit. Aggregate total amount receivable, list accounts flagged as AR priority, and analyze billing statuses (e.g. Update Required, Partially Billed). Flag completed work orders that remain unbilled.'
  },
  {
    id: 'sector_review',
    title: 'Sector Performance Review',
    description: 'Detailed analysis of energy, renewables, railways, powerline, and mining sector performance across deals & work orders.',
    prompt: 'Generate a Sector Performance Review. Group both deals and work orders by sector (normalized). Compare the total pipeline value, won contract values, and billing rates for Renewables, Mining, Railways, Powerline, and Construction.'
  }
];

export const LeadershipUpdates: React.FC<LeadershipUpdatesProps> = ({
  data,
  apiKey,
  onGenerateReport,
  isGenerating
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(reportTemplates[0]);
  const [customPromptText, setCustomPromptText] = useState('');
  const [generatedReport, setGeneratedReport] = useState('');
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
        <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <p>No active board data loaded. Configure settings to enable leadership reports.</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    const promptToUse = customPromptText.trim() || selectedTemplate.prompt;
    setCopied(false);
    try {
      const result = await onGenerateReport(promptToUse, selectedTemplate.title);
      setGeneratedReport(result);
    } catch (e: any) {
      setGeneratedReport(`Error generating report: ${e.message || e}`);
    }
  };

  const handleCopy = () => {
    if (!generatedReport) return;
    navigator.clipboard.writeText(generatedReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to render markdown inline for preview
  const formatBriefForUI = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return <h1 key={i} style={{ fontSize: '1.4rem', color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginTop: '16px', marginBottom: '10px', fontFamily: 'var(--font-display)' }}>{trimmed.substring(2)}</h1>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={i} style={{ fontSize: '1.2rem', color: 'white', marginTop: '14px', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>{trimmed.substring(3)}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={i} style={{ fontSize: '1.05rem', color: 'white', marginTop: '12px', marginBottom: '6px', fontFamily: 'var(--font-display)' }}>{trimmed.substring(4)}</h3>;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return <li key={i} style={{ marginLeft: '20px', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{trimmed.substring(2)}</li>;
      }
      if (trimmed === '') return <div key={i} style={{ height: '10px' }} />;
      return <p key={i} style={{ marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{line}</p>;
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', height: '100%' }}>
      {/* Template selector side */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'white', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'var(--color-primary)' }} />
            Briefing Templates
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Select a structured leadership report template or customize the instructions below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {reportTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setCustomPromptText('');
                }}
                className="suggested-prompt-card"
                style={{
                  width: '100%',
                  borderColor: selectedTemplate.id === template.id ? 'var(--color-primary)' : 'var(--border-color)',
                  background: selectedTemplate.id === template.id ? 'rgba(99, 102, 241, 0.08)' : 'rgba(31, 41, 55, 0.2)',
                  color: selectedTemplate.id === template.id ? 'white' : 'var(--text-secondary)',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '2px', color: selectedTemplate.id === template.id ? 'var(--color-primary)' : 'white' }}>
                  {template.title}
                </div>
                <div style={{ fontSize: '0.7rem' }}>{template.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom refinement box */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>Refine Prompt (Optional)</h4>
          <textarea
            value={customPromptText}
            onChange={(e) => setCustomPromptText(e.target.value)}
            placeholder={`Customize instructions, e.g. "Focus on Renewables and Mining sector and list top 3 overdue invoices..."`}
            className="glass-input"
            style={{ width: '100%', height: '100px', fontSize: '0.8rem', resize: 'none', fontFamily: 'var(--font-sans)' }}
          />

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !apiKey}
            className="glass-button glass-button-primary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                <span>Compiling Update...</span>
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Compile Briefing</span>
              </>
            )}
          </button>
          {!apiKey && (
            <div style={{ fontSize: '0.7rem', color: 'var(--color-danger)', textAlign: 'center' }}>
              Add Gemini API Key in Credentials to enable compilation.
            </div>
          )}
        </div>
      </div>

      {/* Preview side */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', color: 'white' }}>
            Executive Brief Preview
          </h3>
          {generatedReport && (
            <button
              onClick={handleCopy}
              className="glass-button"
              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              {copied ? (
                <>
                  <Check size={14} style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--color-success)' }}>Copied!</span>
                </>
              ) : (
                <>
                  <Clipboard size={14} />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
          {isGenerating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px' }}>
              <div className="shimmer" style={{ height: '24px', width: '30%', borderRadius: '4px', marginBottom: '12px' }} />
              <div className="shimmer" style={{ height: '16px', width: '90%', borderRadius: '4px' }} />
              <div className="shimmer" style={{ height: '16px', width: '85%', borderRadius: '4px' }} />
              <div className="shimmer" style={{ height: '16px', width: '95%', borderRadius: '4px', marginBottom: '16px' }} />
              <div className="shimmer" style={{ height: '20px', width: '25%', borderRadius: '4px', marginBottom: '8px' }} />
              <div className="shimmer" style={{ height: '16px', width: '40%', borderRadius: '4px' }} />
              <div className="shimmer" style={{ height: '16px', width: '45%', borderRadius: '4px' }} />
            </div>
          ) : generatedReport ? (
            <div style={{ wordBreak: 'break-word' }}>
              {formatBriefForUI(generatedReport)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
              <FileText size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.85rem' }}>Select a template on the left and click "Compile Briefing" to generate an executive leadership report.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* CSS Spin style inline */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
};
