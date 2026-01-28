/**
 * Centralized canvas scaling utility
 * Ensures consistent scaling across all canvas elements
 */
export class CanvasScaler {
  private baseScale: number;

  constructor(baseScale: number = 4) {
    this.baseScale = baseScale;
  }

  /**
   * Get the current scale multiplier
   */
  getScale(): number {
    return this.baseScale;
  }

  /**
   * Scale a dimension value
   */
  scale(value: number): number {
    return value * (this.baseScale / 4); // 4 is the reference scale
  }

  /**
   * Scale font size
   */
  scaleFont(fontSize: number): number {
    return this.scale(fontSize);
  }

  /**
   * Scale stroke width
   */
  scaleStroke(strokeWidth: number): number {
    return this.scale(strokeWidth);
  }

  /**
   * Scale radius for circles/locks
   */
  scaleRadius(radius: number): number {
    return this.scale(radius);
  }

  /**
   * Scale point coordinates
   */
  scalePoint(point: number): number {
    return this.scale(point);
  }

  /**
   * Scale array of points [x1, y1, x2, y2, ...]
   */
  scalePoints(points: number[]): number[] {
    return points.map(p => this.scalePoint(p));
  }

  /**
   * Create a scaled version of this scaler with a different base
   */
  withMultiplier(multiplier: number): CanvasScaler {
    return new CanvasScaler(this.baseScale * multiplier);
  }
}
