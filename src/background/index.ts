/**
 * Synta Background Script
 *
 * Central orchestrator that bridges content scripts, popup UI, and web pages.
 *
 * Message Flow:
 * 1. Content Script → sends INTERCEPT_REQUEST with raw Ethereum call data
 * 2. Background → decodes transaction, analyzes risk, updates popup
 * 3. Popup → sends user decision (confirm/reject) back to background
 * 4. Background → resolves the original promise in the webpage
 *
 * Uses chrome.runtime.onMessage for cross-context communication
 */

// ============================================================================
// Imports
// ============================================================================

import { decodeTransaction, DecodedTransaction } from '../services/transactionDecoder';
import { analyzeTransaction, RiskAssessment } from '../services/riskAnalyzer';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Message from content script requesting security screening
 * Sent when user initiates a transaction/signing request
 */
interface InterceptRequestMessage {
  type: 'INTERCEPT_REQUEST';
  method: string;
  params: unknown[] | unknown;
  origin: string;
  url: string;
  timestamp: number;
}

/**
 * Response sent back to content script after user decision
 * Resolves/rejects the intercepted promise in the webpage
 */
interface InterceptResponseMessage {
  type: 'INTERCEPT_RESPONSE';
  approved: boolean;
  reason?: string;
  error?: string;
}

/**
 * Message from popup when user makes a decision
 */
interface UserDecisionMessage {
  type: 'USER_DECISION';
  approved: boolean;
  reason?: string;
}

/**
 * Message to update popup with analysis results
 */
interface PopupUpdateMessage {
  type: 'ANALYSIS_UPDATE';
  transaction: DecodedTransaction & {
    risk?: RiskAssessment;
  };
  riskAssessment: RiskAssessment;
  request: InterceptRequestMessage;
}

/**
 * Pending transaction awaiting user approval
 * Tracks state between content script request and popup response
 */
interface PendingApproval {
  requestId: string;
  request: InterceptRequestMessage;
  senderTabId: number;
  decodedTx?: DecodedTransaction;
  riskAssessment?: RiskAssessment;
  port?: chrome.runtime.Port;
}

/**
 * Complete message union type
 */
type BackgroundMessage =
  | InterceptRequestMessage
  | UserDecisionMessage
  | { type: 'PING' }
  | { type: 'POPUP_READY' };

// ============================================================================
// Pending Approval Store
// ============================================================================

/**
 * In-memory store of pending approvals
 * In a production system, this might use chrome.storage for persistence
 */
const pendingApprovals: Map<string, PendingApproval> = new Map();

/**
 * Generates a unique ID for each approval request
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the currently active tab ID in the focused window
 */
function getActiveTabId(): Promise<number | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.id);
    });
  });
}

/**
 * Sends a message to the active tab (content script)
 */
function sendMessageToTab(tabId: number, message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(undefined);
      }
    });
  });
}

/**
 * Notifies the popup UI about a new transaction requiring approval
 * Falls back to creating a browser notification if popup isn't open
 */
async function notifyUI(approval: PendingApproval): Promise<void> {
  const updateMessage: PopupUpdateMessage = {
    type: 'ANALYSIS_UPDATE',
    transaction: {
      ...approval.decodedTx!,
      risk: approval.riskAssessment
    },
    riskAssessment: approval.riskAssessment!,
    request: approval.request,
  };

  try {
    // Send to all extension contexts (popup, if open)
    await chrome.runtime.sendMessage(updateMessage);
    console.log('[Synta] Analysis update sent to UI');
  } catch (error) {
    console.warn('[Synta] Failed to notify UI:', error);
    // Fallback: show browser notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/synta-icon-48.png',
      title: 'Synta - Action Required',
      message: `New transaction requires your review\nAction: ${approval.decodedTx?.action || 'Unknown'}`,
    });
  }
}

// ============================================================================
// Core Message Handlers
// ============================================================================

/**
 * Handles a transaction interception request from the content script
 * Full flow: decode → analyze → notify popup → store pending approval
 *
 * @param message - The intercepted request message
 * @param sender - Message sender info (includes tab ID)
 * @returns Request ID for tracking
 */
async function handleInterceptRequest(
  message: InterceptRequestMessage,
  sender: chrome.runtime.MessageSender
): Promise<string> {
  const requestId = generateRequestId();
  const senderTabId = sender.tab?.id || 0;

  console.log('[Synta] Intercepted request:', {
    method: message.method,
    origin: message.origin,
    requestId
  });

  try {
    // Step 1: Decode the transaction
    const decodedTx = decodeRequest(message);

    // Step 2: Analyze risk (await the async analysis)
    const riskAssessment = await analyzeTransaction(decodedTx);

    // Step 3: Store pending approval
    const approval: PendingApproval = {
      requestId,
      request: message,
      senderTabId,
      decodedTx,
      riskAssessment,
    };
    pendingApprovals.set(requestId, approval);

    // Step 4: Notify UI (popup or notification)
    await notifyUI(approval);

    console.log('[Synta] Transaction sent to UI for approval:', requestId);
    return requestId;

  } catch (error) {
    console.error('[Synta] Failed to process intercepted request:', error);

    // Clean up and notify UI of error
    pendingApprovals.delete(requestId);

    // Send rejection back to content script
    if (senderTabId) {
      await sendMessageToTab(senderTabId, {
        type: 'INTERCEPT_RESPONSE',
        approved: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        requestId,
      });
    }

    throw error;
  }
}

/**
 * Converts an intercepted message into a DecodedTransaction object
 * compatible with the transactionDecoder.ts interface
 */
function decodeRequest(message: InterceptRequestMessage): DecodedTransaction {
  const defaultChainId = 1;

  if (message.method === 'eth_sendTransaction') {
    const params = message.params as unknown[] | unknown;
    const paramArray = Array.isArray(params) ? params : [params];

    if (paramArray.length > 0) {
      const txParams = paramArray[0] as { to?: string; data?: string; value?: string };
      const toAddress = txParams?.to || '';
      const data = txParams?.data || '0x';
      const value = txParams?.value || '0';

      return decodeTransaction({ to: toAddress, data, value }, defaultChainId);
    }
  }

  // For personal_sign and eth_signTypedData_v4
  const paramsArray = Array.isArray(message.params) ? message.params : [];
  const toAddress = typeof paramsArray[0] === 'string' ? paramsArray[0] : '';

  return {
    action: message.method === 'personal_sign' ? 'Sign personal message'
           : message.method === 'eth_signTypedData_v4' ? 'Sign typed data (EIP-712)'
           : `Unknown method: ${message.method}`,
    contract: toAddress,
    chainId: defaultChainId,
  };
}

/**
 * Handles user decision from popup (confirm/reject)
 */
async function handleUserDecision(message: UserDecisionMessage): Promise<void> {
  // Find the pending approval with matching criteria
  // In MVP, we'll use the most recent one
  const pending = Array.from(pendingApprovals.values()).pop();

  if (!pending) {
    console.warn('[Synta] No pending approval found for user decision');
    return;
  }

  const { requestId, senderTabId } = pending;
  pendingApprovals.delete(requestId);

  // Send response back to content script
  const response: InterceptResponseMessage = {
    type: 'INTERCEPT_RESPONSE',
    approved: message.approved,
    reason: message.reason,
  };

  if (senderTabId) {
    await sendMessageToTab(senderTabId, response);
  }

  console.log('[Synta] User decision processed:', message.approved ? 'approved' : 'rejected');
}

// ============================================================================
// Message Listener Setup
// ============================================================================

chrome.runtime.onMessage.addListener((
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean => {
  switch (message.type) {
    case 'INTERCEPT_REQUEST':
      handleInterceptRequest(message, sender)
        .then(result => sendResponse({ success: true, requestId: result }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true; // Keep message channel open for async response

    case 'USER_DECISION':
      handleUserDecision(message)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      return true;

    case 'PING':
      sendResponse({ type: 'PONG', timestamp: Date.now() });
      return false;

    case 'POPUP_READY':
      sendResponse({ type: 'PONG', timestamp: Date.now() });
      return false;

    default:
      console.warn('[Synta] Unknown message type:', message);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

// Suppress unused var warnings
void generateRequestId;
void getActiveTabId;

// Export for testing (if needed)
export {
  pendingApprovals,
  generateRequestId,
  handleInterceptRequest,
  handleUserDecision,
};
