/**
 * Popup Component - Synta Transaction Safety
 * Enhanced UI featuring:
 * - Animated risk indicators
 * - Tabbed chain/domain views
 * - Progress rings for risk visualization
 * - Improved typography and spacing
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
  const [activeChain, setActiveChain] = useState<string>('ethereum');

  // List of supported chains for tabbed view
  const chains = [
    { id: 'ethereum', name: 'Ethereum' },
    { id: 'polygon', name: 'Polygon' },
    { id: 'arbitrum', name: 'Arbitrum' }
  ];

  useEffect(() => {
    const listener = (msg: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
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
    chrome.runtime.sendMessage({ 
      type: 'USER_DECISION', 
      approved,
      chain: activeChain // Include selected chain context
    });
    window.close();
  };

  // Calculate risk percentage for progress ring (0-100)
  const getRiskPercentage = (level?: string): number => {
    switch(level) {
      case 'danger': return 85; // High risk threshold
      case 'warning': return 60; // Medium risk threshold
      case 'safe': return 25; // Low risk baseline
      default: return 50; // Neutral baseline
    }
  };

  // SVG circle parameters for progress ring
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const riskPercent = getRiskPercentage(riskData?.level);
  const offset = circumference - (riskPercent / 100) * circumference;

  // Risk color mapping
  const getRiskColors = (level?: string) => {
    switch(level) {
      case 'danger': return { 
        bg: 'bg-red-500/10', 
        border: 'border-red-500', 
        text: 'text-red-400',
        ring: '#ef4444'
      };
      case 'warning': return { 
        bg: 'bg-yellow-500/10', 
        border: 'border-yellow-500', 
        text: 'text-yellow-400',
        ring: '#eab308'
      };
      default: return { 
        bg: 'bg-green-500/10', 
        border: 'border-green-500', 
        text: 'text-green-400',
        ring: '#22c55e'
      };
    }
  };

  const risk = riskData || txData?.risk;
  const riskStyle = risk ? getRiskColors(risk.level) : getRiskColors();

  return (
    <div className="w-96 min-h-[400px] bg-slate-900 text-slate-100 p-6 font-inter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <ShieldIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Synta</h1>
          <p className="text-sm text-slate-400">Transaction Safety Guardian</p>
        </div>
      </div>

      {/* Chain Tabs */}
      <div className="flex space-x-1 mb-6 border-b border-slate-700">
        {chains.map((chain) => (
          <button
            key={chain.id}
            onClick={() => setActiveChain(chain.id)}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeChain === chain.id
                ? 'border-b-2 border-indigo-500 text-white'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {chain.name}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center">
          <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Analyzing transaction...</p>
          <p className="text-slate-500 text-sm mt-2">
            Checking against scam databases and verifying contract legitimacy
          </p>
        </div>
      )}

      {/* Transaction Details */}
      {!isLoading && txData && (
        <div className="space-y-6">
          {/* Risk Visualization with Progress Ring */}
          <div className={`p-5 rounded-xl ${riskStyle.bg} border ${riskStyle.border} relative overflow-hidden`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Risk Assessment</span>
              <span className={`font-semibold ${riskStyle.text}`}>
                {(risk?.level || 'UNKNOWN').toUpperCase()}
              </span>
            </div>

            {/* Progress Ring */}
            <div className="flex items-center gap-4">
              <svg width="50" height="50" viewBox="0 0 40 40" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="20"
                  cy="20"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-slate-600/50"
                />
                {/* Progress circle */}
                <circle
                  cx="20"
                  cy="20"
                  r={radius}
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  stroke={riskStyle.ring}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div>
                <p className="text-2xl font-bold">{riskPercent}%</p>
                <p className="text-xs text-slate-500">Risk Score</p>
              </div>
            </div>
          </div>

          {/* Action Section */}
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Action</span>
            <p className="font-semibold mt-1 text-lg">{txData.action}</p>
          </div>

          {/* Chain-Specific Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Network</span>
              <p className="font-medium mt-1 capitalize">{activeChain}</p>
            </div>
            {txData.chainId && (
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Chain ID</span>
                <p className="font-medium mt-1">{txData.chainId}</p>
              </div>
            )}
          </div>

          {/* Token/Amount */}
          {(txData.amount || txData.token) && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Amount</span>
              <p className="font-medium mt-1 flex items-baseline gap-2">
                <span className="text-xl">{txData.amount}</span>
                {txData.token && (
                  <span className="px-2 py-0.5 bg-slate-800 rounded text-sm">
                    {txData.token}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Addresses */}
          <div className="space-y-3">
            {txData.spender && (
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Spender Address</span>
                <p className="font-mono text-sm mt-1 break-all bg-slate-800/50 p-2 rounded">
                  {txData.spender}
                </p>
              </div>
            )}
            {txData.contract && (
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">Contract Address</span>
                <p className="font-mono text-sm mt-1 break-all bg-slate-800/50 p-2 rounded">
                  {txData.contract}
                </p>
              </div>
            )}
          </div>

          {/* Security Concerns */}
          {risk?.reasons && risk.reasons.length > 0 && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Security Concerns</span>
              <ul className="mt-2 space-y-2">
                {risk.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span className="text-slate-300">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Audit Status */}
          {risk?.auditStatus && (
            <div className="flex justify-between py-2 border-t border-slate-700">
              <span className="text-sm text-slate-400">Audit Status</span>
              <span className={`font-medium ${
                risk.auditStatus === 'audited' ? 'text-green-400' :
                risk.auditStatus === 'not-audited' ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {risk.auditStatus === 'audited' ? 'Audited Contract' :
                 risk.auditStatus === 'not-audited' ? 'Not Audited' :
                 'Unknown'}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button 
              onClick={() => handleDecision(false)}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-all transform hover:scale-[1.02]"
            >
              Reject
            </button>
            <button 
              onClick={() => handleDecision(true)}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all transform hover:scale-[1.02] ${
                risk?.level === 'danger'
                  ? 'bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/50'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {risk?.level === 'danger' ? 'Confirm Risky' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700 text-center">
        <p className="text-xs text-slate-500">
          Protected by Synta Security Engine
        </p>
      </div>
    </div>
  );
};

// SVG Icon Component for Shield
const ShieldIcon: React.FC = () => (
  <svg 
    width="20" 
    height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="text-indigo-400"
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

export default Popup;
