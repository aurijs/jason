import { describe, it, expect } from "vitest";
import { evaluateFilter } from "../src/make/query.js";
import { gt, lt, and, or, not, startsWith, inValues, regex, ne, gte, lte, ninValues } from "../src/types/query.js";

describe("Query Engine - evaluateFilter", () => {
  const doc = { id: "1", name: "Alice", age: 30, email: "alice@example.com" };

  it("should match simple equality", () => {
    expect(evaluateFilter(doc, { name: "Alice" })).toBe(true);
    expect(evaluateFilter(doc, { name: "Bob" })).toBe(false);
  });

  it("should match comparison operators", () => {
    expect(evaluateFilter(doc, { age: gt(25) })).toBe(true);
    expect(evaluateFilter(doc, { age: gt(35) })).toBe(false);
    expect(evaluateFilter(doc, { age: gte(30) })).toBe(true);
    expect(evaluateFilter(doc, { age: lt(35) })).toBe(true);
    expect(evaluateFilter(doc, { age: lte(30) })).toBe(true);
    expect(evaluateFilter(doc, { name: ne("Bob") })).toBe(true);
  });

  it("should match set operators", () => {
    expect(evaluateFilter(doc, { name: inValues(["Alice", "Bob"]) })).toBe(true);
    expect(evaluateFilter(doc, { name: inValues(["Bob", "Charlie"]) })).toBe(false);
    expect(evaluateFilter(doc, { name: ninValues(["Bob", "Charlie"]) })).toBe(true);
  });

  it("should match string operators", () => {
    expect(evaluateFilter(doc, { email: startsWith("alice") })).toBe(true);
    expect(evaluateFilter(doc, { email: startsWith("bob") })).toBe(false);
    expect(evaluateFilter(doc, { email: regex("example\\.com$") })).toBe(true);
    expect(evaluateFilter(doc, { email: regex("^bob") })).toBe(false);
  });

  it("should match logical operators", () => {
    expect(evaluateFilter(doc, and({ age: gt(25) }, { name: "Alice" }))).toBe(true);
    expect(evaluateFilter(doc, and({ age: gt(35) }, { name: "Alice" }))).toBe(false);
    
    expect(evaluateFilter(doc, or({ age: gt(35) }, { name: "Alice" }))).toBe(true);
    expect(evaluateFilter(doc, or({ age: gt(35) }, { name: "Bob" }))).toBe(false);

    expect(evaluateFilter(doc, not({ name: "Bob" }))).toBe(true);
    expect(evaluateFilter(doc, not({ name: "Alice" }))).toBe(false);
  });
});
