import { Schema } from "effect";

export const CreateOpSchema = Schema.Struct({
  _tag: Schema.Literal("CreateOp"),
  collection: Schema.String,
  data: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }) // doc to be created
});
export type CreateOp = typeof CreateOpSchema.Type;

export const UpdateOpSchema = Schema.Struct({
  _tag: Schema.Literal("UpdateOp"),
  collection: Schema.String,
  id: Schema.String,
  data: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  }) // fields to be updated
});
export type UpdateOp = typeof UpdateOpSchema.Type;

export const DeleteOpSchema = Schema.Struct({
  _tag: Schema.Literal("DeleteOp"),
  collection: Schema.String,
  id: Schema.String
});
export type DeleteOp = typeof DeleteOpSchema.Type;

export const WALOperationSchema = Schema.Union(
  CreateOpSchema,
  UpdateOpSchema,
  DeleteOpSchema
);
export type WALOperation = typeof WALOperationSchema.Type;
