import { CLEAN, DERIVED, DESTROYED, MAYBE_DIRTY, UNOWNED } from "./constants.js";
import { destroyEffect } from "./effect.js";
import { activeEffect, removeReactions, setActiveEffect, setSignalStatus } from "./runtime.js";
import type { Derived, Effect, Value } from "./types.js";

export function updateDerived(derived: Derived) {
    const value = executeDerived(derived);
    const status =
        (skip_reaction || (derived.f & UNOWNED) !== 0) && derived.deps !== null ? MAYBE_DIRTY : CLEAN;

    set_signal_status(derived, status);

    if (!derived.equals(value)) {
        derived.v = value;
        derived.wv = increment_write_version();
    }
}

function getDerivedParentEffect(derived: Derived) {
    let parent = derived.parent;
    while (parent !== null) {
        if ((parent.f & DERIVED) === 0) {
            return (parent as Effect);
        }
        parent = parent.parent;
    }
    return null;
}

export function destroyDerived(derived: Derived) {
	destroyDerivedChildren(derived);
	removeReactions(derived, 0);
	setSignalStatus(derived, DESTROYED);

	derived.v = derived.children = derived.deps = derived.reactions = null;
}

function destroyDerivedChildren(derived: Derived) {
    const children = derived.children;

    if (children !== null) {
        derived.children = null;

        for (let i = 0; i < children.length; i += 1) {
            const child = children[i];
            if ((child.f & DERIVED) !== 0) {
                destroyDerived((child as Derived));
            } else {
                destroyEffect((child as Effect));
            }
        }
    }
}

export function executeDerived<T>(derived: Derived) {
    let value: Value;
    const prevActiveEffect = activeEffect;

    setActiveEffect(getDerivedParentEffect(derived));

    try {
        destroyDerivedChildren(derived);
        value = updateReaction(derived);
    } finally {
        setActiveEffect(prevActiveEffect);
    }

    return value;
}