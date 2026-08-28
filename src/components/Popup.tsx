/**
 * Synta Popup Component — Enhanced UI
 *
 * Visual improvements:
 * - 480px-wide canvas (per viewport config)
 * - Animated gradient shield header
 * - Risk progress ring (SVG) with percentage
 * - Color-coded threat badges
 * - Action icon + details card
 * - Address rows with copy buttons
 * - Security concerns list
 * - Audit & chain info
 * - Confirm / Reject buttons
 *
 * Listens to `ANALYSIS_UPDATE` messages from the background script
 * (sent when a new transaction is intercepted). On user decision, posts
 * `USER_DECISION` and closes the popup.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DecodedTransaction, RiskAssessment } from '../services/transactionDecoder';
import { RISK_COLORS } from '../utils/riskThemes';

interface PopupProps {
  transaction?: DecodedTransaction | null;
  riskAssessment?: RiskAssessment | null;
  onDecision?: (approved: boolean) => void;
}

const Popup: React.FC<PopupProps> = ({ transaction, riskAssessment, onDecision }) => {
  const [txData, setTxData] = useState<DecodedTransaction | null>(transaction ?? null);
  const [riskData, setRiskData] = useState<RiskAssessment | null>(riskAssessment ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!transaction && !riskAssessment);

  useEffect(() => {
    const listener = (
      msg: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (msg.type === 'ANALYSIS_UPDATE') {
        setTxData(msg.transaction);
        setRiskData(msg.riskAssessment);
        setIsLoading(false);
        sendResponse({ received: true });
        return true;
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const handleDecision = useCallback(
    (approved: boolean) => {
      onDecision?.(approved);
      chrome.runtime.sendMessage({ type: 'USER_DECISION', approved });
      window.close();
    },
    [onDecision]
  );

  // ── Theme selection ──────────────────────────────────────────────
  const theme = RISK_COLORS[riskData?.level ?? 'neutral'];

  const getRiskPercentage = (level?: string): number => {
    switch (level) {
      case 'danger':
        return 90;
      case 'warning':
        return 65;
      case 'safe':
        return 30;
      default:
        return 50;
    }
  };

  const riskPercent = getRiskPercentage(riskData?.level);

  // ── SVG progress ring helper ─────────────────────────────────────
  const renderRiskRing = () => {
    const size = 100;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (riskPercent / 100) * circumference;

    const colorMap = {
      danger: '#ef4444',
      warning: '#eab308',
      safe: '#22c55e',
      neutral: '#6366f1',
    };
    const ringColor = colorMap[riskData?.level ?? 'neutral'];

    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="#334159"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        {/* Percentage label */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs font-bold fill-slate-200"
        >
          {riskPercent}%
        </text>
      </svg>
    );
  };

  return (
    <div className={`relative w-full h-full ${theme.bg} text-white overflow-hidden rounded-xl`}>
      {/* Header with shield icon */}
      <div className="relative z-10 flex flex-col p-5 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border ${theme.border}`}
          >
            <ShieldIcon className="text-indigo-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-white to-cyan-400 bg-clip-text text-transparent">
              Synta
            </h1>
            <p className="text-sm text-slate-400">Transaction Safety Engine</p>
          </div>
        </div>

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldIcon className="text-indigo-400 w-6 h-6" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Analyzing transaction...</p>
              <p className="text-sm text-slate-400 mt-1">
                Decoding smart contract interactions
                <br />
                Checking against threat databases
              </p>
            </div>
          </div>
        )}

        {/* ── Transaction content ── */}
        {!isLoading && txData && (
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pb-4">
            {/* Risk gauge */}
            <div className="mb-6 pb-4 border-b border-slate-700/50">
              <div className="flex justify-between items-center mb-3">
                <h2 className={`text-lg font-semibold ${theme.accent}`}>
                  {(riskData?.level || 'UNKNOWN').toUpperCase()} RISK
                </h2>
                <span className={`text-sm font-bold ${theme.accent}`}>
                  {riskPercent}% Threat Level
                </span>
              </div>

              <div className="flex items-center gap-4">
                {/* Progress ring */}
                <div className="flex-shrink-0">{renderRiskRing()}</div>

                {/* Risk reasons */}
                <div className="flex-1">
                  {riskData?.reasons && riskData.reasons.length > 0 ? (
                    <ul className="space-y-1">
                      {riskData.reasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className={`mt-0.5 text-current ${theme.accent}`}>●</span>
                          <span className="text-slate-300 leading-tight">{reason}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-300">No significant risks detected</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action card */}
            <div className="mb-5 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <ActionIcon action={txData.action} className="text-indigo-400" />
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

            {/* Address rows */}
            <div className="mb-5 space-y-3">
              {txData.spender && (
                <AddressRow label="Spender" address={txData.spender} theme={theme} />
              )}
              {txData.contract && txData.contract !== txData.spender && (
                <AddressRow label="Contract" address={txData.contract} theme={theme} isContract />
              )}
            </div>

            {/* Security concerns (only if riskData has them) */}
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

            {/* Audit status & chain info */}
            <div className="space-y-3 border-t border-slate-700/30 pt-3">
              {riskData?.auditStatus && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-slate-400">Smart Contract Audit</span>
                  <span
                    className={`font-medium ${
                      riskData.auditStatus === 'audited'
                        ? 'text-green-400'
                        : riskData.auditStatus === 'not-audited'
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {riskData.auditStatus === 'audited'
                      ? 'Audited'
                      : riskData.auditStatus === 'not-audited'
                      ? 'Not Audited'
                      : 'Unknown'}
                  </span>
                </div>
              )}
              {txData.chainId && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-slate-400">Chain ID</span>
                  <span className="font-medium">{txData.chainId}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Action buttons (always visible when not loading) ── */}
        {!isLoading && txData && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
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
          Powered by Synta · Real-time Blockchain Security
        </div>
      </div>
    </div>
  );
};

// ── SVG Icon Components ───────────────────────────────────────────

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

const TransferIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M21 15.5C21 17.9817 16.1511 20.5 11 20.5C5.84891 20.5 1 17.9817 1 15.5C1 13.0183 5.84891 10.5 11 10.5C16.1511 10.5 21 13.0183 21 15.5Z" />
    <path d="M15 9L19 4L15 0" />
  </svg>
);

const ApproveIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M9 11L14 16L19 4M21 12V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6C3 4.89543 3.89543 4 5 4H13" />
  </svg>
);

const DefaultIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 22C17.3075 22 22 17.3075 22 12C22 6.69251 17.3075 2 12 2C6.69251 2 2 6.69251 2 12C2 17.3075 6.69251 22 12 22Z" />
    <path d="M9 12L11 14L15 10" />
  </svg>
);

const ActionIcon: React.FC<{ action: string; className?: string }> = ({ action, className }) => {
  const lower = action.toLowerCase();
  if (lower.includes('transfer') || lower.includes('send')) return <TransferIcon className={className} />;
  if (lower.includes('approve')) return <ApproveIcon className={className} />;
  return <DefaultIcon className={className} />;
};

const AddressRow: React.FC<{
  label: string;
  address: string;
  theme: typeof RISK_COLORS[keyof typeof RISK_COLORS];
  isContract?: boolean;
}> = ({ label, address, theme, isContract = false }) => {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${isContract ? 'bg-indigo-400' : 'bg-slate-500'}`}
        />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <span className="font-mono text-sm text-slate-300 break-all max-w-[200px]">
        {shortAddr}
      </span>
    </div>
  );
};

export default Popup;
