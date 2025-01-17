import { CLEAN, DERIVED, DIRTY, INSPECT_EFFECT, MAYBE_DIRTY, UNOWNED } from "./constants.js";
import { handleError } from "./errors.js";
import type { Effect, Equals, Signal, Source, Value } from "./types.js";

function equals(this: Value, value: Value) {
    return value === this.v;
}

const inspectEffects = new Set()

export function source<T>(v: T) {
    const signal: Value<T> = {
        f: 0,
        v,
        reactions: null,
        equals: equals as Equals,
        rv: 0,
        wv: 0,
    }

    return signal as Source<T>;
}

let writeVersion = 1;
function incrementWriteVersion() {
    return ++writeVersion;
}

export function set<T>(source: Source<T>, value: T) {
    return internalSet(source, value);
}

function internalSet<T>(source: Source<T>, value: T) {
    if (!source.equals(value)) {
        const oldVal = source.v;
        source.wv = incrementWriteVersion();
    }
}


// Used for handling scheduling
let isMicroTaskQueued = false;



let isFlushingEffect = false;
function flushQueuedRootEffect(rootEffects: Effect[]) {
    const length = rootEffects.length;
    if (length === 0) { return }

    let previouslyFlushingEffect = isFlushingEffect;
    isFlushingEffect = true;

    try {
        for (let i = 0; i < length; i++) {
            const effect = rootEffects[i];

            if ((effect.f & CLEAN) === 0) {
                effect.f ^= CLEAN;
            }

            /** @type {Effect[]} */
            const collectedEffects: Effect[] = [];

            process_effects(effect, collected_effects);
            flushQueuedEffects(collected_effects);
        }
    } finally {
        is_flushing_effect = previously_flushing_effect;
    }
}

let lastScheduledEffect: Effect | null = null;
function infiniteLoopGuard() {
    if (flushCount > 1000) {
        flushCount = 0;

        try {
            throw new Error('loop length reached');
        } catch (error) {
            if (lastScheduledEffect !== null) {
                handleError(error, lastScheduledEffect, null);
            } else {
                throw error;
            }
        }
    }
}

function markReactions(signal: Value, status: number) {
    const reactions = signal.reactions;
    if (reactions === null) return;

    const length = reactions.length;

    for (let i = 0; i < length; i++) {
        const reaction = reactions[i];
        const flags = reaction.f;

        if ((flags & DIRTY) !== 0) continue;

        if ((flags & INSPECT_EFFECT) !== 0) {
            inspectEffects.add(reaction);
        }

        setSignalStatus(reaction, status);

        if ((flags & (CLEAN | UNOWNED)) !== 0) {
            if ((flags & DERIVED) !== 0) {
                markReactions((reaction), MAYBE_DIRTY);
            } else {
                scheduleEffect((reaction));
            }
        }
    }
}