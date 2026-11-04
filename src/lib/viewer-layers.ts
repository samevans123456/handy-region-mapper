// Viewer overrides are local only; the saved layers remain unchanged.
export function applyViewerVisibility<T extends { id: string; visible: boolean }>(
  layers: T[],
  overrides: Record<string, boolean>,
): T[] {
  return layers.map((layer) => ({
    ...layer,
    visible: overrides[layer.id] ?? layer.visible,
  }));
}