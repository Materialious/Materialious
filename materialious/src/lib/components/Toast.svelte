<script lang="ts" module>
	export interface ToastAction {
		icon?: string;
		text?: string;
		action: (event: MouseEvent) => void;
	}

	export interface ToastData {
		text: string;
		icon?: string;
		action?: ToastAction;
	}

	const toaster = new Toaster<ToastData>();

	export const addToast = toaster.addToast;
</script>

<script lang="ts">
	import { Toaster } from 'melt/builders';
	import { fly } from 'svelte/transition';
</script>

<div {...toaster.root} style:--toasts={toaster.toasts.length} popover="manual">
	{#each toaster.toasts as toast (toast.id)}
		<nav {...toast.content} in:fly={{ y: 60, opacity: 0.9 }} out:fly={{ y: 20 }}>
			<p {...toast.title}>
				{#if toast.data.icon}
					<i>{toast.data.icon}</i>
				{/if}
				{toast.data.text}
			</p>
			{#if toast.data.action}
				<button onclick={(event) => toast.data.action?.action(event)} aria-label="dismiss alert">
					{#if toast.data.action.icon}
						<i>{toast.data.action.icon}</i>
					{/if}
					{#if toast.data.action.text}
						<span>{toast.data.action.text}</span>
					{/if}
				</button>
			{/if}
		</nav>
	{/each}
</div>

<style>
	[data-melt-toaster-root] {
		--gap: 0.75rem;
		--hover-offset: 1rem;
		--toast-height: 4rem;
		--hidden-offset: 0.75rem;

		--hidden-toasts: calc(var(--toasts) - 1);

		overflow: visible;
		display: grid;
		grid-template-rows: var(--toast-height) repeat(var(--hidden-toasts), var(--hidden-offset));
		grid-template-columns: 1fr;
		gap: 0;
		background: unset;
		padding: 0;
	}

	[data-melt-toaster-toast-content]:nth-last-child(n + 4) {
		z-index: 1;
		scale: 0.925;
		opacity: 0;
		translate: 0 calc(-3 * var(--hidden-offset));
	}

	[data-melt-toaster-toast-content]:nth-last-child(-n + 3) {
		z-index: 2;
		scale: 0.95;
		translate: 0 calc(-2 * var(--hidden-offset));
	}

	[data-melt-toaster-toast-content]:nth-last-child(-n + 2) {
		z-index: 3;
		scale: 0.975;
		translate: 0 calc(-1 * var(--hidden-offset));
	}

	[data-melt-toaster-toast-content]:nth-last-child(-n + 1) {
		z-index: 4;
		scale: 1;
		translate: 0;
	}

	[data-melt-toaster-root]:hover [data-melt-toaster-toast-content] {
		scale: 1;
		opacity: 1;
		--toast-gap: calc(calc(var(--gap) * var(--n)) + var(--hover-offset));
		--percentage: calc(-100% * calc(var(--n) - 1));
		translate: 0 calc(var(--percentage) - var(--toast-gap));
	}

	[data-melt-toaster-toast-content] {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		inline-size: 80%;
		max-inline-size: 24rem;
		block-size: auto;
		z-index: 200;
		pointer-events: auto;
		display: flex;
		background-color: var(--surface-container-low);
		color: var(--on-surface);
		box-shadow: none;
		border: 0.0625rem solid var(--outline-variant);
		padding: 1rem;
		cursor: pointer;
		text-align: start;
		align-items: center;
		border-radius: 0.25rem;
		gap: 0.5rem;
	}

	@media (max-width: 640px) {
		[data-melt-toaster-toast-content] {
			left: 1rem;
			right: 1rem;
			bottom: 4.5rem;
			inline-size: auto;
			max-inline-size: none;
			border-radius: 0.5rem;
			padding: 1rem 1.25rem;
		}
	}
</style>
