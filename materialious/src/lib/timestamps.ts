import { decodeHtmlCharCodes } from './misc';
import { convertToSeconds } from './numbers';

export interface PhasedDescription {
	description: string;
	timestamps: { title: string; time: number; timePretty: string }[];
}

export function extractActualLink(url: string): string {
	const urlParams = new URLSearchParams(url.split('?')[1]);
	const actualLink = urlParams.get('q');
	if (actualLink) {
		return decodeURIComponent(actualLink);
	}
	return url;
}

export function processYoutubeLink(line: string): string {
	// Regex to match the <a> tag and extract the href (YouTube redirect link)
	const urlRegex = /<a href="https:\/\/www\.youtube\.com\/redirect\?([^"]+)"/;

	const urlMatch = urlRegex.exec(line);

	if (urlMatch) {
		// Extract the YouTube redirect URL and get the actual URL from the `q` parameter
		const redirectUrl = urlMatch[0]; // the full redirect URL with the `q` parameter
		const actualUrl = extractActualLink(redirectUrl);
		return line.replace(urlRegex, `<a href="${actualUrl}"`);
	} else {
		// If no match found, just return the original line
		return line;
	}
}

export function phaseDescription(
	videoId: string,
	content: string,
	fallbackPatch?: 'youtubejs' | 'piped'
): PhasedDescription {
	const timestamps: { title: string; time: number; timePretty: string }[] = [];
	const lines = content.split('\n');

	// Regular expressions for different timestamp formats
	const urlRegex = /<a href="([^"]+)"/;
	const timestampRegexInvidious =
		/<a href="([^"]+)" data-onclick="jump_to_time" data-jump-time="(\d+)">(\d+:\d+(?::\d+)?)<\/a>\s*(.+)/;
	const timestampRegexYtJs = new RegExp(
		`href="https://www\\.youtube\\.com/watch\\?v=${videoId}(?:&t=(\\d+)s)?"[^>]*>\\s*<span[^>]*>\\s*([^<]+)\\s*</span>\\s*</a>\\s*<span[^>]*>\\s*([^<]+)\\s*</span>`,
		'i'
	);

	const filteredLines: string[] = [];
	lines.forEach((line) => {
		const urlMatch = urlRegex.exec(line);
		// Use appropriate regex based on the `usingYoutubeJs` flag
		const timestampMatch = (
			fallbackPatch === 'youtubejs' ? timestampRegexYtJs : timestampRegexInvidious
		).exec(fallbackPatch === 'youtubejs' ? line + '</span>' : line);

		if (urlMatch !== null && timestampMatch === null) {
			// If line contains a URL but not a timestamp, modify the URL
			const modifiedLine = processYoutubeLink(line).replace(
				/<a href="([^"]+)"/,
				'<a href="$1" target="_blank" rel="noopener noreferrer" class="link"'
			);
			console.log(modifiedLine);
			filteredLines.push(modifiedLine);
		} else if (timestampMatch !== null) {
			// If line contains a timestamp, extract details and push into timestamps array
			const time = (fallbackPatch === 'youtubejs' ? timestampMatch[1] : timestampMatch[2]) || '0';
			const timestamp = fallbackPatch === 'youtubejs' ? timestampMatch[2] : timestampMatch[3];
			const title =
				fallbackPatch === 'youtubejs' ? timestampMatch[3] || '' : timestampMatch[4] || '';

			timestamps.push({
				time: convertToSeconds(time),
				// Remove any HTML in the timestamp title.
				title: decodeHtmlCharCodes(
					title
						.replace(/<[^>]+>/g, '')
						.replace(/\n/g, '')
						.trim()
				),
				timePretty: timestamp
			});
		} else {
			filteredLines.push(line);
		}
	});

	const filteredContent = filteredLines.join('\n');

	return { description: filteredContent, timestamps: timestamps };
}
