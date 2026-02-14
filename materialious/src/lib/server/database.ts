import { Sequelize, DataTypes, Model, type ModelCtor } from 'sequelize';
import { env } from '$env/dynamic/private';

let UserTable: ModelCtor<Model<any, any>>;
let ChannelSubscriptionTable: ModelCtor<Model<any, any>>;
let CaptchaTable: ModelCtor<Model<any, any>>;

let sequelizeInstance: Sequelize | null = null;

// Don't want to make our Sequelize instance always
export function getSequelize(): {
	sequelize: Sequelize;
	UserTable: ModelCtor<Model<any, any>>;
	ChannelSubscriptionTable: ModelCtor<Model<any, any>>;
	CaptchaTable: ModelCtor<Model<any, any>>;
} {
	if (sequelizeInstance) {
		return {
			sequelize: sequelizeInstance,
			UserTable,
			ChannelSubscriptionTable,
			CaptchaTable
		};
	}

	sequelizeInstance = new Sequelize(
		env.DATABASE_CONNECTION_URI ? env.DATABASE_CONNECTION_URI : 'sqlite::memory:'
	);

	console.log('sequelizeInstance');

	UserTable = sequelizeInstance.define(
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

	ChannelSubscriptionTable = sequelizeInstance.define('Subscriptions', {
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

	CaptchaTable = sequelizeInstance.define('Captchas', {
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

	UserTable.hasMany(ChannelSubscriptionTable);

	return {
		sequelize: sequelizeInstance,
		UserTable,
		ChannelSubscriptionTable,
		CaptchaTable
	};
}

export interface ChannelSubscriptionModel {
	id: string; // Hashed authId with subscription key on client.
	channelIdCipher: string;
	channelIdNonce: string;
	channelNameCipher: string;
	channelNameNonce: string;
	lastRSSFetch: Date;
	userId: string;
}

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
