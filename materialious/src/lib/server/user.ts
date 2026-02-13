import { UserTable, type ChannelSubscriptionModel, type UserTableModel } from './database';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { error } from '@sveltejs/kit';

export class User {
	private user: UserTableModel;

	constructor(user: UserTableModel) {
		this.user = user;
	}

	public get id() {
		return this.user.id;
	}

	public get publicPasswordSalts() {
		return {
			subscriptionPasswordSalt: this.user.subscriptionPasswordSalt,
			passwordSalt: this.user.passwordSalt
		};
	}

	private get userWhere() {
		return {
			where: {
				[Op.or]: [{ id: this.user.id }, { username: this.user.username }]
			}
		};
	}

	async delete() {
		await UserTable.destroy(this.userWhere);
	}

	async subscriptions(): Promise<ChannelSubscriptionModel[]> {
		const subscriptions = await UserTable.findAll({
			where: {
				userId: this.user.id
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
	subscriptionPasswordSalt: string;
};

export async function createUser(user: CreateUser): Promise<User> {
	const id = crypto.randomUUID();

	const createdUser = {
		id,
		username: user.username,
		passwordHash: user.password.hash,
		passwordSalt: user.password.salt,
		created: new Date(),
		subscriptionPasswordSalt: user.subscriptionPasswordSalt
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
