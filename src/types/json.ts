export type Stringified<ObjType> = string & { source: ObjType };

type JsonifiedValue<T> = T extends string | number | null | boolean
  ? T
  : T extends { toJSON(): infer R }
    ? R
    : T extends undefined | ((...args: any[]) => any)
      ? never
      : T extends object
        ? JsonifiedObject<T>
        : never;

export type JsonifiedObject<T> = {
  [K in keyof T as [JsonifiedValue<T[K]>] extends [never]
    ? never
    : K]: JsonifiedValue<T[K]>;
};
