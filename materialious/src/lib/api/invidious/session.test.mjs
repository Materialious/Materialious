import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isRejectedInvidiousSession } from './session.ts';

test('only known Invidious credential failures reject a session', () => {
	for (const message of [
		'Request must be authenticated',
		'Token is expired, please try again',
		'Invalid signature'
	]) {
		assert.equal(isRejectedInvidiousSession(403, message), true);
		assert.equal(isRejectedInvidiousSession(500, message), false);
	}
	for (const message of ['Invalid scope', 'Internal server error', '', undefined]) {
		assert.equal(isRejectedInvidiousSession(403, message), false);
	}
});
