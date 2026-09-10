import { readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function main() {
	const fileNames = ['shaka-player.ui.d.ts', 'shaka-player.ui.debug.d.ts'];

	for (const filename of fileNames) {
		await fixTypes(filename);
	}
}

async function fixTypes(filename) {
	const filePath = path.join(__dirname, '..', 'node_modules', 'shaka-player', 'dist', filename);

	const shakaTs = await readFile(filePath, 'utf-8');

	if (!shakaTs.includes('export default shaka')) {
		await appendFile(filePath, 'export default shaka;');
		console.log(`[PatchShaka] Fixed types in ${filename}`);
	} else {
		console.log(`[PatchShaka] No changes needed in ${filename}`);
	}
}

main().catch(() => {
	console.error('[PatchShaka]', 'Failed to patch shaka-player');
});
