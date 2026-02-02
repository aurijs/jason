export type ComparisonOperator<T> =
  | { _tag: "eq"; value: T }
  | { _tag: "ne"; value: T }
  | { _tag: "gt"; value: T }
  | { _tag: "gte"; value: T }
  | { _tag: "lt"; value: T }
  | { _tag: "lte"; value: T }
  | { _tag: "in"; values: T[] }
  | { _tag: "nin"; values: T[] }
  | { _tag: "startsWith"; value: string }
  | { _tag: "regex"; pattern: string; flags?: string | undefined };

export type LogicalOperator<Doc> =
  | { _tag: "and"; filters: FilterExpression<Doc>[] }
  | { _tag: "or"; filters: FilterExpression<Doc>[] }
  | { _tag: "not"; filter: FilterExpression<Doc> };

export type FilterExpression<Doc> =
  | { [K in keyof Doc]?: Doc[K] | ComparisonOperator<Doc[K]> }
  | LogicalOperator<Doc>;

// Helper functions for creating operators
export const eq = <T>(value: T): ComparisonOperator<T> => ({
  _tag: "eq",
  value
});
export const ne = <T>(value: T): ComparisonOperator<T> => ({
  _tag: "ne",
  value
});
export const gt = <T>(value: T): ComparisonOperator<T> => ({
  _tag: "gt",
  value
});
export const gte = <T>(value: T): ComparisonOperator<T> => ({
  _tag: "gte",
  value
});
export const lt = <T>(value: T): ComparisonOperator<T> => ({
  _tag: "lt",
  value
});
export const lte = <T>(value: T): ComparisonOperator<T> => ({
  _tag: "lte",
  value
});
export const inValues = <T>(values: T[]): ComparisonOperator<T> => ({
  _tag: "in",
  values
});
export const ninValues = <T>(values: T[]): ComparisonOperator<T> => ({
  _tag: "nin",
  values
});
export const startsWith = (value: string): ComparisonOperator<string> => ({
  _tag: "startsWith",
  value
});
export const regex = (
  pattern: string,
  flags?: string
): ComparisonOperator<string> => ({ _tag: "regex", pattern, flags });

export const and = <Doc>(
  ...filters: FilterExpression<Doc>[]
): LogicalOperator<Doc> => ({ _tag: "and", filters });
export const or = <Doc>(
  ...filters: FilterExpression<Doc>[]
): LogicalOperator<Doc> => ({ _tag: "or", filters });
export const not = <Doc>(
  filter: FilterExpression<Doc>
): LogicalOperator<Doc> => ({ _tag: "not", filter });
