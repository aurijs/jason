import { DESTROYED } from "./constants.js";
import { destroyDerived } from "./derived.js";
import { activeReaction, isDestroyingEffect, removeReactions, setActiveReaction, setIsDestroyingEffect, setSignalStatus } from "./runtime.js";
import type { Effect } from "./types.js";


export function destroyEffectChildren(signal: Effect) {
    let effect = signal.first;
    signal.first = signal.last = null;

    while (effect !== null) {
        const next = effect.next;
        destroyEffect(effect);
        effect = next;
    }
}

export function destroyEffectDeriveds(signal: Effect) {
    const deriveds = signal.deriveds;

    if (deriveds !== null) {
        signal.deriveds = null;

        for (let i = 0; i < deriveds.length; i += 1) {
            destroyDerived(deriveds[i]);
        }
    }
}

export function executeEffectTeardown(effect: Effect) {
    const teardown = effect.teardown;
    if (teardown !== null) {
        const previously_destroying_effect = isDestroyingEffect;
        const previous_reaction = activeReaction;
        setIsDestroyingEffect(true);
        setActiveReaction(null);
        try {
            teardown.call(null);
        } finally {
            setIsDestroyingEffect(previously_destroying_effect);
            setActiveReaction(previous_reaction);
        }
    }
}

export function unlinkEffect(effect: Effect) {
    const parent = effect.parent;
    const prev = effect.prev;
    const next = effect.next;

    if (prev !== null) prev.next = next;
    if (next !== null) next.prev = prev;

    if (parent !== null) {
        if (parent.first === effect) parent.first = next;
        if (parent.last === effect) parent.last = prev;
    }
}

export function destroyEffect(effect: Effect) {
    destroyEffectChildren(effect);
    destroyEffectDeriveds(effect);
    removeReactions(effect, 0);
    setSignalStatus(effect, DESTROYED);

    executeEffectTeardown(effect);

    const parent = effect.parent;

    if (parent !== null && parent.first !== null) {
        unlinkEffect(effect);
    }


    // `first` and `child` are nulled out in destroy_effect_children
    // we don't null out `parent` so that error propagation can work correctly
    effect.next =
        effect.prev =
        effect.teardown =
        effect.deps =
        effect.fn =
        null;
}

