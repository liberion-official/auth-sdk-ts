/**
 * Token Provider - Fetches user SNFT tokens from blockchain and IPFS
 */

import { Contract, JsonRpcProvider } from 'ethers';
import type { ILogger, UserToken } from '../types.js';
import { NoOpLogger, shortenAddress } from '../adapters/logger.js';
import {
  USER_CONTRACT_ABI,
  getNetworkConfig,
  type NetworkConfig,
} from './constants.js';

// In-memory cache for IPFS tokens (15 minute TTL)
const tokenCache = new Map<string, { data: UserToken; expiry: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Extract IPFS hash from tokenURI
 * Handles multiple formats:
 * - ipfs://QmHash...
 * - https://gateway.pinata.cloud/ipfs/QmHash...
 * - https://secure.liberion.com/QmHash...
 * - QmHash... (raw hash)
 */
export function extractIpfsHash(tokenURI: string): string {
  if (!tokenURI) {
    throw new Error('tokenURI is empty');
  }

  // Handle ipfs:// protocol
  if (tokenURI.startsWith('ipfs://')) {
    return tokenURI.replace('ipfs://', '');
  }

  // Handle /ipfs/ path
  if (tokenURI.includes('/ipfs/')) {
    const parts = tokenURI.split('/ipfs/');
    return parts[1];
  }

  // Handle Liberion URLs (secure.liberion.com, public.liberion.com)
  if (tokenURI.includes('liberion.com/')) {
    const parts = tokenURI.split('/');
    return parts[parts.length - 1];
  }

  // Assume it's already a hash
  return tokenURI;
}

/**
 * Fetch JSON from IPFS with caching
 */
async function fetchFromIPFS(
  ipfsHash: string,
  ipfsGateway: string,
  logger: ILogger
): Promise<UserToken> {
  // Check cache first
  const cached = tokenCache.get(ipfsHash);
  if (cached && cached.expiry > Date.now()) {
    logger.info('[fetchFromIPFS] Cache hit', { ipfsHash });
    return cached.data;
  }

  // Fetch from IPFS gateway
  const url = `${ipfsGateway}/${ipfsHash}`;
  logger.info('[fetchFromIPFS] Fetching from IPFS', { url });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as UserToken;

  // Cache the result
  tokenCache.set(ipfsHash, {
    data,
    expiry: Date.now() + CACHE_TTL,
  });

  logger.info('[fetchFromIPFS] Token fetched and cached', { ipfsHash });

  return data;
}

/**
 * Get SNFT token from IPFS by user address
 *
 * @param address - User blockchain address
 * @param logger - Optional logger instance
 * @param networkConfig - Optional network configuration (defaults to production)
 * @returns SNFT token object from IPFS
 */
export async function getTokenFromIPFS(
  address: string,
  logger: ILogger = new NoOpLogger(),
  networkConfig?: NetworkConfig
): Promise<UserToken> {
  const config = networkConfig ?? getNetworkConfig();

  logger.info('[getTokenFromIPFS] Getting SNFT token from IPFS', { address: shortenAddress(address) });

  // 1. Create provider and contract
  const provider = new JsonRpcProvider(config.RPC_ENDPOINT);
  const contract = new Contract(
    config.USER_CONTRACT_ADDRESS,
    USER_CONTRACT_ABI,
    provider
  );

  // 2. Get tokenURI - in our contract, tokenId = address
  const tokenURI = (await contract.tokenURI(address)) as string;

  logger.info('[getTokenFromIPFS] Token URI retrieved', {
    address: shortenAddress(address),
    tokenURI,
  });

  // 3. Extract IPFS hash from tokenURI
  const ipfsHash = extractIpfsHash(tokenURI);

  logger.info('[getTokenFromIPFS] IPFS hash extracted', {
    address: shortenAddress(address),
    ipfsHash,
  });

  // 4. Fetch JSON from IPFS
  const userToken = await fetchFromIPFS(ipfsHash, config.IPFS_GATEWAY, logger);

  // 5. Validate SNFT token structure
  if (!userToken.publicKeySign || !userToken.publicKeyEncrypt) {
    throw new Error('Invalid SNFT token structure: missing public keys');
  }

  logger.info('[getTokenFromIPFS] SNFT token fetched successfully', {
    address: shortenAddress(address),
    hasPublicKeySign: !!userToken.publicKeySign,
    hasPublicKeyEncrypt: !!userToken.publicKeyEncrypt,
    hasAssets: !!userToken.assets,
  });

  return userToken;
}

/**
 * Clear the token cache (for testing or manual invalidation)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}
