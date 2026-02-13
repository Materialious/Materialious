import {
	ChannelSubscriptionTable,
	UserTable,
	type ChannelSubscriptionModel,
	type UserTableModel
} from './database';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { error } from '@sveltejs/kit';

export class User {
	data: UserTableModel;

	constructor(data: UserTableModel) {
		this.data = data;
	}

	public get id() {
		return this.data.id;
	}

	public get publicPasswordSalts() {
		return {
			decryptionKeySalt: this.data.decryptionKeySalt,
			passwordSalt: this.data.passwordSalt
		};
	}

	private get userWhere() {
		return {
			where: {
				[Op.or]: [{ id: this.data.id }, { username: this.data.username }]
			}
		};
	}

	async delete() {
		await UserTable.destroy(this.userWhere);
	}

	async addSubscription(subscription: Omit<ChannelSubscriptionModel, 'userId'>) {
		await ChannelSubscriptionTable.create({
			...subscription,
			userId: this.id
		});
	}

	async removeSubscription(id: string) {
		await ChannelSubscriptionTable.destroy({
			where: {
				id
			}
		});
	}

	async amSubscribed(id: string): Promise<boolean> {
		return (
			(await ChannelSubscriptionTable.count({
				where: {
					id
				}
			})) > 0
		);
	}

	async subscriptions(): Promise<ChannelSubscriptionModel[]> {
		const subscriptions = await UserTable.findAll({
			where: {
				userId: this.data.id
			}
		});

		if (!subscriptions) return [];

		return subscriptions as unknown as ChannelSubscriptionModel[];
	}
}

export type CreateUser = {
	username: string;
	password: {
		hash: string;
		salt: string;
	};
	decryptionKeySalt: string;
	masterKey: {
		cipher: string;
		nonce: string;
	};
};

export async function createUser(user: CreateUser): Promise<User> {
	const id = crypto.randomUUID();

	const createdUser = {
		id,
		username: user.username,
		passwordHash: user.password.hash,
		passwordSalt: user.password.salt,
		created: new Date(),
		decryptionKeySalt: user.decryptionKeySalt,
		masterKeyCipher: user.masterKey.cipher,
		masterKeyNonce: user.masterKey.nonce
	};

	let userCreated = false;
	try {
		await UserTable.create(createdUser);
		userCreated = true;
	} catch {
		userCreated = false;
	}

	if (!userCreated) {
		throw error(400);
	}

	return new User(createdUser as UserTableModel);
}

export async function getUser(identifier: string): Promise<User> {
	const user = await UserTable.findOne({
		where: {
			[Op.or]: [{ id: identifier }, { username: identifier }]
		}
	});

	if (!user) {
		throw error(404);
	}

	return new User(user as UserTableModel);
}

export async function authenticateUser(username: string, passwordHash: string): Promise<User> {
	const user = await UserTable.findOne({
		where: {
			username
		}
	});

	if (!user) {
		throw error(404);
	}

	const userModel = user as UserTableModel;

	const textEncoder = new TextEncoder();

	// Password is hashed in the browser, so if db is leaked it doesn't matter.
	// Timing safe equal used to stop timing attacks when comparing strings.
	if (
		crypto.timingSafeEqual(
			textEncoder.encode(passwordHash),
			textEncoder.encode(userModel.passwordHash)
		)
	) {
		return new User(userModel as UserTableModel);
	}

	throw error(404);
}
