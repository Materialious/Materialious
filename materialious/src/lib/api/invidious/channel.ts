import type { ChannelContent, ChannelOptions, ChannelPage } from '../model';
import { buildPath, fetchErrorHandle } from './request';

export async function getChannelInvidious(
	channelId: string,
	fetchOptions?: RequestInit
): Promise<ChannelPage> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath(`channels/${channelId}`), fetchOptions)
	);
	return await resp.json();
}

export async function getChannelContentInvidious(
	channelId: string,
	options: ChannelOptions,
	fetchOptions?: RequestInit
): Promise<ChannelContent> {
	const url = buildPath(`channels/${channelId}/${options.type}`);

	if (typeof options.continuation !== 'undefined')
		url.searchParams.set('continuation', options.continuation);

	if (typeof options.sortBy !== 'undefined') url.searchParams.set('sort_by', options.sortBy);

	const resp = await fetchErrorHandle(await fetch(url.toString(), fetchOptions));
	return await resp.json();
}

export async function searchChannelContentInvidious(
	channelId: string,
	search: string,
	fetchOptions?: RequestInit
): Promise<ChannelContent> {
	const path = buildPath(`channel/${channelId}/search`);
	path.searchParams.set('q', search);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}
