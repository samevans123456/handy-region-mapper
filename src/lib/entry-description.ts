import type { FieldRow } from "@/lib/maps-data";

export const isDescriptionLabel = (label: string) => label.trim().toLowerCase() === "description";
export const isDescriptionField = (field: Pick<FieldRow, "key" | "label">) =>
  isDescriptionLabel(field.key) || isDescriptionLabel(field.label);

export function descriptionKey(fields: FieldRow[]) {
  return fields.find(isDescriptionField)?.key ?? "description";
}

export function readDescription(data: Record<string, unknown>, fields: FieldRow[]) {
  const value = data[descriptionKey(fields)] ?? data.description ??
    Object.entries(data).find(([key]) => isDescriptionLabel(key))?.[1];
  return value == null ? "" : String(value);
}