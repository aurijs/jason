/**
 * Represents a query options type.
 *
 */
export interface QueryOptions {
	/**
	 * The limit of the query.
	 */
	limit?: number;
	/**
	 * The offset of the query.
	 */
	offset?: number;
	/**
	 * The order by field of the query.
	 */
	orderBy?: string;
	/**
	 * The order of the query.
	 */
	order?: "asc" | "desc";
}

/**
 * Represents a partial query options type.
 *
 * @see QueryOptions
 */
export type QueryOptionsPartial = Partial<QueryOptions>;
