import { JasonDB } from "./src/index";

interface User {
	name: string;
	age: number;
}

interface Database {
	user: User[];
}

const db = new JasonDB<Database>();

const user = db.collection("user");

console.log("Start", user);

const John = await user.create({
	age: 20,
	name: "John Doe",
});

console.log("End", await user.has(John.id));

