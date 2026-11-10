import type { CapacitorConfig } from '@capacitor/cli';
import pkg from './package.json';

const androidTvBuild = process.env.ANDROID_TV_BUILD === 'true';

const config: CapacitorConfig = {
	appId: 'us.materialio.app',
	appName: 'Materialious',
	webDir: 'build',
	android: {
		includePlugins: [
			...Object.keys(pkg.dependencies),
			...Object.keys(pkg.devDependencies).filter((name) => name !== 'cordova-plugin-apkupdater'),
			...(androidTvBuild ? ['cordova-plugin-apkupdater'] : [])
		]
	},
	plugins: {
		Nodejs: {
			nodeDir: 'nodejsAndroid'
		}
	},
	server: {
		hostname: 'www.youtube.com',
		androidScheme: 'https'
	}
};

export default config;
