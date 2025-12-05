/**
 * Blockchain configuration constants
 * Supports production and development environments
 */

/** Environment type */
export type Environment = 'production' | 'development';

/** Network configuration interface */
export interface NetworkConfig {
  RPC_ENDPOINT: string;
  USER_CONTRACT_ADDRESS: string;
  IPFS_GATEWAY: string;
  TRUST_GATE_URL: string;
}

/** Production environment configuration */
const PRODUCTION_CONFIG: NetworkConfig = {
  RPC_ENDPOINT: 'https://bc.liberion.com/rpc',
  USER_CONTRACT_ADDRESS: '0xB0b23F79Bf023C97f0235BC0ffC5a8258C03fef9',
  IPFS_GATEWAY: 'https://secure.liberion.com',
  TRUST_GATE_URL: 'wss://gate.liberion.com',
};

/** Development environment configuration */
const DEVELOPMENT_CONFIG: NetworkConfig = {
  RPC_ENDPOINT: 'https://bc.liberion.dev/rpc',
  USER_CONTRACT_ADDRESS: '0xb584861f5760E9B04B7439c777246c5B82FE6Fff',
  IPFS_GATEWAY: 'https://secure.liberion.dev',
  TRUST_GATE_URL: 'wss://gate.liberion.dev',
};

/**
 * Get network configuration for specified environment
 * @param env - Environment ('production' | 'development'), default: 'production'
 * @returns Network configuration object
 */
export function getNetworkConfig(env: Environment = 'production'): NetworkConfig {
  return env === 'development' ? DEVELOPMENT_CONFIG : PRODUCTION_CONFIG;
}

/** User contract ABI (minimal for tokenURI) */
export const USER_CONTRACT_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'tokenId',
        type: 'address',
      },
    ],
    name: 'tokenURI',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
