export type PluginLifecycle =
	| "beforeCollectionCreate"
	| "afterCollectionCreate"
	| "beforeDocumentWrite"
	| "afterDocumentWrite"
	| "beforeDocumentRead"
	| "afterDocumentRead"
	| "beforeDocumentDelete"
	| "afterDocumentDelete";

/**
 * Represents a plugin type.
 *
 * @template T The type of data in the database.
 */
export interface Plugin<T = any> {
	name: string;
	lifecycle: Partial<
		Record<PluginLifecycle, (context: T) => Promise<void> | void>
	>;
}
