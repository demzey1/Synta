/**
 * Synta Background Script
 * Bridges content scripts, popup UI, and web pages.
 * 
 * Flow:
 * 1. Content Script → INTERCEPT_REQUEST with raw eth call
 * 2. Background → decodes, analyzes risk, opens popup, sends ANALYSIS_UPDATE
 * 3. Popup → USER_DECISION → Background
 * 4. Background → sends INTERCEPT_RESPONSE back to content script
 * 5. Content script resolves/rejects the original promise
 */

import { decodeTransaction, DecodedTransaction } from '../services/transactionDecoder';
import { analyzeTransaction, RiskAssessment } from '../services/riskAnalyzer';

interface InterceptRequestMessage {
  type: 'INTERCEPT_REQUEST';
  messageId: string;
  method: string;
  params: unknown[] | unknown;
  origin: string;
  url: string;
  timestamp: number;
}

interface UserDecisionMessage {
  type: 'USER_DECISION';
  messageId: string;
  approved: boolean;
  reason?: string;
}

interface PopupUpdateMessage {
  type: 'ANALYSIS_UPDATE';
  messageId: string;
  transaction: DecodedTransaction;
  riskAssessment: RiskAssessment;
  method: string;
  origin: string;
}

interface PendingApproval {
  requestId: string;
  messageId: string;
  request: InterceptRequestMessage;
  senderTabId: number;
  decodedTx?: DecodedTransaction;
  riskAssessment?: RiskAssessment;
}

const pendingApprovals = new Map<string, PendingApproval>();

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function sendMessageToTab(tabId: number, message: any): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      // Don't reject on error - tab might be closed
      resolve();
    });
  });
}

async function handleInterceptRequest(
  message: InterceptRequestMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  const requestId = generateRequestId();
  const senderTabId = sender.tab?.id || 0;

  console.log('[Synta] Intercepted:', message.method, 'from', message.origin, 'msgId:', message.messageId);

  try {
    const decodedTx = decodeRequest(message);
    const riskAssessment = await analyzeTransaction(decodedTx);

    const approval: PendingApproval = {
      requestId,
      messageId: message.messageId,
      request: message,
      senderTabId,
      decodedTx,
      riskAssessment,
    };
    pendingApprovals.set(message.messageId, approval);

    // Update popup if open, otherwise open it
    await notifyUI(approval);

    // Respond to content script immediately that we received it
    sendResponse({ received: true });
  } catch (error) {
    console.error('[Synta] Intercept error:', error);
    pendingApprovals.delete(message.messageId);
    sendResponse({
      received: true,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
    // Auto-reject on error
    await sendMessageToTab(senderTabId, {
      type: 'INTERCEPT_RESPONSE',
      messageId: message.messageId,
      approved: false,
      reason: 'Analysis failed - rejecting for safety',
    });
  }
}

function decodeRequest(message: InterceptRequestMessage): DecodedTransaction {
  const defaultChainId = 1;

  if (message.method === 'eth_sendTransaction') {
    const paramsArray = Array.isArray(message.params) ? message.params : [message.params];
    if (paramsArray.length > 0) {
      const txParams = paramsArray[0] as { to?: string; data?: string; value?: string };
      const toAddress = txParams?.to || '';
      const data = txParams?.data || '0x';
      const value = txParams?.value || '0';
      return decodeTransaction({ to: toAddress, data, value }, defaultChainId);
    }
  }

  const paramsArray = Array.isArray(message.params) ? message.params : [];
  const toAddress = typeof paramsArray[0] === 'string' ? paramsArray[0] : '';

  return {
    action: message.method === 'personal_sign'
      ? 'Sign personal message'
      : message.method === 'eth_signTypedData_v4'
      ? 'Sign typed data (EIP-712)'
      : `Unknown method: ${message.method}`,
    contract: toAddress,
    chainId: defaultChainId,
  };
}

async function notifyUI(approval: PendingApproval): Promise<void> {
  const updateMessage: PopupUpdateMessage = {
    type: 'ANALYSIS_UPDATE',
    messageId: approval.messageId,
    transaction: approval.decodedTx!,
    riskAssessment: approval.riskAssessment!,
    method: approval.request.method,
    origin: approval.request.origin,
  };

  try {
    // Try to send to popup if it's open
    await chrome.runtime.sendMessage(updateMessage);
    console.log('[Synta] Analysis sent to popup');
  } catch {
    // Popup not open - create notification and open popup
    console.log('[Synta] Popup not open, creating notification');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/synta-icon-48.svg',
      title: 'Synta - Action Required',
      message: `New transaction from ${approval.request.origin || 'unknown site'}\n${approval.decodedTx?.action || 'Unknown action'}`,
    });
    
    // Open the popup
    chrome.action.openPopup?.();
  }
}

async function handleUserDecision(message: UserDecisionMessage): Promise<void> {
  const pending = pendingApprovals.get(message.messageId);
  
  if (!pending) {
    console.warn('[Synta] No pending approval for decision:', message.messageId);
    return;
  }

  const { senderTabId } = pending;
  pendingApprovals.delete(message.messageId);

  const response = {
    type: 'INTERCEPT_RESPONSE' as const,
    messageId: message.messageId,
    approved: message.approved,
    reason: message.reason,
  };

  if (senderTabId) {
    await sendMessageToTab(senderTabId, response);
  }

  console.log('[Synta] User decision:', message.approved ? '✅ approved' : '❌ rejected');
}

// ─── Message Listener ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((
  message,
  sender,
  sendResponse
): boolean => {
  switch (message.type) {
    case 'INTERCEPT_REQUEST':
      handleInterceptRequest(message, sender, sendResponse);
      return true;

    case 'USER_DECISION':
      handleUserDecision(message)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      return true;

    case 'POPUP_READY':
      console.log('[Synta] Popup is ready');
      break;

    default:
      break;
  }

  return false;
});

// Keep service worker alive
chrome.runtime.onStartup?.addListener(() => {
  console.log('[Synta] Service worker started');
});

// Export for testing
export { pendingApprovals, generateRequestId, handleInterceptRequest, handleUserDecision };
