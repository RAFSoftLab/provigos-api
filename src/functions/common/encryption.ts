import * as crypto from 'crypto';
import { jwtSecret } from './config';

// Function to derive a key from the user's Google ID (PBKDF2)
export function deriveKey(userId: string): Buffer {
  const salt = jwtSecret; // You can replace this with user-specific salt if needed
  return crypto.pbkdf2Sync(userId, salt, 100000, 32, 'sha256'); // Deriving a 256-bit key
}

// Function to encrypt data using AES-GCM with IV
export function encryptData(data: string, userId: string): { encryptedData: string; iv: string; authTag: string } {
  const key = deriveKey(userId);
  const iv = crypto.randomBytes(12); // AES-GCM recommended IV length is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get the authentication tag for integrity check
  const authTag = cipher.getAuthTag().toString('base64');

  return {
    encryptedData: encrypted,
    iv: iv.toString('base64'),
    authTag: authTag,
  };
}

// Function to decrypt data using AES-GCM with IV and Authentication Tag
export function decryptData(encrypted: { encryptedData: string; iv: string; authTag: string }, userId: string): string {
  const key = deriveKey(userId);
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  // Set the authentication tag for integrity check
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

