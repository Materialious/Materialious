export function DELETE({ cookies }) {
	cookies.delete('userid', { path: '/' });

	return new Response();
}
