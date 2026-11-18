import { error } from '@sveltejs/kit';
import { generateSecret, generateURI, verify } from 'otplib';
import { Op } from 'sequelize';
import { getSequelize, type UserTableModel } from './database';

const options = { algorithm: 'sha1', digits: 6, period: 30 } as const;

function provisioning(secret: string, username: string) {
	return {
		secret,
		uri: generateURI({ ...options, secret, issuer: 'Materialious', label: username })
	};
}

export function twoFactorStatus(user: UserTableModel) {
	if (user.twoFactorVerified) return { configured: true, verified: true };
	return {
		configured: !!user.twoFactorSecret,
		verified: false,
		...(user.twoFactorSecret && provisioning(user.twoFactorSecret, user.username))
	};
}

export async function startTwoFactor(user: UserTableModel) {
	const secret = generateSecret();
	const [updated] = await getSequelize().UserTable.update(
		{ twoFactorSecret: secret, twoFactorVerified: false, twoFactorLastTimeStep: null },
		{ where: { id: user.id, twoFactorVerified: false } }
	);
	if (!updated) throw error(409, 'Two-factor authentication is already enabled');
	return provisioning(secret, user.username);
}

// A conditional update prevents two concurrent requests accepting the same code,
// or verification of a secret that was replaced/removed while the request ran.
export async function verifyTwoFactor(user: UserTableModel, token: string, activate = false) {
	if (!user.twoFactorSecret || user.twoFactorVerified === activate || !/^[0-9]{6}$/.test(token)) {
		throw error(401, 'Invalid authentication code');
	}
	const result = await verify({
		...options,
		secret: user.twoFactorSecret,
		token,
		epochTolerance: [30, 0],
		...(user.twoFactorLastTimeStep != null && {
			afterTimeStep: Number(user.twoFactorLastTimeStep)
		})
	});
	if (!result.valid || !('timeStep' in result)) throw error(401, 'Invalid authentication code');

	const [updated] = await getSequelize().UserTable.update(
		{ twoFactorVerified: true, twoFactorLastTimeStep: result.timeStep },
		{
			where: {
				id: user.id,
				twoFactorSecret: user.twoFactorSecret,
				twoFactorVerified: !activate,
				[Op.or]: [
					{ twoFactorLastTimeStep: null },
					{ twoFactorLastTimeStep: { [Op.lt]: result.timeStep } }
				]
			}
		}
	);
	if (!updated) throw error(401, 'Invalid authentication code');
}

export async function removeTwoFactor(user: UserTableModel, token = '') {
	if (user.twoFactorVerified) await verifyTwoFactor(user, token);

	const [updated] = await getSequelize().UserTable.update(
		{ twoFactorSecret: null, twoFactorVerified: false, twoFactorLastTimeStep: null },
		{
			where: {
				id: user.id,
				twoFactorSecret: user.twoFactorSecret,
				twoFactorVerified: user.twoFactorVerified
			}
		}
	);
	if (!updated) throw error(409, 'Two-factor setup changed; refresh and try again');
}
