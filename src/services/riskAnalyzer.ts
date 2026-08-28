/**
 * Synta Risk Analyzer
 * 
 * Threat intelligence layer that evaluates decoded transactions for security risks:
 * - Unlimited token approvals to unknown spenders
 * - Interactions with unverified/unaudited contracts
 * - Known scam addresses from threat feeds
 * - Phishing contract patterns
 * 
 * Uses async resolvers to simulate on-chain lookups and external API calls.
 */

import { MaxUint256 } from 'ethers';
import { DecodedTransaction } from './transactionDecoder';

// ============================================================================
// Type Definitions
// ============================================================================

export interface RiskAssessment {
  level: 'safe' | 'warning' | 'danger';
  reasons: string[];
  auditStatus: 'audited' | 'not-audited' | 'unknown';
  phishingMatch?: boolean;
}

// ============================================================================
// Mock Data: Whitelists, Threat Feeds, Audit Records
// ============================================================================

// Well-known spender addresses (protocols, DEXes, aggregators)
const WELL_KNOWN_SPENDERS: Record<string, string[]> = {
  1: [ // Ethereum mainnet
    // Uniswap V2 Router
    '0x7a250d5630b4cf539739dcf152222b498418a6d0',
    // Uniswap V3 Router
    '0xe592427a019d2862267e48d033418b3c7c38f708',
    // 1inch Router
    '0x1111111254eeb2a63344e197c4675d93814b6e47b',
    // Paraswap Router
    '0xdef1c0addeaf6a02bc2c0c4779709cb8a92401d3',
    // OpenSea Seaport
    '0x00000000000000ad2047057686f7939ef73813ab',
  ],
  56: [ // BSC
    '0x10ed43c7187943690d78359a6589043096275462', // PancakeSwap Router
  ],
};

// Static scam database (in production, this would be a live threat feed)
const SCAM_DATABASE = new Set([
  // Known scam contracts
  '0xe479fd43ec7c9de3982e2dc7f9f6469d72b82439', // Fake Uniswap Router
  '0xa354f7cb8e346e4e35d3b0a0b692e5a5d8f8e8e8', // Rug pull token
  '0x7c3a5e84d2f6d8b7a9c1e0f4d5e6a7b8c9d0e1f2', // Phishing contract
  '0xb9d839456823cf6f8a8e075bd2c7a47b5c5e4e8d', // Impersonation contract
  // Suspicious token contracts
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '0xbbbbc0debc00c1c0debc00c1c0debc00c1c0debc',
]);

// Known audited protocols
const AUDITED_PROTOCOLS: Record<string, boolean> = {
  // Audited token contracts
  '0x6b175474e89094c44da98b954eedeac495271d0f': true, // DAI
  '0xa0b86f2cf34d5efc4ff1d7b7b6e8461c5e82c2b9': true, // USDC
  '0xdac17f958d2ee523a22062e66101294f6390626a': true, // USDT
  '0xc02aaa39b223fe8d0a0e5d20d7eb00ce0e8a0c5e1': true, // WETH
  // Audited protocol contracts
  '0x7a250d5630b4cf539739dcf152222b498418a6d0': true, // Uniswap V2
  '0xe592427a019d2861c5e8a0d12794c8c2b3c5d8ef': true, // Uniswap V3
};

// ============================================================================
// Async Resolver Functions (simulate external API calls)
// ============================================================================

/**
 * Simulates checking if an address is in a scam/threat database
 * In production, this would query:
 * - Chainabuse API
 * - VirusTotal
 * - Custom threat feeds
 */
async function checkScamDatabase(address: string, chainId: number): Promise<boolean> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const normalized = address.toLowerCase();
  return SCAM_DATABASE.has(normalized);
}

/**
 * Simulates checking if a contract source is verified on block explorers
 * In production, this would call:
 * - Etherscan API (GET /getsourcecode)
 * - BscScan API
 * - Polygonscan API, etc.
 */
async function checkContractVerification(contractAddress: string, chainId: number): Promise<boolean> {
  // Simulate API call latency
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const normalized = contractAddress.toLowerCase();
  
  // In our mock, we treat known audited contracts as verified
  // and scam contracts as suspicious
  if (SCAM_DATABASE.has(normalized)) {
    return false;
  }
  
  if (AUDITED_PROTOCOLS[normalized]) {
    return true;
  }
  
  // Default: unknown contracts are treated as not verified
  return false;
}

/**
 * Simulates fetching audit status from audit databases
 * In production, this would query:
 * - DeFiSafety
 * - CertiK
 * - OpenZeppelin Defender
 */
async function fetchAuditStatus(contractAddress: string, chainId: number): Promise<'audited' | 'not-audited' | 'unknown'> {
  const normalized = contractAddress.toLowerCase();
  
  // Check against known audited protocols
  if (AUDITED_PROTOCOLS[normalized]) {
    return 'audited';
  }
  
  // Check if it's a scammer contract
  if (SCAM_DATABASE.has(normalized)) {
    return 'not-audited';
  }
  
  // For everything else, simulate an API lookup with some latency
  await new Promise(resolve => setTimeout(resolve, 75));
  
  // Simulate that some random contracts might have audit info
  // In reality, most won't
  return 'unknown';
}

/**
 * Simulates phishing detection by checking against known phishing patterns
 * In production, this would query:
 * - Google Safe Browsing API
 * - PhishFort
 * - Custom ML models for phishing detection
 */
async function detectPhishingPatterns(contractAddress: string, chainId: number): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const normalized = contractAddress.toLowerCase();
  
  // Check against scam database with phishing indicators
  const phishingIndicators = [
    '0xe47347c4d74c9d64e4c4a8e1a1d4444421f79f47', // Known phishing contract
    '0xaaaabbbbccccdddd1234567890abcdef12345678', // Fake token with phishing patterns
  ];
  
  return phishingIndicators.includes(normalized);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if an amount represents "unlimited" approval (max uint256)
 * @param amountStr - Formatted amount string from decoded transaction
 * @returns true if the amount is effectively unlimited
 */
function isUnlimitedApproval(amountStr?: string): boolean {
  if (!amountStr) return false;
  
  // Check for common representations of max uint256
  const maxUint256 = MaxUint256.toString();
  
  // Also match the "X DAI" format from the decoder
  const numericPart = amountStr.replace(/[^\d.\-]/g, '');
  if (numericPart === '') return false;
  
  // Parse the numeric value
  const value = parseFloat(numericPart);
  
  // Unlimited approvals typically show as 2^256-1 or are very large
  // Check if the raw value matches max uint256 or is astronomically large
  return value >= 1e18 * 1000 || // 1000 ETH worth in raw units
         amountStr.includes(maxUint256);
}

/**
 * Checks if spender is in the whitelist for the given chain
 * @param spender - Spender address
 * @param chainId - Chain ID
 * @returns true if spender is well-known
 */
function isWellKnownSpender(spender: string, chainId: number): boolean {
  const spenders = WELL_KNOWN_SPENDERS[chainId] || [];
  return spenders.some(addr => addr.toLowerCase() === spender.toLowerCase());
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyzes a decoded transaction for security risks
 * Performs multiple async checks and aggregates findings
 * 
 * @param decodedTx - Decoded transaction from transactionDecoder.ts
 * @returns RiskAssessment with risk level, reasons, and metadata
 * 
 * @example
 * ```typescript
 * const risk = await analyzeTransaction({
 *   action: "Approve DAI spending",
 *   spender: "0x7a250d5630b4cf539739dcf152222b498418a6d0",
 *   amount: "1157920892373161954235709850086879078532699846656405640391784059417...",
 *   contract: "0x6b175474e89094c44da98b954eedeac495271d0f",
 *   chainId: 1,
 * });
 * console.log(risk);
 * // -> { level: 'warning', reasons: ['Unlimited token approval'], ... }
 * ```
 */
export async function analyzeTransaction(
  decodedTx: DecodedTransaction
): Promise<RiskAssessment> {
  const { action, spender, amount, contract, chainId } = decodedTx;
  const normalizedContract = contract.toLowerCase();
  const reasons: string[] = [];
  let riskScore = 0;
  
  // Parallel fetch of external data
  const [
    isScamAddress,
    isContractVerified,
    auditStatus,
    isPhishing,
  ] = await Promise.all([
    checkScamDatabase(contract, chainId),
    checkContractVerification(contract, chainId),
    fetchAuditStatus(contract, chainId),
    detectPhishingPatterns(contract, chainId),
  ]);
  
  // Check 1: Is the contract in a known scam database?
  if (isScamAddress) {
    reasons.push('Contract appears in scam database');
    riskScore += 3; // High risk
  }
  
  // Check 2: Is this a phishing contract?
  if (isPhishing) {
    reasons.push('Contract flagged as phishing');
    riskScore += 4; // Critical risk
  }
  
  // Check 3: Unlimited token approval (major red flag)
  if (amount && isUnlimitedApproval(amount)) {
    reasons.push(`Unlimited ${decodedTx.token || 'token'} approval`);
    riskScore += 2;
    
    // If spender is also unknown, this is especially dangerous
    if (spender && !isWellKnownSpender(spender, chainId)) {
      reasons.push('Approval to unknown spender');
      riskScore += 1;
    }
  }
  
  // Check 4: Unknown spender for any approval
  if (spender && !isWellKnownSpender(spender, chainId) && !isScamAddress) {
    // Only warn if not already flagged as a scam
    if (!reasons.some(r => r.includes('scam') || r.includes('phishing'))) {
      reasons.push('Interaction with non-whitelisted contract');
      riskScore += 1;
    }
  }
  
  // Check 5: Unverified contract source
  if (!isContractVerified && !isScamAddress) {
    reasons.push('Contract source code not verified');
    riskScore += 1;
  }
  
  // Determine risk level based on score
  let level: 'safe' | 'warning' | 'danger';
  if (riskScore >= 3) {
    level = 'danger';
  } else if (riskScore >= 1) {
    level = 'warning';
  } else {
    level = 'safe';
  }
  
  return {
    level,
    reasons,
    auditStatus,
    phishingMatch: isPhishing,
  };
}

// ============================================================================
// Helper for testing
// ============================================================================

/**
 * Quick check: Is an address well-known (for use without full analysis context)?
 */
export function isKnownSafeAddress(address: string, chainId: number = 1): boolean {
  return isWellKnownSpender(address, chainId);
}

// Export risk assessment type only
export { RiskAssessment };

// ============================================================================
// Built-in Test Cases
// ============================================================================

/**
 * Runs built-in test cases to verify risk analysis
 */
export async function runRiskAnalyzerTests(): Promise<void> {
  console.group('Synta Risk Analyzer Tests');
  
  try {
    // Test 1: Safe transaction (whitelisted spender)
    const safeResult = await analyzeTransaction({
      action: 'Approve DAI spending',
      spender: '0x7a250d5630b4cf539739dcf152222b498418a6d0', // Uniswap
      amount: '100.00 DAI',
      token: 'DAI',
      contract: '0x6b175474e89094c44da98b954eedeac495271d0f',
      chainId: 1,
    });
    console.log('Test: Safe approval', safeResult);
    console.assert(safeResult.level === 'safe', 'Safe approval should be level safe');
    
    // Test 2: Dangerous transaction (scam contract)
    const dangerResult = await analyzeTransaction({
      action: 'Unknown function call',
      contract: '0xe47347c4d74c9d64e4c4a8e1a1d4444421f79f47',
      chainId: 1,
      methodId: '0xffffffff',
    });
    console.log('Test: Scam contract', dangerResult);
    console.assert(dangerResult.level === 'danger', 'Scam contract should be danger level');
    console.assert(dangerResult.reasons.some(r => r.includes('scam')), 'Should flag as scam');
    
    // Test 3: Warning transaction (unverified contract)
    const warningResult = await analyzeTransaction({
      action: 'Approve UNKNOWN spending',
      spender: '0x1234567890123456789012345678901234567890',
      amount: '50.00 UNKNOWN',
      token: 'UNKNOWN',
      contract: '0x1234567890123456789012345678901234567890',
      chainId: 1,
    });
    console.log('Test: Unverified contract', warningResult);
    console.assert(warningResult.level === 'warning', 'Unverified should be warning');
    console.assert(warningResult.auditStatus === 'unknown', 'Should be unknown audit status');
    
    console.groupEnd();
  } catch (error) {
    console.error('Test failed:', error);
    console.groupEnd();
  }
}

// Uncomment to run tests:
// runRiskAnalyzerTests();