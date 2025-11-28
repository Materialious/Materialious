import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export async function load({ params }) {
	goto(resolve('/watch/[videoId]', { videoId: params.slug }));
}
