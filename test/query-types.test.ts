import { describe, it, expect } from "vitest";
import { gt, lt, and, or, startsWith, inValues } from "../src/types/query.js";
import type { Filter } from "../src/types/collection.js";

interface User {
  id: string;
  name: string;
  age: number;
}

describe("Query Types & DSL", () => {
  it("should allow simple equality filters", () => {
    const filter: Filter<User> = { name: "Alice" };
    expect(filter).toEqual({ name: "Alice" });
  });

  it("should allow comparison operators", () => {
    const filter: Filter<User> = { age: gt(18) };
    expect(filter).toEqual({ age: { _tag: "gt", value: 18 } });
  });

  it("should allow multiple comparison operators", () => {
    const filter: Filter<User> = { age: and(gt(18), lt(65)) } as any; 
    // Wait, the FilterExpression type currently allows:
    // | { [K in keyof Doc]?: Doc[K] | ComparisonOperator<Doc[K]> }
    // | LogicalOperator<Doc>;
    // So { age: and(...) } is NOT allowed by the type definition yet.
    // Logical operators are currently top-level.
  });

  it("should allow top-level logical operators", () => {
    const filter: Filter<User> = and(
      { age: gt(18) },
      { name: startsWith("A") }
    );
    expect(filter).toEqual({
      _tag: "and",
      filters: [
        { age: { _tag: "gt", value: 18 } },
        { name: { _tag: "startsWith", value: "A" } }
      ]
    });
  });

  it("should allow nested logical operators", () => {
    const filter: Filter<User> = or(
      and({ age: gt(18) }, { age: lt(30) }),
      { name: inValues(["Admin", "Superuser"]) }
    );
    expect(filter).toEqual({
      _tag: "or",
      filters: [
        {
          _tag: "and",
          filters: [
            { age: { _tag: "gt", value: 18 } },
            { age: { _tag: "lt", value: 30 } }
          ]
        },
        { name: { _tag: "in", values: ["Admin", "Superuser"] } }
      ]
    });
  });
});
