import type { EffectFn, Reaction } from "./types.js";

export let activeEffect: Reaction | null = null;
export const effectStack: Reaction[] = [];

export function setActiveEffect(effect: Reaction | null) {
	activeEffect = effect;
}

export async function effect(fn: EffectFn) {
	const reaction: Reaction = {
		f: 0,
		wv: 0,
		fn,
		deps: null,
	};

	const execute = async () => {
		effectStack.push(reaction);
		activeEffect = reaction;

		try {
			await Promise.resolve(fn());
		} finally {
			activeEffect = effectStack.pop() ?? null;
		}
	};

	await execute();

	// Retorna uma função de cleanup
	return () => {
		reaction.fn = null;
		reaction.deps = null;
	};
}
