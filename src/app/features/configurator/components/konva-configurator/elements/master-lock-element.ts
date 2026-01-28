import Konva from 'konva';
import { DOOR_BASE_SIZES, scaleSize } from './door-sizes';

export interface MasterLockElementOptions {
  x: number;
  y: number;
  scale?: number;
  color?: string;
  strokeColor?: string;
}

/**
 * Reusable master lock element component
 * Creates a master lock (smaller gold lock) with 4 dots around it
 */
export class MasterLockElement {
  private readonly x: number;
  private readonly y: number;
  private readonly scale: number;
  private readonly color: string;
  private readonly strokeColor: string;

  constructor(options: MasterLockElementOptions) {
    this.x = options.x;
    this.y = options.y;
    this.scale = options.scale ?? 1;
    this.color = options.color ?? '#ffd700'; // Gold by default
    this.strokeColor = options.strokeColor ?? '#daa520'; // GoldenRod for keyhole
  }

  /**
   * Create the master lock as a Konva.Group
   */
  create(): Konva.Group {
    const lockGroup = new Konva.Group({
      x: this.x,
      y: this.y
    });

    const sizes = {
      radius: scaleSize(DOOR_BASE_SIZES.masterLockRadius, this.scale),
      strokeWidth: scaleSize(DOOR_BASE_SIZES.masterLockStrokeWidth, this.scale),
      keyholeStrokeWidth: scaleSize(DOOR_BASE_SIZES.masterLockKeyholeStrokeWidth, this.scale),
      keyholeHalf: scaleSize(DOOR_BASE_SIZES.masterLockKeyholeLength / 2, this.scale),
      dotSize: scaleSize(DOOR_BASE_SIZES.masterLockDotSize, this.scale),
      spacingX: scaleSize(DOOR_BASE_SIZES.masterLockDotSpacingX, this.scale),
      spacingY: scaleSize(DOOR_BASE_SIZES.masterLockDotSpacingY, this.scale),
      shadowBlur: scaleSize(DOOR_BASE_SIZES.shadowBlur, this.scale),
    };

    // Lock body (smaller gold circle)
    lockGroup.add(new Konva.Circle({
      radius: sizes.radius,
      fill: this.color,
      stroke: this.strokeColor,
      strokeWidth: sizes.strokeWidth,
      shadowColor: 'black',
      shadowBlur: sizes.shadowBlur,
      shadowOpacity: DOOR_BASE_SIZES.shadowOpacity
    }));

    // Keyhole (vertical line)
    lockGroup.add(new Konva.Line({
      points: [0, -sizes.keyholeHalf, 0, sizes.keyholeHalf],
      stroke: this.strokeColor,
      strokeWidth: sizes.keyholeStrokeWidth
    }));

    // 4 dots around master lock (2 above, 2 below in same plane)
    const dotColor = '#333';

    // Top left dot
    lockGroup.add(new Konva.Circle({
      x: -sizes.spacingX,
      y: -sizes.spacingY,
      radius: sizes.dotSize,
      fill: dotColor
    }));

    // Top right dot
    lockGroup.add(new Konva.Circle({
      x: sizes.spacingX,
      y: -sizes.spacingY,
      radius: sizes.dotSize,
      fill: dotColor
    }));

    // Bottom left dot
    lockGroup.add(new Konva.Circle({
      x: -sizes.spacingX,
      y: sizes.spacingY,
      radius: sizes.dotSize,
      fill: dotColor
    }));

    // Bottom right dot
    lockGroup.add(new Konva.Circle({
      x: sizes.spacingX,
      y: sizes.spacingY,
      radius: sizes.dotSize,
      fill: dotColor
    }));

    return lockGroup;
  }
}
