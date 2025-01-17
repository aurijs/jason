import { source } from "./source.js";
import type { Source } from "./types.js";

export function proxy<T>(value: T) {

    const sources = new Map<unknown, Source<unknown>>();
    const isProxyArray = Array.isArray(value);
    const version = source(0);

    if (isProxyArray) {
        sources.set('length', source((value as unknown[]).length))
    }

    return new Proxy(value as object, {
        defineProperty(_, prop, descriptor) {
            if (!('value' in descriptor) ||
                descriptor.configurable === false ||
                descriptor.writable === false ||
                descriptor.enumerable === false
            ) {
                throw new Error('Invalid property descriptor');
            }

            let s = sources.get(prop);

            if(s === undefined) {
                s = source(descriptor.value);
                sources.set(prop, s);
            } else {
            }
            return true;
        }
    })
}