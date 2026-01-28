import Konva from 'konva';
import { DOOR_BASE_SIZES, scaleSize } from './door-sizes';

export interface LockElementOptions {
  x: number;
  y: number;
  scale?: number;
  color?: string;
  strokeColor?: string;
}

/**
 * Reusable lock element component
 * Creates a standard lock with circle body and keyhole
 */
export class LockElement {
  private readonly x: number;
  private readonly y: number;
  private readonly scale: number;
  private readonly color: string;
  private readonly strokeColor: string;

  constructor(options: LockElementOptions) {
    this.x = options.x;
    this.y = options.y;
    this.scale = options.scale ?? 1;
    this.color = options.color ?? '#b0b0b0';
    this.strokeColor = options.strokeColor ?? '#555555';
  }

  /**
   * Create the lock as a Konva.Group
   */
  create(): Konva.Group {
    const lockGroup = new Konva.Group({
      x: this.x,
      y: this.y
    });

    const sizes = {
      radius: scaleSize(DOOR_BASE_SIZES.lockRadius, this.scale),
      strokeWidth: scaleSize(DOOR_BASE_SIZES.lockStrokeWidth, this.scale),
      keyholeStrokeWidth: scaleSize(DOOR_BASE_SIZES.lockKeyholeStrokeWidth, this.scale),
      keyholeHalf: scaleSize(DOOR_BASE_SIZES.lockKeyholeLength / 2, this.scale),
      shadowBlur: scaleSize(DOOR_BASE_SIZES.shadowBlur, this.scale),
    };

    // Lock body (circle)
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

    return lockGroup;
  }
}
