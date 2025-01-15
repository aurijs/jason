
export interface TestUser {
	id: string;
	name: string;
	email: string;
	age: number;
}

export interface TestPost {
	id: string;
	title: string;
	content: string;
	authorId: string;
}

export interface TestCollections {
	users: TestUser[];
	posts: TestPost[];
}
