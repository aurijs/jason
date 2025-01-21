import { batchDepth } from "./batch.js";
import { activeEffect, effectStack, setActiveEffect } from "./effect.js";
import { UNINITIALIZED } from "./symbols.js";
import type { Equals, Reaction, Value } from "./types.js";

const enum Flags {
	DIRTY = 1 << 0, // 1 - Value needs to be recomputed
	RUNNING = 1 << 1, // 2 - Computation is currently running
	ASYNC = 1 << 2, // 4 - It's an async derived function
	INITIALIZED = 1 << 3, // 8 - Initial value has been computed
	HAS_ERROR = 1 << 4, // 16 - Last computation resulted in an error
}

type DerivedFn<T> = () => T;

const derivedCache = new WeakMap<DerivedFn<any>, WeakRef<Derived<any>>>();

export class Derived<T> implements Value<T> {
	f = 0; // Bitmask flags for internal state tracking
	wv = 0; // Write version - incremented on value change
	rv = 0; // Read version - used to detect stale reads
	reactions: Reaction[] | null = null; // List of reactions to notify on change
	deps: Value[] | null = null; // List of dependencies for derived values
	v: T; // Current value

	#dirty = true;
	#lastComputedTime = 0;
	#computeCount = 0;
	#cacheThreshold = 100; // ms
	#promise: Promise<T> | null = null;
	#error: any = null;

	constructor(
		public fn: DerivedFn<T>,
		public equals: Equals<T> = Object.is,
	) {
		this.v = UNINITIALIZED as T;
		if (fn.constructor.name === "AsyncFunction") {
			this.f |= Flags.ASYNC;
		}

		this.f |= Flags.DIRTY;

		if (!(this.f & Flags.ASYNC)) {
			this.#compute();
		} else {
			this.#computeAsync();
		}
	}

	#collectDependencies() {
		if (this.deps) {
			for (const dep of this.deps) {
				if (dep.reactions) {
					const index = dep.reactions.findIndex(
						(r) => r.fn === this.#handleDependencyChange,
					);
					if (index === -1) {
						dep.reactions.splice(index, 1);
					}
				}
			}
		}

		this.deps = [];
	}

	#handleDependencyChange() {
		if (!(this.f & Flags.DIRTY)) {
			this.f |= Flags.DIRTY;
			this.wv++;
		}

		if (this.reactions && batchDepth === 0) {
			for (const reaction of this.reactions) {
				if (reaction.fn) {
					try {
						reaction.fn();
					} catch (error) {
						console.error("Effect Error:", error);
					}
				}
			}
		}
	}

	async #computeAsync() {
		if (this.f & Flags.RUNNING) {
			return this.#promise;
		}

		this.f |= Flags.RUNNING;
		const start = performance.now();

		const prevEffect = activeEffect;
		const reaction: Reaction = {
			f: 0,
			wv: 0,
			fn: this.#handleDependencyChange,
			deps: null,
		};

		setActiveEffect(reaction);

		this.#collectDependencies();

		try {
			this.#promise = (async () => {
				try {
					const value = await this.fn();

					const computeTime = performance.now() - start;
					this.#updateComputationStats(computeTime);

					if (!this.equals(this.v, value)) {
						this.v = value;
						this.wv++;
						this.#notifyReactions();
					}

					this.f &= ~Flags.DIRTY;
					this.f |= Flags.INITIALIZED;
					this.f &= ~Flags.HAS_ERROR;

					return value;
				} catch (error) {
					this.#error = error;
					this.f |= Flags.HAS_ERROR;
					throw error;
				} finally {
					this.f &= ~Flags.RUNNING;
				}
			})();

			return await this.#promise;
		} finally {
			setActiveEffect(prevEffect);
		}
	}

	#compute() {
		if (this.f & Flags.RUNNING) {
			throw new Error("Circular dependency detected");
		}

		this.f |= Flags.RUNNING;
		const start = performance.now();

		const prevEffect = activeEffect;
		const reaction: Reaction = {
			f: 0,
			wv: 0,
			fn: this.#handleDependencyChange,
			deps: null,
		};

		setActiveEffect(reaction);
		this.#collectDependencies();

		try {
			const value = this.fn() as T;
			const computeTime = performance.now() - start;
			this.#updateComputationStats(computeTime);

			if (!this.equals(this.v, value)) {
				this.v = value;
				this.wv++;
			}

			this.f &= ~Flags.DIRTY;
			this.f |= Flags.INITIALIZED;
			this.f &= ~Flags.HAS_ERROR;
			return value;
		} catch (error) {
			this.#error = error;
			this.f |= Flags.HAS_ERROR;
			throw error;
		} finally {
			this.f &= ~Flags.RUNNING;
			setActiveEffect(prevEffect);
		}
	}

	#updateComputationStats(computeTime: number) {
		this.#computeCount++;
		if (this.#computeCount > 10) {
			this.#cacheThreshold = Math.max(50, computeTime * 2);
		}
		this.#lastComputedTime = Date.now();
	}

	#notifyReactions() {
		if (this.reactions && batchDepth === 0) {
			for (const reaction of this.reactions) {
				if (reaction.fn) {
					try {
						reaction.fn();
					} catch (error) {
						console.error("Reaction Error:", error);
					}
				}
			}
		}
	}

	get() {
		this.rv++;

		if (activeEffect) {
			if (!this.reactions) {
				this.reactions = [];
			}

			if (!this.reactions.includes(activeEffect)) {
				this.reactions.push(activeEffect);
			}
		}

		if (this.f & Flags.ASYNC) {
			if (!(this.f & Flags.INITIALIZED)) {
				throw new Error("Async Derived value is not yet initialized");
			}

			if (this.f & Flags.HAS_ERROR) {
				throw this.#error;
			}
		}

		if (
			this.f & Flags.DIRTY &&
			Date.now() - this.#lastComputedTime > this.#cacheThreshold
		) {
			if (this.f & Flags.ASYNC) {
				this.#computeAsync();
			} else {
				this.#compute();
			}
		}

		return this.v;
	}


	[Symbol.toPrimitive]() {
		return this.get();
	}

	toString() {
		return String(this.get());
	}

	valueOf() {
		return this.get();
	}
}

export function derived<T>(fn: DerivedFn<T>) {
	let cachedDerived = derivedCache.get(fn)?.deref() as Derived<T> | undefined;
	if (!cachedDerived) {
		cachedDerived = new Derived(fn);
		derivedCache.set(fn, new WeakRef(cachedDerived));
	}

	const proxy = new Proxy(cachedDerived, {
		get(target, prop) {
			if (
				prop === Symbol.toPrimitive ||
				prop === "valueOf" ||
				prop === "toString"
			) {
				return (target as any)[prop].bind(target);
			}

			return target.get();
		},
	});

	return proxy as T;
}
