import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const apiUrl = 'https://api.github.com/repos/Materialious/Materialious/contributors';
const outputDir = path.join(__dirname, '../static/localApi');
const outputFile = 'ghContributors.json';

async function main() {
	try {
		const response = await fetch(apiUrl);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();

		// Ensure the output directory exists
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Write the data to a JSON file
		fs.writeFileSync(path.join(__dirname, outputDir, outputFile), JSON.stringify(data));
		console.log('Github contributors fetched and written to', path.join(outputDir, outputFile));
	} catch (error) {
		console.error('Error fetching data:', error);
	}
}

main();
