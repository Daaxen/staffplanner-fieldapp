import { z } from 'zod';

/**
 * Validation for what is still allowed to live in the `data` JSONB columns of
 * `clients` and `projects`.
 *
 * Business-critical fields (anything used for filtering, planning, permissions,
 * reporting, invoicing or workflow decisions) now live in typed columns or
 * normalised tables. The JSON keeps genuinely optional metadata plus a full
 * snapshot of the record for backwards compatibility — unknown keys are
 * deliberately preserved (`.passthrough()`), never silently dropped.
 */

const attachmentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z.number().nonnegative(),
    type: z.string(),
  })
  .passthrough();

const goodsItemSchema = z
  .object({
    id: z.string(),
    description: z.string().optional(),
    quantity: z.number().nonnegative().optional(),
    lengthCm: z.number().nonnegative().optional(),
    widthCm: z.number().nonnegative().optional(),
    heightCm: z.number().nonnegative().optional(),
    weightKg: z.number().nonnegative().optional(),
  })
  .passthrough();

const dateOverrideSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

/** Optional metadata still stored inside projects.data. */
export const projectMetadataSchema = z
  .object({
    attachments: z.array(attachmentSchema).optional(),
    goodsItems: z.array(goodsItemSchema).optional(),
    installerDateOverrides: z.record(dateOverrideSchema).optional(),
  })
  .passthrough();

/** Optional metadata still stored inside clients.data. */
export const clientMetadataSchema = z.object({}).passthrough();

export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;
export type ClientMetadata = z.infer<typeof clientMetadataSchema>;

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  // Never drop data because it fails validation — warn and keep what we got.
  console.warn(`Unexpected ${label} JSON structure`, result.error.issues);
  return (value ?? {}) as z.infer<T>;
}

export const parseProjectMetadata = (value: unknown) =>
  parse(projectMetadataSchema, value, 'order');

export const parseClientMetadata = (value: unknown) =>
  parse(clientMetadataSchema, value, 'customer');
