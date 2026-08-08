const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ARCH = {
	x64: 1,
	arm64: 3
};

exports.default = async function (context) {
	if (context.electronPlatformName !== 'darwin') {
		return;
	}

	const archName = context.arch === ARCH.x64 ? 'x64' : context.arch === ARCH.arm64 ? 'arm64' : null;
	if (!archName) {
		return;
	}

	const ffmpegStaticDir = path.resolve(__dirname, '../node_modules/ffmpeg-static');
	const installScript = path.join(ffmpegStaticDir, 'install.js');
	if (!fs.existsSync(installScript)) {
		return;
	}

	const binary = path.join(ffmpegStaticDir, 'ffmpeg');
	try {
		fs.unlinkSync(binary);
	} catch (err) {
		if (err && err.code !== 'ENOENT') throw err;
	}

	execFileSync(process.execPath, [installScript], {
		env: { ...process.env, npm_config_arch: archName, npm_config_platform: 'darwin' },
		stdio: 'inherit'
	});

	const appBundle = fs.readdirSync(context.appOutDir).find((f) => f.endsWith('.app'));
	if (!appBundle) {
		return;
	}

	const unpackedDir = path.join(
		context.appOutDir,
		appBundle,
		'Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static'
	);
	fs.copyFileSync(binary, path.join(unpackedDir, 'ffmpeg'));

	// install.js overwrites ffmpeg.LICENSE / ffmpeg.README per-arch, which breaks
	// @electron/universal's identical-SHA check (and its non-Mach-O reconciliation).
	// Replace them with the package's static files so both arch bundles match, and
	// keep ffmpeg.README present because the asar header still references it.
	fs.copyFileSync(path.join(ffmpegStaticDir, 'LICENSE'), path.join(unpackedDir, 'ffmpeg.LICENSE'));
	fs.copyFileSync(path.join(ffmpegStaticDir, 'README.md'), path.join(unpackedDir, 'ffmpeg.README'));
};
