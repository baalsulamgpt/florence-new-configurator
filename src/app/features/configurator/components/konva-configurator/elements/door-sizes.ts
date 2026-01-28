/**
 * Base sizes for door elements at scale = 1
 * All sizes are in pixels and should be multiplied by scale factor
 */
export const DOOR_BASE_SIZES = {
  // Lock (regular)
  lockRadius: 3.5,
  lockStrokeWidth: 0.5,
  lockKeyholeStrokeWidth: 1,
  lockKeyholeLength: 2.5, // from -1 to 1.5

  // Master Lock
  masterLockRadius: 2.8,
  masterLockStrokeWidth: 0.5,
  masterLockKeyholeStrokeWidth: 0.8,
  masterLockKeyholeLength: 2, // from -0.8 to 1.2
  masterLockDotSize: 1.2,
  masterLockDotSpacingX: 6,
  masterLockDotSpacingY: 4.5,

  // Handle (circle)
  handleRadius: 4.5,
  handleStrokeWidth: 0.5,

  // Text
  labelFontSize: 8,
  typeTextFontSize: 8,

  // Highlight
  highlightStrokeWidth: 3,

  // Frame/door
  doorStrokeWidth: 1,

  // Special: TDS1 pill
  pillWidth: 70,
  pillHeight: 18,
  pillCornerRadius: 6,
  pillLabelFontSize: 10,

  // Special: BIN door handle
  binHandleCornerRadius: 4,
  binHandleStrokeWidth: 1.5,
  binHandleInnerStrokeWidth: 0.5,

  // Shadow
  shadowBlur: 2,
  shadowOpacity: 0.3,
} as const;

/**
 * Calculate size with scale factor
 */
export function scaleSize(baseSize: number, scale: number): number {
  return baseSize * scale;
}

/**
 * Get door sizes for specific scale
 */
export function getDoorSizes(scale: number = 1) {
  const scaled = Object.entries(DOOR_BASE_SIZES).reduce((acc, [key, value]) => {
    acc[key] = typeof value === 'number' ? scaleSize(value, scale) : value;
    return acc;
  }, {} as Record<string, number | string>);

  return scaled;
}
