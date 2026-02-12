import { getInnertube } from '.';
import type { ResolvedUrl } from '../model';

export async function getResolveUrlYTjs(url: string): Promise<ResolvedUrl> {
	const innertube = await getInnertube();

	const resloved = await innertube.resolveURL(url);

	return {
		pageType: resloved.metadata.page_type ?? '',
		params: '',
		ucid: resloved.metadata.url ? resloved.metadata.url?.split('/')[2] : ''
	};
}
