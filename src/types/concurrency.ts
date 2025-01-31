/**
 * Represents the concurrency strategy of a JasonDB instance.
 *
 * The possible values are:
 * - "optimistic": The default strategy which will throw an error if the data has changed since the last read.
 * - "versioning": The strategy which will auto-increment a version number for each update and will throw an error if the version number has changed since the last read.
 * - "none": The strategy which will not check for concurrency at all.
 */
export type ConcurrencyStrategy = "optimistic" | "versioning" | "none";

/**
 * Represents information about a lock in a database.
 *
 * @property id The unique id of the lock.
 * @property timestamp The timestamp when the lock was acquired.
 * @property expiresAt The timestamp when the lock will expire.
 */
export interface LockInfo {
    id: string;
    timestamp: number;
    expiresAt: number;
}