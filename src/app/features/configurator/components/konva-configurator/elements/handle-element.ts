import Konva from 'konva';
import { DOOR_BASE_SIZES, scaleSize } from './door-sizes';

export type HandleType = 'circle' | 'rectangular';

export interface HandleElementOptions {
  x: number;
  y: number;
  scale?: number;
  type?: HandleType;
  width?: number; // For rectangular handle
  height?: number; // For rectangular handle
  color?: string;
  strokeColor?: string;
  doorColor?: string; // For stroke adjustment
}

/**
 * Reusable handle element component
 * Supports both circular (for parcel/SD/DD) and rectangular (for BIN doors) handles
 */
export class HandleElement {
  private readonly x: number;
  private readonly y: number;
  private readonly scale: number;
  private readonly type: HandleType;
  private readonly width: number | null;
  private readonly height: number | null;
  private readonly color: string;
  private readonly strokeColor: string | undefined;
  private readonly doorColor: string;

  constructor(options: HandleElementOptions) {
    this.x = options.x;
    this.y = options.y;
    this.scale = options.scale ?? 1;
    this.type = options.type ?? 'circle';
    this.width = options.width ?? null;
    this.height = options.height ?? null;
    this.color = options.color ?? '#b0b0b0';
    this.strokeColor = options.strokeColor; // Can be undefined
    this.doorColor = options.doorColor ?? '#555555';
  }

  /**
   * Helper to lighten/darken color for gradient
   */
  private adjustColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  /**
   * Create the handle as a Konva.Group (or Circle for simple circular handle)
   */
  create(): Konva.Group {
    const handleGroup = new Konva.Group({
      x: this.x,
      y: this.y
    });

    if (this.type === 'circle') {
      this.createCircleHandle(handleGroup);
    } else {
      this.createRectangularHandle(handleGroup);
    }

    return handleGroup;
  }

  /**
   * Create circular handle (for parcel, SD, DD doors)
   */
  private createCircleHandle(group: Konva.Group): void {
    const sizes = {
      radius: scaleSize(DOOR_BASE_SIZES.handleRadius, this.scale),
      strokeWidth: scaleSize(DOOR_BASE_SIZES.handleStrokeWidth, this.scale),
      shadowBlur: scaleSize(DOOR_BASE_SIZES.shadowBlur, this.scale),
    };

    const stroke = this.strokeColor ?? this.adjustColor(this.doorColor, -50);

    group.add(new Konva.Circle({
      x: 0,
      y: 0,
      radius: sizes.radius,
      fill: this.color,
      stroke: stroke,
      strokeWidth: sizes.strokeWidth,
      shadowColor: 'black',
      shadowBlur: sizes.shadowBlur,
      shadowOpacity: DOOR_BASE_SIZES.shadowOpacity
    }));
  }

  /**
   * Create rectangular handle (for BIN doors - tds*, tdh*)
   */
  private createRectangularHandle(group: Konva.Group): void {
    if (this.width === null || this.height === null) {
      throw new Error('Rectangular handle requires width and height');
    }

    const sizes = {
      width: this.width,
      height: this.height,
      cornerRadius: scaleSize(DOOR_BASE_SIZES.binHandleCornerRadius, this.scale),
      strokeWidth: scaleSize(DOOR_BASE_SIZES.binHandleStrokeWidth, this.scale),
      innerStrokeWidth: scaleSize(DOOR_BASE_SIZES.binHandleInnerStrokeWidth, this.scale),
      offset: scaleSize(3, this.scale), // Offset for inner rect
    };

    const stroke = this.strokeColor ?? this.adjustColor(this.doorColor, -30);
    const innerStroke = this.adjustColor(this.doorColor, -50);

    // Outer handle
    group.add(new Konva.Rect({
      x: 0,
      y: 0,
      width: sizes.width,
      height: sizes.height,
      cornerRadius: sizes.cornerRadius,
      fill: 'transparent',
      stroke: stroke,
      strokeWidth: sizes.strokeWidth
    }));

    // Inner part of handle (3D effect)
    group.add(new Konva.Rect({
      x: sizes.offset,
      y: sizes.offset,
      width: sizes.width - sizes.offset * 2,
      height: sizes.height - sizes.offset * 2,
      cornerRadius: sizes.cornerRadius / 2,
      stroke: innerStroke,
      strokeWidth: sizes.innerStrokeWidth,
      opacity: 0.5
    }));
  }
}
