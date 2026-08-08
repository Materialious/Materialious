export function sanitizeFilename(title: string): string {
	const cleaned = title
		.replace(/[^\p{L}\p{N}._ -]+/gu, '_')
		.replace(/[._ ]+/g, ' ')
		.trim()
		.replace(/[. ]+$/, '')
		.replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])($|\.)/i, '_$2');
	return cleaned || 'video';
}
