export type Equals<T> = (a: T, b: T) => boolean;

export type EffectFn = (() => void) | (() => Promise<void>);

export interface Signal {
	/** Flags bitmask */
	f: number;
	/** Write version */
	wv: number;
}

export interface Value<V = unknown> extends Signal {
	v: V;
	reactions: Reaction[] | null;
	equals: Equals<V>;
	rv: number;
}

export interface Reaction extends Signal {
	fn: EffectFn | null;
	deps: Value[] | null;
}
