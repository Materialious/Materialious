import { Sequelize, DataTypes, Model, type ModelCtor } from 'sequelize';
import { DATABASE_CONNECTION_URI } from '$app/env/private';
import { twoFactorColumns } from './migrations';

let UserTable: ModelCtor<Model<any, any>>;
let ChannelSubscriptionTable: ModelCtor<Model<any, any>>;
let CaptchaTable: ModelCtor<Model<any, any>>;
let UserKeyValueTable: ModelCtor<Model<any, any>>;
let UserHistoryTable: ModelCtor<Model<any, any>>;
let UserPlaylistVideoTable: ModelCtor<Model<any, any>>;
let UserPlaylistTable: ModelCtor<Model<any, any>>;
let QuickConnectTable: ModelCtor<Model<any, any>>;

let sequelizeInstance: Sequelize | null = null;

// Don't want to make our Sequelize instance always
export function getSequelize(): {
	sequelize: Sequelize;
	UserTable: ModelCtor<Model<any, any>>;
	ChannelSubscriptionTable: ModelCtor<Model<any, any>>;
	CaptchaTable: ModelCtor<Model<any, any>>;
	UserKeyValueTable: ModelCtor<Model<any, any>>;
	UserHistoryTable: ModelCtor<Model<any, any>>;
	UserPlaylistVideoTable: ModelCtor<Model<any, any>>;
	UserPlaylistTable: ModelCtor<Model<any, any>>;
	QuickConnectTable: ModelCtor<Model<any, any>>;
} {
	if (sequelizeInstance) {
		return {
			sequelize: sequelizeInstance,
			UserTable,
			ChannelSubscriptionTable,
			CaptchaTable,
			UserKeyValueTable,
			UserHistoryTable,
			QuickConnectTable,
			UserPlaylistTable,
			UserPlaylistVideoTable
		};
	}

	if (!DATABASE_CONNECTION_URI) {
		throw new Error('DATABASE_CONNECTION_URI must be set');
	}

	sequelizeInstance = new Sequelize(DATABASE_CONNECTION_URI);

	UserTable = sequelizeInstance.define(
		'User',
		{
			...twoFactorColumns,
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

	UserKeyValueTable = sequelizeInstance.define(
		'UserKeyValue',
		{
			key: {
				type: DataTypes.STRING,
				allowNull: false
			},
			valueCipher: {
				type: DataTypes.STRING,
				allowNull: false
			},
			valueNonce: {
				type: DataTypes.STRING,
				allowNull: false
			}
		},
		{
			indexes: [
				{
					unique: true,
					fields: ['UserId', 'key']
				}
			]
		}
	);

	QuickConnectTable = sequelizeInstance.define(
		'QuickConnect',
		{
			codeHash: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true
			},
			receiverPublicKey: {
				type: DataTypes.STRING,
				allowNull: true
			},
			credentialsCipher: {
				type: DataTypes.TEXT,
				allowNull: true
			},
			created: {
				type: DataTypes.DATE,
				allowNull: false
			},
			expires: {
				type: DataTypes.DATE,
				allowNull: false
			}
		},
		{
			indexes: [
				{
					fields: ['expires']
				}
			]
		}
	);

	UserHistoryTable = sequelizeInstance.define('UserHistory', {
		id: {
			type: DataTypes.STRING,
			allowNull: false,
			primaryKey: true
		},
		watched: {
			type: DataTypes.DATE,
			allowNull: false
		},
		lengthSeconds: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		progress: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		videoIdCipher: {
			type: DataTypes.STRING,
			allowNull: false
		},
		videoIdNonce: {
			type: DataTypes.STRING,
			allowNull: false
		},
		titleCipher: {
			type: DataTypes.STRING,
			allowNull: false
		},
		titleNonce: {
			type: DataTypes.STRING,
			allowNull: false
		},
		authorCipher: {
			type: DataTypes.STRING,
			allowNull: false
		},
		authorNonce: {
			type: DataTypes.STRING,
			allowNull: false
		},
		authorIdCipher: {
			type: DataTypes.STRING,
			allowNull: true
		},
		authorIdNonce: {
			type: DataTypes.STRING,
			allowNull: true
		},
		thumbnailCipher: {
			type: DataTypes.STRING,
			allowNull: false
		},
		thumbnailNonce: {
			type: DataTypes.STRING,
			allowNull: false
		}
	});

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

	UserPlaylistTable = sequelizeInstance.define('UserPlaylist', {
		id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
		titleCipher: { type: DataTypes.TEXT, allowNull: false },
		titleNonce: { type: DataTypes.STRING, allowNull: false },
		revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
	});
	UserPlaylistVideoTable = sequelizeInstance.define(
		'UserPlaylistVideo',
		{
			id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
			videoIdCipher: { type: DataTypes.TEXT, allowNull: false },
			videoIdNonce: { type: DataTypes.STRING, allowNull: false },
			titleCipher: { type: DataTypes.TEXT, allowNull: false },
			titleNonce: { type: DataTypes.STRING, allowNull: false },
			authorCipher: { type: DataTypes.TEXT, allowNull: false },
			authorNonce: { type: DataTypes.STRING, allowNull: false },
			authorIdCipher: { type: DataTypes.TEXT, allowNull: false },
			authorIdNonce: { type: DataTypes.STRING, allowNull: false },
			thumbnailCipher: { type: DataTypes.TEXT, allowNull: false },
			thumbnailNonce: { type: DataTypes.STRING, allowNull: false },
			lengthSeconds: { type: DataTypes.INTEGER, allowNull: false },
			viewCount: { type: DataTypes.BIGINT, allowNull: false },
			position: { type: DataTypes.INTEGER, allowNull: false }
		},
		{ indexes: [{ unique: true, fields: ['playlistId', 'position'] }] }
	);
	UserPlaylistTable.hasMany(UserPlaylistVideoTable, {
		as: 'videos',
		foreignKey: { name: 'playlistId', allowNull: false },
		onDelete: 'CASCADE'
	});
	UserTable.hasMany(UserPlaylistTable, { onDelete: 'CASCADE' });
	UserPlaylistTable.belongsTo(UserTable, { as: 'owner', foreignKey: 'UserId' });

	UserTable.hasMany(ChannelSubscriptionTable);
	UserTable.hasMany(UserKeyValueTable);
	UserTable.hasMany(UserHistoryTable);

	return {
		sequelize: sequelizeInstance,
		UserTable,
		ChannelSubscriptionTable,
		CaptchaTable,
		UserKeyValueTable,
		UserHistoryTable,
		QuickConnectTable,
		UserPlaylistTable,
		UserPlaylistVideoTable
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
	twoFactorSecret: string | null;
	twoFactorVerified: boolean;
	twoFactorLastTimeStep: number | string | null;
	id: string;
	username: string;
	passwordHash: string;
	passwordSalt: string;
	created: Date;
	decryptionKeySalt: string;
	masterKeyCipher: string;
	masterKeyNonce: string;
}

export interface UserKeyStoreModel {
	key: string;
	valueCipher: string;
	valueNonce: string;
}

export interface QuickConnectModel {
	codeHash: string;
	receiverPublicKey: string | null;
	credentialsCipher: string | null;
	created: Date;
	expires: Date;
}
