import { Sequelize, DataTypes, type Model } from 'sequelize';
import { env } from '$env/dynamic/private';

export const sequelize = new Sequelize(
	// Use sqlite::memory: if not provided.
	env.DATABASE_CONNECTION_URI ? env.DATABASE_CONNECTION_URI : 'sqlite::memory:'
);

export interface UserTableModel extends Model {
	id: string;
	username: string;
	passwordHash: string;
	passwordSalt: string;
	created: Date;
	decryptionKeySalt: string;
	masterKeyCipher: string;
	masterKeyNonce: string;
}

export const UserTable = sequelize.define(
	'User',
	{
		id: {
			type: DataTypes.UUIDV4,
			allowNull: false,
			primaryKey: true,
			unique: true
		},
		username: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true
		},
		passwordHash: {
			type: DataTypes.STRING,
			allowNull: false
		},
		passwordSalt: {
			type: DataTypes.STRING,
			allowNull: false
		},
		created: {
			type: DataTypes.DATE,
			allowNull: false
		},
		decryptionKeySalt: {
			type: DataTypes.STRING,
			allowNull: false
		},
		masterKeyCipher: {
			type: DataTypes.STRING,
			allowNull: false
		},
		masterKeyNonce: {
			type: DataTypes.STRING,
			allowNull: false
		}
	},
	{
		indexes: [
			{
				unique: true,
				fields: ['id', 'username']
			}
		]
	}
);

export interface ChannelSubscriptionModel {
	id: string; // Hashed authId with subscription key on client.
	channelIdCipher: string;
	channelIdNonce: string;
	channelNameCipher: string;
	channelNameNonce: string;
	lastRSSFetch: Date;
	userId: string;
}

export const ChannelSubscriptionTable = sequelize.define('Subscriptions', {
	id: {
		type: DataTypes.STRING,
		allowNull: false,
		primaryKey: true
	},
	channelIdCipher: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelIdNonce: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelNameCipher: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelNameNonce: {
		type: DataTypes.STRING,
		allowNull: false
	},
	lastRSSFetch: {
		type: DataTypes.DATE,
		allowNull: false
	}
});

UserTable.hasMany(ChannelSubscriptionTable);

export const CaptchaTable = sequelize.define('Captchas', {
	signature: {
		type: DataTypes.STRING,
		allowNull: false,
		primaryKey: true
	},
	created: {
		type: DataTypes.DATE,
		allowNull: false
	}
});
