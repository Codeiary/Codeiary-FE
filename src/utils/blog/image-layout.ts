export type ImageAlignment = "left" | "center" | "right";
export interface ImageLayout {
  width: number;
  align: ImageAlignment;
  original?: boolean;
}
export interface SelectedImage extends ImageLayout {
  key: string;
  alt: string;
  rowSize?: number;
}
export type ImageLayouts = Record<string, ImageLayout>;
export interface ImageSize {
  width: number;
  height: number;
}
export type ImageSizes = Record<string, ImageSize>;

export function normalizeImageLayout(
  layout?: Partial<ImageLayout>,
): ImageLayout {
  return {
    original: layout?.original ?? layout?.width === undefined,
    width:
      typeof layout?.width === "number" && Number.isFinite(layout.width)
        ? Math.min(100, Math.max(10, Math.round(layout.width)))
        : 100,
    align:
      layout?.align === "left" || layout?.align === "right"
        ? layout.align
        : "center",
  };
}
