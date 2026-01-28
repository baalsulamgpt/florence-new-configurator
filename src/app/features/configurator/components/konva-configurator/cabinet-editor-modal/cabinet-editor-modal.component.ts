import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Frame, Door } from '../../../../../core/models/configurator.models';
import Konva from 'konva';
import { KonvaDrawerFactory } from '../konva-drawer-factory';
import { CanvasScaler } from './canvas-scaler';
import { getTextFillForCabinetColor } from '../../../../../core/constants/cabinet-colors';
import { DOOR_CONFIGS, getDoorUnits } from '../../../../../core/constants/door-configs';

interface DoorIdentifier {
  position: number;
  column?: 'left' | 'right';
}

interface PaletteDoor {
  name: string;
  label: string;
  displayName: string;
  category: 'tenant' | 'master' | 'special' | 'parcel';
}

// Slot represents a single unit position in cabinet
interface Slot {
  unitIndex: number;           // Position from bottom (0-based)
  column: 'left' | 'right';   // Which column
  door: Door | null;          // Door occupying this slot (null = empty)
  isOccupiedByAbove: boolean; // True if door from above unit extends here
}

@Component({
  selector: 'app-cabinet-editor-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cabinet-editor-modal.component.html',
  styleUrls: ['./cabinet-editor-modal.component.scss']
})
export class CabinetEditorModalComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() isOpen = false;
  @Input() frame!: Frame;
  @Input() cabinetColor = '#dbe0eb'; // Cabinet color for realistic rendering
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Frame>();

  @ViewChild('cabinetCanvas') cabinetCanvas!: ElementRef<HTMLDivElement>;
  @ViewChild('paletteCanvas') paletteCanvas!: ElementRef<HTMLDivElement>;

  // Konva stages
  private cabinetStage: Konva.Stage | null = null;
  private cabinetLayer: Konva.Layer | null = null;
  private dragPreviewLayer: Konva.Layer | null = null; // Separate layer for drag preview (always on top)
  private paletteStage: Konva.Stage | null = null;
  private paletteLayer: Konva.Layer | null = null;

  // State
  private draggedDoor: PaletteDoor | null = null;
  private dragPreview: Konva.Group | null = null;
  private dragPreviewElement: HTMLElement | null = null; // HTML-based drag preview
  highlightedDoors: Set<string> = new Set();
  invalidDoors: Set<string> = new Set();
  
  // Slot system for managing door positions
  private leftSlots: Slot[] = [];
  private rightSlots: Slot[] = [];
  private totalUnits: number = 0; // Total height in units
  
  // Selected door for deletion
  private selectedDoor: Door | null = null;
  private keyboardListener: ((e: KeyboardEvent) => void) | null = null;

  // Cabinet geometry for hit detection
  private cabinetGeometry = {
    startX: 0,
    startY: 0,
    leftColX: 0,
    rightColX: 0,
    leftColWidth: 0,
    rightColWidth: 0,
    unitHeight: 0,
    doorsStartY: 0,
    isDoubleColumn: false
  };

  // Canvas constants (optimized scale for editor)
  readonly SCALE = 8; // Optimized scale for compact yet clear display
  readonly DOOR_UNIT = 3.5; // Same as PREVIEW_DOOR_UNIT in main component
  readonly FRAME_TB = 1.125; // 1 1/8 - Frame top/bottom thickness in inches
  readonly FRAME_SIDE = 1.3125; // Frame side thickness in inches (1 5/16)
  readonly FRAME_MID = 1.4375; // Frame middle thickness in inches (1 7/16)

  readonly PALETTE_DOOR_WIDTH = 67; // Width of palette doors (base size)
  readonly PALETTE_SCALE = this.SCALE; // Scale for palette doors

  // Generate palette doors from DOOR_CONFIGS - single source of truth
  get substituteDoors(): PaletteDoor[] {
    return Object.values(DOOR_CONFIGS).map(config => ({
      name: config.name,
      label: config.name.toUpperCase(),
      displayName: config.displayName,
      category: config.category
    }));
  }

  categories = ['Standard', 'Outgoing', 'Parcel'];
  selectedCategory = 'Standard'; // Default selected tab

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit() {
    // Canvases will be initialized when isOpen changes to true
  }

  ngOnChanges(changes: import('@angular/core').SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      // Normalize door positions only on initial open
      this.normalizeDoorPositions();
      
      // Initialize slot system
      this.initializeSlots();
      
      // Use setTimeout to ensure DOM is fully rendered with proper dimensions
      setTimeout(() => {
        this.initializeCanvases();
      }, 50);
      
      // Add keyboard event listener for Delete key
      this.keyboardListener = (e: KeyboardEvent) => this.handleKeyPress(e);
      document.addEventListener('keydown', this.keyboardListener);
    } else if (changes['isOpen'] && !this.isOpen) {
      // Remove keyboard event listener when modal closes
      if (this.keyboardListener) {
        document.removeEventListener('keydown', this.keyboardListener);
        this.keyboardListener = null;
      }
    }
  }
  
  // Initialize slot system from current doors
  private initializeSlots() {
    // Calculate total units based on frame height and DOOR_UNIT
    this.totalUnits = Math.round(this.frame.height / this.DOOR_UNIT);
    
    // Initialize empty slots for both columns
    this.leftSlots = Array.from({ length: this.totalUnits }, (_, i) => ({
      unitIndex: i,
      column: 'left' as const,
      door: null,
      isOccupiedByAbove: false
    }));
    
    this.rightSlots = Array.from({ length: this.totalUnits }, (_, i) => ({
      unitIndex: i,
      column: 'right' as const,
      door: null,
      isOccupiedByAbove: false
    }));
    
    // Place existing doors into slots
    const leftDoors = this.getLeftDoors();
    const rightDoors = this.getRightDoors();
    
    // Fill left column
    leftDoors.forEach(door => {
      this.placeDoorInSlots(door, 'left');
    });
    
    // Fill right column
    rightDoors.forEach(door => {
      this.placeDoorInSlots(door, 'right');
    });
  }
  
  // Normalize door positions from sequential indices to absolute unit positions
  private normalizeDoorPositions() {
    if (!this.frame.doors) return;
    
    // Group doors by column
    const leftDoors = this.getLeftDoors().sort((a, b) => a.position - b.position);
    const rightDoors = this.getRightDoors().sort((a, b) => a.position - b.position);
    
    // Normalize left column
    let currentUnit = 0;
    leftDoors.forEach(door => {
      const doorType = door.door_type.toLowerCase();
      const units = getDoorUnits(doorType);
      door.position = currentUnit;
      currentUnit += units;
    });
    
    // Normalize right column
    currentUnit = 0;
    rightDoors.forEach(door => {
      const doorType = door.door_type.toLowerCase();
      const units = getDoorUnits(doorType);
      door.position = currentUnit;
      currentUnit += units;
    });
  }

  // Convert absolute unit positions back to sequential indices for saving
  private denormalizeDoorPositions() {
    if (!this.frame.doors) return;
    
    // Create mappings from absolute position to sequential index for each column
    const leftDoors = this.getLeftDoors().sort((a, b) => a.position - b.position);
    const rightDoors = this.getRightDoors().sort((a, b) => a.position - b.position);
    
    // Build position maps
    const leftPosMap = new Map<number, number>();
    leftDoors.forEach((door, index) => {
      leftPosMap.set(door.position, index);
    });
    
    const rightPosMap = new Map<number, number>();
    rightDoors.forEach((door, index) => {
      rightPosMap.set(door.position, index);
    });
    
    // Apply sequential positions WITHOUT changing array order
    this.frame.doors.forEach(door => {
      const column = door.column || 'left';
      const posMap = column === 'left' ? leftPosMap : rightPosMap;
      const sequentialPos = posMap.get(door.position);
      if (sequentialPos !== undefined) {
        door.position = sequentialPos;
      }
    });
  }
  
  // Place door in slots
  private placeDoorInSlots(door: Door, column: 'left' | 'right') {
    const slots = column === 'left' ? this.leftSlots : this.rightSlots;
    const doorType = door.door_type.toLowerCase();
    const units = getDoorUnits(doorType);
    const startUnit = door.position;
    
    // Mark slots as occupied
    for (let i = 0; i < units; i++) {
      const unitIndex = startUnit + i;
      if (unitIndex < slots.length) {
        slots[unitIndex].door = i === 0 ? door : null;
        slots[unitIndex].isOccupiedByAbove = i > 0;
      }
    }
  }
  
  // Get empty slots in column
  private getEmptySlots(column: 'left' | 'right'): number[] {
    const slots = column === 'left' ? this.leftSlots : this.rightSlots;
    return slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.door === null && !slot.isOccupiedByAbove)
      .map(({ index }) => index);
  }
  
  // Check if slots have empty units
  private hasEmptySlots(): boolean {
    return this.getEmptySlots('left').length > 0 || this.getEmptySlots('right').length > 0;
  }

  ngOnDestroy() {
    this.destroyCanvases();
    this.destroyDragPreview();
    
    // Remove keyboard event listener
    if (this.keyboardListener) {
      document.removeEventListener('keydown', this.keyboardListener);
      this.keyboardListener = null;
    }
  }

  private initializeCanvases() {
    // Destroy existing canvases first to prevent double initialization
    this.destroyCanvases();

    this.ngZone.runOutsideAngular(() => {
      this.initializeCabinetCanvas();
      this.initializePaletteCanvas();
    });
  }

  private initializeCabinetCanvas() {
    if (!this.cabinetCanvas) return;

    const container = this.cabinetCanvas.nativeElement;
    const containerWidth = container.clientWidth || 350;
    
    // Calculate cabinet dimensions
    const scale = this.SCALE;
    const cabinetWidth = this.frame.width * scale;
    const cabinetHeight = this.frame.height * scale;
    
    // Stage dimensions: fit cabinet with minimal padding
    const width = Math.max(containerWidth, cabinetWidth + 20);
    const height = cabinetHeight + 20;

    console.log('[Cabinet Canvas] Initializing:', { 
      containerWidth, 
      cabinetWidth, 
      cabinetHeight, 
      stageWidth: width, 
      stageHeight: height 
    });

    this.cabinetStage = new Konva.Stage({
      container: container.id,
      width: width,
      height: height,
      pixelRatio: window.devicePixelRatio || 1
    });

    this.cabinetLayer = new Konva.Layer();
    this.cabinetStage.add(this.cabinetLayer);

    // Drag preview layer - added last so it's always on top
    this.dragPreviewLayer = new Konva.Layer();
    this.cabinetStage.add(this.dragPreviewLayer);

    this.renderCabinet();
  }

  private initializePaletteCanvas() {
    if (!this.paletteCanvas) return;

    const container = this.paletteCanvas.nativeElement;
    const width = container.clientWidth || 450;
    const height = 200; // Initial minimal height

    this.paletteStage = new Konva.Stage({
      container: container.id,
      width: width,
      height: height,
      pixelRatio: window.devicePixelRatio || 1
    });

    this.paletteLayer = new Konva.Layer();
    this.paletteStage.add(this.paletteLayer);

    this.renderPalette();
  }

  private destroyCanvases() {
    if (this.cabinetStage) {
      this.cabinetStage.destroy();
      this.cabinetStage = null;
      this.cabinetLayer = null;
      this.dragPreviewLayer = null;
    }

    if (this.paletteStage) {
      this.paletteStage.destroy();
      this.paletteStage = null;
      this.paletteLayer = null;
    }
  }

  // Helper methods to get filtered doors from the doors array
  getLeftDoors(): Door[] {
    if (!this.frame.doors) return [];
    return this.frame.doors.filter(d => d.column === 'left' || !d.column);
  }

  getRightDoors(): Door[] {
    if (!this.frame.doors) return [];
    return this.frame.doors.filter(d => d.column === 'right');
  }

  // Create a unique identifier for a door based on position and column
  getDoorId(door: Door): string {
    const column = door.column || 'left';
    return `${door.position}-${column}`;
  }

  // Render cabinet on canvas
  private renderCabinet() {
    if (!this.cabinetLayer) return;

    this.cabinetLayer.destroyChildren();

    const leftDoors = this.getLeftDoors();
    const rightDoors = this.getRightDoors();

    const isDoubleColumn = rightDoors.length > 0;

    // Use frame dimensions with SCALE
    const scale = this.SCALE;
    const cabinetWidth = this.frame.width * scale;
    const cabinetHeight = this.frame.height * scale;

    const startX = (this.cabinetStage!.width() - cabinetWidth) / 2;
    const startY = 20;

    // Draw frame
    this.drawFrame(startX, startY, cabinetWidth, cabinetHeight, isDoubleColumn, scale);

    // Calculate frame dimensions in pixels
    const FRAME_TB_PX = this.FRAME_TB * scale;
    const FRAME_SIDE_PX = this.FRAME_SIDE * scale;
    const FRAME_MID_PX = this.FRAME_MID * scale;

    // Calculate available space for doors
    const availWidth = cabinetWidth - (2 * FRAME_SIDE_PX);
    const availHeight = cabinetHeight - (2 * FRAME_TB_PX);

    // Calculate door dimensions
    const leftColWidth = isDoubleColumn ? (availWidth - FRAME_MID_PX) / 2 : availWidth;
    const rightColWidth = isDoubleColumn ? (availWidth - FRAME_MID_PX) / 2 : 0;

    // Use fixed unit height (not stretching to fit available space)
    const unitHeight = this.DOOR_UNIT * scale;
    
    // Draw unit grid and empty slots
    const leftStartX = startX + FRAME_SIDE_PX;
    const rightStartX = leftStartX + leftColWidth + (isDoubleColumn ? FRAME_MID_PX : 0);
    const doorsStartY = startY + FRAME_TB_PX;
    
    // Save geometry for hit detection
    this.cabinetGeometry = {
      startX,
      startY,
      leftColX: leftStartX,
      rightColX: rightStartX,
      leftColWidth,
      rightColWidth,
      unitHeight,
      doorsStartY,
      isDoubleColumn
    };
    
    this.drawUnitGrid(leftStartX, doorsStartY, leftColWidth, unitHeight, 'left');
    if (isDoubleColumn) {
      this.drawUnitGrid(rightStartX, doorsStartY, rightColWidth, unitHeight, 'right');
    }
    
    this.drawEmptySlots(leftStartX, doorsStartY, leftColWidth, unitHeight, 'left');
    if (isDoubleColumn) {
      this.drawEmptySlots(rightStartX, doorsStartY, rightColWidth, unitHeight, 'right');
    }

    // Draw left column doors
    for (const door of leftDoors) {
      const doorType = door.door_type.toLowerCase(); // Normalize to lowercase
      const doorUnits = getDoorUnits(doorType);
      const doorHeight = doorUnits * unitHeight;
      
      // Calculate Y position based on door.position (not sequential)
      const doorY = doorsStartY + (door.position * unitHeight);

      this.drawCabinetDoor(
        leftStartX,
        doorY,
        leftColWidth,
        doorHeight,
        door,
        'left',
        unitHeight,
        this.SCALE // Scale for subelements
      );
    }

    // Draw right column doors if exists
    if (isDoubleColumn) {
      const rightStartX = leftStartX + leftColWidth + FRAME_MID_PX;

      for (const door of rightDoors) {
        const doorType = door.door_type.toLowerCase(); // Normalize to lowercase
        const doorUnits = getDoorUnits(doorType);
        const doorHeight = doorUnits * unitHeight;
        
        // Calculate Y position based on door.position (not sequential)
        const doorY = doorsStartY + (door.position * unitHeight);

        this.drawCabinetDoor(
          rightStartX,
          doorY,
          rightColWidth,
          doorHeight,
          door,
          'right',
          unitHeight,
          this.SCALE // Scale for subelements
        );
      }
    }
  }

  private calculateDoorHeight(units: number, totalDoors: number): number {
    const frameHeight = this.frame.height * this.SCALE;
    const frameThickness = 2 * this.FRAME_TB * this.SCALE;
    const availableHeight = frameHeight - frameThickness;

    return (units / totalDoors) * availableHeight;
  }

  private drawFrame(x: number, y: number, width: number, height: number, isDouble: boolean, scale: number) {
    const frame = new Konva.Group({ x, y });

    const FRAME_TB_PX = this.FRAME_TB * scale;
    const FRAME_SIDE_PX = this.FRAME_SIDE * scale;
    const FRAME_MID_PX = this.FRAME_MID * scale;

    // Helper to lighten/darken color for gradient
    const adjustColor = (color: string, amount: number) => {
      const hex = color.replace('#', '');
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    };

    // Frame Gradient using selected cabinet color
    const frameStops = [
      0, adjustColor(this.cabinetColor, 20),
      0.4, adjustColor(this.cabinetColor, 40),
      0.6, adjustColor(this.cabinetColor, 40),
      1, adjustColor(this.cabinetColor, 20)
    ];
    const frameStroke = adjustColor(this.cabinetColor, -50);

    // Helper to draw frame rect with gradient
    const drawFrameRect = (x: number, y: number, w: number, h: number, vertical: boolean) => {
      const rect = new Konva.Rect({
        x, y, width: w, height: h,
        stroke: frameStroke,
        strokeWidth: 0.5,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: vertical ? { x: w, y: 0 } : { x: 0, y: h },
        fillLinearGradientColorStops: frameStops
      });
      frame.add(rect);
      return rect;
    };

    // Left (Vertical Gradient)
    drawFrameRect(0, 0, FRAME_SIDE_PX, height, true);

    // Right (Vertical Gradient)
    drawFrameRect(width - FRAME_SIDE_PX, 0, FRAME_SIDE_PX, height, true);

    // Middle frame for double column
    let middleFrame: Konva.Rect | null = null;
    if (isDouble) {
      const midX = (width - FRAME_MID_PX) / 2;
      middleFrame = drawFrameRect(midX, 0, FRAME_MID_PX, height, true) as Konva.Rect;
    }

    // Top (Horizontal Gradient) - drawn AFTER middle so it overlaps
    const topFrame = drawFrameRect(0, 0, width, FRAME_TB_PX, false) as Konva.Rect;
    // Bottom (Horizontal Gradient) - drawn AFTER middle so it overlaps
    const bottomFrame = drawFrameRect(0, height - FRAME_TB_PX, width, FRAME_TB_PX, false) as Konva.Rect;

    // Ensure top and bottom frames are on top of middle frame
    if (middleFrame) {
      topFrame.moveToTop();
      bottomFrame.moveToTop();
    }

    this.cabinetLayer!.add(frame);
  }
  
  // Draw unit grid (horizontal lines every unit)
  private drawUnitGrid(x: number, y: number, width: number, unitHeight: number, column: 'left' | 'right') {
    const gridGroup = new Konva.Group({ x, y });
    
    // Draw horizontal lines for each unit
    for (let i = 1; i < this.totalUnits; i++) {
      const lineY = i * unitHeight;
      const line = new Konva.Line({
        points: [0, lineY, width, lineY],
        stroke: '#999',
        strokeWidth: 0.5,
        opacity: 0.3,
        dash: [4, 4]
      });
      gridGroup.add(line);
    }
    
    this.cabinetLayer!.add(gridGroup);
  }
  
  // Draw empty slots with light red background
  private drawEmptySlots(x: number, y: number, width: number, unitHeight: number, column: 'left' | 'right') {
    const emptySlots = this.getEmptySlots(column);
    const emptyGroup = new Konva.Group({ x, y });
    
    emptySlots.forEach(slotIndex => {
      const slotY = slotIndex * unitHeight;
      const emptySlotId = `empty-${slotIndex}-${column}`;
      
      // Check if this empty slot is being hovered
      const isHighlighted = this.highlightedDoors.has(emptySlotId);
      const isInvalid = this.invalidDoors.has(emptySlotId);
      
      let fillColor = '#ffcccc';
      let opacity = 0.3;
      
      if (isHighlighted) {
        fillColor = 'rgba(40, 167, 69, 0.4)';
        opacity = 1;
      } else if (isInvalid) {
        fillColor = 'rgba(220, 53, 69, 0.4)';
        opacity = 1;
      }
      
      const emptyRect = new Konva.Rect({
        x: 0,
        y: slotY,
        width: width,
        height: unitHeight,
        fill: fillColor,
        opacity: opacity
      });
      emptyGroup.add(emptyRect);
    });
    
    this.cabinetLayer!.add(emptyGroup);
  }

  private drawCabinetDoor(x: number, y: number, width: number, height: number, door: Door, column: 'left' | 'right', unitHeight: number, scale: number) {
    const doorId = this.getDoorId(door);
    const isHighlighted = this.highlightedDoors.has(doorId);
    const isInvalid = this.invalidDoors.has(doorId);
    const isSelected = this.selectedDoor === door;
    const textFill = getTextFillForCabinetColor(this.cabinetColor);

    const doorGroup = new Konva.Group({
      x,
      y,
      width,
      height,
      draggable: true
    });

    // Use KonvaDrawerFactory for realistic door rendering
    // Note: cabinet preview doors should NOT have numeric labels (they show door type, not tenant number)
    const doorDrawer = KonvaDrawerFactory.createDrawer(
      door.door_type.toLowerCase(), // Normalize to lowercase
      width,
      height,
      {
        x: 0,
        y: 0,
        label: undefined, // No numeric label for cabinet preview doors
        cabinetColor: this.cabinetColor,
        textFill: textFill,
        unitHeight: unitHeight,
        scale: this.SCALE / 5 // Scale door elements proportionally to SCALE (5 was original)
      }
    );
    doorGroup.add(doorDrawer);

    // Add highlight overlay for valid/invalid drops
    if (isHighlighted || isInvalid) {
      const overlayColor = isHighlighted ? 'rgba(40, 167, 69, 0.4)' : 'rgba(220, 53, 69, 0.4)';
      const overlayStroke = isHighlighted ? '#28a745' : '#dc3545';

      const overlay = new Konva.Rect({
        x: 0,
        y: 0,
        width: width,
        height: height,
        fill: overlayColor,
        stroke: overlayStroke,
        strokeWidth: 2,
        cornerRadius: 2
      });
      doorGroup.add(overlay);
    }

    // Add selection overlay
    if (isSelected) {
      const selectionOverlay = new Konva.Rect({
        x: 0,
        y: 0,
        width: width,
        height: height,
        fill: 'rgba(0, 123, 255, 0.2)',
        stroke: '#007bff',
        strokeWidth: 3,
        cornerRadius: 2
      });
      doorGroup.add(selectionOverlay);
    }

    // Store door data for drag-drop
    doorGroup.setAttr('doorData', door);
    doorGroup.setAttr('isCabinetDoor', true);
    doorGroup.setAttr('originalX', x);
    doorGroup.setAttr('originalY', y);

    // Click to select door
    doorGroup.on('click tap', () => {
      this.selectedDoor = door;
      this.renderCabinet();
    });

    // Drag events
    doorGroup.on('dragstart', () => {
      doorGroup.moveToTop();
      this.selectedDoor = door;
    });

    doorGroup.on('dragend', (e) => {
      const stage = doorGroup.getStage();
      if (!stage) {
        this.returnDoorToPosition(doorGroup);
        return;
      }

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) {
        this.returnDoorToPosition(doorGroup);
        return;
      }

      // Check if dropped on another cabinet door for swapping
      const targetDoor = this.findCabinetDoorAtPosition(pointerPos, doorGroup);
      if (targetDoor) {
        const swapped = this.trySwapDoors(door, targetDoor);
        this.returnDoorToPosition(doorGroup);
        if (swapped) {
          this.renderCabinet();
        }
        return;
      }

      // Check if dropped on palette door
      const paletteStage = this.paletteStage;
      if (paletteStage) {
        const paletteBox = {
          x: paletteStage.absolutePosition().x,
          y: paletteStage.absolutePosition().y,
          width: paletteStage.width(),
          height: paletteStage.height()
        };

        if (pointerPos.x >= paletteBox.x && pointerPos.x <= paletteBox.x + paletteBox.width &&
            pointerPos.y >= paletteBox.y && pointerPos.y <= paletteBox.y + paletteBox.height) {
          this.returnDoorToPosition(doorGroup);
          return;
        }
      }

      this.returnDoorToPosition(doorGroup);
    });

    this.cabinetLayer!.add(doorGroup);
  }

  private returnDoorToPosition(doorGroup: Konva.Group) {
    const originalX = doorGroup.getAttr('originalX') || 0;
    const originalY = doorGroup.getAttr('originalY') || 0;
    
    doorGroup.to({
      x: originalX,
      y: originalY,
      duration: 0.2,
      easing: Konva.Easings.EaseOut
    });
  }

  private findCabinetDoorAtPosition(pointerPos: { x: number; y: number }, excludeGroup: Konva.Group): Door | null {
    if (!this.cabinetLayer) return null;

    const shapes = this.cabinetLayer.getChildren((node: Konva.Node) => {
      return node.getAttr('isCabinetDoor') === true && node !== excludeGroup;
    });

    for (const shape of shapes) {
      const group = shape as Konva.Group;
      const doorX = group.x();
      const doorY = group.y();
      const doorWidth = group.width();
      const doorHeight = group.height();

      if (pointerPos.x >= doorX && pointerPos.x <= doorX + doorWidth &&
          pointerPos.y >= doorY && pointerPos.y <= doorY + doorHeight) {
        return group.attrs.doorData as Door;
      }
    }

    return null;
  }

  private trySwapDoors(door1: Door, door2: Door): boolean {
    const door1Type = door1.door_type.toLowerCase();
    const door2Type = door2.door_type.toLowerCase();
    const door1Units = getDoorUnits(door1Type);
    const door2Units = getDoorUnits(door2Type);
    
    const door1Column = door1.column || 'left';
    const door2Column = door2.column || 'right';
    
    if (door1Column !== door2Column) {
      return false;
    }
    
    const door1Position = door1.position;
    const door2Position = door2.position;
    
    // Check if both doors will fit after swap
    const door1NewEnd = door2Position + door1Units - 1;
    const door2NewEnd = door1Position + door2Units - 1;
    
    if (door1NewEnd >= this.totalUnits || door2NewEnd >= this.totalUnits) {
      return false;
    }
    
    // Get all doors in this column
    const columnDoors = this.frame.doors?.filter(d => {
      const dColumn = d.column || 'left';
      return dColumn === door1Column;
    }) || [];
    
    // Check if there are any other doors between the swap positions
    const minPos = Math.min(door1Position, door2Position);
    const maxPos = Math.max(
      door1Position + door1Units - 1,
      door2Position + door2Units - 1
    );
    
    for (const d of columnDoors) {
      if (d === door1 || d === door2) continue;
      
      const dType = d.door_type.toLowerCase();
      const dUnits = getDoorUnits(dType);
      const dEnd = d.position + dUnits - 1;
      
      // Check if this door overlaps with the swap range
      if ((d.position >= minPos && d.position <= maxPos) ||
          (dEnd >= minPos && dEnd <= maxPos)) {
        return false;
      }
    }
    
    // Perform the swap
    const tempPosition = door1.position;
    door1.position = door2.position;
    door2.position = tempPosition;
    
    this.initializeSlots();
    
    return true;
  }

  private findDoorOccupyingSlot(slotIndex: number, column: 'left' | 'right'): Door | null {
    const slots = column === 'left' ? this.leftSlots : this.rightSlots;
    
    for (let i = slotIndex; i >= 0; i--) {
      const slot = slots[i];
      if (slot.door !== null) {
        return slot.door;
      }
    }
    
    return null;
  }

  private handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedDoor) {
        e.preventDefault();
        this.deleteSelectedDoor();
      }
    } else if (e.key === 'Escape') {
      this.selectedDoor = null;
      this.renderCabinet();
    }
  }

  private deleteSelectedDoor() {
    if (!this.selectedDoor || !this.frame.doors) return;

    const doorToDelete = this.selectedDoor;
    
    this.frame.doors = this.frame.doors.filter(door => {
      return door !== doorToDelete;
    });
    
    this.selectedDoor = null;
    
    this.initializeSlots();
    this.renderCabinet();
  }

  // Render palette doors
  private renderPalette() {
    if (!this.paletteLayer) return;

    this.paletteLayer.destroyChildren();

    // Calculate real door width from cabinet (same as in renderCabinet)
    const scale = this.SCALE;
    const leftDoors = this.getLeftDoors();
    const rightDoors = this.getRightDoors();
    const isDoubleColumn = rightDoors.length > 0;

    // Calculate actual door column width
    const FRAME_TB_PX = this.FRAME_TB * scale;
    const FRAME_SIDE_PX = this.FRAME_SIDE * scale;
    const FRAME_MID_PX = this.FRAME_MID * scale;
    const cabinetWidth = this.frame.width * scale;
    const availWidth = cabinetWidth - (2 * FRAME_SIDE_PX);
    const doorColumnWidth = isDoubleColumn ? (availWidth - FRAME_MID_PX) / 2 : availWidth;

    // Filter doors based on selected tab (matching original configurator logic)
    let categoryDoors: PaletteDoor[];
    if (this.selectedCategory === 'Standard') {
      categoryDoors = this.substituteDoors.filter(d => d.category === 'tenant');
    } else if (this.selectedCategory === 'Parcel') {
      categoryDoors = this.substituteDoors.filter(d => d.category === 'parcel');
    } else if (this.selectedCategory === 'Outgoing') {
      categoryDoors = this.substituteDoors.filter(d => d.category === 'master' || d.category === 'special');
    } else {
      categoryDoors = [];
    }

    const padding = 10;
    const doorWidth = doorColumnWidth; // Use actual cabinet door width
    const unitHeight = this.DOOR_UNIT * this.PALETTE_SCALE; // Height of 1 unit in palette

    let currentY = 10;
    let doorX = padding;
    let maxHeightInRow = 0;
    let maxY = 0;

    // Arrange doors in rows
    for (let i = 0; i < categoryDoors.length; i++) {
      const door = categoryDoors[i];
      const doorHeight = getDoorUnits(door.name) * unitHeight;

      // Check if we need to wrap to next row
      if (doorX + doorWidth > this.paletteStage!.width() - padding && doorX > padding) {
        doorX = padding;
        currentY += maxHeightInRow + padding;
        maxHeightInRow = 0;
      }

      this.drawPaletteDoor(doorX, currentY, doorWidth, doorHeight, door, unitHeight, this.SCALE);
      doorX += doorWidth + padding;
      maxHeightInRow = Math.max(maxHeightInRow, doorHeight);
      maxY = Math.max(maxY, currentY + doorHeight);
    }

    // Resize stage height to fit content exactly
    const newHeight = maxY + 20; // 10px top + 10px bottom padding
    this.paletteStage!.height(newHeight);
  }

  // Select category tab
  selectCategory(category: string) {
    this.selectedCategory = category;
    this.renderPalette();
  }

  private drawPaletteDoor(x: number, y: number, width: number, height: number, door: PaletteDoor, unitHeight: number, scale: number) {
    const doorGroup = new Konva.Group({
      x,
      y
      // NOT draggable - we'll handle drag manually
    });
    const textFill = getTextFillForCabinetColor(this.cabinetColor);

    // Use KonvaDrawerFactory for realistic door rendering
    // Note: palette doors should NOT have numeric labels (they show door type, not tenant number)
    const doorDrawer = KonvaDrawerFactory.createDrawer(
      door.name,
      width,
      height,
      {
        x: 0,
        y: 0,
        label: undefined, // No numeric label for palette doors
        cabinetColor: this.cabinetColor,
        textFill: textFill,
        unitHeight: unitHeight,
        scale: this.SCALE / 5 // Scale door elements proportionally to SCALE (5 was original)
      }
    );
    doorGroup.add(doorDrawer);

    // Add subtle border for visibility
    const border = new Konva.Rect({
      x: 0,
      y: 0,
      width: width,
      height: height,
      fill: undefined,
      stroke: 'rgba(0, 123, 255, 0.2)',
      strokeWidth: 1,
      cornerRadius: 4
    });
    doorGroup.add(border);

    // Store door data
    doorGroup.setAttr('doorData', door);
    doorGroup.setAttr('isPaletteDoor', true);
    doorGroup.setAttr('borderRect', border);

    // Hover effect
    doorGroup.on('mouseenter', () => {
      if (this.draggedDoor === null) {
        document.body.style.cursor = 'grab';
        border.stroke('rgba(0, 123, 255, 0.8)');
        border.strokeWidth(2);
      }
    });

    doorGroup.on('mouseleave', () => {
      if (this.draggedDoor === null) {
        document.body.style.cursor = 'default';
        border.stroke('rgba(0, 123, 255, 0.2)');
        border.strokeWidth(1);
      }
    });

    // Manual drag handling with mousedown
    doorGroup.on('mousedown', () => {
      this.startDrag(door, doorGroup, border);
    });

    this.paletteLayer!.add(doorGroup);
  }

  private startDrag(door: PaletteDoor, doorGroup: Konva.Group, border: Konva.Rect) {
    this.draggedDoor = door;
    document.body.style.cursor = 'grabbing';

    // Hide original door (make it semi-transparent)
    doorGroup.opacity(0.3);

    // Create drag preview on separate layer
    this.createDragPreview(door);

    // Set up global mouse event handlers
    const onMouseMove = (e: MouseEvent) => {
      if (!this.draggedDoor) return;

      // Update drag preview position based on client coordinates
      this.updateDragPreviewFromMouse(e.clientX, e.clientY);
      this.checkCabinetDoorHover(door);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!this.draggedDoor) return;

      // Clean up event listeners
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Restore original door
      doorGroup.opacity(1);

      // Destroy drag preview
      this.destroyDragPreview();

      // Check if dropped on cabinet door
      this.handleDropOnCabinet(door);

      // Clear highlights
      this.highlightedDoors.clear();
      this.invalidDoors.clear();
      this.renderCabinet();

      this.draggedDoor = null;
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private createDragPreview(door: PaletteDoor) {
    // Use same scale as cabinet for consistent preview
    const scale = this.SCALE;
    const unitHeight = this.DOOR_UNIT * scale;
    const previewHeight = getDoorUnits(door.name) * unitHeight;

    // Calculate actual door width from cabinet (same as in renderCabinet)
    const leftDoors = this.getLeftDoors();
    const rightDoors = this.getRightDoors();
    const isDoubleColumn = rightDoors.length > 0;
    const FRAME_TB_PX = this.FRAME_TB * scale;
    const FRAME_SIDE_PX = this.FRAME_SIDE * scale;
    const FRAME_MID_PX = this.FRAME_MID * scale;
    const cabinetWidth = this.frame.width * scale;
    const availWidth = cabinetWidth - (2 * FRAME_SIDE_PX);
    const previewWidth = isDoubleColumn ? (availWidth - FRAME_MID_PX) / 2 : availWidth;

    // Create HTML-based drag preview element
    const previewElement = document.createElement('div');
    previewElement.style.position = 'fixed';
    previewElement.style.pointerEvents = 'none';
    previewElement.style.zIndex = '99999';
    previewElement.style.opacity = '0.9';
    previewElement.style.border = '2px solid #007bff';
    previewElement.style.borderRadius = '4px';
    previewElement.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    previewElement.style.width = `${previewWidth}px`;
    previewElement.style.height = `${previewHeight}px`;
    previewElement.style.transform = 'translate(-50%, -50%)';

    // Create canvas for the door
    const canvas = document.createElement('canvas');
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    previewElement.appendChild(canvas);

    // Create Konva stage for the preview (just for rendering)
    const previewStage = new Konva.Stage({
      container: previewElement,
      width: previewWidth,
      height: previewHeight
    });
    const previewLayer = new Konva.Layer();
    previewStage.add(previewLayer);

    const textFill = getTextFillForCabinetColor(this.cabinetColor);

    // Draw the door using KonvaDrawerFactory
    const doorDrawer = KonvaDrawerFactory.createDrawer(
      door.name,
      previewWidth,
      previewHeight,
      {
        x: 0,
        y: 0,
        label: undefined, // No numeric label for palette doors during drag
        cabinetColor: this.cabinetColor,
        textFill: textFill,
        unitHeight: unitHeight,
        scale: 1 // Sizes are already calculated with proper scale
      }
    );
    previewLayer.add(doorDrawer);

    // Add to document body
    document.body.appendChild(previewElement);
    this.dragPreviewElement = previewElement;
  }

  private updateDragPreview() {
    // Deprecated - use updateDragPreviewFromMouse instead
    if (!this.dragPreview || !this.cabinetStage) return;

    const pointerPos = this.cabinetStage.getPointerPosition();
    if (pointerPos) {
      this.dragPreview.position({
        x: pointerPos.x,
        y: pointerPos.y
      });
    }
  }

  private updateDragPreviewFromMouse(clientX: number, clientY: number) {
    if (!this.dragPreviewElement) return;

    // Position the HTML element at cursor position
    this.dragPreviewElement.style.left = `${clientX}px`;
    this.dragPreviewElement.style.top = `${clientY}px`;
  }

  private destroyDragPreview() {
    if (this.dragPreview) {
      this.dragPreview.destroy();
      this.dragPreview = null;
    }

    if (this.dragPreviewElement) {
      document.body.removeChild(this.dragPreviewElement);
      this.dragPreviewElement = null;
    }
  }

  private getSlotAtPosition(pointerPos: { x: number; y: number }): { slotIndex: number; column: 'left' | 'right' } | null {
    const { leftColX, rightColX, leftColWidth, rightColWidth, unitHeight, doorsStartY, isDoubleColumn } = this.cabinetGeometry;
    
    // Determine column
    let column: 'left' | 'right' | null = null;
    if (pointerPos.x >= leftColX && pointerPos.x <= leftColX + leftColWidth) {
      column = 'left';
    } else if (isDoubleColumn && pointerPos.x >= rightColX && pointerPos.x <= rightColX + rightColWidth) {
      column = 'right';
    }
    
    if (!column) return null;
    
    // Determine slot index from Y position
    const relativeY = pointerPos.y - doorsStartY;
    if (relativeY < 0 || relativeY > this.totalUnits * unitHeight) return null;
    
    const slotIndex = Math.floor(relativeY / unitHeight);
    if (slotIndex < 0 || slotIndex >= this.totalUnits) return null;
    
    return { slotIndex, column };
  }

  private checkCabinetDoorHover(draggedDoor: PaletteDoor) {
    if (!this.cabinetStage) return;

    const pointerPos = this.cabinetStage.getPointerPosition();
    if (!pointerPos) {
      this.highlightedDoors.clear();
      this.invalidDoors.clear();
      this.renderCabinet();
      return;
    }

    // Clear previous highlights
    this.highlightedDoors.clear();
    this.invalidDoors.clear();

    // Find cabinet door under pointer
    const shapes = this.cabinetLayer!.getChildren((node: Konva.Node) => {
      return node.getAttr('isCabinetDoor') === true;
    });

    // Sort doors by position (Y) for each column
    const leftDoors = shapes.filter(s => {
      const data = s.attrs.doorData as Door;
      return data?.column !== 'right';
    }).sort((a, b) => a.y() - b.y());
    const rightDoors = shapes.filter(s => {
      const data = s.attrs.doorData as Door;
      return data?.column === 'right';
    }).sort((a, b) => a.y() - b.y());

    let foundDoor = false;

    // Check left doors first
    for (const shape of leftDoors) {
      if (this.checkDoorHover(shape, pointerPos, draggedDoor)) {
        foundDoor = true;
        break;
      }
    }

    // Then check right doors if not found
    if (!foundDoor) {
      for (const shape of rightDoors) {
        if (this.checkDoorHover(shape, pointerPos, draggedDoor)) {
          foundDoor = true;
          break;
        }
      }
    }

    // If no door found, check if hovering over empty slots
    if (!foundDoor) {
      const slotInfo = this.getSlotAtPosition(pointerPos);
      if (slotInfo) {
        this.checkEmptySlotHover(slotInfo.slotIndex, slotInfo.column, draggedDoor);
      }
    }

    this.renderCabinet();
  }

  private checkEmptySlotHover(startSlotIndex: number, column: 'left' | 'right', draggedDoor: PaletteDoor) {
    const draggedUnits = getDoorUnits(draggedDoor.name);
    const slots = column === 'left' ? this.leftSlots : this.rightSlots;
    
    // Check if we have enough consecutive empty or occupied-by-same-door slots
    let availableSlots = 0;
    const affectedDoors = new Set<Door>();
    
    for (let i = startSlotIndex; i < startSlotIndex + draggedUnits && i < this.totalUnits; i++) {
      const slot = slots[i];
      
      if (slot.door === null && !slot.isOccupiedByAbove) {
        // Empty slot - good
        availableSlots++;
      } else if (slot.door !== null || slot.isOccupiedByAbove) {
        // Occupied by a door - track it
        const occupyingDoor = slot.door || this.findDoorOccupyingSlot(i, column);
        if (occupyingDoor) {
          affectedDoors.add(occupyingDoor);
        }
        availableSlots++;
      }
    }
    
    // Check if we have enough space
    if (availableSlots === draggedUnits && startSlotIndex + draggedUnits <= this.totalUnits) {
      // Highlight all affected doors
      affectedDoors.forEach(door => {
        this.highlightedDoors.add(this.getDoorId(door));
      });
      
      // Create a virtual door ID for empty slot highlighting
      if (affectedDoors.size === 0) {
        // No doors affected, just empty space - we'll highlight in renderCabinet
        // For now, add a special marker
        this.highlightedDoors.add(`empty-${startSlotIndex}-${column}`);
      }
    } else {
      // Not enough space - mark as invalid
      affectedDoors.forEach(door => {
        this.invalidDoors.add(this.getDoorId(door));
      });
      
      if (affectedDoors.size === 0) {
        this.invalidDoors.add(`empty-${startSlotIndex}-${column}`);
      }
    }
  }

  private checkDoorHover(shape: Konva.Node, pointerPos: { x: number; y: number }, draggedDoor: PaletteDoor): boolean {
    const group = shape as Konva.Group;
    const doorData = shape.attrs.doorData as Door;
    const column = doorData.column || 'left';

    const doorX = group.x();
    const doorY = group.y();
    const doorWidth = group.width();
    const doorHeight = group.height();

    // Check if pointer is over this door
    if (pointerPos.x >= doorX && pointerPos.x <= doorX + doorWidth &&
        pointerPos.y >= doorY && pointerPos.y <= doorY + doorHeight) {

      const draggedUnits = getDoorUnits(draggedDoor.name);
      const targetUnits = getDoorUnits(doorData.door_type);

      // For single-unit dragged door or target door has enough units
      if (draggedUnits === 1 || draggedUnits <= targetUnits) {
        const doorId = this.getDoorId(doorData);
        this.highlightedDoors.add(doorId);
        return true;
      }

      // For multi-unit dragged door, find multiple doors to replace
      const doorsInColumn = this.cabinetLayer!.getChildren((node: Konva.Node) => {
        const d = node.attrs.doorData as Door;
        return node.getAttr('isCabinetDoor') === true && (d?.column || 'left') === column;
      }).sort((a, b) => a.y() - b.y());

      const startIndex = doorsInColumn.indexOf(group);
      if (startIndex === -1) return false;

      let totalUnits = 0;
      const doorsToHighlight: string[] = [];

      for (let i = startIndex; i < doorsInColumn.length; i++) {
        const d = doorsInColumn[i];
        const door = d.attrs.doorData as Door;
        const units = getDoorUnits(door.door_type);
        totalUnits += units;
        doorsToHighlight.push(this.getDoorId(door));

        if (totalUnits >= draggedUnits) {
          // Found enough units
          doorsToHighlight.forEach(id => this.highlightedDoors.add(id));
          return true;
        }
      }

      // Not enough units in remaining doors - mark as invalid
      doorsToHighlight.forEach(id => this.invalidDoors.add(id));
      return true;
    }

    return false;
  }

  private handleDropOnCabinet(draggedDoor: PaletteDoor): boolean {
    if (!this.cabinetStage || this.highlightedDoors.size === 0) return false;

    // Check if any highlighted doors are invalid
    for (const doorId of this.highlightedDoors) {
      if (this.invalidDoors.has(doorId)) {
        return false; // Don't allow drop if any door is invalid
      }
    }

    // Check if dropping on empty slots
    const emptySlotIds = Array.from(this.highlightedDoors).filter(id => id.startsWith('empty-'));
    if (emptySlotIds.length > 0) {
      // Parse the empty slot ID to get position and column
      const firstEmptyId = emptySlotIds[0];
      const parts = firstEmptyId.split('-');
      const slotIndex = parseInt(parts[1], 10);
      const column = parts[2] as 'left' | 'right';
      
      // Get all actual doors that are highlighted (not empty slots)
      const actualDoorIds = Array.from(this.highlightedDoors).filter(id => !id.startsWith('empty-'));
      
      if (actualDoorIds.length > 0) {
        // There are some real doors highlighted along with empty slots
        // Use replaceDoors logic
        const shapes = this.cabinetLayer!.getChildren((node: Konva.Node) => {
          return node.getAttr('isCabinetDoor') === true;
        });
        
        let firstDoor: Door | null = null;
        for (const shape of shapes) {
          const door = shape.attrs.doorData as Door;
          const doorId = this.getDoorId(door);
          if (actualDoorIds.includes(doorId)) {
            firstDoor = door;
            break;
          }
        }
        
        if (firstDoor) {
          this.replaceDoors(firstDoor, draggedDoor.name, actualDoorIds);
          return true;
        }
      } else {
        // Only empty slots - create new door
        this.createDoorAtSlot(slotIndex, column, draggedDoor.name);
        return true;
      }
    }

    // Get the first highlighted door (top-most)
    const shapes = this.cabinetLayer!.getChildren((node: Konva.Node) => {
      return node.getAttr('isCabinetDoor') === true;
    });

    let firstDoor: Door | null = null;
    for (const shape of shapes) {
      const door = shape.attrs.doorData as Door;
      const doorId = this.getDoorId(door);
      if (this.highlightedDoors.has(doorId)) {
        firstDoor = door;
        break;
      }
    }

    if (!firstDoor) return false;

    // Replace highlighted doors with new door
    this.replaceDoors(firstDoor, draggedDoor.name, Array.from(this.highlightedDoors));
    return true;
  }

  private createDoorAtSlot(slotIndex: number, column: 'left' | 'right', doorType: string) {
    if (!this.frame.doors) {
      this.frame.doors = [];
    }
    
    const newDoor: Door = {
      position: slotIndex,
      door_type: doorType.toUpperCase(),
      column: column === 'right' ? 'right' : undefined
    };
    
    this.frame.doors.push(newDoor);
    
    this.initializeSlots();
    this.renderCabinet();
  }

  replaceDoors(firstDoor: Door, newDoorType: string, doorIdsToRemove: string[]) {
    if (!this.frame.doors) return;

    const newDoorUnits = getDoorUnits(newDoorType);
    const column = firstDoor.column || 'left';
    const slots = column === 'left' ? this.leftSlots : this.rightSlots;
    
    const doorsToRemoveObjects = this.frame.doors.filter(door => {
      const doorId = this.getDoorId(door as Door);
      return doorIdsToRemove.includes(doorId);
    });
    
    let minPosition = firstDoor.position;
    let totalFreedSlots = 0;
    
    doorsToRemoveObjects.forEach(door => {
      const doorType = (door as Door).door_type.toLowerCase();
      const units = getDoorUnits(doorType);
      totalFreedSlots += units;
      minPosition = Math.min(minPosition, (door as Door).position);
    });
    
    if (newDoorUnits > totalFreedSlots) {
      console.warn('New door requires more units than available');
      return;
    }
    
    let updatedDoors = this.frame.doors.filter(door => {
      const doorId = this.getDoorId(door as Door);
      return !doorIdsToRemove.includes(doorId);
    });
    
    const newDoor: Door = {
      ...firstDoor,
      door_type: newDoorType.toUpperCase(),
      position: minPosition
    };
    updatedDoors.push(newDoor);
    
    this.frame.doors = updatedDoors;
    
    this.initializeSlots();
    this.renderCabinet();
  }

  canSave(): boolean {
    return !this.hasEmptySlots();
  }

  onSave() {
    if (!this.canSave()) {
      alert('Cannot save: Cabinet has empty slots. Please fill all slots with doors or adjust the configuration.');
      return;
    }
    
    // Convert absolute positions back to sequential before saving
    this.denormalizeDoorPositions();
    
    // Sort doors array to ensure correct rendering order
    // Main renderer iterates through doors sequentially, so array order matters
    if (this.frame.doors) {
      this.frame.doors.sort((a, b) => {
        const colA = a.column || 'left';
        const colB = b.column || 'left';
        
        // Sort by column first (left before right)
        if (colA !== colB) {
          return colA === 'left' ? -1 : 1;
        }
        
        // Then by position within column
        return a.position - b.position;
      });
    }
    
    this.save.emit(this.frame);
  }

  onBackdropClick(event: MouseEvent) {
    if (this.draggedDoor) {
      return;
    }
    this.onClose();
  }

  onClose() {
    if (this.draggedDoor) {
      return;
    }
    this.close.emit();
  }
}
