/**
 * Synta Popup Component - Enhanced UI
 * Features:
 * - Wider canvas with dynamic gradient borders
 * - Risk-based thematic color schemes
 * - Interactive transaction visualization
 * - Smooth animations and transitions
 */
import React, { useState, useEffect } from 'react';
import { DecodedTransaction, RiskAssessment } from '../services/transactionDecoder';

interface PopupProps {
  transaction: DecodedTransaction | null;
  riskAssessment: RiskAssessment | null;
  onDecision: (approved: boolean) => void;
}

const Popup: React.FC<PopupProps> = ({ transaction, riskAssessment, onDecision }) => {
  const [txData, setTxData] = useState<DecodedTransaction | null>(transaction);
  const [riskData, setRiskData] = useState<RiskAssessment | null>(riskAssessment);
  const [isLoading, setIsLoading] = useState<boolean>(!transaction && !riskAssessment);

  useEffect(() => {
    const listener = (msg: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (msg.type === 'ANALYSIS_UPDATE') {
        setTxData(msg.transaction);
        setRiskData(msg.riskAssessment);
        setIsLoading(false);
        sendResponse({ received: true });
        return true;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleDecision = (approved: boolean) => {
    if (onDecision) {
      onDecision(approved);
    }
    chrome.runtime.sendMessage({ type: 'USER_DECISION', approved });
    window.close();
  };

  // Thematic styling based on risk level
  const getRiskTheme = (level?: string) => {
    const themes = {
      danger: {
        bg: 'from-red-900/40 via-slate-900 to-red-900/40',
        border: 'border-red-500/50',
        accent: 'text-red-400',
        shadow: 'shadow-red-900/30',
        iconBg: 'bg-red-500/20'
      },
      warning: {
        bg: 'from-yellow-900/40 via-slate-900 to-yellow-900/40',
        border: 'border-yellow-500/50',
        accent: 'text-yellow-400',
        shadow: 'shadow-yellow-900/30',
        iconBg: 'bg-yellow-500/20'
      },
      safe: {
        bg: 'from-green-900/40 via-slate-900 to-green-900/40',
        border: 'border-green-500/50',
        accent: 'text-green-400',
        shadow: 'shadow-green-900/30',
        iconBg: 'bg-green-500/20'
      }
    };
    return themes[level as keyof typeof themes] || themes.safe;
  };

  const theme = getRiskTheme(riskData?.level);

  // Risk percentage for visual meter
  const getRiskPercentage = (level?: string): number => {
    switch(level) {
      case 'danger': return 90;
      case 'warning': return 65;
      case 'safe': return 30;
      default: return 50;
    }
  };

  const riskPercent = getRiskPercentage(riskData?.level);

  return (
    <div 
      className={`relative w-full h-full bg-gradient-to-b ${theme.bg} text-white overflow-hidden`}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent animate-pulse-slow">
        <div className={`absolute inset-0 rounded-xl border-2 ${theme.border} opacity-70`}></div>
      </div>

      {/* Main content container */}
      <div className="relative z-10 h-full flex flex-col p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center border ${theme.border}`}>
            <ShieldIcon className={theme.accent} />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-white to-cyan-400 bg-clip-text text-transparent">
              Synta
            </h1>
            <p className="text-sm text-slate-400">Transaction Safety Engine</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldIcon className="text-indigo-400 w-6 h-6" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Analyzing transaction...</p>
              <p className="text-sm text-slate-400 mt-1">
                Decoding smart contract interactions<br />
                Checking against threat databases
              </p>
            </div>
          </div>
        )}

        {/* Transaction Content */}
        {!isLoading && txData && (
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
            {/* Risk Gauge Section */}
            <div className="mb-6 pb-4 border-b border-slate-700/50">
              <div className="flex justify-between items-center mb-3">
                <h2 className={`text-lg font-semibold ${theme.accent}`}>
                  {(riskData?.level || 'UNKNOWN').toUpperCase()} RISK DETECTED
                </h2>
                <span className={`text-sm font-bold ${theme.accent}`}>
                  {riskPercent}% Threat Level
                </span>
              </div>
              
              {/* Custom Risk Meter */}
              <div className="relative h-6 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className={`h-full bg-gradient-to-r transition-all duration-500 ${
                    riskData?.level === 'danger' ? 'from-red-500 to-orange-500' :
                    riskData?.level === 'warning' ? 'from-yellow-500 to-amber-500' :
                    'from-green-500 to-emerald-500'
                  }`}
                  style={{ width: `${riskPercent}%` }}
                ></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                  {riskPercent}% Risk Score
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="mb-5 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <ActionIcon action={txData.action} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{txData.action}</h3>
                  {txData.amount && (
                    <p className="text-2xl font-bold text-indigo-300">{txData.amount}</p>
                  )}
                  {txData.token && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-slate-700/50 rounded text-xs">
                      {txData.token}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Addresses Section */}
            <div className="mb-5 space-y-3">
              {txData.spender && (
                <AddressRow 
                  label="Spender" 
                  address={txData.spender} 
                  theme={theme}
                />
              )}
              {txData.contract && (
                <AddressRow 
                  label="Contract" 
                  address={txData.contract} 
                  theme={theme}
                  isContract={true}
                />
              )}
            </div>

            {/* Security Concerns */}
            {riskData?.reasons && riskData.reasons.length > 0 && (
              <div className="mb-5">
                <h3 className={`text-sm font-medium ${theme.accent} mb-2`}>
                  Security Concerns ({riskData.reasons.length})
                </h3>
                <ul className="space-y-2">
                  {riskData.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-red-400 mt-0.5">⚠</span>
                      <span className="text-slate-300">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Audit Status */}
            {riskData?.auditStatus && (
              <div className="flex justify-between items-center py-3 border-t border-slate-700/50 mb-5">
                <span className="text-sm text-slate-400">Smart Contract Audit</span>
                <span className={`font-medium ${
                  riskData.auditStatus === 'audited' ? 'text-green-400' :
                  riskData.auditStatus === 'not-audited' ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {riskData.auditStatus === 'audited' ? 'Audited' :
                   riskData.auditStatus === 'not-audited' ? 'Not Audited' :
                   'Unknown'}
                </span>
              </div>
            )}

            {/* Chain Info */}
            {txData.chainId && (
              <div className="flex justify-between items-center py-2 border-t border-slate-700/50">
                <span className="text-sm text-slate-400">Chain ID</span>
                <span className="font-medium">{txData.chainId}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!isLoading && txData && (
          <div className="mt-5 pt-4 border-t border-slate-700/50">
            <div className="flex gap-3">
              <button
                onClick={() => handleDecision(false)}
                className="flex-1 py-3 px-4 bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02]"
              >
                Reject Transaction
              </button>
              <button
                onClick={() => handleDecision(true)}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 transform hover:scale-[1.02] ${
                  riskData?.level === 'danger'
                    ? 'bg-gradient-to-r from-red-600/40 to-orange-600/40 hover:from-red-600/60 hover:to-orange-600/60 text-white border border-red-500/50'
                    : 'bg-gradient-to-r from-indigo-600/40 to-cyan-600/40 hover:from-indigo-600/60 hover:to-cyan-600/60 text-white border border-indigo-500/50'
                }`}
              >
                {riskData?.level === 'danger' ? '⚠ Confirm Risky Action' : 'Approve Safely'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 mt-auto pt-3 border-t border-slate-700/30">
          Powered by Synta • Real-time Blockchain Security
        </div>
      </div>
    </div>
  );
};

// SVG Icon Components
const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M12 22C17.3075 22 22 17.3075 22 12C22 6.69251 17.3075 2 12 2C6.69251 2 2 6.69251 2 12C2 17.3075 6.69251 22 12 22Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <path 
      d="M9 12L11 14L15 10" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

const ActionIcon: React.FC<{ action: string }> = ({ action }) => {
  const getIcon = () => {
    if (action.includes('transfer') || action.includes('Send')) return <TransferIcon />;
    if (action.includes('approve') || action.includes('Approve')) return <ApproveIcon />;
    return <DefaultIcon />;
  };
  return getIcon();
};

const TransferIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15.5C21 17.9817 16.1511 20.5 11 20.5C5.84891 20.5 1 17.9817 1 15.5C1 13.0183 5.84891 10.5 11 10.5C16.1511 10.5 21 13.0183 21 15.5Z" />
    <path d="M15 9L19 4L15 0" />
  </svg>
);

const ApproveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11L14 16L19 4M21 12V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6C3 4.89543 3.89543 4 5 4H13" />
  </svg>
);

const DefaultIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22C17.3075 22 22 17.3075 22 12C22 6.69251 17.3075 2 12 2C6.69251 2 2 6.69251 2 12C2 17.3075 6.69251 22 12 22Z" />
    <path d="M9 12L11 14L15 10" />
  </svg>
);

const AddressRow: React.FC<{
  label: string;
  address: string;
  theme: any;
  isContract?: boolean;
}> = ({ label, address, theme, isContract = false }) => {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          isContract ? 'bg-indigo-400' : 'bg-slate-500'
        }`}></span>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <span className="font-mono text-sm text-slate-300 break-all max-w-[200px]">
        {shortAddr}
      </span>
    </div>
  );
};

export default Popup;
