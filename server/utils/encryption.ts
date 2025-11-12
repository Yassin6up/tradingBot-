import crypto from 'crypto';

const DEV_MASTER_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

export class APIKeyEncryption {
  private masterKey: string;

  constructor(masterKey?: string) {
    this.masterKey = masterKey || process.env.MASTER_ENCRYPTION_KEY || '';
    
    if (!this.masterKey) {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (isDevelopment) {
        // Use persistent dev key so encrypted credentials survive restarts
        this.masterKey = DEV_MASTER_KEY;
        console.warn('⚠️  Using development encryption key. Set MASTER_ENCRYPTION_KEY in production!');
      } else {
        // Production REQUIRES encryption key to be set
        throw new Error(
          'CRITICAL: MASTER_ENCRYPTION_KEY environment variable is required in production. ' +
          'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
      }
    }
    
    if (this.masterKey.length !== 64) {
      throw new Error('Master encryption key must be 64 hex characters (32 bytes)');
    }
  }

  encrypt(apiKey: string): string {
    try {
      const iv = crypto.randomBytes(12);
      
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(this.masterKey, 'hex'),
        iv
      );

      let encrypted = cipher.update(apiKey, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        Buffer.from(this.masterKey, 'hex'),
        iv
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const encryptor = new APIKeyEncryption();
