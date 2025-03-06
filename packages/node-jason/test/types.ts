export interface TestUser {
  id?: string;
  name: string;
  email: string;
  age: number;
}

export interface TestPost {
  id?: string;
  title?: string;
  content?: string;
  authorId?: string;
  tags?: string[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  inStock?: boolean;
}

interface Order {
  id: string;
  customer: { name: string; address: { city: string } };
  total: number;
}

interface Log {
  id: string;
  message?: string;
  severity?: string;
}

interface Event {
  name: string;
  date: number;
}

interface Book {
  id: string;
  title: string;
  author: string;
}

export interface TestCollections {
  users: TestUser[];
  posts: TestPost[];
  products: Product[];
  orders: Order[];
  events: Event[];
  books: Book[];
  logs: Log[];
}
