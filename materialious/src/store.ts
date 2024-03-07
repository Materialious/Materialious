import { persisted } from 'svelte-persisted-store';

export const invidiousInstance = persisted('invidiousInstance', import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE);
export const returnYTDislikesInstance = persisted('returnYTDislikesInstance', import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE);