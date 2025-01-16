interface IObserver {
    depend(): void;
    notify(): void;
    cleanup(): void;
}

type EffectFn = (() => void | Promise<void>);
type Cleanup = () => void;
type DerivedFn<T> = () => T;
type ObserverMap = Map<string | symbol, Observer>;

// Batch updates
let batchDepth = 0;
const batchQueue = new Set<Observer>();

// Otimização: WeakRef para cache de objetos proxy
const proxyCache = new WeakMap<object, WeakRef<any>>();
const derivedCache = new WeakMap<DerivedFn<any>, WeakRef<Derived<any>>>();

// Otimização: Object pool para observers
class ObserverPool {
    private static pool: Observer[] = [];
    private static MAX_POOL_SIZE = 1000;

    static acquire(): Observer {
        return this.pool.pop() || new Observer();
    }

    static release(observer: Observer) {
        observer.cleanup();
        if (this.pool.length < this.MAX_POOL_SIZE) {
            this.pool.push(observer);
        }
    }
}

let activeEffect: EffectFn | null = null;
let effectStack: EffectFn[] = [];

class Observer implements IObserver {
    #subscribers = new Set<EffectFn>();

    depend() {
        if (activeEffect) {
            this.#subscribers.add(activeEffect);
        }
    }

    notify() {
        if (batchDepth > 0) {
            batchQueue.add(this);
            return;
        }

        // Otimização: Usar array estático para iteração
        const subsArray = Array.from(this.#subscribers);
        for (let i = 0; i < subsArray.length; i++) {
            try {
                subsArray[i]();
            } catch (error) {
                console.error('Effect error:', error);
            }
        }
    }

    cleanup() {
        this.#subscribers.clear();
    }
}

class Derived<T> {
    private value: T;
    private dirty = true;
    private observer: Observer;
    private cleanup: Cleanup | null = null;
    private lastComputedTime = 0;
    private computeCount = 0;

    // Otimização: Cache threshold adaptativo
    private cacheThreshold = 100; // ms

    constructor(private fn: DerivedFn<T>) {
        this.observer = ObserverPool.acquire();
        this.value = this.compute();
    }

    private compute(): T {
        const start = performance.now();
        this.dirty = false;

        if (this.cleanup) {
            this.cleanup();
            this.cleanup = null;
        }

        const updateEffect = () => {
            this.dirty = true;
            this.observer.notify();
        };

        effectStack.push(activeEffect!);
        activeEffect = updateEffect;

        try {
            const value = this.fn();

            // Otimização: Ajusta threshold baseado no tempo de computação
            const computeTime = performance.now() - start;
            this.computeCount++;
            if (this.computeCount > 10) {
                this.cacheThreshold = Math.max(50, computeTime * 2);
            }

            this.lastComputedTime = Date.now();
            return value;
        } finally {
            activeEffect = effectStack.pop() ?? null;
        }
    }

    get(): T {
        this.observer.depend();

        // Otimização: Skip recompute se dentro do threshold
        if (this.dirty && Date.now() - this.lastComputedTime > this.cacheThreshold) {
            this.value = this.compute();
        }

        return this.value;
    }
}

// Batch updates API
export function batch<T>(fn: () => T): T {
    batchDepth++;
    try {
        const result = fn();
        batchDepth--;

        if (batchDepth === 0 && batchQueue.size > 0) {
            const uniqueObservers = Array.from(batchQueue);
            batchQueue.clear();
            for (const observer of uniqueObservers) {
                observer.notify();
            }
        }

        return result;
    } catch (error) {
        batchDepth--;
        batchQueue.clear();
        throw error;
    }
}

// Otimização: Função para criar proxy com cache
function createProxy<T extends object>(
    target: T,
    handler: ProxyHandler<T>,
): T {
    let proxyRef = proxyCache.get(target);
    let proxy = proxyRef?.deref();

    if (!proxy) {
        proxy = new Proxy(target, handler);
        proxyCache.set(target, new WeakRef(proxy));
    }

    return proxy;
}

export function derived<T>(fn: DerivedFn<T>): { readonly value: T } {
    let derivedRef = derivedCache.get(fn);
    let derived = derivedRef?.deref();

    if (!derived) {
        derived = new Derived(fn);
        derivedCache.set(fn, new WeakRef(derived));
    }

    return {
        get value() {
            return derived!.get();
        }
    };
}

class ReactiveMap<K, V> extends Map<K, V> {
    #observer: Observer;

    constructor(entries?: readonly (readonly [K, V])[] | null) {
        super(entries);
        this.#observer = ObserverPool.acquire();
    }

    get size() {
        this.#observer.depend();
        return super.size;
    }

    set(key: K, value: V) {
        const result = super.set(key, value);
        this.#observer.notify();
        return result;
    }

    delete(key: K) {
        const result = super.delete(key);
        if (result) this.#observer.notify();
        return result;
    }

    clear() {
        const size = this.size;
        super.clear();
        if (size > 0) this.#observer.notify();
    }
}


export function state<T extends Record<string | symbol, any>>(
    obj: T,
    options: { proxyMethods?: boolean } = {}
): T {
    const handler: ProxyHandler<T> = {
        get(target: T, key: string | symbol, receiver: any) {
            const observer = ObserverPool.acquire();
            observer.depend();

            const value = Reflect.get(target, key, receiver);

            if (options.proxyMethods && typeof value === 'object' && value !== null && (value as any) instanceof Map) {
                const mapValue = value as Map<any, any>;
                if (typeof (mapValue as any)[key] === 'function') {
                    return (mapValue as any)[key].bind(mapValue);
                }
            }

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return createProxy(value, handler);
            }

            return value;
        },

        set(target: T, key: string | symbol, value: any, receiver: any) {
            const previousValue = Reflect.get(target, key, receiver);

            if (Object.is(previousValue, value)) {
                return true;
            }

            const result = Reflect.set(target, key, value, receiver);

            if (result) {
                const observer = ObserverPool.acquire();
                observer.notify();
            }

            return result;
        }
    };

    return createProxy(obj, handler);
}

const observers = new WeakMap<object, ObserverMap>();
export async function effect(fn: EffectFn) {
    const execute = async () => {
        effectStack.push(activeEffect!);
        activeEffect = fn;

        try {
            await Promise.resolve(fn());
        } catch (error) {
            console.error('Effect execution error:', error);
        } finally {
            activeEffect = effectStack.pop() ?? null;
        }
    };

    await execute();

    // Retorna uma função de cleanup
    return () => {
        const deps = observers.get(fn);
        if (deps) {
            deps.forEach(observer => observer.cleanup());
            observers.delete(fn);
        }
    };
}