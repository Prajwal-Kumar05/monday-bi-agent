import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle, HelpCircle, Terminal } from 'lucide-react';
import type { ChatMessage } from '../services/geminiService';
import type { DataWarning } from '../utils/dataProcessor';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  warnings: DataWarning[];
}

const suggestedPrompts = [
  {
    title: 'Pipeline Health',
    text: "How is our pipeline looking for the Renewables sector this quarter?"
  },
  {
    title: 'Collection & AR Risks',
    text: "Summarize our unbilled work order value and identify top accounts by Amount Receivable."
  },
  {
    title: 'Sector Performance',
    text: "Compare Won deals count and value across all sectors. Which is performing best?"
  },
  {
    title: 'Operational Audit',
    text: "Show me a summary of work orders that are 'Completed' but have billing status 'Update Required' or 'Open'."
  }
];

// A clean, simple markdown parser to render basic markdown formatting (tables, lists, bold) beautifully
const renderMarkdown = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let currentTable: { headers: string[]; rows: string[][] } | null = null;
  let codeBlock = false;
  let codeLines: string[] = [];

  const flushList = (key: number) => {
    if (currentList) {
      const Tag = currentList.type;
      elements.push(
        <Tag key={`list-${key}`} style={{ marginLeft: '24px', marginBottom: '14px', listStyleType: Tag === 'ul' ? 'disc' : 'decimal' }}>
          {currentList.items}
        </Tag>
      );
      currentList = null;
    }
  };

  const flushTable = (key: number) => {
    if (currentTable) {
      elements.push(
        <div key={`table-container-${key}`} className="table-responsive" style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {currentTable.headers.map((h, i) => (
                  <th key={`th-${i}`} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontWeight: 600 }}>
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentTable.rows.map((row, ri) => (
                <tr key={`tr-${ri}`} style={{ borderBottom: '1px solid var(--border-color)', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  {row.map((cell, ci) => (
                    <td key={`td-${ci}`} style={{ padding: '8px 14px' }}>
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTable = null;
    }
  };

  const renderInline = (str: string): React.ReactNode => {
    // Basic bold ** and code ` replacement
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      const codeMatch = remaining.match(/`(.*?)`/);

      const boldIndex = boldMatch && boldMatch.index !== undefined ? boldMatch.index : Infinity;
      const codeIndex = codeMatch && codeMatch.index !== undefined ? codeMatch.index : Infinity;

      if (boldIndex === Infinity && codeIndex === Infinity) {
        parts.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      if (boldIndex < codeIndex) {
        if (boldIndex > 0) {
          parts.push(<span key={keyIdx++}>{remaining.substring(0, boldIndex)}</span>);
        }
        parts.push(<strong key={keyIdx++} style={{ color: 'white', fontWeight: 600 }}>{boldMatch![1]}</strong>);
        remaining = remaining.substring(boldIndex + boldMatch![0].length);
      } else {
        if (codeIndex > 0) {
          parts.push(<span key={keyIdx++}>{remaining.substring(0, codeIndex)}</span>);
        }
        parts.push(
          <code key={keyIdx++} style={{ 
            background: 'rgba(31, 41, 55, 0.8)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.05)',
            fontFamily: 'monospace',
            fontSize: '0.85em',
            color: 'var(--color-accent)'
          }}>
            {codeMatch![1]}
          </code>
        );
        remaining = remaining.substring(codeIndex + codeMatch![0].length);
      }
    }

    return parts.length > 0 ? <>{parts}</> : str;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Code block check
    if (trimmed.startsWith('```')) {
      if (codeBlock) {
        codeBlock = false;
        elements.push(
          <pre key={`code-${index}`} style={{ 
            background: 'rgba(15, 23, 42, 0.8)', 
            border: '1px solid var(--border-color)',
            padding: '14px', 
            borderRadius: '8px', 
            overflowX: 'auto',
            marginBottom: '16px',
            fontFamily: 'monospace',
            fontSize: '0.85rem'
          }}>
            <code style={{ color: '#E2E8F0' }}>{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
      } else {
        flushList(index);
        flushTable(index);
        codeBlock = true;
      }
      return;
    }

    if (codeBlock) {
      codeLines.push(line);
      return;
    }

    // Table parser
    if (trimmed.startsWith('|')) {
      flushList(index);
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      
      // Check if it's separator row (e.g. |---|---|)
      const isSeparator = cells.every(c => /^:-*-*:*$/.test(c) || /^-+$/.test(c));
      
      if (isSeparator) {
        // Just skip separator lines
        return;
      }

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      return;
    } else {
      flushTable(index);
    }

    // Headers
    if (trimmed.startsWith('#')) {
      flushList(index);
      const level = line.match(/^#+/)?.[0].length || 1;
      const headingText = trimmed.substring(level).trim();
      const style: React.CSSProperties = {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        color: 'white',
        marginTop: level === 1 ? '24px' : '16px',
        marginBottom: '10px'
      };

      if (level === 1) {
        elements.push(<h1 key={`h-${index}`} style={{ ...style, fontSize: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>{renderInline(headingText)}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={`h-${index}`} style={{ ...style, fontSize: '1.25rem' }}>{renderInline(headingText)}</h2>);
      } else {
        elements.push(<h3 key={`h-${index}`} style={{ ...style, fontSize: '1.05rem' }}>{renderInline(headingText)}</h3>);
      }
      return;
    }

    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.substring(2).trim();
      if (!currentList || currentList.type !== 'ul') {
        flushList(index);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(
        <li key={`li-${index}`} style={{ marginBottom: '4px' }}>
          {renderInline(itemText)}
        </li>
      );
      return;
    }

    const numberListMatch = trimmed.match(/^\d+\.\s(.*)/);
    if (numberListMatch) {
      const itemText = numberListMatch[1].trim();
      if (!currentList || currentList.type !== 'ol') {
        flushList(index);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(
        <li key={`li-${index}`} style={{ marginBottom: '4px' }}>
          {renderInline(itemText)}
        </li>
      );
      return;
    }

    // Regular paragraphs
    if (trimmed === '') {
      flushList(index);
      return;
    }

    flushList(index);
    elements.push(
      <p key={`p-${index}`} style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
        {renderInline(line)}
      </p>
    );
  });

  // final flush
  flushList(lines.length);
  flushTable(lines.length);

  return elements;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatHistory,
  onSendMessage,
  isLoading,
  warnings
}) => {
  const [input, setInput] = useState('');
  const [showWarningsDrawer, setShowWarningsDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleSuggestionClick = (text: string) => {
    if (isLoading) return;
    onSendMessage(text);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  // Filters warning level for the drawer summary
  const criticalWarnings = warnings.filter(w => w.severity === 'critical' || w.severity === 'warning');

  return (
    <div className="chat-container">
      {/* Dynamic Header */}
      <div className="glass-panel" style={{ 
        padding: '16px 20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(17, 24, 39, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={18} style={{ color: 'var(--color-accent)' }} />
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Intelligence Query Agent</h4>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Powered by Gemini 1.5 Flash • Context: Deals & Work Orders
            </div>
          </div>
        </div>

        {/* Warnings button indicator */}
        {warnings.length > 0 && (
          <button 
            onClick={() => setShowWarningsDrawer(!showWarningsDrawer)}
            className="glass-button"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.75rem', 
              borderRadius: '20px', 
              borderColor: criticalWarnings.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              background: criticalWarnings.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
              color: criticalWarnings.length > 0 ? 'var(--color-danger)' : 'var(--color-warning)'
            }}
          >
            <AlertCircle size={12} />
            <span>{criticalWarnings.length} Warnings Active</span>
          </button>
        )}
      </div>

      {/* Warnings Drawer Overlay */}
      {showWarningsDrawer && warnings.length > 0 && (
        <div className="glass-panel" style={{ 
          padding: '16px', 
          borderLeft: '4px solid var(--color-warning)',
          background: 'rgba(15, 23, 42, 0.95)',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} /> Data Quality Caveats For Current Boards
            </span>
            <button 
              onClick={() => setShowWarningsDrawer(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Dismiss
            </button>
          </div>
          <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <ul style={{ paddingLeft: '16px' }}>
              {criticalWarnings.slice(0, 5).map((w, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>
                  <strong>[{w.board} - {w.row}]:</strong> {w.message}
                </li>
              ))}
              {criticalWarnings.length > 5 && (
                <li>And {criticalWarnings.length - 5} more issues. Review details in Data Quality tab.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Message List */}
      <div className="messages-list">
        {chatHistory.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            textAlign: 'center',
            color: 'var(--text-secondary)',
            padding: '40px 20px'
          }}>
            <HelpCircle size={40} style={{ color: 'var(--color-primary)', marginBottom: '16px', opacity: 0.8 }} />
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
              Ask the Business Intelligence Agent
            </h3>
            <p style={{ maxWidth: '480px', fontSize: '0.9rem', marginBottom: '32px' }}>
              Query consolidated sales forecasts, operational work order billing, and sector performance directly in natural language.
            </p>

            <div style={{ width: '100%', maxWidth: '600px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', textAlign: 'left' }}>
                Suggested founder queries:
              </div>
              <div className="suggested-prompts-grid">
                {suggestedPrompts.map((p, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => handleSuggestionClick(p.text)}
                    className="suggested-prompt-card"
                  >
                    <div style={{ fontWeight: 600, color: 'white', marginBottom: '4px' }}>{p.title}</div>
                    <div>{p.text}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div key={index} className={`chat-bubble chat-bubble-${msg.role}`}>
              <div className={`avatar avatar-${msg.role}`}>
                {msg.role === 'user' ? 'U' : 'AI'}
              </div>
              <div className="bubble-content">
                {renderMarkdown(msg.content)}
              </div>
            </div>
          ))
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="chat-bubble chat-bubble-model">
            <div className="avatar avatar-model">AI</div>
            <div className="bubble-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div className="shimmer" style={{ height: '14px', width: '40%', borderRadius: '4px' }} />
              <div className="shimmer" style={{ height: '14px', width: '80%', borderRadius: '4px' }} />
              <div className="shimmer" style={{ height: '14px', width: '60%', borderRadius: '4px' }} />
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit}>
        <div className="glass-panel chat-input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLoading ? 'Thinking...' : 'Ask about pipeline health, billing reports, AR issues...'}
            disabled={isLoading}
            className="chat-input"
            style={{ color: 'white', outline: 'none' }}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="glass-button glass-button-primary"
            style={{ padding: '10px 14px', borderRadius: '8px' }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};
