import { BOUNDARY_EFFECT, DESTROYED } from "./constants.js";
import type { Effect } from "./types.js";

const handledErrors = new WeakSet<Error>();
export let isThrowingError = false;

function propagateError(error: unknown, effect: Effect) {
	let current: Effect | null = effect;

	while (current !== null) {
		if ((current.f & BOUNDARY_EFFECT) !== 0) {
			try {
                // @ts-ignore
				current.fn?.(error);
				return;
			} catch {
				// Remove boundary flag from effect
				current.f ^= BOUNDARY_EFFECT;
			}
		}

		current = current.parent;
	}

	isThrowingError = false;
	throw error;
}

function shouldRethrowError(effect: Effect) {
    return (
        (effect.f & (DESTROYED)) === 0 &&
        (effect.parent === null || (effect.parent.f & (BOUNDARY_EFFECT)) === 0)
    )
}

export function handleError(error: unknown, effect: Effect, previousEffect: Effect | null) {
    if (isThrowingError) {
        if (previousEffect === null) {
            isThrowingError = false;
        }

        if (shouldRethrowError(effect)) {
            throw error;
        }

        return;
    }

    if (previousEffect !== null) {
        isThrowingError = true;
    }

    if (
        !(error instanceof Error) ||
        handledErrors.has(error)
    ) {
        propagateError(error, effect);
        return;
    }

    handledErrors.add(error);

    propagateError(error, effect);

    if (shouldRethrowError(effect)) {
        throw error;
    }
}