import madge from "madge";
import path from "node:path";

const main_file = path.resolve("src/index.ts");
const static_dir = path.resolve("static", "graph.svg");
const res = await madge(main_file);
await res.image(static_dir);
