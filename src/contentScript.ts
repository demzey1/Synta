/**
 * Synta Content Script
 * 
 * Intercepts Ethereum wallet API calls to provide security screening before
 * transactions are signed or sent. Runs on every webpage via manifest v3 host permissions.
 * 
 * Injection Points:
 * - window.ethereum (most wallets: MetaMask, Rabby, etc.)
 * - window.ethereum.request method wrapper
 * - Handles: eth_sendTransaction, personal_sign, eth_signTypedData_v4
 * 
 * Message Types:
 * - INTERCEPT_REQUEST: Sent from content script to background with payload details
 * - INTERCEPT_RESPONSE: Background sends approval/denial back to content script
 */

// Type definition for the ethereum.request method we're wrapping
interface EthereumRequest {
  (args: { method: string; params?: unknown[] }): Promise<unknown>;
}

// Message payload sent to background script
interface InterceptMessage {
  type: 'INTERCEPT_REQUEST';
  method: string;
  params: unknown[] | unknown;
  origin: string;
  url: string;
  timestamp: number;
}

// Response from background script
interface InterceptResponse {
  approved: boolean;
  reason?: string;
}

// Methods that Synta intercepts for security screening
const INTERCEPTED_METHODS = new Set([
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData_v4',
]);

/**
 * Sends the intercepted request to background script and waits for approval
 * @param method - The Ethereum JSON-RPC method being called
 * @param params - The parameters passed to the method
 * @returns Promise that resolves with approval status
 */
function requestApproval(method: string, params: unknown[]): Promise<InterceptResponse> {
  return new Promise((resolve) => {
    const message: InterceptMessage = {
      type: 'INTERCEPT_REQUEST',
      method,
      params,
      origin: window.location.origin,
      url: window.location.href,
      timestamp: Date.now(),
    };

    // Send message to background script
    chrome.runtime.sendMessage(message, (response: InterceptResponse) => {
      // If the extension context was invalidated, default to denial
      if (chrome.runtime.lastError || !response) {
        resolve({
          approved: false,
          reason: chrome.runtime.lastError?.message || 'Extension context unavailable',
        });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Sets up the interception of window.ethereum.request
 * Called once when the content script initializes
 */
function setupEthereumInterception(): void {
  // Store a reference to the original window.ethereum before we modify it
  const originalEthereum = window.ethereum;

  // If no ethereum provider is available, we can't intercept anything
  if (!originalEthereum) {
    console.debug('[Synta] No window.ethereum found - skipping interception setup');
    return;
  }

  // Store reference to the original request method
  const originalRequest: EthereumRequest = originalEthereum.request.bind(originalEthereum);

  /**
   * Wrapped request method that intercepts specific calls
   * Preserves the original promise-based interface
   */
  const wrappedRequest: EthereumRequest = async (args) => {
    const { method, params } = args;

    // Only intercept methods we care about
    if (INTERCEPTED_METHODS.has(method)) {
      // Pause execution by requesting approval from background script
      // This waits for user interaction in the popup/notification
      const response = await requestApproval(method, params || []);

      if (!response.approved) {
        // User denied the request - reject the original promise
        const error = new Error(
          response.reason || `Transaction rejected by Synta security screening`
        );
        // Cast to match the expected return type shape for rejection
        // Ethereum providers typically throw provider errors
        (error as Record<string, unknown>).code = 4001; // User rejected error code
        
        // Simulate provider rejection by throwing
        throw error;
      }

      // User approved - proceed with original request
    }

    // Either not an intercepted method, or user approved - call original
    return originalRequest(args);
  };

  // Replace the request method on the ethereum object
  // Using Object.defineProperty to ensure it's not configurable/bypassable
  try {
    Object.defineProperty(originalEthereum, 'request', {
      value: wrappedRequest,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    // Fallback: direct assignment if defineProperty fails (e.g., frozen objects)
    console.warn('[Synta] Could not define property on ethereum, using direct assignment', e);
    originalEthereum.request = wrappedRequest;
  }

  console.log('[Synta] Ethereum request interception active');
}

/**
 * Polls for ethereum provider to handle dynamic injection cases
 * Some wallets inject ethereum after page load (e.g., async injection)
 */
function waitForEthereum(maxRetries = 50, intervalMs = 100): void {
  let retries = 0;

  const check = () => {
    if (window.ethereum) {
      setupEthereumInterception();
      return;
    }

    retries++;
    if (retries < maxRetries) {
      setTimeout(check, intervalMs);
    } else {
      console.debug('[Synta] Ethereum provider not detected after waiting');
    }
  };

  check();
}

/**
 * Initialize Synta content script
 * Runs once on page load, with retry logic for dynamic wallet injection
 */
function init(): void {
  if (window.ethereum) {
    // Ethereum already available - intercept immediately
    setupEthereumInterception();
  } else {
    // Ethereum not yet available - wait for dynamic injection
    waitForEthereum();
  }
}

// Start interception
init();

// Listen for messages from background or popup (future expansion)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNTH_STATUS_CHECK') {
    sendResponse({ active: true });
    return true; // Keep message channel open for async response
  }
  // Allow other listeners to handle unhandled messages
  return false;
});