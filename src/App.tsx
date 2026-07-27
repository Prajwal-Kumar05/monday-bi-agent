import { useState, useEffect } from 'react';
import { Terminal, Database, FileText, CheckCircle2, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { ChatInterface } from './components/ChatInterface';
import { DataDiagnostics } from './components/DataDiagnostics';
import { LeadershipUpdates } from './components/LeadershipUpdates';
import { fetchMondayBoard, fetchMockBoardData } from './services/mondayService';
import { queryGemini } from './services/geminiService';
import type { ChatMessage } from './services/geminiService';
import { cleanAndNormalizeData } from './utils/dataProcessor';
import type { CleanedData } from './utils/dataProcessor';

const EXPECTED_DEALS_COLUMNS = [
  'Deal Name',
  'Owner code',
  'Client Code',
  'Deal Status',
  'Close Date (A)',
  'Closure Probability',
  'Masked Deal value',
  'Tentative Close Date',
  'Deal Stage',
  'Product deal',
  'Sector/service',
  'Created Date'
];

const EXPECTED_WO_COLUMNS = [
  'Deal name masked',
  'Customer Name Code',
  'Serial #',
  'Nature of Work',
  'Last executed month of recurring project',
  'Execution Status',
  'Data Delivery Date',
  'Date of PO/LOI',
  'Document Type',
  'Probable Start Date',
  'Probable End Date',
  'BD/KAM Personnel code',
  'Sector',
  'Type of Work',
  'Is any Skylark software platform part of the client deliverables in this deal?',
  'Last invoice date',
  'latest invoice no.',
  'Amount in Rupees (Excl of GST) (Masked)',
  'Amount in Rupees (Incl of GST) (Masked)',
  'Billed Value in Rupees (Excl of GST.) (Masked)',
  'Billed Value in Rupees (Incl of GST.) (Masked)',
  'Collected Amount in Rupees (Incl of GST.) (Masked)',
  'Amount to be billed in Rs. (Exl. of GST) (Masked)',
  'Amount to be billed in Rs. (Incl. of GST) (Masked)',
  'Amount Receivable (Masked)',
  'AR Priority account',
  'Quantity by Ops',
  'Quantities as per PO',
  'Quantity billed (till date)',
  'Balance in quantity',
  'Invoice Status',
  'Expected Billing Month',
  'Actual Billing Month',
  'Actual Collection Month',
  'WO Status (billed)',
  'Collection status',
  'Collection Date',
  'Billing Status'
];

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'diagnostics' | 'leadership'>('chat');
  
  // Credentials config state
  const [apiKey, setApiKey] = useState('');
  const [mondayToken, setMondayToken] = useState('');
  const [dealsBoardId, setDealsBoardId] = useState('');
  const [woBoardId, setWoBoardId] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(true); // default to demo mode for instant testing!

  // Data State
  const [isMondayConnected, setMondayConnected] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cleanedData, setCleanedData] = useState<CleanedData | null>(null);
  
  // Custom Mappings stored for Diagnostics
  const [dealsMapping, setDealsMapping] = useState<Record<string, string>>({});
  const [woMapping, setWoMapping] = useState<Record<string, string>>({});

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setChatLoading] = useState(false);
  
  // Leadership State
  const [isReportGenerating, setReportGenerating] = useState(false);

  // Load config on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('bi_agent_api_key');
    const savedMondayToken = localStorage.getItem('bi_agent_monday_token');
    const savedDealsId = localStorage.getItem('bi_agent_deals_id');
    const savedWoId = localStorage.getItem('bi_agent_wo_id');
    const savedDemoMode = localStorage.getItem('bi_agent_demo_mode');

    const demo = savedDemoMode === null ? true : savedDemoMode === 'true';
    setIsDemoMode(demo);

    if (demo) {
      setApiKey(savedApiKey || 'demo-gemini-key');
      setMondayToken('demo-monday-token');
      setDealsBoardId('demo-deals-board');
      setWoBoardId('demo-wo-board');
    } else {
      setApiKey(savedApiKey || '');
      setMondayToken(savedMondayToken || '');
      setDealsBoardId(savedDealsId || '');
      setWoBoardId(savedWoId || '');
    }
  }, []);

  // Fetch / reload data when credentials or demo mode changes
  useEffect(() => {
    if (isDemoMode) {
      loadData();
    } else if (mondayToken && dealsBoardId && woBoardId) {
      loadData();
    } else {
      setCleanedData(null);
      setMondayConnected(false);
    }
  }, [apiKey, mondayToken, dealsBoardId, woBoardId, isDemoMode]);

  const loadData = async () => {
    setLoadingData(true);
    setErrorMessage('');
    try {
      if (isDemoMode) {
        // Load offline simulated mock datasets
        const mockDeals = fetchMockBoardData('deals');
        const mockWo = fetchMockBoardData('workOrders');

        setDealsMapping(mockDeals.columnMapping);
        setWoMapping(mockWo.columnMapping);

        const cleaned = cleanAndNormalizeData(
          mockDeals.items,
          mockWo.items,
          mockDeals.columnMapping,
          mockWo.columnMapping
        );

        setCleanedData(cleaned);
        setMondayConnected(true);
      } else {
        // Query Live Monday.com Board details
        const dealsBoard = await fetchMondayBoard(mondayToken, dealsBoardId, EXPECTED_DEALS_COLUMNS);
        const woBoard = await fetchMondayBoard(mondayToken, woBoardId, EXPECTED_WO_COLUMNS);

        setDealsMapping(dealsBoard.columnMapping);
        setWoMapping(woBoard.columnMapping);

        const cleaned = cleanAndNormalizeData(
          dealsBoard.items,
          woBoard.items,
          dealsBoard.columnMapping,
          woBoard.columnMapping
        );

        setCleanedData(cleaned);
        setMondayConnected(true);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Error pulling data from Monday.com');
      setCleanedData(null);
      setMondayConnected(false);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSaveConfig = (config: {
    apiKey: string;
    mondayToken: string;
    dealsBoardId: string;
    woBoardId: string;
    isDemoMode: boolean;
  }) => {
    localStorage.setItem('bi_agent_api_key', config.apiKey);
    localStorage.setItem('bi_agent_monday_token', config.mondayToken);
    localStorage.setItem('bi_agent_deals_id', config.dealsBoardId);
    localStorage.setItem('bi_agent_wo_id', config.woBoardId);
    localStorage.setItem('bi_agent_demo_mode', String(config.isDemoMode));

    setApiKey(config.apiKey);
    setMondayToken(config.mondayToken);
    setDealsBoardId(config.dealsBoardId);
    setWoBoardId(config.woBoardId);
    setIsDemoMode(config.isDemoMode);
    
    // Clear chat history on configuration change to align context
    setChatHistory([]);
  };

  const handleSendMessage = async (text: string) => {
    if (!cleanedData) {
      alert('Please load Monday.com board data before querying.');
      return;
    }

    const newUserMessage: ChatMessage = { role: 'user', content: text };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setChatLoading(true);

    try {
      const response = await queryGemini(
        apiKey,
        text,
        chatHistory,
        cleanedData.deals,
        cleanedData.workOrders,
        cleanedData.warnings,
        'chat'
      );
      setChatHistory([...updatedHistory, { role: 'model', content: response }]);
    } catch (e: any) {
      setChatHistory([
        ...updatedHistory,
        {
          role: 'model',
          content: `⚠️ **Agent Error:** Failed to get a response from Gemini.\n\n*Details:* ${e.message || e}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateReport = async (prompt: string, reportType: string): Promise<string> => {
    if (!cleanedData) {
      throw new Error('Please configure boards to compile leadership updates.');
    }
    setReportGenerating(true);
    try {
      const response = await queryGemini(
        apiKey,
        prompt,
        [], // fresh generation without chat history
        cleanedData.deals,
        cleanedData.workOrders,
        cleanedData.warnings,
        'leadership',
        reportType
      );
      return response;
    } finally {
      setReportGenerating(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar - Setup & Info */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <Terminal size={22} />
          </div>
          <span className="logo-text">Monday BI Agent</span>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          Founder-level business intelligence assistant for cross-board data auditing.
        </p>

        {/* MONDAY status indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="status-indicator">
            <span className={`status-light ${isMondayConnected ? 'status-light-success' : 'status-light-danger'}`} />
            <span>
              Monday API: {isMondayConnected ? (isDemoMode ? 'Simulated (Demo)' : 'Connected') : 'Disconnected'}
            </span>
          </div>

          <div className="status-indicator">
            <span className={`status-light ${apiKey ? 'status-light-success' : 'status-light-warning'}`} />
            <span>
              Gemini Engine: {apiKey ? 'Authorized' : 'Key Required'}
            </span>
          </div>
        </div>

        {/* Global Loading Spinner */}
        {loadingData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-primary)' }}>
            <Loader2 size={16} className="spin" />
            <span>Pulling Monday.com boards...</span>
          </div>
        )}

        {/* Global Error Display */}
        {errorMessage && (
          <div style={{ 
            padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px',
            fontSize: '0.75rem', color: 'var(--color-danger)', display: 'flex', gap: '8px'
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Credentials Form */}
        <ConfigPanel
          apiKey={apiKey}
          mondayToken={mondayToken}
          dealsBoardId={dealsBoardId}
          woBoardId={woBoardId}
          isDemoMode={isDemoMode}
          onSaveConfig={handleSaveConfig}
          setMondayConnected={setMondayConnected}
        />
        
        {/* Help footer */}
        <div className="glass-panel" style={{ padding: '12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <HelpCircle size={12} />
            <span>Usage Guide</span>
          </div>
          <span>Import the provided Deals and Work Orders CSVs into separate Monday boards, apply their IDs, and toggle off Demo Mode.</span>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-area">
        {/* Top navigation */}
        <header className="top-nav">
          <div className="nav-tabs">
            <button
              onClick={() => setActiveTab('chat')}
              className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            >
              <Terminal size={16} />
              Conversational Query
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`nav-tab ${activeTab === 'diagnostics' ? 'active' : ''}`}
            >
              <Database size={16} />
              Data Diagnostics & Health
            </button>
            <button
              onClick={() => setActiveTab('leadership')}
              className={`nav-tab ${activeTab === 'leadership' ? 'active' : ''}`}
            >
              <FileText size={16} />
              Leadership Updates
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={12} style={{ color: 'var(--color-accent)' }} />
            <span>Data synced dynamically</span>
          </div>
        </header>

        {/* Content panel */}
        <section className="content-pane">
          {activeTab === 'chat' && (
            <ChatInterface
              chatHistory={chatHistory}
              onSendMessage={handleSendMessage}
              isLoading={isChatLoading}
              warnings={cleanedData?.warnings || []}
            />
          )}

          {activeTab === 'diagnostics' && (
            <DataDiagnostics
              data={cleanedData}
              dealsMapping={dealsMapping}
              woMapping={woMapping}
            />
          )}

          {activeTab === 'leadership' && (
            <LeadershipUpdates
              data={cleanedData}
              apiKey={apiKey}
              onGenerateReport={handleGenerateReport}
              isGenerating={isReportGenerating}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
