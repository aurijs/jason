/**
 * Represents a validation function type.
 *
 * @template T The type of data being validated.
 */
export type ValidationFunction<T> = (item: T) => boolean;
