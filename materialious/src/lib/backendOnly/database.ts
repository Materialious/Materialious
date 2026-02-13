import { Sequelize, DataTypes } from 'sequelize';
import { DATABASE_CONNECTION_URI } from '$env/static/private';

export const sequelize = new Sequelize(
	// Use sqlite::memory: if not provided.
	DATABASE_CONNECTION_URI ? DATABASE_CONNECTION_URI : 'sqlite::memory:'
);

export const UserTable = sequelize.define('User', {
	id: {
		type: DataTypes.UUIDV4,
		allowNull: false,
		primaryKey: true
	},
	username: {
		type: DataTypes.STRING,
		allowNull: false
	},
	passwordHash: {
		type: DataTypes.STRING,
		allowNull: false
	},
	create: {
		type: DataTypes.DATE,
		allowNull: false
	}
});

export const ChannelSubscriptionTable = sequelize.define('Subscriptions', {
	channelId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	channelName: {
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
		}
	}
});
