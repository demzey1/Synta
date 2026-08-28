/**
 * Synta Popup Component
 * 
 * Main approval UI shown to users when they interact with dApps.
 * Displays transaction details, risk assessment, and confirmation controls.
 * 
 * State Flow:
 * Loading Spinner → Transaction Details → (Approval Response)
 * 
 * Features:
 * - Dynamic risk-level colors (green/yellow/red)
 * - Animated transitions between states
 * - Responsive centered layout
 * - Keyboard accessible buttons
 */

import React, { useState, useEffect } from 'react';
import { RiskAssessment } from '../services/riskAnalyzer';

// ============================================================================
// Type Definitions
// ============================================================================

interface DecodedTransaction {
  action: string;
  spender?: string;
  amount?: string;
  token?: string;
  contract: string;
  chainId: number;
  methodId?: string;
}

interface PopupProps {
  // Transaction is null when loading
  transaction: DecodedTransaction | null;
  // Risk assessment from analyzer
  riskAssessment: RiskAssessment | null;
  // Callback when user confirms/rejects
  onResponse: (approved: boolean, reason?: string) => void;
}

// ============================================================================
// Inline Styles (for animations and dynamic values)
// ============================================================================

const styles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .animate-spin-slow {
    animation: spin 1s linear infinite;
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }
  .animate-pulse-once {
    animation: pulse 1s ease-in-out;
  }
`;

// Inject styles into document head
const injectStyles = () => {
  if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
    return () => styleSheet.remove();
  }
  return () => {};
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns Tailwind classes for risk level color scheme
 */
function getRiskColorClasses(level: 'safe' | 'warning' | 'danger'): {
  bg: string;
  border: string;
  text: string;
  hover: string;
} {
  switch (level) {
    case 'safe':
      return {
        bg: 'bg-green-500/20',
        border: 'border-green-500/50',
        text: 'text-green-400',
        hover: 'hover:bg-green-500/30',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500/50',
        text: 'text-yellow-400',
        hover: 'hover:bg-yellow-500/30',
      };
    case 'danger':
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/50',
        text: 'text-red-400',
        hover: 'hover:bg-red-500/30',
      };
  }
}

/**
 * Formats address to shortened display (0x1234...5678)
 */
function shortenAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

/**
 * Capitalizes first letter of risk level
 */
function capitalizeLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Loading spinner shown while transaction data is being fetched
 */
const LoadingState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin-slow mb-4" />
      <p className="text-gray-400 text-sm font-medium">Analyzing transaction...</p>
    </div>
  );
};

/**
 * Main transaction details view
 */
const TransactionView: React.FC<{
  tx: DecodedTransaction;
  risk: RiskAssessment;
  onResponse: (approved: boolean, reason?: string) => void;
}> = ({ tx, risk, onResponse }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const riskColors = getRiskColorClasses(risk.level);
  const auditStatus = risk.auditStatus;

  const handleReject = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onResponse(false, 'User rejected transaction');
    }, 300); // Brief animation delay
  };

  const handleConfirm = () => {
    if (risk.level === 'danger') {
      // Double-confirm for dangerous transactions
      const confirmed = window.confirm(
        'This transaction is flagged as high risk. Are you sure you want to proceed?'
      );
      if (!confirmed) return;
    }
    
    setIsProcessing(true);
    setTimeout(() => {
      onResponse(true, 'User approved transaction');
    }, 300);
  };

  // Determine if approve button should be disabled
  const isDangerous = risk.level === 'danger';
  const isDangerousBtnEnabled = !isProcessing && (!isDangerous || isDangerous);

  return (
    <div className="animate-fade-in w-full space-y-4">
      {/* Token Icon & Action Header */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-700/50 rounded-full flex items-center justify-center text-xl">
          {tx.token ? tx.token.charAt(0) : 'Ξ'}
        </div>
        <div>
          <h2 className="font-semibold text-white text-lg leading-tight">
            {tx.action}
          </h2>
          {tx.token && (
            <p className="text-gray-400 text-sm">{tx.token} Token</p>
          )}
        </div>
      </div>

      {/* Risk Badge */}
      <div className={`${riskColors.bg} ${riskColors.border} border rounded-lg px-3 py-2 flex items-center space-x-2`}>
        <div className={`w-2 h-2 rounded-full ${riskColors.bg.replace('/20', '/100')}`} />
        <span className={`${riskColors.text} font-medium text-sm`}>
          {capitalizeLevel(risk.level)} Risk
        </span>
      </div>

      {/* Reasons (if any) */}
      {risk.reasons.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">
            Security Concerns
          </p>
          <ul className="space-y-1">
            {risk.reasons.map((reason, idx) => (
              <li key={idx} className="text-red-300 text-sm flex items-start space-x-2">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Audit Status Badge */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">Audit Status</span>
        <span className={`
          px-2 py-1 rounded text-xs font-medium
          ${auditStatus === 'audited' 
            ? 'bg-green-500/20 text-green-400' 
            : auditStatus === 'not-audited'
            ? 'bg-red-500/20 text-red-400'
            : 'bg-gray-500/20 text-gray-400'}
        `}>
          {capitalizeLevel(auditStatus)}
        </span>
      </div>

      {/* Contract Info */}
      <div className="text-sm text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>Contract:</span>
          <span className="font-mono text-gray-300">{shortenAddress(tx.contract)}</span>
        </div>
        {tx.spender && (
          <div className="flex justify-between">
            <span>Spender:</span>
            <span className="font-mono text-gray-300">{shortenAddress(tx.spender)}</span>
          </div>
        )}
        {tx.amount && (
          <div className="flex justify-between">
            <span>Amount:</span>
            <span className="text-gray-300">{tx.amount}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-2">
        <button
          onClick={handleReject}
          disabled={isProcessing}
          className="flex-1 py-2.5 px-4 bg-gray-800/50 hover:bg-gray-700/70 text-gray-300 hover:text-white rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50"
        >
          Reject
        </button>
        
        <button
          onClick={handleConfirm}
          disabled={!isDangerousBtnEnabled}
          className={`
            flex-1 py-2.5 px-4 rounded-lg font-medium text-sm
            transition-all duration-200 disabled:opacity-50
            ${isDangerous
              ? 'bg-red-600/30 hover:bg-red-600/50 text-red-300 hover:text-red-200 border border-red-500/50'
              : 'bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 hover:text-blue-200 border border-blue-500/50'}
          `}
        >
          {isDangerous ? ' Confirm Risky ' : 'Confirm'}
        </button>
      </div>

      {/* Phishing Warning (if applicable) */}
      {risk.phishingMatch && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-2 text-center">
          <span className="text-red-400 text-xs font-medium">
            ⚠ This contract is flagged as phishing
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Synta Popup - Main approval interface for wallet transactions
 * 
 * States:
 * 1. Loading → Spinner with "Analyzing..."
 * 2. Ready → Transaction details with risk assessment
 */
const Popup: React.FC<PopupProps> = ({ transaction, riskAssessment, onResponse }) => {
  // Inject CSS styles for animations
  useEffect(() => {
    const cleanup = injectStyles();
    return cleanup;
  }, []);

  // Internal state managed directly here for live updates
  const [internalTx, setInternalTx] = useState<DecodedTransaction | null>(transaction || null);
  const [internalRisk, setInternalRisk] = useState<RiskAssessment | null>(riskAssessment || null);

  useEffect(() => {
    // Listen for ANALYSIS_UPDATE from background
    const messageListener = (msg: any, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      if (msg.type === 'ANALYSIS_UPDATE') {
        setInternalTx(msg.transaction);
        setInternalRisk(msg.riskAssessment);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Use internal state if available, fall back to props
  const txToShow = internalTx || transaction;
  const riskToShow = internalRisk || riskAssessment;

  // Helper to send decision to background
  const sendDecision = (approved: boolean, reason?: string) => {
    chrome.runtime.sendMessage({
      type: 'USER_DECISION',
      approved,
      reason
    });

    if (onResponse) {
      onResponse(approved, reason);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-white font-sans overflow-y-auto">
      <div className="max-w-full mx-auto p-4">
        {/* Header */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
              <span className="text-indigo-400 text-sm">🛡️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Synta</h1>
              <p className="text-sm text-slate-400">Transaction Safety</p>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="min-h-[280px]">
          {!txToShow || !riskToShow ? (
            <LoadingState />
          ) : (
            <TransactionView
              tx={txToShow}
              risk={riskToShow}
              onResponse={sendDecision}
            />
          )}
        </main>

        {/* Footer Note */}
        <footer className="mt-6 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
          Protected by Synta
        </footer>
      </div>
    </div>
  );
};

export default Popup;