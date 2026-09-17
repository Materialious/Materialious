import { getSequelize, type QuickConnectModel } from './database';
import crypto from 'crypto';
import { Op } from 'sequelize';

// Crockford base32 style alphabet, ambiguity free (no I, L, O, U).
export const quickConnectCodeAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const quickConnectCodeLength = 8;
export const quickConnectTtlMs = 5 * 60 * 1000;

export function normalizeQuickConnectCode(code: string): string {
	return code
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, '')
		.replace(/[IL]/g, '1')
		.replace(/O/g, '0');
}

export function generateQuickConnectCode(): string {
	const bytes = crypto.randomBytes(quickConnectCodeLength);
	let code = '';
	for (let i = 0; i < quickConnectCodeLength; i++) {
		code += quickConnectCodeAlphabet[bytes[i] % quickConnectCodeAlphabet.length];
	}
	return code;
}

function hashQuickConnectCode(code: string): string {
	return crypto.createHash('sha256').update(normalizeQuickConnectCode(code)).digest('hex');
}

async function purgeExpired(): Promise<void> {
	await getSequelize().QuickConnectTable.destroy({
		where: {
			expires: { [Op.lt]: new Date() }
		}
	});
}

export async function createQuickConnectSession(): Promise<{
	code: string;
	expires: Date;
}> {
	await purgeExpired();

	const expires = new Date(Date.now() + quickConnectTtlMs);

	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateQuickConnectCode();

		try {
			await getSequelize().QuickConnectTable.create({
				codeHash: hashQuickConnectCode(code),
				receiverPublicKey: null,
				credentialsCipher: null,
				created: new Date(),
				expires
			});

			return { code, expires };
		} catch {
			// Code collision, retry with a fresh code.
		}
	}

	throw new Error('Failed to generate quick connect code');
}

export async function getQuickConnectSession(code: string): Promise<QuickConnectModel | null> {
	await purgeExpired();

	const session = await getSequelize().QuickConnectTable.findOne({
		where: { codeHash: hashQuickConnectCode(code) }
	});

	return (session as QuickConnectModel | null) ?? null;
}

export type QuickConnectRegisterResult = 'ok' | 'not-found' | 'conflict';

export async function registerQuickConnectReceiver(
	code: string,
	receiverPublicKey: string
): Promise<QuickConnectRegisterResult> {
	const session = await getQuickConnectSession(code);
	if (!session) return 'not-found';
	if (session.receiverPublicKey) return 'conflict';

	await getSequelize().QuickConnectTable.update(
		{ receiverPublicKey },
		{ where: { codeHash: hashQuickConnectCode(code) } }
	);

	return 'ok';
}

export async function setQuickConnectCredentials(
	code: string,
	credentialsCipher: string
): Promise<boolean> {
	const session = await getQuickConnectSession(code);
	if (!session) return false;
	if (!session.receiverPublicKey) return false;
	if (session.credentialsCipher) return false;

	await getSequelize().QuickConnectTable.update(
		{ credentialsCipher },
		{ where: { codeHash: hashQuickConnectCode(code) } }
	);

	return true;
}

export async function getQuickConnectCredentials(code: string): Promise<string | null> {
	const session = await getQuickConnectSession(code);
	if (!session) return null;
	return session.credentialsCipher ?? null;
}

export async function deleteQuickConnectSession(code: string): Promise<void> {
	await getSequelize().QuickConnectTable.destroy({
		where: { codeHash: hashQuickConnectCode(code) }
	});
}
