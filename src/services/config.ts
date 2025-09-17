import { Context, type Effect, type Schema } from "effect";
import type { IndexDefinition } from "../types/metadata.js";

// A interface that define the "capacities" of our config service
export interface IConfigService {
  /** @return the database path */
  readonly getBasePath: Effect.Effect<string, never>;

  /** @return the list of all collection names */
  readonly getCollectionNames: Effect.Effect<string[], never>;

  /**
   * @param collection_name - The name of the collection
   * @return The full path for a specific collection
   */
  readonly getCollectionPath: (
    collection_name: string
  ) => Effect.Effect<string, never>;

  /**
   * @param collection_name - The name of the collection
   * @return The path for the indexes directory of a collecition
   */
  readonly getIndexPath: (
    collection_name: string
  ) => Effect.Effect<string, never>;

  /**
   * @param collection_name - The name of the collection
   * @return The schema of a specific collection
   */
  readonly getCollectionSchema: (
    collection_name: string
  ) => Effect.Effect<
    Schema.Struct<Record<string, Schema.Schema<any, any>>>,
    never
  >;

  /**
   * @param collection_name - The name of the collection
   * @return The parsed index definition of a collection
   */
  readonly getIndexDefinitions: (
    collection_name: string
  ) => Effect.Effect<Record<string, IndexDefinition>, never>;

  /**
   * @param collection_name - The name of the collection
   * @return The path for the metadata
   */
  readonly getMetadataPath: (
    collection_name: string
  ) => Effect.Effect<string, never>;
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  IConfigService
>() {}
