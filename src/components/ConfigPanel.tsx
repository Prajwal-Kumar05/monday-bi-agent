import React, { useState } from 'react';
import { Settings, Database, Key, CheckCircle2, AlertTriangle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { checkMondayConnection } from '../services/mondayService';

interface ConfigPanelProps {
  apiKey: string;
  mondayToken: string;
  dealsBoardId: string;
  woBoardId: string;
  isDemoMode: boolean;
  onSaveConfig: (config: {
    apiKey: string;
    mondayToken: string;
    dealsBoardId: string;
    woBoardId: string;
    isDemoMode: boolean;
  }) => void;
  setMondayConnected: (connected: boolean) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  apiKey,
  mondayToken,
  dealsBoardId,
  woBoardId,
  isDemoMode,
  onSaveConfig,
  setMondayConnected
}) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localMondayToken, setLocalMondayToken] = useState(mondayToken);
  const [localDealsId, setLocalDealsId] = useState(dealsBoardId);
  const [localWoId, setLocalWoId] = useState(woBoardId);
  const [localDemoMode, setLocalDemoMode] = useState(isDemoMode);

  const [showApiKey, setShowApiKey] = useState(false);
  const [showMondayToken, setShowMondayToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  const handleSave = () => {
    onSaveConfig({
      apiKey: localApiKey,
      mondayToken: localMondayToken,
      dealsBoardId: localDealsId,
      woBoardId: localWoId,
      isDemoMode: localDemoMode
    });
  };

  const handleTestConnection = async () => {
    if (localDemoMode) {
      setTestResult('success');
      setMondayConnected(true);
      return;
    }

    if (!localMondayToken) {
      alert('Please enter a Monday.com API Token first.');
      return;
    }

    setTestingConnection(true);
    setTestResult(null);
    try {
 const isConnected = await checkMondayConnection();
      if (isConnected) {
        setTestResult('success');
        setMondayConnected(true);
      } else {
        setTestResult('failed');
        setMondayConnected(false);
      }
    } catch (e) {
      setTestResult('failed');
      setMondayConnected(false);
    } finally {
      setTestingConnection(false);
    }
  };

  const toggleDemoMode = (checked: boolean) => {
    setLocalDemoMode(checked);
    if (checked) {
      setLocalApiKey(localApiKey || 'demo-gemini-key');
      setLocalMondayToken('demo-monday-token');
      setLocalDealsId('demo-deals-board');
      setLocalWoId('demo-wo-board');
      setMondayConnected(true);
    } else {
      // Clear demo values to let them input their own
      setLocalApiKey(apiKey === 'demo-gemini-key' ? '' : apiKey);
      setLocalMondayToken(mondayToken === 'demo-monday-token' ? '' : mondayToken);
      setLocalDealsId(dealsBoardId === 'demo-deals-board' ? '' : dealsBoardId);
      setLocalWoId(woBoardId === 'demo-wo-board' ? '' : woBoardId);
      setMondayConnected(false);
      setTestResult(null);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <Settings size={18} className="text-secondary" style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Agent Credentials</h3>
      </div>

      {/* Demo Mode Switch */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '12px', 
        background: 'rgba(99, 102, 241, 0.06)', 
        border: '1px dashed rgba(99, 102, 241, 0.25)', 
        borderRadius: '8px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--color-secondary)' }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>Demo Mode (Offline)</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Uses pre-compiled messy CSVs</div>
          </div>
        </div>
        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input 
            type="checkbox" 
            checked={localDemoMode} 
            onChange={(e) => toggleDemoMode(e.target.checked)}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute',
            cursor: 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: localDemoMode ? 'var(--color-primary)' : '#4b5563',
            borderRadius: '34px',
            transition: '0.2s',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              height: '14px', width: '14px',
              left: localDemoMode ? '18px' : '4px',
              bottom: '3px',
              backgroundColor: 'white',
              borderRadius: '50%',
              position: 'relative',
              transition: '0.2s'
            }} />
          </span>
        </label>
      </div>

      {/* Gemini API Key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Key size={12} /> Gemini API Key
        </label>
        <div style={{ position: 'relative', display: 'flex' }}>
          <input
            type={showApiKey ? 'text' : 'password'}
            value={localApiKey}
            onChange={(e) => setLocalApiKey(e.target.value)}
            placeholder={localDemoMode ? 'demo-gemini-key' : 'Enter API Key...'}
            disabled={localDemoMode}
            className="glass-input"
            style={{ width: '100%', paddingRight: '40px' }}
          />
          <button 
            type="button" 
            onClick={() => setShowApiKey(!showApiKey)}
            disabled={localDemoMode}
            style={{ 
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', 
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' 
            }}
          >
            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Monday Token */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Database size={12} /> Monday Personal API Token
        </label>
        <div style={{ position: 'relative', display: 'flex' }}>
          <input
            type={showMondayToken ? 'text' : 'password'}
            value={localMondayToken}
            onChange={(e) => setLocalMondayToken(e.target.value)}
            placeholder={localDemoMode ? 'demo-monday-token' : 'Enter Monday Token...'}
            disabled={localDemoMode}
            className="glass-input"
            style={{ width: '100%', paddingRight: '40px' }}
          />
          <button 
            type="button" 
            onClick={() => setShowMondayToken(!showMondayToken)}
            disabled={localDemoMode}
            style={{ 
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', 
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' 
            }}
          >
            {showMondayToken ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Board IDs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Deals Board ID</label>
          <input
            type="text"
            value={localDealsId}
            onChange={(e) => setLocalDealsId(e.target.value)}
            placeholder="Deals board ID"
            disabled={localDemoMode}
            className="glass-input"
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Work Orders ID</label>
          <input
            type="text"
            value={localWoId}
            onChange={(e) => setLocalWoId(e.target.value)}
            placeholder="Work orders ID"
            disabled={localDemoMode}
            className="glass-input"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button 
          onClick={handleTestConnection}
          disabled={testingConnection}
          className="glass-button" 
          style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
        >
          {testingConnection ? 'Testing...' : 'Test Connection'}
        </button>
        <button 
          onClick={handleSave} 
          className="glass-button glass-button-primary" 
          style={{ flex: 1, justifyContent: 'center', fontSize: '0.85rem' }}
        >
          Apply Credentials
        </button>
      </div>

      {/* Connection Result Status */}
      {testResult && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          fontSize: '0.8rem',
          background: testResult === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: testResult === 'success' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
          color: testResult === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
        }}>
          {testResult === 'success' ? (
            <>
              <CheckCircle2 size={14} />
              <span>Connection active! Ready to query.</span>
            </>
          ) : (
            <>
              <AlertTriangle size={14} />
              <span>Connection failed. Check token/permissions.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
