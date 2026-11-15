import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isCurrentInvidiousSession, isRejectedInvidiousSession } from './session.ts';

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

test('a response cannot change a replaced session, instance, or backend', () => {
	const auth = { username: 'user', token: 'old' };
	const instance = 'https://example.com';
	assert.equal(isCurrentInvidiousSession(auth, instance, auth, instance, true), true);
	assert.equal(isCurrentInvidiousSession(auth, instance, { ...auth }, instance, true), false);
	assert.equal(isCurrentInvidiousSession(auth, instance, null, instance, true), false);
	assert.equal(
		isCurrentInvidiousSession(auth, instance, auth, 'https://other.example', true),
		false
	);
	assert.equal(isCurrentInvidiousSession(auth, instance, auth, instance, false), false);
});
