import { UserTable, type ChannelSubscriptionModel, type UserTableModel } from './database';
import { Op } from 'sequelize';
import crypto from 'crypto';

export class User {
	private userId: string;

	constructor(id: string) {
		this.userId = id;
	}

	public get id() {
		return this.userId;
	}

	private get userWhere() {
		return {
			where: {
				[Op.or]: [{ id: this.userId }, { username: this.userId }]
			}
		};
	}

	async delete() {
		await UserTable.destroy(this.userWhere);
	}

	async subscriptions(): Promise<ChannelSubscriptionModel[]> {
		const subscriptions = await UserTable.findAll({
			where: {
				userId: this.userId
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
	subscriptionPasswordHash: string;
};

export async function createUser(user: CreateUser): Promise<User> {
	const id = crypto.randomUUID();

	await UserTable.create({
		id,
		username: user.username,
		passwordHash: user.password.hash,
		passwordSalt: user.password.salt,
		created: new Date(),
		subscriptionPasswordHash: user.subscriptionPasswordHash
	});

	return new User(id);
}

export async function getUser(identifier: string): Promise<User> {
	const user = await UserTable.findOne({
		where: {
			[Op.or]: [{ id: identifier }, { username: identifier }]
		}
	});

	if (!user) {
		throw new Error('User does not exist');
	}

	return new User((user as UserTableModel).id);
}

export async function authenticateUser(username: string, passwordHash: string): Promise<User> {
	const user = await UserTable.findOne({
		where: {
			username
		}
	});

	if (!user) {
		throw new Error('User does not exist');
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
		return new User(userModel.id);
	}

	throw new Error('User does not exist');
}
