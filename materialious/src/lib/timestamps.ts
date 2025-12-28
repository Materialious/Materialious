import { decodeHtmlCharCodes } from './misc';
import { convertToSeconds } from './numbers';

export type Timestamp = { title: string; time: number; timePretty: string; endTime: number };
export type Timestamps = Timestamp[];

export interface PhasedDescription {
	description: string;
	timestamps: Timestamps;
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
	const timestamps: Timestamps = [];
	const lines = content.split('\n');
	const filteredLines: string[] = [];

	const parser = new DOMParser();

	lines.forEach((line) => {
		const doc = parser.parseFromString(line, 'text/html');
		const link = doc.querySelector('a');

		if (link) {
			const href = link.getAttribute('href') || '';

			// Handle youtubejs timestamps
			if (
				fallbackPatch === 'youtubejs' &&
				href.includes(`https://www.youtube.com/watch?v=${videoId}`)
			) {
				const url = new URL(href);
				const timeParam = url.searchParams.get('t') || '0';

				const timePretty = link.textContent?.trim() || '';
				const spans = doc.querySelectorAll('span');
				const title = spans.length > 1 ? spans[1].textContent?.trim() || '' : '';

				timestamps.push({
					time: convertToSeconds(timeParam.replace('s', '')),
					title: decodeHtmlCharCodes(title),
					timePretty,
					endTime: -1
				});
			}
			// Handle invidious-like timestamps
			else if (
				fallbackPatch !== 'youtubejs' &&
				link.hasAttribute('data-onclick') &&
				link.getAttribute('data-onclick') === 'jump_to_time'
			) {
				const timePretty = link.textContent?.trim() || '';
				const time = link.getAttribute('data-jump-time') || '0';

				// Get remaining text after the link for title
				const title = link.nextSibling?.textContent?.trim() || '';

				timestamps.push({
					time: convertToSeconds(time),
					title: decodeHtmlCharCodes(title),
					timePretty,
					endTime: -1
				});
			}
			// Normal link, modify to not use youtube redirect
			else {
				const modifiedLine = processYoutubeLink(line).replace(
					/<a href="([^"]+)"/,
					'<a href="$1" target="_blank" rel="noopener noreferrer" class="link"'
				);
				filteredLines.push(modifiedLine);
			}
		} else {
			filteredLines.push(line);
		}
	});

	// Set endTime for each timestamp
	timestamps.forEach((ts, idx) => {
		ts.endTime = idx < timestamps.length - 1 ? timestamps[idx + 1].time : -1;
	});

	const filteredContent = filteredLines.join('\n');

	return { description: filteredContent, timestamps };
}
