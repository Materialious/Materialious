import { env } from '$env/dynamic/public';

export function getPublicEnv(envName: string): string | undefined {
	const envValue = env[`PUBLIC_${envName}`] ?? import.meta.env[`VITE_${envName}`];
	if (envValue === '') return;
	return envValue;
}