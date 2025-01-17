
export interface Signal {
	/** Flags bitmask */
	f: number;
	/** Write version */
	wv: number;
}

export type Equals = (this: Value, value: unknown) => boolean;
export type Source<V = unknown> = Value<V>;

export interface Value<V = unknown> extends Signal {
	/** Equality function */
	equals: Equals;
	/** Signals that read from this signal */
	reactions: null | Reaction[];
	/** Read version */
	rv: number;
	/** The latest value for this signal */
	v: V;
	/** Dev only */
	created?: Error | null;
	updated?: Error | null;
	trace_need_increase?: boolean;
	trace_v?: V;
	debug?: null | (() => void);
}

export interface Reaction extends Signal {
	/** The reaction function */
	fn: null | (() => void);
	/** Signals that this signal reads from */
	deps: null | Value[];
}

export interface Effect extends Reaction {
	/** Reactions created inside this signal */
	deriveds: null | Derived[];
	/** The effect function */
	fn: null | (() => undefined | (() => void));
	/** The teardown function returned from the effect function */
	teardown: null | (() => void);
	/** Next sibling child effect created inside the parent signal */
	prev: null | Effect;
	/** Next sibling child effect created inside the parent signal */
	next: null | Effect;
	/** First child effect created inside this signal */
	first: null | Effect;
	/** Last child effect created inside this signal */
	last: null | Effect;
	/** Parent effect */
	parent: Effect | null;
	/** Dev only */
	component_function?: unknown;
}

export interface Derived<V = unknown> extends Value<V>, Reaction {
	/** The derived function */
	fn: () => V;
	/** Reactions created inside this signal */
	children: null | Reaction[];
	/** Parent effect or derived */
	parent: Effect | Derived | null;
}