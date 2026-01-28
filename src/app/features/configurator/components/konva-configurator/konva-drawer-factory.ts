import Konva from 'konva';
import { LockElement, MasterLockElement, HandleElement, scaleSize, DOOR_BASE_SIZES } from './elements';
import { DOOR_CONFIGS, DoorConfig, ElementPosition, DoorElement } from '../../../../core/constants/door-configs';

export interface DoorDrawerOptions {
  x: number;
  y: number;
  label?: string;
  cabinetColor?: string;
  textFill?: string;
  unitHeight?: number;
  scale?: number;
}

export class KonvaDrawerFactory {
  /**
   * Create a door drawer (visual representation of a door)
   * @param type - Door type (sd, dd, td, p2, md, etc.)
   * @param width - Door width in pixels (already scaled)
   * @param height - Door height in pixels (already scaled)
   * @param options - Door options including scale
   */
  static createDrawer(
    type: string,
    width: number,
    height: number,
    options: DoorDrawerOptions
  ): Konva.Group {
    const config = DOOR_CONFIGS[type];

    // Fallback for unknown door types
    if (!config) {
      return this.createFallbackDoor(type, width, height, options);
    }

    const cabinetColor = options.cabinetColor || '#dbe0eb';
    const textFill = options.textFill || '#555';
    const unitHeight = options.unitHeight || height / config.units;
    const scale = options.scale || 1;

    const group = new Konva.Group({
      x: options.x,
      y: options.y,
      width: width,
      height: height
    });

    // Helper to lighten/darken color for gradient
    const adjustColor = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };

    // Background
    const rect = new Konva.Rect({
      width: width,
      height: height,
      stroke: adjustColor(cabinetColor, -30),
      strokeWidth: scaleSize(DOOR_BASE_SIZES.doorStrokeWidth, scale),
      fill: cabinetColor
    });

    if (config.hasGradient) {
      rect.fillLinearGradientStartPoint({ x: 0, y: 0 });
      rect.fillLinearGradientEndPoint({ x: width, y: height });
      rect.fillLinearGradientColorStops([0, adjustColor(cabinetColor, 20), 1, cabinetColor]);
    }
    group.add(rect);

    // Door elements from config
    config.elements.forEach(element => {
      const pos = this.calculatePosition(element.position, width, height, unitHeight, scale);

      switch (element.type) {
        case 'lock': {
          const lockColor = textFill === '#fff' ? '#c0c0c0' : '#b0b0b0';
          const lock = new LockElement({
            x: pos.x,
            y: pos.y,
            scale,
            color: lockColor
          });
          group.add(lock.create());
          break;
        }
        case 'master-lock': {
          const masterLock = new MasterLockElement({
            x: pos.x,
            y: pos.y,
            scale,
            color: '#ffd700' // Gold
          });
          group.add(masterLock.create());
          break;
        }
        case 'handle': {
          const handle = new HandleElement({
            x: pos.x,
            y: pos.y,
            scale,
            type: element.handleType || 'circle',
            color: '#b0b0b0',
            doorColor: textFill
          });
          group.add(handle.create());
          break;
        }
      }
    });

    // Special elements (slot, pill)
    if (config.special) {
      this.createSpecialElement(group, config.special, width, height, scale, cabinetColor, options);
    }

    // Type text
    if (config.showTypeText !== false) {
      const typeText = this.createTypeText(type, width, height, scale, textFill);
      group.add(typeText);
    }

    // Number label (skip for pill-type doors - they have their own label in the pill)
    if (options.label && (!config.special || config.special.type !== 'pill')) {
      const labelText = this.createLabelText(options.label, width, height, scale, textFill);
      group.add(labelText);
    }

    // Highlight rect
    const highlight = new Konva.Rect({
      width: width,
      height: height,
      stroke: '#007bff',
      strokeWidth: scaleSize(DOOR_BASE_SIZES.highlightStrokeWidth, scale),
      opacity: 0,
      name: 'highlight-rect',
      listening: false
    });
    group.add(highlight);

    return group;
  }

  /**
   * Calculate element position based on position type
   */
  private static calculatePosition(
    position: ElementPosition,
    width: number,
    height: number,
    unitHeight: number,
    scale: number
  ): { x: number; y: number } {
    switch (position.type) {
      case 'absolute':
        return {
          x: scaleSize(position.x, scale),
          y: scaleSize(position.y, scale)
        };
      case 'relative':
        return {
          x: width * position.x,
          y: height * position.y
        };
      case 'units':
        return {
          x: scaleSize(position.x, scale),
          y: position.yUnits * unitHeight
        };
      case 'mixed':
        return {
          x: width * position.x,
          y: position.yUnits * unitHeight
        };
    }
  }

  /**
   * Create special element (slot or pill)
   */
  private static createSpecialElement(
    group: Konva.Group,
    special: any,
    width: number,
    height: number,
    scale: number,
    cabinetColor: string,
    options: DoorDrawerOptions
  ): void {
    const adjustColor = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };

    if (special.type === 'slot') {
      const slot = new Konva.Rect({
        x: width * special.x,
        y: height * special.y,
        width: width * special.width,
        height: height * special.height,
        fill: '#333',
        cornerRadius: scaleSize(2, scale),
        stroke: adjustColor(cabinetColor, -30),
        strokeWidth: scaleSize(0.5, scale)
      });
      group.add(slot);
    } else if (special.type === 'pill') {
      // Calculate pill dimensions
      const pillWidth = Math.min(scaleSize(special.width || 60, scale), width - scaleSize(16, scale));
      const pillHeight = scaleSize((special.height || 20) * 0.85, scale);
      const pillX = (width - pillWidth) / 2;
      const pillY = (height - pillHeight) / 2 - scaleSize(6, scale);

      // White pill background
      const pill = new Konva.Rect({
        x: pillX,
        y: pillY,
        width: pillWidth,
        height: pillHeight,
        fill: '#ffffff',
        cornerRadius: scaleSize(DOOR_BASE_SIZES.pillCornerRadius, scale),
        shadowColor: 'black',
        shadowBlur: scaleSize(DOOR_BASE_SIZES.shadowBlur, scale),
        shadowOpacity: 0.2,
        shadowOffset: { x: 0, y: scaleSize(1, scale) }
      });
      group.add(pill);

      // Pill label (if provided)
      if (options.label) {
        const labelText = (options.label === 'PAPER' ? '♻ ' : '') + options.label;
        const label = new Konva.Text({
          x: pillX,
          y: pillY,
          width: pillWidth,
          height: pillHeight,
          text: labelText,
          align: 'center',
          verticalAlign: 'middle',
          fontSize: scaleSize(DOOR_BASE_SIZES.pillLabelFontSize, scale),
          fontFamily: 'Arial',
          fill: '#222',
          fontStyle: 'bold'
        });
        group.add(label);
      }
    }
  }

  /**
   * Create type text (e.g., "SD", "DD")
   */
  private static createTypeText(
    type: string,
    width: number,
    height: number,
    scale: number,
    textFill: string
  ): Konva.Text {
    const typeUpper = type.toUpperCase();
    const tempTypeText = new Konva.Text({
      text: typeUpper,
      fontSize: scaleSize(DOOR_BASE_SIZES.typeTextFontSize, scale),
      fontFamily: 'Arial',
      visible: false
    });
    const typeTextWidth = tempTypeText.getTextWidth() + scaleSize(4, scale);

    return new Konva.Text({
      text: typeUpper,
      x: width - typeTextWidth - scaleSize(5, scale),
      y: height - scaleSize(10, scale),
      width: typeTextWidth,
      align: 'right',
      fontSize: scaleSize(DOOR_BASE_SIZES.typeTextFontSize, scale),
      fontFamily: 'Arial',
      fill: textFill,
      opacity: 0.6
    });
  }

  /**
   * Create centered label text (for door numbers)
   */
  private static createLabelText(
    labelText: string,
    width: number,
    height: number,
    scale: number,
    textFill: string
  ): Konva.Text {
    return new Konva.Text({
      text: labelText,
      x: 0,
      y: height / 2 - scaleSize(4, scale),
      width: width,
      align: 'center',
      fontSize: scaleSize(DOOR_BASE_SIZES.labelFontSize, scale),
      fontFamily: 'Arial',
      fill: textFill,
      fontStyle: 'bold'
    });
  }

  /**
   * Fallback door for unknown types
   */
  private static createFallbackDoor(
    type: string,
    width: number,
    height: number,
    options: DoorDrawerOptions
  ): Konva.Group {
    const cabinetColor = options.cabinetColor || '#dbe0eb';
    const textFill = options.textFill || '#555';
    const scale = options.scale || 1;

    const group = new Konva.Group({
      x: options.x,
      y: options.y,
      width: width,
      height: height
    });

    const adjustColor = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };

    // Background
    const rect = new Konva.Rect({
      width: width,
      height: height,
      stroke: adjustColor(cabinetColor, -30),
      strokeWidth: scaleSize(DOOR_BASE_SIZES.doorStrokeWidth, scale)
    });
    rect.fillLinearGradientStartPoint({ x: 0, y: 0 });
    rect.fillLinearGradientEndPoint({ x: width, y: height });
    rect.fillLinearGradientColorStops([0, adjustColor(cabinetColor, 20), 1, cabinetColor]);
    group.add(rect);

    // Type text
    const typeText = this.createTypeText(type, width, height, scale, textFill);
    group.add(typeText);

    // Label
    if (options.label) {
      const labelText = this.createLabelText(options.label, width, height, scale, textFill);
      group.add(labelText);
    }

    // Highlight
    const highlight = new Konva.Rect({
      width: width,
      height: height,
      stroke: '#007bff',
      strokeWidth: scaleSize(DOOR_BASE_SIZES.highlightStrokeWidth, scale),
      opacity: 0,
      name: 'highlight-rect',
      listening: false
    });
    group.add(highlight);

    return group;
  }
}
