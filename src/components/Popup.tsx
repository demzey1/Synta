/**
 * Popup Component - Synta Transaction Safety
 * Clean, responsive UI showing decoded transaction details with risk assessment
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
    // Listen for messages from background script
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
    chrome.runtime.sendMessage({ type: 'USER_DECISION', approved });
    window.close();
  };

  // Risk level styling
  const getRiskColors = (level?: string) => {
    switch(level) {
      case 'danger': return { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-400', icon: '🔴' };
      case 'warning': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500', text: 'text-yellow-400', icon: '⚠️' };
      default: return { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-400', icon: '✅' };
    }
  };

  const risk = riskData || txData?.risk;
  const riskStyle = risk ? getRiskColors(risk.level) : getRiskColors();

  return (
    <div className="w-80 min-h-[300px] bg-slate-900 text-slate-100 p-4 font-sans">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
        <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
          🛡️
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Synta</h1>
          <p className="text-sm text-slate-400">Transaction Safety</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-8 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-slate-300">Analyzing transaction...</p>
        </div>
      )}

      {/* Transaction Details */}
      {!isLoading && txData && (
        <div className="space-y-4">
          {/* Risk Level Badge */}
          <div className={`p-3 rounded-lg ${riskStyle.bg} border ${riskStyle.border}`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{riskStyle.icon}</span>
              <span className={`font-medium ${riskStyle.text}`}>
                {(risk?.level || 'UNKNOWN').toUpperCase()} RISK
              </span>
            </div>
          </div>

          {/* Action */}
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Action</span>
            <p className="font-medium mt-1">{txData.action}</p>
          </div>

          {/* Token/Amount */}
          {(txData.amount || txData.token) && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Amount</span>
              <p className="font-medium mt-1">
                {txData.amount}
                {txData.token && <span className="text-slate-400"> ({txData.token})</span>}
              </p>
            </div>
          )}

          {/* Spender */}
          {txData.spender && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Spender</span>
              <p className="font-mono text-sm mt-1 break-all">{txData.spender}</p>
            </div>
          )}

          {/* Contract */}
          {txData.contract && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Contract</span>
              <p className="font-mono text-sm mt-1 break-all">{txData.contract}</p>
            </div>
          )}

          {/* Risk Reasons */}
          {risk?.reasons && risk.reasons.length > 0 && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Security Concerns</span>
              <ul className="mt-2 space-y-1">
                {risk.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button 
              onClick={() => handleDecision(false)}
              className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Reject
            </button>
            <button 
              onClick={() => handleDecision(true)}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-700 text-center">
        <span className="text-xs text-slate-500">🔐 Protected by Synta</span>
      </div>
    </div>
  );
};

export default Popup;
