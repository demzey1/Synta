/**
 * Synta Transaction Decoder
 * 
 * Parses and decodes Ethereum transaction calldata to provide human-readable
 * summaries for security screening. Uses ethers.js for ABI decoding.
 * 
 * Supported Protocols:
 * - ERC20: approve(), transfer()
 * - ERC721: safeTransferFrom()
 * - Unknown functions: raw signature + parameters
 * 
 * Asset Resolution:
 * Uses a simulated token registry pattern (would connect to on-chain registry
 * in production) for symbol and decimal lookups.
 */

import { ethers, Interface, formatUnits, formatEther } from 'ethers';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ParsedTransaction {
  to: string;
  data: string;
  value: string;
}

export interface DecodedTransaction {
  action: string;
  spender?: string;
  amount?: string;
  token?: string;
  contract: string;
  chainId: number;
  methodId?: string;
  decodedParams?: Record<string, unknown>;
}

export interface TokenInfo {
  symbol: string;
  decimals: number;
  name?: string;
}

// ============================================================================
// Known Function Selectors (first 4 bytes of keccak256 hash)
// ============================================================================

const ERC20_APPROVE_SELECTOR = '0x095ea7b3';
const ERC20_TRANSFER_SELECTOR = '0xa9059cbb';
const ERC721_SAFE_TRANSFER_FROM_SELECTOR = '0x23b872dd';
const ERC1155_SAFE_TRANSFER_FROM_SELECTOR = '0x2eb2c096';

// ============================================================================
// Simulated Token Registry
// In production, this would query on-chain contracts or a subgraph
// ============================================================================

const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  // DAI stablecoin
  '0x6b175474e89094c44da98b954eedeac495271d0f': {
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
  },
  // USDC
  '0xa0b86f2cf34d5efc4ff1d7b7b6e8461c5e82c2b9': {
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  // WETH
  '0xc02aaa39b223fe8d0a0e5d20d7eb0ce0e8a0c5e1': {
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
  },
  // USDT
  '0xdac17f958d2ee523a22062e66101294f6390626a': {
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
  },
  // UNI
  '0x1f9840a85d5aF5bf1D1762F925BDADd9c16d2375': {
    symbol: 'UNI',
    decimals: 18,
    name: 'Uniswap',
  },
};

/**
 * Resolves token symbol and decimals from the registry
 * Falls back to a generic representation if not found.
 * 
 * @param contractAddress - Token contract address
 * @returns TokenInfo with symbol and decimals
 */
function resolveTokenInfo(contractAddress: string): TokenInfo {
  const normalized = contractAddress.toLowerCase();
  if (normalized in TOKEN_REGISTRY) {
    return TOKEN_REGISTRY[normalized];
  }
  // Fallback for unknown tokens
  return {
    symbol: 'UNKNOWN',
    decimals: 18,
  };
}

/**
 * Formats a raw amount using token decimals
 * Handles large numbers via ethers.utils.formatUnits
 * 
 * @param rawAmount - Raw amount from transaction (string or BigNumber)
 * @param decimals - Token decimals
 * @returns Formatted amount string (e.g., "1000.0")
 */
function formatAmount(rawAmount: string | ethers.BigNumberish, decimals: number): string {
  try {
    const formatted = formatUnits(rawAmount, decimals);
    // Remove trailing zeros but keep at least one decimal place for readability
    if (formatted.includes('.')) {
      return parseFloat(formatted).toFixed(2).replace(/\.?0+$/, '') || '0';
    }
    return formatted;
  } catch (e) {
    return 'invalid amount';
  }
}

/**
 * Extracts the first 4 bytes of a transaction's data field as the method selector
 * 
 * @param data - Hex data field
 * @returns 4-byte method selector (lowercase, with 0x prefix)
 */
function extractMethodSelector(data: string): string {
  if (!data || data === '0x' || data.length < 10) {
    return '';
  }
  return data.substring(0, 10).toLowerCase();
}

// ============================================================================
// Decoder Functions
// ============================================================================

/**
 * Decodes an ERC20 approve() call
 * approve(address spender, uint256 amount)
 * 
 * @param iface - ethers Interface instance
 * @param data - Transaction calldata
 * @param contract - Token contract address
 * @param chainId - Chain ID
 * @returns DecodedTransaction with approval details
 */
function decodeERC20Approve(
  iface: Interface,
  data: string,
  contract: string,
  chainId: number
): DecodedTransaction {
  const decoded = iface.decodeFunctionData('approve', data);
  const spender = decoded.spender as string;
  const amount = decoded.amount as ethers.BigNumber;

  const tokenInfo = resolveTokenInfo(contract);
  const amountStr = formatAmount(amount, tokenInfo.decimals);

  return {
    action: `Approve ${tokenInfo.symbol} spending`,
    spender,
    amount: `${amountStr} ${tokenInfo.symbol}`,
    token: tokenInfo.symbol,
    contract,
    chainId,
    decodedParams: { spender, amount: amount.toString() },
  };
}

/**
 * Decodes an ERC20 transfer() call
 * transfer(address to, uint256 amount)
 * 
 * @param iface - ethers Interface instance
 * @param data - Transaction calldata
 * @param contract - Token contract address
 * @param chainId - Chain ID
 * @returns DecodedTransaction with transfer details
 */
function decodeERC20Transfer(
  iface: Interface,
  data: string,
  contract: string,
  chainId: number
): DecodedTransaction {
  const decoded = iface.decodeFunctionData('transfer', data);
  const to = decoded.to as string;
  const amount = decoded.amount as ethers.BigNumber;

  const tokenInfo = resolveTokenInfo(contract);
  const amountStr = formatAmount(amount, tokenInfo.decimals);

  return {
    action: `Send ${tokenInfo.symbol}`,
    spender: to, // Recipient address shown as spender for transfers too
    amount: `${amountStr} ${tokenInfo.symbol}`,
    token: tokenInfo.symbol,
    contract,
    chainId,
    decodedParams: { to, amount: amount.toString() },
  };
}

/**
 * Decodes an ERC721 safeTransferFrom() call
 * safeTransferFrom(address from, address to, uint256 tokenId)
 * 
 * @param iface - ethers Interface instance
 * @param data - Transaction calldata
 * @param contract - NFT contract address
 * @param chainId - Chain ID
 * @returns DecodedTransaction with NFT transfer details
 */
function decodeERC721SafeTransferFrom(
  iface: Interface,
  data: string,
  contract: string,
  chainId: number
): DecodedTransaction {
  const decoded = iface.decodeFunctionData('safeTransferFrom', data);
  const from = decoded.from as string;
  const to = decoded.to as string;
  const tokenId = decoded.tokenId as ethers.BigNumber;

  return {
    action: 'Transfer NFT',
    spender: to,
    contract,
    chainId,
    decodedParams: { from, to, tokenId: tokenId.toString() },
  };
}

/**
 * Decodes an ERC1155 safeTransferFrom() call
 * safeTransferFrom(address operator, address from, address to, uint256 id, uint256 value, bytes data)
 * 
 * @param iface - ethers Interface instance
 * @param data - Transaction calldata
 * @param contract - NFT contract address
 * @param chainId - Chain ID
 * @returns DecodedTransaction with NFT transfer details
 */
function decodeERC1155SafeTransferFrom(
  iface: Interface,
  data: string,
  contract: string,
  chainId: number
): DecodedTransaction {
  const decoded = iface.decodeFunctionData('safeTransferFrom', data);
  const from = decoded.from as string;
  const to = decoded.to as string;
  const id = decoded.id as ethers.BigNumber;
  const value = decoded.value as ethers.BigNumber;

  return {
    action: 'Transfer NFT (ERC1155)',
    spender: to,
    amount: `${value.toString()} x NFT #${id.toString()}`,
    contract,
    chainId,
    decodedParams: { from, to, id: id.toString(), value: value.toString() },
  };
}

// ============================================================================
// Main Decoder Function
// ============================================================================

// ABI definitions for standard methods
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const ERC721_ABI = [
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
];

const ERC1155_ABI = [
  'function safeTransferFrom(address operator, address from, address to, uint256 id, uint256 value, bytes data)',
];

/**
 * Main entry point: Decodes parsed Ethereum transaction data into human-readable action
 * 
 * @param tx - Transaction object with { to, data, value }
 * @param chainId - Chain ID defaulting to 1 (mainnet)
 * @returns DecodedTransaction with human-readable summary
 * 
 * @example
 * ```typescript
 * const result = decodeTransaction({
 *   to: '0x6b175474e89094c44da98b954eedeac495271d0f',
 *   data: '0x095ea7b3000000000000000000000000...',
 *   value: '0',
 * });
 * console.log(result);
 * // -> {
 * //   action: "Approve DAI spending",
 * //   spender: "0x...",
 * //   amount: "1000 DAI",
 * //   contract: "0x6b175...",
 * //   chainId: 1,
 * //   ...
 * // }
 * ```
 */
export function decodeTransaction(
  tx: ParsedTransaction,
  chainId: number = 1
): DecodedTransaction {
  const { to, data, value } = tx;
  const contract = to.toLowerCase();
  const methodSelector = extractMethodSelector(data);

  if (!methodSelector) {
    // No calldata or just ETH transfer
    const ethValue = formatEther(value || '0');
    return {
      action: 'Send ETH',
      spender: to,
      amount: `${ethValue} ETH`,
      contract: to,
      chainId,
    };
  }

  // Try ERC20 functions first
  try {
    const erc20Iface = new Interface(ERC20_ABI);

    if (methodSelector === ERC20_APPROVE_SELECTOR) {
      return decodeERC20Approve(erc20Iface, data, to, chainId);
    }

    if (methodSelector === ERC20_TRANSFER_SELECTOR) {
      return decodeERC20Transfer(erc20Iface, data, to, chainId);
    }
  } catch (e) {
    // Continue to next attempt
  }

  // Try ERC721 functions
  try {
    const erc721Iface = new Interface(ERC721_ABI);

    if (methodSelector === ERC721_SAFE_TRANSFER_FROM_SELECTOR) {
      return decodeERC721SafeTransferFrom(erc721Iface, data, to, chainId);
    }
  } catch (e) {
    // Continue to next attempt
  }

  // Try ERC1155 functions
  try {
    const erc1155Iface = new Interface(ERC1155_ABI);

    if (methodSelector === ERC1155_SAFE_TRANSFER_FROM_SELECTOR) {
      return decodeERC1155SafeTransferFrom(erc1155Iface, data, to, chainId);
    }
  } catch (e) {
    // Continue to next attempt
  }

  // Fallback: Unknown signature
  return {
    action: 'Unknown function call',
    contract: to,
    chainId,
    methodId: methodSelector,
    decodedParams: {
      rawData: data,
      value: value || '0',
    },
  };
}

// ============================================================================
// Built-in Test Cases
// ============================================================================

/**
 * Runs built-in test cases to verify decoder functionality
 * Call this function during development to validate behavior.
 */
export function runDecoderTests(): void {
  console.group('Synta Transaction Decoder Tests');

  // Test: DAI Approve
  const daiApproveData = '0x095ea7b3' +
    '000000000000000000000000' +
    '881d40c9b5c1d33681e5c6ec9b5d5e6c9c5e5e5e' + // spender (padded)
    '0000000000000000000000000000000000000000' + // amount high bits
    '0de08daaffffffffffff'; // amount (~1000 DAI * 10^18)

  try {
    const result1 = decodeTransaction({
      to: '0x6b175474e89094c44da98b954eedeac495271d0f',
      data: daiApproveData,
      value: '0',
    });
    console.log('Test: DAI Approve', result1);
    console.assert(result1.action === 'Approve DAI spending', 'Should identify DAI approve');
    console.assert(result1.spender !== undefined, 'Should have spender');
    console.assert(result1.amount !== undefined, 'Should have amount');
  } catch (e) {
    console.error('DAI Approve test failed:', e);
  }

  // Test: ETH Transfer (no data)
  try {
    const result2 = decodeTransaction({
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      value: '1000000000000000000', // 1 ETH
    });
    console.log('Test: ETH Transfer', result2);
    console.assert(result2.action === 'Send ETH', 'Should identify ETH transfer');
    console.assert(result2.amount === '1.00 ETH', 'Should format ETH amount');
  } catch (e) {
    console.error('ETH Transfer test failed:', e);
  }

  // Test: Unknown function
  try {
    const result3 = decodeTransaction({
      to: '0x1f9840a85d5aF5bf1D176e2F925BDADd9c16d2375',
      data: '0xffffffff12345678',
      value: '0',
    });
    console.log('Test: Unknown Function', result3);
    console.assert(result3.action === 'Unknown function call', 'Should fallback to unknown');
    console.assert(result3.methodId === '0xffffffff', 'Should show method ID');
  } catch (e) {
    console.error('Unknown function test failed:', e);
  }

  console.groupEnd();
}

// Export types for external use
export {
  ParsedTransaction,
  DecodedTransaction,
  TokenInfo,
  ERC20_ABI,
  ERC721_ABI,
  ERC1155_ABI,
};

// Uncomment to run tests in development:
// runDecoderTests();