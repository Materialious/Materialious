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
	subscriptionPasswordHash: string;
}

export const UserTable = sequelize.define('User', {
	id: {
		type: DataTypes.UUIDV4,
		allowNull: false,
		primaryKey: true
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
	subscriptionPasswordHash: {
		type: DataTypes.STRING,
		allowNull: false
	}
});

export interface ChannelSubscriptionModel {
	channelIdCipher: string;
	channelIdSalt: string;
	channelNameCipher: string;
	channelNameSalt: string;
	lastRSSFetch: Date;
	userId: string;
}

export const ChannelSubscriptionTable = sequelize.define('Subscriptions', {
	channelIdCipher: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelIdSalt: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelNameCipher: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelNameSalt: {
		type: DataTypes.STRING,
		allowNull: false
	},
	lastRSSFetch: {
		type: DataTypes.DATE,
		allowNull: false
	},
	userId: {
		type: DataTypes.UUIDV4,
		references: {
			model: 'User',
			key: 'id'
		},
		allowNull: false
	}
});
