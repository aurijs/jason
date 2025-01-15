import type { BaseDocument } from "../src/types";

interface TestUser extends BaseDocument {
	id: string;
	name: string;
	email: string;
	age: number;
}

export interface TestPost extends BaseDocument {
	id: string;
	title: string;
	content: string;
	authorId: string;
}

export interface TestCollections {
	users: TestUser[];
	posts: TestPost[];
}
