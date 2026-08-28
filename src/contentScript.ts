/**
 * Synta Content Script
 * Intercepts Ethereum wallet calls and sends them to the background script for analysis.
 * When the background responds with INTERCEPT_RESPONSE, the original promise resolves/rejects.
 */

const INTERCEPTED_METHODS = new Set([
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData_v4',
]);

function waitForEthereum(maxRetries = 100, intervalMs = 100): void {
  let retries = 0;
  const check = () => {
    if (window.ethereum) {
      setupEthereumInterception();
      return;
    }
    retries++;
    if (retries < maxRetries) {
      setTimeout(check, intervalMs);
    }
  };
  check();
}

function setupEthereumInterception(): void {
  const originalEthereum = window.ethereum;
  if (!originalEthereum) return;

  const originalRequest = originalEthereum.request.bind(originalEthereum);

  const wrappedRequest = async (args: { method: string; params?: unknown[] }) => {
    const { method, params } = args;

    if (INTERCEPTED_METHODS.has(method)) {
      const response = await requestApproval(method, params || []);

      if (!response.approved) {
        const error: any = new Error(
          response.reason || 'Transaction rejected by Synta'
        );
        error.code = 4001;
        error.message = response.reason || error.message;
        throw error;
      }
    }

    return originalRequest(args);
  };

  try {
    Object.defineProperty(originalEthereum, 'request', {
      value: wrappedRequest,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch {
    (originalEthereum as any).request = wrappedRequest;
  }
}

function requestApproval(
  method: string,
  params: unknown[] | unknown
): Promise<{ approved: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const messageId = `synta_req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    chrome.runtime.sendMessage(
      {
        type: 'INTERCEPT_REQUEST',
        messageId,
        method,
        params,
        origin: window.location.origin,
        url: window.location.href,
        timestamp: Date.now(),
      },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ approved: false, reason: chrome.runtime.lastError?.message || 'Extension error' });
        } else {
          resolve({ approved: response.approved, reason: response.reason });
        }
      }
    );

    // Listen for INTERCEPT_RESPONSE on this specific messageId
    const responseHandler = (msg: any, _sender: any) => {
      if (msg.type === 'INTERCEPT_RESPONSE' && msg.messageId === messageId) {
        chrome.runtime.onMessage.removeListener(responseHandler);
        resolve({ approved: msg.approved, reason: msg.reason });
      }
    };

    chrome.runtime.onMessage.addListener(responseHandler);

    // Timeout fallback
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(responseHandler);
      resolve({ approved: false, reason: 'Approval timeout - defaulting to reject' });
    }, 30000);
  });
}

function init(): void {
  if (window.ethereum) {
    setupEthereumInterception();
  } else {
    waitForEthereum();
  }
}

init();

// Keep service worker alive / respond to pings
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTH_STATUS_CHECK') {
    sendResponse({ active: true });
    return true;
  }
  return false;
});
