/**
 * Post-Quantum Cryptography utility class
 * Implements hybrid encryption: ML-KEM-1024 + XChaCha20-Poly1305 + ML-DSA-87
 */

import { ml_kem1024 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { webcrypto } from 'crypto';
import sodium from 'libsodium-wrappers';
import type { ILogger } from '../types.js';
import { NoOpLogger } from '../adapters/logger.js';

const { subtle } = webcrypto;

// Protocol version AAD (must match client)
const PROTOCOL_AAD = new TextEncoder().encode('PQv1');

/**
 * Post-Quantum Cryptography utility class
 * Used by Trust Gate to:
 * 1. Generate temporary session keys
 * 2. Encrypt data for Wallet using user's public keys
 * 3. Sign KEM ciphertext for authenticity
 *
 * Format matches client (cipher.js):
 * version (1) + header (4) + sigLen (4) + signature + cipherText + nonce (24) + ct
 */
export class PQCrypto {
  private logger: ILogger;

  // Trust Gate keys (generated from seed)
  // Note: kemPrivateKey kept for potential future decryption support
  private _kemPrivateKey: Uint8Array | null = null;
  private kemPublicKey: Uint8Array | null = null;
  private dsaPrivateKey: Uint8Array | null = null;
  private dsaPublicKey: Uint8Array | null = null;

  // Peer (User/Wallet) public keys
  private peerKEMPublicKey: Uint8Array | null = null;
  private peerDSAPublicKey: Uint8Array | null = null;

  constructor(logger?: ILogger) {
    this.logger = logger ?? new NoOpLogger();
  }

  /**
   * Generate Trust Gate session keys from cryptographic seed
   * @param seed - Random seed (at least 96 bytes: 64 for ML-KEM + 32 for ML-DSA)
   */
  async generateKeysFromSeed(seed: Uint8Array): Promise<void> {
    try {
      if (seed.length < 96) {
        throw new Error(
          `Seed too short: expected at least 96 bytes (64 for KEM + 32 for DSA), got ${seed.length}`
        );
      }

      // ML-KEM-1024 keypair (first 64 bytes of seed)
      const kemSeed = seed.slice(0, 64);
      const kemKeys = ml_kem1024.keygen(kemSeed);
      this.kemPublicKey = kemKeys.publicKey; // 1568 bytes
      this._kemPrivateKey = kemKeys.secretKey; // 3168 bytes

      // ML-DSA-87 keypair (next 32 bytes)
      const dsaSeed = seed.slice(64, 96);
      const dsaKeys = ml_dsa87.keygen(dsaSeed);
      this.dsaPublicKey = dsaKeys.publicKey; // 2592 bytes
      this.dsaPrivateKey = dsaKeys.secretKey; // 4896 bytes

      this.logger.info('[PQCrypto] Keys generated successfully', {
        kemPublicKeySize: this.kemPublicKey!.length,
        dsaPublicKeySize: this.dsaPublicKey!.length,
      });
    } catch (ex) {
      const error = ex as Error;
      this.logger.error(`[PQCrypto] Failed to generate keys: ${error.message}`);
      throw new Error(`Failed to generate PQ keys: ${error.message}`);
    }
  }

  /**
   * Import peer's (user) public keys for encryption and verification
   * @param kemPublicKey - ML-KEM-1024 public key (1568 bytes)
   * @param dsaPublicKey - ML-DSA-87 public key (2592 bytes)
   */
  importPeerPublicKeys(
    kemPublicKey: Uint8Array | Buffer,
    dsaPublicKey: Uint8Array | Buffer
  ): void {
    try {
      this.peerKEMPublicKey = new Uint8Array(kemPublicKey);
      this.peerDSAPublicKey = new Uint8Array(dsaPublicKey);

      // Validate sizes
      if (this.peerKEMPublicKey.length !== 1568) {
        throw new Error(
          `Invalid ML-KEM-1024 public key size: expected 1568, got ${this.peerKEMPublicKey.length}`
        );
      }
      if (this.peerDSAPublicKey.length !== 2592) {
        throw new Error(
          `Invalid ML-DSA-87 public key size: expected 2592, got ${this.peerDSAPublicKey.length}`
        );
      }

      this.logger.info('[PQCrypto] Peer public keys imported', {
        kemKeySize: this.peerKEMPublicKey.length,
        dsaKeySize: this.peerDSAPublicKey.length,
      });
    } catch (ex) {
      const error = ex as Error;
      this.logger.error(`[PQCrypto] Failed to import peer keys: ${error.message}`);
      throw new Error(`Failed to import peer public keys: ${error.message}`);
    }
  }

  /**
   * Hybrid encryption: ML-KEM + XChaCha20-Poly1305 + ML-DSA signature
   * Matches client format: version + header + sigLen + signature + cipherText + nonce + ct
   * @param message - Data to encrypt
   * @returns Encrypted package in client-compatible format
   */
  async encrypt(message: ArrayBuffer | Uint8Array | Buffer): Promise<Buffer> {
    try {
      // Ensure libsodium is ready
      await sodium.ready;

      if (!this.peerKEMPublicKey) {
        throw new Error('Peer KEM public key not imported');
      }
      if (!this.dsaPrivateKey) {
        throw new Error('DSA private key not generated');
      }

      // Normalize message to Uint8Array
      const messageBytes =
        message instanceof Uint8Array ? message : new Uint8Array(message);

      this.logger.info('[PQCrypto] Starting hybrid encryption', {
        messageSize: messageBytes.length,
      });

      // 1. ML-KEM-1024 encapsulation (generates shared secret)
      const { cipherText: kemCiphertext, sharedSecret } = ml_kem1024.encapsulate(
        this.peerKEMPublicKey
      );

      this.logger.info('[PQCrypto] ML-KEM encapsulation complete', {
        ciphertextSize: kemCiphertext.length, // 1568 bytes
        sharedSecretSize: sharedSecret.length, // 32 bytes
      });

      // 2. Derive key using HKDF with protocol AAD
      // Create a copy to satisfy stricter BufferSource types in Node.js 24+
      const sharedSecretBuffer = Uint8Array.from(sharedSecret);
      const secretKeyRaw = await subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: PROTOCOL_AAD,
          info: PROTOCOL_AAD,
        },
        await subtle.importKey('raw', sharedSecretBuffer, { name: 'HKDF' }, false, [
          'deriveBits',
        ]),
        256
      );

      // Zero-wipe shared secrets
      sharedSecret.fill(0);
      sharedSecretBuffer.fill(0);

      // 3. Build version and header
      const versionBuf = new Uint8Array([1]);
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, kemCiphertext.length, false); // big-endian

      // 4. Build AAD for AEAD: PROTOCOL_AAD || version || header
      const aad = new Uint8Array(PROTOCOL_AAD.length + 1 + 4);
      aad.set(PROTOCOL_AAD, 0);
      aad.set(versionBuf, PROTOCOL_AAD.length);
      aad.set(header, PROTOCOL_AAD.length + 1);

      // 5. XChaCha20-Poly1305 encryption
      const keyBytes = new Uint8Array(secretKeyRaw);
      const nonce = webcrypto.getRandomValues(
        new Uint8Array(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES)
      );

      const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        messageBytes,
        aad,
        null,
        nonce,
        keyBytes
      );

      this.logger.info('[PQCrypto] XChaCha20-Poly1305 encryption complete', {
        nonceSize: nonce.length, // 24 bytes
        encryptedSize: ct.length, // message + 16 bytes tag
      });

      // 6. ML-DSA-87 signature (sign the KEM ciphertext, not encrypted data!)
      const signature = ml_dsa87.sign(kemCiphertext, this.dsaPrivateKey);

      this.logger.info('[PQCrypto] ML-DSA signature created', {
        signatureSize: signature.length, // ~4627 bytes
      });

      // 7. Build signature length buffer
      const sigLenBuf = new Uint8Array(4);
      new DataView(sigLenBuf.buffer).setUint32(0, signature.length, false);

      // 8. Pack everything: version + header + sigLen + sig + cipherText + nonce + ct
      const result = new Uint8Array(
        1 + 4 + 4 + signature.length + kemCiphertext.length + nonce.length + ct.length
      );

      let offset = 0;
      result.set(versionBuf, offset);
      offset += 1;
      result.set(header, offset);
      offset += 4;
      result.set(sigLenBuf, offset);
      offset += 4;
      result.set(signature, offset);
      offset += signature.length;
      result.set(kemCiphertext, offset);
      offset += kemCiphertext.length;
      result.set(nonce, offset);
      offset += nonce.length;
      result.set(ct, offset);

      // Zero-wipe key material
      keyBytes.fill(0);
      new Uint8Array(secretKeyRaw).fill(0);

      this.logger.info('[PQCrypto] Hybrid encryption complete', {
        totalSize: result.length,
        breakdown: {
          version: 1,
          header: 4,
          sigLen: 4,
          signature: signature.length,
          kemCiphertext: kemCiphertext.length,
          nonce: nonce.length,
          ct: ct.length,
        },
      });

      return Buffer.from(result);
    } catch (ex) {
      const error = ex as Error;
      this.logger.error(`[PQCrypto] Encryption failed: ${error.message}`);
      throw new Error(`PQ encryption failed: ${error.message}`);
    }
  }

  /**
   * Check if keys have been generated
   */
  hasKeys(): boolean {
    return !!(this.kemPublicKey && this.dsaPublicKey && this._kemPrivateKey);
  }

  /**
   * Export Trust Gate public keys (for sending to client)
   * @returns Object with publicKeyEncrypt and publicKeySign as Buffers
   */
  exportKeys(): { publicKeyEncrypt: Buffer; publicKeySign: Buffer } {
    if (!this.kemPublicKey || !this.dsaPublicKey) {
      throw new Error('Keys not generated yet');
    }

    return {
      publicKeyEncrypt: Buffer.from(this.kemPublicKey),
      publicKeySign: Buffer.from(this.dsaPublicKey),
    };
  }
}
