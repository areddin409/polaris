export const BASE_PADDING = 12;
export const LEVEL_PADDING = 12;

export const getItemPadding = (level: number, isFile: boolean) => {
  // files need extra padding since they don't have a chevron icon
  const fileOffset = isFile ? 16 : 0;
  return BASE_PADDING + level * LEVEL_PADDING + fileOffset;
};
