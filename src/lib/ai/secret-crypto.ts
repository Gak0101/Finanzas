import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'

function encryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('Falta APP_ENCRYPTION_KEY o NEXTAUTH_SECRET para cifrar credenciales')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptSecret(value: string) {
  const [version, ivEncoded, authTagEncoded, encryptedEncoded] = value.split('.')
  if (version !== VERSION || !ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error('Formato de credencial cifrada no válido')
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function maskedSecret(value: string) {
  return `••••${value.slice(-4)}`
}
