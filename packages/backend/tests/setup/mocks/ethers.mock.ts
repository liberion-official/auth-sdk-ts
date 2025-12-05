/**
 * Ethers mock for testing blockchain interactions
 * Mocks JsonRpcProvider and Contract
 */

import { vi } from 'vitest';

export interface MockContractOptions {
  tokenURI?: string;
  tokenURIError?: Error;
}

/**
 * Create a mock Contract instance
 */
export function createMockContract(options: MockContractOptions = {}) {
  const { tokenURI = 'ipfs://QmTestHash123', tokenURIError } = options;

  return {
    tokenURI: tokenURIError
      ? vi.fn().mockRejectedValue(tokenURIError)
      : vi.fn().mockResolvedValue(tokenURI),
  };
}

/**
 * Create a mock JsonRpcProvider
 */
export function createMockJsonRpcProvider() {
  return {};
}

/**
 * Create ethers module mock
 */
export function createEthersMock(options: MockContractOptions = {}) {
  const mockContract = createMockContract(options);
  const mockProvider = createMockJsonRpcProvider();

  return {
    JsonRpcProvider: vi.fn().mockImplementation(() => mockProvider),
    Contract: vi.fn().mockImplementation(() => mockContract),
    _mockContract: mockContract,
    _mockProvider: mockProvider,
  };
}

/**
 * Default tokenURI formats for testing
 */
export const TEST_TOKEN_URIS = {
  ipfsProtocol: 'ipfs://QmTestHash123',
  ipfsGateway: 'https://gateway.pinata.cloud/ipfs/QmTestHash123',
  liberionGateway: 'https://secure.liberion.com/QmTestHash123',
  rawHash: 'QmTestHash123',
};

/**
 * Setup ethers mock with vitest
 */
export function setupEthersMock(options: MockContractOptions = {}) {
  const mock = createEthersMock(options);
  vi.mock('ethers', () => mock);
  return mock;
}

/**
 * Create mock that returns different tokenURIs for different addresses
 */
export function createMultiAddressMock(addressToURI: Record<string, string>) {
  const mockContract = {
    tokenURI: vi.fn().mockImplementation((address: string) => {
      const uri = addressToURI[address];
      if (!uri) {
        return Promise.reject(new Error(`Token not found for address: ${address}`));
      }
      return Promise.resolve(uri);
    }),
  };

  return {
    JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
    Contract: vi.fn().mockImplementation(() => mockContract),
    _mockContract: mockContract,
  };
}
