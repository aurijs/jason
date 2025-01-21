import type { Value } from "./types.js";

// Batch updates
export let batchDepth = 0;
export const batchQueue = new Set<Value>();

export function setBatchDepth(value: number) {
	batchDepth = value;
}

export function batch<T>(fn: () => T): T {
	batchDepth++;
	try {
		const result = fn();
		batchDepth--;

		if (batchDepth === 0 && batchQueue.size > 0) {
			const values = Array.from(batchQueue);
			batchQueue.clear();

			for (const value of values) {
				if (value.reactions) {
					for (const reaction of value.reactions) {
						reaction.fn?.();
					}
				}
			}
		}

		return result;
	} catch (error) {
		batchDepth--;
		batchQueue.clear();
		throw error;
	}
}
