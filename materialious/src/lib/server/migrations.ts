import { DataTypes, type Sequelize } from 'sequelize';

export const twoFactorColumns = {
	twoFactorSecret: { type: DataTypes.STRING, allowNull: true },
	twoFactorVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
	twoFactorLastTimeStep: { type: DataTypes.BIGINT, allowNull: true }
};

export async function runSequelizeMigrations(sequelize: Sequelize) {
	const queryInterface = sequelize.getQueryInterface();

	const userColumns = await queryInterface.describeTable('Users');
	for (const [name, definition] of Object.entries(twoFactorColumns)) {
		if (!(name in userColumns)) await queryInterface.addColumn('Users', name, definition);
	}

	const historyColumns = await queryInterface.describeTable('UserHistories');

	if (!('authorIdCipher' in historyColumns)) {
		await queryInterface.addColumn('UserHistories', 'authorIdCipher', {
			type: DataTypes.STRING,
			allowNull: true
		});
	}

	if (!('authorIdNonce' in historyColumns)) {
		await queryInterface.addColumn('UserHistories', 'authorIdNonce', {
			type: DataTypes.STRING,
			allowNull: true
		});
	}
}
