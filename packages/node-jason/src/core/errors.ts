export class MetadataPersistenceError extends Error {
	constructor(message: string, originalError?: Error) {
		super(message);
		this.name = "MetadataPersistenceError";
		if (originalError) {
			this.stack += `\nCaused by: ${originalError.stack}`;
		}
	}
}

export class DocumentNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DocumentNotFoundError";
	}
}

export class DeleteOperationError extends Error {
	originalError: unknown;

	constructor(message: string, originalError?: unknown) {
		super(message);
		this.name = "DeleteOperationError";
		this.originalError = originalError;
	}
}

export class QueryOperationError extends Error {
	originalError: unknown;

	constructor(message: string, originalError?: unknown) {
		super(message);
		this.name = "QueryOperationError";
		this.originalError = originalError;
	}
}
