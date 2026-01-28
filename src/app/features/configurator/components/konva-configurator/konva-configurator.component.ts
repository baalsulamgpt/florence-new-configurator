import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { KonvaStateService } from '../../services/konva-state.service';
import { XmlConfigService } from '../../../../core/services/xml-config.service';
import { ProjectService, Project, SharedUser } from '../../../../core/services/project.service';
import { ProjectSettingsModalComponent } from '../../../projects/components/project-settings-modal/project-settings-modal.component';
import { ShareModalComponent } from '../../../projects/components/share-modal/share-modal.component';
import { CabinetEditorModalComponent } from './cabinet-editor-modal/cabinet-editor-modal.component';
import { FrameDefinition } from '../../models/door-type.model';
import { Frame, Door, Wall, Level } from '../../../../core/models/configurator.models';
import { FormsModule } from '@angular/forms';
import Konva from 'konva';
import { CABINET_COLORS, getTextFillForCabinetColor } from '../../../../core/constants/cabinet-colors';
import { getDoorUnits } from '../../../../core/constants/door-configs';
import { KonvaDrawerFactory } from './konva-drawer-factory';
import { Subscription, Observable } from 'rxjs';
import { WallStatsPipe } from '../../pipes/wall-stats.pipe';

interface CabinetGroup {
  label: string;
  rows: number;
  height: number;
  cabinets: FrameDefinition[];
}

interface SnapPoint {
  x: number;
  y: number;
  type: 'corner' | 'midpoint' | 'center';
}

interface CabinetColor {
  name: string;
  hex: string;
  textFill: string; // Color for text and locks
}

// Frame Dimensions in Inches
const FRAME_TB = 1.125; // 1 1/8 - Top/bottom frame thickness
const FRAME_SIDE = 1.3125; // 1 5/16
const FRAME_MID = 1.4375; // 1 7/16

const STARTER_MIN_DEFAULT = [
  0, 0, 0,
  36.375,  // 3 rows
  36.375,  // 4 rows
  28,      // 5 rows
  28,      // 6 rows
  28,      // 7 rows
  28,      // 8 rows
  28,      // 9 rows
  28,      // 10 rows
  28,      // 11 rows
  15,      // 12 rows
  15,      // 13 rows
  15,      // 14 rows
  15,      // 15 rows
  15       // 16 rows
];

@Component({
  selector: 'app-konva-configurator',
  standalone: true,
  imports: [CommonModule, FormsModule, WallStatsPipe, ProjectSettingsModalComponent, ShareModalComponent, CabinetEditorModalComponent],
  templateUrl: './konva-configurator.component.html',
  styleUrls: ['./konva-configurator.component.scss']
})
export class KonvaConfiguratorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef;
  @ViewChild('inlineInput') inlineInput!: ElementRef;
  
  private stage!: Konva.Stage;
  private layer!: Konva.Layer;
  private gridLayer!: Konva.Layer;
  private selectionLayer!: Konva.Layer;
  private hoverLayer!: Konva.Layer;
  private wallSubscription?: Subscription;

  // Scale factor: 1 inch = 6 pixels (increased from 5 for sharper graphics)
  readonly SCALE = 6; 
  readonly MAX_HEIGHT_INCH = 67;
  
  // Canvas dimensions - will be set dynamically
  width = 1200;
  height = 800;
  
  // Floor Y position (calculated)
  floorY = 0;

  cabinetGroups: CabinetGroup[] = [];
  allDefinitions: FrameDefinition[] = [];
  expandedGroups: Set<number> = new Set();
  
  // State for dragging
  private isReordering = false;
  private dragStartIndex = -1;
  private dragPlaceholderLine: Konva.Group | null = null;
  private cachedSiblingGroups: Konva.Group[] = [];
  
  // Selection
  private selectedFrameId: string | null = null;
  private selectionRect: Konva.Rect | null = null;
  private hoveredFrameId: string | null = null;
  private hoverRect: Konva.Rect | null = null;
  private duplicateButton: Konva.Group | null = null;
  private editButton: Konva.Group | null = null;

  // Editor Modal
  isEditorOpen = false;
  editingFrame: Frame | null = null;
  
  // Numbering Mode
  isNumberingMode = false;
  nextNumber = 1;
  tenantStart = 1;
  parcelStart = 1;
  
  // Inline Editing
  editingDoor: { frameId: string, door: Door } | null = null;
  inputPosition = { x: 0, y: 0, width: 0, height: 0 };
  inputValue = '';

  // Cabinet Color - using shared constants
  cabinetColors = CABINET_COLORS;
  selectedColor = 'Silver Speck';
  isColorDropdownOpen = false;
  currentCabinetColor = '#dbe0eb';
  currentTextFill = '#555';

  // Cabinets Mode
  isCabinetsMode = false;
  selectedCabinetHeight: number | null = null;

  // Levels & Walls
  levels$!: Observable<Level[]>;
  activeLevelId$!: Observable<number>;
  activeWallId$!: Observable<number>;
  activeLevelName = 'Level 1';
  activeWallName = 'Wall 1';
  editingLevelId: number | null = null;
  editingWallId: number | null = null;
  activeActionsMenu: string | null = null; // 'level-{id}' or 'wall-{id}'

  // Panel visibility
  sidebarVisible = true;
  rightPanelVisible = false;

  // Project
  currentProject: Project | null = null;
  editingProjectName = false;
  @ViewChild('projectNameInput') projectNameInput!: ElementRef;
  isProjectSettingsOpen = false;
  stateChangeSubscription?: Subscription;
  routerSubscription?: Subscription;

  // User menu
  isUserMenuOpen = false;
  currentUserEmail = 'user@example.com'; // TODO: Get from Drupal/session

  // Share modal
  isShareModalOpen = false;
  currentShareProject: Project | null = null;

  // Canvas Info Panel
  canvasStats: { tenantCabinets: number; parcelCabinets: number; maxWidth: number; maxHeight: number } | null = null;
  private activeWallSubscription?: Subscription;

  private resizeHandler = () => this.handleResize();
  private keydownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);

  // Close dropdowns when clicking outside
  private clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.actions-menu') && !target.closest('.wall-actions-menu')) {
          this.activeActionsMenu = null;
      }
      if (!target.closest('.user-menu-container')) {
          this.isUserMenuOpen = false;
      }
  };

  constructor(
    private stateService: KonvaStateService,
    private xmlService: XmlConfigService,
    private projectService: ProjectService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Load current project
    this.loadCurrentProject();

    // Subscribe to router navigation events to reload project when navigating between projects
    this.routerSubscription = this.router.events.subscribe(event => {
      // Only reload on NavigationEnd event to /konva route
      if (event instanceof NavigationEnd && event.url === '/konva') {
        this.loadCurrentProject();
      }
    });

    // Initialize observables after stateService is injected
    this.levels$ = this.stateService.levels$;
    this.activeLevelId$ = this.stateService.activeLevelId$;
    this.activeWallId$ = this.stateService.activeWallId$;

    // Subscribe to state changes for auto-save
    this.subscribeToStateChanges();

    this.xmlService.loadConfig().subscribe(defs => {
      this.allDefinitions = defs;
      this.processDefinitions(defs);
    });

    // Load cabinet color from project first, then fallback to localStorage
    this.loadCabinetColorFromProject();

    // Keyboard events for deletion
    window.addEventListener('keydown', this.keydownHandler);
    // Click handler for closing dropdowns
    document.addEventListener('click', this.clickHandler);
  }

  // Measure Mode - New implementation
  isMeasuringMode = false;
  private interactionLayer!: Konva.Layer;
  private completedMeasurements: Konva.Group | null = null;
  private measureFirstPoint: Konva.Vector2d | null = null;
  private measureSecondPoint: Konva.Vector2d | null = null;
  private snapPointsGroup: Konva.Group | null = null;
  private measureHoveredFrameId: string | null = null; // Separate from normal hover
  private firstPointMarker: Konva.Circle | null = null;
  private secondPointMarker: Konva.Circle | null = null;
  private tempMeasureLine: Konva.Line | null = null;
  private measureText: Konva.Text | null = null;
  private measureTextBg: Konva.Rect | null = null;
  private readonly SNAP_THRESHOLD = 30; // Pixels to snap - increased for easier targeting
  private readonly SNAP_SIZE = 8; // Size of snap point indicator
  private readonly MEASURE_COLOR = '#0099cc'; // Darker cyan

  ngAfterViewInit() {
    this.initKonva();
    this.drawGrid();

    // Subscribe to wall changes to render frames
    this.wallSubscription = this.stateService.activeWall$.subscribe(wall => {
        if (wall) {
            this.renderFrames(wall.frames);
        } else {
            this.layer.destroyChildren();
        }
    });

    // Subscribe to active level/wall changes to update display names
    this.stateService.activeLevel$.subscribe(level => {
        if (level) {
            this.activeLevelName = level.level_name;
            // Ensure change detection runs
            this.cdr.detectChanges();
        }
    });

    this.stateService.activeWall$.subscribe(wall => {
        if (wall) {
            this.activeWallName = wall.wall_name || `Wall ${wall.wall_id + 1}`;
            this.updateCanvasStats(wall);
            // Ensure change detection runs
            this.cdr.detectChanges();
        }
    });

    // Handle window resize
    window.addEventListener('resize', this.resizeHandler);
  }
  
  ngOnDestroy() {
    if (this.stage) {
      this.stage.destroy();
    }
    this.wallSubscription?.unsubscribe();
    this.stateChangeSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('click', this.clickHandler);
  }

  private handleKeyDown(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedFrameId) {
          const state = this.stateService.getState();
          if (state.active_wall_id !== undefined) {
             // Store frame ID before clearing selection
             const frameToRemove = this.selectedFrameId;

             // Clear selection state first
             this.selectedFrameId = null;
             this.hoveredFrameId = null;

             // Clear both selection and hover layers immediately
             this.selectionLayer.destroyChildren();
             this.hoverLayer.destroyChildren();
             this.selectionLayer.batchDraw();
             this.hoverLayer.batchDraw();

             // Then remove the frame (this triggers renderFrames via subscription)
             this.stateService.removeFrame(state.active_wall_id, frameToRemove);
          }
      }
  }

  toggleMeasureMode() {
      this.isMeasuringMode = !this.isMeasuringMode;
      if (this.isMeasuringMode) {
          this.isNumberingMode = false;
          this.stage.container().style.cursor = 'crosshair';
          // Clear all selections and hovers
          this.selectedFrameId = null;
          this.hoveredFrameId = null;
          this.selectionLayer.destroyChildren();
          this.hoverLayer.destroyChildren();
          this.selectionLayer.batchDraw();
          this.hoverLayer.batchDraw();
          // Create group for completed measurements
          this.completedMeasurements = new Konva.Group({ listening: false });
          this.interactionLayer.add(this.completedMeasurements);
          // Disable cabinet dragging while measuring
          const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
          groups.forEach(g => g.draggable(false));
      } else {
          this.stage.container().style.cursor = 'default';
          // Clear measurement and re-enable dragging
          this.clearMeasurement();
          const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
          groups.forEach(g => g.draggable(true));
      }
  }

  clearMeasurement() {
      // Clear all measurement elements
      if (this.snapPointsGroup) {
          this.snapPointsGroup.destroy();
          this.snapPointsGroup = null;
      }
      // Destroy completed measurements group (contains all measurements)
      if (this.completedMeasurements) {
          this.completedMeasurements.destroy();
          this.completedMeasurements = null;
      }
      // Reset all references
      this.measureHoveredFrameId = null;
      this.firstPointMarker = null;
      this.secondPointMarker = null;
      this.tempMeasureLine = null;
      this.measureText = null;
      this.measureTextBg = null;
      this.measureFirstPoint = null;
      this.measureSecondPoint = null;
      this.interactionLayer.batchDraw();
  }

  // Reset current measurement (but keep completed ones)
  private resetCurrentMeasurement() {
      // Just reset references, don't destroy (they're in completedMeasurements group now)
      this.firstPointMarker = null;
      this.secondPointMarker = null;
      this.tempMeasureLine = null;
      this.measureText = null;
      this.measureTextBg = null;
      this.measureFirstPoint = null;
      this.measureSecondPoint = null;
  }

  // Get snap points for a specific cabinet group
  private getSnapPointsForGroup(group: Konva.Group): SnapPoint[] {
      const points: SnapPoint[] = [];
      const x = group.x();
      const y = group.y();
      const width = group.width();
      const height = group.height();

      // Corners (4)
      points.push({ x, y, type: 'corner' }); // Top-left
      points.push({ x: x + width, y, type: 'corner' }); // Top-right
      points.push({ x, y: y + height, type: 'corner' }); // Bottom-left
      points.push({ x: x + width, y: y + height, type: 'corner' }); // Bottom-right

      // Midpoints (4)
      points.push({ x: x + width / 2, y, type: 'midpoint' }); // Top
      points.push({ x: x + width / 2, y: y + height, type: 'midpoint' }); // Bottom
      points.push({ x, y: y + height / 2, type: 'midpoint' }); // Left
      points.push({ x: x + width, y: y + height / 2, type: 'midpoint' }); // Right

      // Center (1)
      points.push({ x: x + width / 2, y: y + height / 2, type: 'center' });

      return points;
  }

  // Show all snap points for a cabinet when hovering
  private showSnapPointsForGroup(group: Konva.Group) {
      if (!this.isMeasuringMode) return;
      if (this.snapPointsGroup) {
          this.snapPointsGroup.destroy();
      }

      const snapGroup = new Konva.Group({ listening: false });
      this.snapPointsGroup = snapGroup;
      const points = this.getSnapPointsForGroup(group);

      points.forEach(point => {
          const indicator = new Konva.Rect({
              x: point.x - this.SNAP_SIZE / 2,
              y: point.y - this.SNAP_SIZE / 2,
              width: this.SNAP_SIZE,
              height: this.SNAP_SIZE,
              stroke: '#ff8c00', // Dark orange
              strokeWidth: 2,
              fill: 'rgba(255, 140, 0, 0.3)', // Dark orange with opacity
              listening: false
          });
          snapGroup.add(indicator);
      });

      this.interactionLayer.add(snapGroup);
      this.interactionLayer.batchDraw();
  }

  // Show marker for a point (first or second)
  private showPointMarker(pos: Konva.Vector2d, isSecond: boolean = false) {
      const marker = new Konva.Circle({
          x: pos.x,
          y: pos.y,
          radius: 6,
          stroke: this.MEASURE_COLOR, // Darker cyan
          strokeWidth: 2,
          fill: '#ffffff', // White fill
          listening: false
      });

      if (isSecond) {
          this.secondPointMarker = marker;
      } else {
          this.firstPointMarker = marker;
      }
      this.interactionLayer.add(marker);
      this.interactionLayer.batchDraw();
  }

  // Hide snap points
  private hideSnapPoints() {
      if (this.snapPointsGroup) {
          this.snapPointsGroup.destroy();
          this.snapPointsGroup = null;
          this.interactionLayer.batchDraw();
      }
  }

  // Find nearest snap point to cursor
  private findNearestSnapPoint(pos: Konva.Vector2d, points: SnapPoint[]): Konva.Vector2d | null {
      let nearest: SnapPoint | null = null;
      let minDist = this.SNAP_THRESHOLD;

      for (const point of points) {
          const dist = Math.sqrt(
              Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2)
          );
          if (dist < minDist) {
              minDist = dist;
              nearest = point;
          }
      }

      if (!nearest) return null;
      return { x: nearest.x, y: nearest.y };
  }

  // Handle click in measure mode
  private handleMeasureClick(pos: Konva.Vector2d) {
      // Get all snap points from all cabinets
      const allPoints: SnapPoint[] = [];
      const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
      groups.forEach(group => {
          if (group instanceof Konva.Group) {
              allPoints.push(...this.getSnapPointsForGroup(group));
          }
      });

      // Find nearest snap point
      const snapped = this.findNearestSnapPoint(pos, allPoints);
      const clickPos = snapped || pos;

      if (!this.measureFirstPoint) {
          // First click - set first point
          this.measureFirstPoint = clickPos;
          this.showPointMarker(clickPos, false);
      } else if (!this.measureSecondPoint) {
          // Second click - set second point and complete measurement
          this.measureSecondPoint = clickPos;
          this.showPointMarker(clickPos, true);
          this.completeMeasurement();
      } else {
          // Third click - start new measurement (keep completed ones)
          this.resetCurrentMeasurement();
          this.measureFirstPoint = clickPos;
          this.showPointMarker(clickPos, false);
      }
  }

  // Complete measurement and show result
  private completeMeasurement() {
      if (!this.measureFirstPoint || !this.measureSecondPoint || !this.completedMeasurements) return;

      const p1 = this.measureFirstPoint;
      const p2 = this.measureSecondPoint;

      // Draw line between points with new darker cyan color
      this.tempMeasureLine = new Konva.Line({
          points: [p1.x, p1.y, p2.x, p2.y],
          stroke: this.MEASURE_COLOR,
          strokeWidth: 2,
          dash: [10, 5],
          listening: false
      });
      this.completedMeasurements.add(this.tempMeasureLine);

      // Calculate distance
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const distInch = distPx / this.SCALE;

      // Show text in middle
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const text = `${distInch.toFixed(2)}"`;

      // Create text first to get dimensions (reduced padding)
      const textObj = new Konva.Text({
          x: midX,
          y: midY,
          text: text,
          fontSize: 14,
          fill: '#ffffff', // White text
          fontStyle: 'bold',
          listening: false,
          align: 'center',
          padding: 4 // Reduced from 8
      });
      textObj.offsetX(textObj.width() / 2);
      textObj.offsetY(textObj.height() / 2);

      // Create rounded rectangle background for text with new color
      this.measureTextBg = new Konva.Rect({
          x: midX,
          y: midY,
          width: textObj.width() + 10, // Reduced from 16
          height: textObj.height() + 2, // Reduced from 4
          stroke: this.MEASURE_COLOR,
          strokeWidth: 2,
          fill: this.MEASURE_COLOR,
          cornerRadius: 6,
          listening: false
      });
      this.measureTextBg.offsetX(this.measureTextBg.width() / 2);
      this.measureTextBg.offsetY(this.measureTextBg.height() / 2);

      // Add background first, then text
      this.completedMeasurements.add(this.measureTextBg);
      this.completedMeasurements.add(textObj);

      // Store reference to text for cleanup
      this.measureText = textObj;

      // Move markers to completed measurements group
      if (this.firstPointMarker) {
          this.firstPointMarker.moveTo(this.completedMeasurements);
      }
      if (this.secondPointMarker) {
          this.secondPointMarker.moveTo(this.completedMeasurements);
      }

      this.interactionLayer.batchDraw();
  }

  private handleResize() {
      if (!this.containerRef) return;
      const container = this.containerRef.nativeElement;
      this.width = container.clientWidth;
      this.height = container.clientHeight;
      this.stage.width(this.width);
      this.stage.height(this.height);

      // Recalculate floor Y - position floor 100px below center
      this.floorY = (this.height / 2) + 100;

      // Keep stage positioned to show left labels
      this.stage.position({ x: 150, y: 0 });

      this.drawGrid();

      // Re-render frames if we have active wall
      const wall = this.stateService.getActiveWall();
      if (wall) {
          this.renderFrames(wall.frames);
      }
  }

  processDefinitions(defs: FrameDefinition[]) {
    const map = new Map<number, FrameDefinition[]>();
    defs.forEach(def => {
        // Filter out advanced mode cabinets - only show standard mode in preview
        if (def.mode !== 'standard') return;

        const rows = def.ih || 0;
        if (!map.has(rows)) map.set(rows, []);
        map.get(rows)!.push(def);
    });

    this.cabinetGroups = Array.from(map.entries())
        .map(([rows, items]) => {
            // Get height from first item in group (all items in group have same height)
            const height = items[0]?.height || 0;
            return {
                label: `${rows} Rows (${height}")`,
                rows: rows,
                height: height,
                cabinets: items
            };
        })
        .sort((a, b) => b.rows - a.rows);

    if (this.cabinetGroups.length > 0) {
        this.expandedGroups.add(this.cabinetGroups[0].rows);
        if (!this.selectedCabinetHeight) {
            this.selectedCabinetHeight = this.cabinetGroups[0].rows;
        }
    }
  }

  toggleGroup(height: number) {
      if (this.expandedGroups.has(height)) {
          this.expandedGroups.delete(height);
      } else {
          this.expandedGroups.add(height);
      }
  }
  
  isGroupExpanded(height: number): boolean {
      return this.expandedGroups.has(height);
  }

  toggleNumberingMode() {
      this.isNumberingMode = !this.isNumberingMode;
      if (this.isNumberingMode) {
          // Turn off measure mode if active
          if (this.isMeasuringMode) {
              this.isMeasuringMode = false;
              this.clearMeasurement();
              // Re-enable dragging
              const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
              groups.forEach(g => g.draggable(true));
              this.stage.container().style.cursor = 'default';
          }
          // Turn off cabinets mode if active
          if (this.isCabinetsMode) {
              this.isCabinetsMode = false;
          }
      }
      const wall = this.stateService.getActiveWall();
      if (wall) {
          this.renderFrames(wall.frames);
      }
  }

  toggleCabinetsMode() {
      this.isCabinetsMode = !this.isCabinetsMode;
      if (this.isCabinetsMode) {
          // Turn off other modes
          if (this.isNumberingMode) {
              this.isNumberingMode = false;
          }
          if (this.isMeasuringMode) {
              this.isMeasuringMode = false;
              this.clearMeasurement();
              const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
              groups.forEach(g => g.draggable(true));
              this.stage.container().style.cursor = 'default';
          }
          // Auto-select first height if none selected
          if (!this.selectedCabinetHeight && this.cabinetGroups.length > 0) {
              this.selectedCabinetHeight = this.cabinetGroups[0].height;
          }
      }
      const wall = this.stateService.getActiveWall();
      if (wall) {
          this.renderFrames(wall.frames);
      }
  }

  selectCabinetHeight(height: number) {
      this.selectedCabinetHeight = height;
  }

  getSelectedCabinets(): FrameDefinition[] {
      if (!this.selectedCabinetHeight) return [];
      const group = this.cabinetGroups.find(g => g.rows === this.selectedCabinetHeight);
      return group?.cabinets || [];
  }

  getDoorColor(doorType: string): string {
      const type = doorType.toLowerCase();

      // MDSD - special color for preview (distinctive purple-gray to show it's a double door)
      if (type === 'mdsd') {
          return '#6750a4'; // distinctive purple-gray
      }

      // Darker monochrome scheme - more contrast
      // Master doors - medium-dark gray
      if (type === 'bms' || type === 'md' || type.startsWith('md')) {
          return '#546e7a';
      }

      // Parcel doors - very dark gray
      if (type.startsWith('p') || type === 'sp' || type === 'hopper' || type === 'bin' ||
          type.startsWith('hop') || type.startsWith('td')) {
          return '#37474f';
      }

      // Mail slot - darkest gray
      if (type === 'ms') {
          return '#263238';
      }

      // Tenant doors - medium gray (darker than before)
      return '#78909c';
  }

  getDoorLabel(doorType: string): string {
      const type = doorType.toLowerCase();

      // Return uppercase label for display
      if (type === 'bms') return 'BMS';
      if (type === 'ms') return 'MS';
      if (type === 'md' && type.length > 2) return type.toUpperCase();
      if (type.startsWith('md')) return type.substring(2).toUpperCase();

      if (type.startsWith('p')) {
          const match = type.match(/p(\d+)/);
          if (match) return 'P' + match[1];
      }
      if (type === 'sp') return 'SP';
      if (type.startsWith('hop')) return 'HOP';
      if (type === 'bin') return 'BIN';

      // Standard doors (sd, dd, td, qd, etc.)
      if (type.startsWith('sd')) return 'SD';
      if (type.startsWith('dd')) return 'DD';
      if (type.startsWith('td')) return 'TD';
      if (type.startsWith('qd')) return 'QD';
      if (type.startsWith('qud')) return 'QUD';

      return type.toUpperCase();
  }

  // SVG Preview - normalized scale for consistent preview sizes
  readonly PREVIEW_SCALE = 4; // Scale for preview (smaller than canvas)
  readonly PREVIEW_DOOR_UNIT = 3.5; // inches per unit (same as canvas)
  readonly PREVIEW_BASE_HEIGHT = 60; // Base height in inches for normalization

  getCabinetViewBox(cabinet: FrameDefinition): string {
      // Use physical dimensions directly (same ratio as canvas)
      // Canvas uses SCALE=5, preview uses PREVIEW_SCALE=4
      const widthPx = cabinet.width * this.PREVIEW_SCALE;
      const heightPx = cabinet.height * this.PREVIEW_SCALE;
      const padding = 4;

      return `0 0 ${widthPx + padding * 2} ${heightPx + padding * 2}`;
  }

  getCabinetBodyHeight(cabinet: FrameDefinition): number {
      // Use physical height directly (same as canvas)
      return cabinet.height * this.PREVIEW_SCALE;
  }

  getCabinetBodyWidth(cabinet: FrameDefinition): number {
      // Use physical width directly (same as canvas)
      return cabinet.width * this.PREVIEW_SCALE;
  }

  // Calculate dynamic unit height for a column (same logic as canvas)
  private getPreviewUnitHeight(cabinet: FrameDefinition, column: 'left' | 'right'): number {
      const doors = column === 'left' ? cabinet.leftColumn : cabinet.rightColumn;
      if (!doors || doors.length === 0) {
          return this.PREVIEW_DOOR_UNIT * this.PREVIEW_SCALE;
      }

      // Calculate total units in this column
      let totalUnits = 0;
      doors.forEach(door => {
          totalUnits += getDoorUnits(door);
      });

      // Use fixed unit height (not stretching to fit available space)
      return this.PREVIEW_DOOR_UNIT * this.PREVIEW_SCALE;
  }

  // Helper to get height scale for a specific cabinet
  // No longer used - preview uses direct physical dimensions like canvas
  private getHeightScale(cabinet: FrameDefinition): number {
      return 1; // No scaling
  }

  getDoorY(doors: string[], index: number, total: number, cabinet: FrameDefinition): number {
      const padding = 2;
      const frameThicknessPx = this.FRAME_TB * this.PREVIEW_SCALE;
      let y = padding + frameThicknessPx;

      // Determine which column and get dynamic unit height
      const column: 'left' | 'right' = doors === cabinet.leftColumn ? 'left' : 'right';
      const unitHeight = this.getPreviewUnitHeight(cabinet, column);

      for (let i = 0; i < index; i++) {
          const units = getDoorUnits(doors[i]);
          y += units * unitHeight;
      }

      return y;
  }

  getDoorHeight(doorType: string, total: number, isLast: boolean, cabinet: FrameDefinition): number {
      // Need to determine which column this door belongs to
      // This is called from template where we don't have direct column info
      // We'll use the total parameter to help determine, or check against cabinet columns

      // Find which column contains this door type
      let column: 'left' | 'right' = 'left';
      const doorLower = doorType.toLowerCase();

      // Check if this door is in right column
      if (cabinet.rightColumn && cabinet.rightColumn.some(d => d.toLowerCase() === doorLower)) {
          column = 'right';
      }

      const unitHeight = this.getPreviewUnitHeight(cabinet, column);
      const units = getDoorUnits(doorType);
      return units * unitHeight;
  }

  isRoundDoor(doorType: string): boolean {
      const type = doorType.toLowerCase();
      return type === 'hopper' || type === 'bin' || type.startsWith('hop');
  }

  // Frame dimensions in inches (same as canvas)
  readonly FRAME_TB = 1.5;
  readonly FRAME_SIDE = 1.5;
  readonly FRAME_MID = 1;

  getCabinetBodyX(cabinet: FrameDefinition): number {
      const padding = 2;
      return padding;
  }

  getCabinetBodyY(cabinet: FrameDefinition): number {
      const padding = 2;
      return padding;
  }

  getCabinetDoorX(cabinet: FrameDefinition, column: 'left' | 'right'): number {
      const padding = 2;
      const FRAME_TB_PX = this.FRAME_TB * this.PREVIEW_SCALE;
      const FRAME_SIDE_PX = this.FRAME_SIDE * this.PREVIEW_SCALE;
      const FRAME_MID_PX = this.FRAME_MID * this.PREVIEW_SCALE;

      const hasRight = cabinet.rightColumn && cabinet.rightColumn.length > 0;
      // Use physical width (same as canvas)
      const cabinetBodyWidth = cabinet.width * this.PREVIEW_SCALE;

      let rightColX: number;

      if (hasRight) {
          const availWidth = cabinetBodyWidth - (2 * FRAME_SIDE_PX) - FRAME_MID_PX;
          const colWidth = availWidth / 2;
          rightColX = FRAME_SIDE_PX + colWidth + FRAME_MID_PX;
      } else {
          rightColX = 0;
      }

      const leftColX = FRAME_SIDE_PX;

      return padding + (column === 'left' ? leftColX : rightColX);
  }

  getCabinetDoorWidth(cabinet: FrameDefinition, column: 'left' | 'right'): number {
      const FRAME_SIDE_PX = this.FRAME_SIDE * this.PREVIEW_SCALE;
      const FRAME_MID_PX = this.FRAME_MID * this.PREVIEW_SCALE;
      // Use physical width (same as canvas)
      const cabinetBodyWidth = cabinet.width * this.PREVIEW_SCALE;
      const hasRight = cabinet.rightColumn && cabinet.rightColumn.length > 0;

      if (hasRight) {
          const availWidth = cabinetBodyWidth - (2 * FRAME_SIDE_PX) - FRAME_MID_PX;
          return availWidth / 2;
      } else {
          return cabinetBodyWidth - (2 * FRAME_SIDE_PX);
      }
  }

  // Calculate canvas statistics for the info panel
  private updateCanvasStats(wall: Wall | null) {
      if (!wall || !wall.frames || wall.frames.length === 0) {
          this.canvasStats = null;
          return;
      }

      const stats = {
          tenantCabinets: 0,
          parcelCabinets: 0,
          maxWidth: 0,
          maxHeight: 0
      };

      wall.frames.forEach((frame: Frame) => {
          // Accumulate dimensions
          stats.maxWidth += frame.width;
          if (frame.height > stats.maxHeight) {
              stats.maxHeight = frame.height;
          }

          // Count cabinets by door type
          let hasTenant = false;
          let hasParcel = false;

          frame.doors?.forEach((door: Door) => {
              const doorType = (door.door_type || '').toLowerCase();

              // Skip special doors (master door, mail slots)
              if (['md', 'bms', 'ms', 'om'].includes(doorType)) {
                  return;
              }

              // Parcel door types
              const isParcelDoor = doorType.match(/^p\d*/) || doorType === 'sp' || doorType === 'lp' ||
                                   doorType === 'hopper' || doorType === 'bin' ||
                                   doorType.startsWith('hop') || doorType.startsWith('td');

              if (isParcelDoor) {
                  hasParcel = true;
              } else {
                  hasTenant = true;
              }
          });

          // Count cabinet based on what doors it contains
          if (hasParcel && !hasTenant) {
              stats.parcelCabinets++;
          } else if (hasTenant && !hasParcel) {
              stats.tenantCabinets++;
          } else {
              // Mixed cabinet - count in both
              stats.tenantCabinets++;
              if (hasParcel) {
                  stats.parcelCabinets++;
              }
          }
      });

      this.canvasStats = stats;
      this.cdr.detectChanges();
  }

  updateAutoNumbering() {
      const wall = this.stateService.getActiveWall();
      if (!wall) return;

      // Save start values to state
      this.stateService.setTenantNumStart(this.tenantStart);
      this.stateService.setParcelNumStart(this.parcelStart);

      let tenantCounter = this.tenantStart;
      let parcelCounter = this.parcelStart;

      // Clone frames to mutate
      const frames = JSON.parse(JSON.stringify(wall.frames)) as Frame[];

      // Sort frames by X position (Konva coordinate)
      // Actually we need to check the rendered position if possible, but the array order
      // is maintained by the reorderFrames method to match visual order.
      // So we can trust the array order.
      
      frames.forEach(frame => {
          // Process Left Column first, then Right Column
          const leftDoors = frame.doors.filter(d => d.column === 'left' || !d.column);
          const rightDoors = frame.doors.filter(d => d.column === 'right');

          const processDoor = (door: Door) => {
              const doorType = (door.door_type || '').toLowerCase();

              // Skip special doors
              if (['md', 'bms', 'ms', 'om'].includes(doorType)) {
                  door.label = undefined;
                  return;
              }

              // Standard tenant doors (sd, dd, td, qd, qud, htsd)
              const isTenantDoor = doorType === 'sd' || doorType === 'dd' || doorType === 'td' ||
                                   doorType === 'qd' || doorType === 'qud' ||
                                   doorType.startsWith('htsd');

              // Parcel doors (excluding standard tenant doors)
              const isParcelDoor = !isTenantDoor && (
                  doorType.match(/^p\d*/) || doorType === 'sp' || doorType === 'lp' ||
                  doorType === 'hopper' || doorType === 'bin' ||
                  doorType.startsWith('hop') || doorType.startsWith('td')
              );

              if (isParcelDoor) {
                  door.label = `${parcelCounter}P`;
                  parcelCounter++;
              } else {
                  // Tenant door
                  door.label = String(tenantCounter);
                  tenantCounter++;
              }
          };

          leftDoors.forEach(processDoor);
          rightDoors.forEach(processDoor);
          
          // Re-assemble doors array in correct order?
          // Actually we just mutated the objects in the filtered arrays.
          // But those objects are references to objects in frame.doors?
          // Array.filter creates a NEW array, but the elements are references if shallow copy.
          // BUT I did JSON.parse(JSON.stringify(frames)), so they are fresh objects.
          // filter() returns references to the objects inside the new 'frames' array.
          // So modifying 'door' inside forEach(processDoor) SHOULD update the object in 'frames'.
          // Let's verify: 
          // const arr = [{a:1}]; const filtered = arr.filter(x=>true); filtered[0].a = 2; console.log(arr[0].a) -> 2.
          // Yes.
      });

      // Update State
      this.stateService.updateWallFrames(wall.wall_id, frames);
      
      // Update nextNumber to match where we left off (optional but nice)
      this.nextNumber = tenantCounter;
  }

  resetNumbering() {
      const wall = this.stateService.getActiveWall();
      if (!wall) return;

      const frames = JSON.parse(JSON.stringify(wall.frames)) as Frame[];
      frames.forEach(frame => {
          frame.doors.forEach(door => {
             // Only clear if it's not a special door (optional, but safer to clear only what we number)
             // Actually, if we want to "skip" numbering, maybe we just want to clear labels?
             const type = door.door_type.toLowerCase();
             if (!['md', 'bms', 'ms', 'om'].includes(type)) {
                 door.label = undefined;
             }
          });
      });

      this.stateService.updateWallFrames(wall.wall_id, frames);
  }

  onDragStart(event: DragEvent, cabinet: FrameDefinition) {
      if (event.dataTransfer) {
          event.dataTransfer.setData('application/json', JSON.stringify({
              type: 'CABINET',
              model: cabinet.model
          }));
          event.dataTransfer.effectAllowed = 'copy';
      }
  }

  private initKonva() {
    const container = this.containerRef.nativeElement;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Position floor 100px below center of screen
    this.floorY = (this.height / 2) + 100;

    this.stage = new Konva.Stage({
      container: container,
      width: this.width,
      height: this.height,
      pixelRatio: 8, // 2x improvement (was 4)
      draggable: true // Allow panning stage
    });

    // Set initial scale to 0.75 (adjusted for SCALE=6, keeps same view as before)
    this.stage.scale({ x: 0.75, y: 0.75 });

    // Shift stage right to accommodate left side labels (~150px)
    this.stage.position({ x: 150, y: 0 });

    this.gridLayer = new Konva.Layer();
    this.layer = new Konva.Layer();
    this.interactionLayer = new Konva.Layer();
    this.selectionLayer = new Konva.Layer();
    this.hoverLayer = new Konva.Layer();

    this.stage.add(this.gridLayer);
    this.stage.add(this.layer);
    this.stage.add(this.interactionLayer);
    this.stage.add(this.selectionLayer); // Selection on top
    this.stage.add(this.hoverLayer); // Hover on top of selection

    this.stage.on('click', (e) => {
        // If clicked on stage (not on a shape that stopped propagation)
        // We actually need to check if target is not part of a group
        // But since we use bubble cancellation on group, this works.
        if (e.target === this.stage) {
            if (this.isMeasuringMode) {
                // Try to snap to nearest point
                const pos = this.stage.getPointerPosition();
                if (pos) {
                    const transform = this.stage.getAbsoluteTransform().copy();
                    transform.invert();
                    const localPos = transform.point(pos);
                    this.handleMeasureClick(localPos);
                }
            } else {
                this.selectedFrameId = null;
                this.updateSelection();
                this.finishEditing();
            }
        }
    });

    // Show snap points when hovering near cabinets in measure mode
    this.stage.on('mousemove', (e) => {
        if (!this.isMeasuringMode) return;

        const pos = this.stage.getPointerPosition();
        if (!pos) return;

        const transform = this.stage.getAbsoluteTransform().copy();
        transform.invert();
        const localPos = transform.point(pos);

        // Find nearest cabinet
        const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
        let nearestGroup: Konva.Group | null = null;
        const HOVER_BUFFER = 50; // Buffer zone around cabinet (px)
        let minDist = Infinity;

        groups.forEach(group => {
            if (!(group instanceof Konva.Group)) return;

            const x = group.x();
            const y = group.y();
            const width = group.width();
            const height = group.height();

            // Calculate distance to cabinet (including buffer zone)
            // If cursor is inside expanded box, distance is 0
            const expandedX = x - HOVER_BUFFER;
            const expandedY = y - HOVER_BUFFER;
            const expandedWidth = width + HOVER_BUFFER * 2;
            const expandedHeight = height + HOVER_BUFFER * 2;

            // Check if cursor is in expanded box
            if (localPos.x >= expandedX && localPos.x <= expandedX + expandedWidth &&
                localPos.y >= expandedY && localPos.y <= expandedY + expandedHeight) {

                // Calculate distance to cabinet center for priority
                const centerX = x + width / 2;
                const centerY = y + height / 2;
                const dist = Math.sqrt(
                    Math.pow(localPos.x - centerX, 2) +
                    Math.pow(localPos.y - centerY, 2)
                );

                if (dist < minDist) {
                    minDist = dist;
                    nearestGroup = group;
                }
            }
        });

        // Show or hide snap points based on nearest cabinet
        if (nearestGroup) {
            // Only update if different group (avoid flicker)
            const frameId = (nearestGroup as any).getAttr('frameId');
            if (this.measureHoveredFrameId !== frameId) {
                this.measureHoveredFrameId = frameId;
                this.showSnapPointsForGroup(nearestGroup);
            }
        } else if (this.snapPointsGroup) {
            this.measureHoveredFrameId = null;
            this.hideSnapPoints();
        }
    });

    this.stage.on('dragstart', () => {
        this.finishEditing();
    });
    
    this.stage.on('wheel', (e) => {
        this.finishEditing();
        e.evt.preventDefault();
        const scaleBy = 1.05;
        const oldScale = this.stage.scaleX();
        const pointer = this.stage.getPointerPosition();

        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - this.stage.x()) / oldScale,
            y: (pointer.y - this.stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

        // Limit scale
        if (newScale < 0.2 || newScale > 5) return;

        this.stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        this.stage.position(newPos);
    });

    // Double middle mouse button click to reset view (like Revit)
    let lastMiddleClick = 0;
    container.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button === 1) { // Middle mouse button
            const now = Date.now();
            if (now - lastMiddleClick < 300) { // Double click detection
                this.resetView();
                lastMiddleClick = 0;
                e.preventDefault();
            } else {
                lastMiddleClick = now;
            }
        }
    });
    
    // Native Drop Handler
    container.addEventListener('dragover', (e: DragEvent) => e.preventDefault());
    container.addEventListener('drop', (e: DragEvent) => this.handleDrop(e));
  }

  private resetView() {
      // Reset to initial position and scale (0.75 because SCALE=6)
      this.stage.scale({ x: 0.75, y: 0.75 });
      this.stage.position({ x: 150, y: 0 });
  }

  private handleDrop(e: DragEvent) {
      e.preventDefault();
      // Need to adjust pointer position for stage scale/position if panned
      this.stage.setPointersPositions(e);
      
      const json = e.dataTransfer?.getData('application/json');
      if (json) {
          try {
              const data = JSON.parse(json);
              if (data.type === 'CABINET') {
                  const cabinet = this.allDefinitions.find((c: FrameDefinition) => c.model === data.model);
                  if (cabinet) {
                      // Calculate insertion index
                      const pointer = this.stage.getPointerPosition();
                      let insertIndex: number | undefined;

                      if (pointer) {
                          const transform = this.stage.getAbsoluteTransform().copy();
                          transform.invert();
                          const pos = transform.point(pointer);
                          
                          const otherGroups = this.layer.getChildren(node => 
                              node instanceof Konva.Group && node.attrs.frameIndex !== undefined
                          ).sort((a, b) => a.x() - b.x());
                          
                          insertIndex = otherGroups.length;
                          for (let i = 0; i < otherGroups.length; i++) {
                              const other = otherGroups[i];
                              if (pos.x < other.x() + (other.width() / 2)) {
                                  insertIndex = i;
                                  break;
                              }
                          }
                      }

                      this.addCabinetToWall(cabinet, insertIndex);
                  }
              }
          } catch (err) {
              console.error('Drop error', err);
          }
      }
  }

  // Extract door type from model ID (e.g., "4C16D-15" -> "dd")
  private extractDoorTypeFromModel(model: string): string {
      const match = model.toLowerCase().match(/4c\d{2}([a-z]+)-\d+/);
      if (match && match[1]) {
          const type = match[1];
          // Map type indicators to door_type values
          // S=sd (single door), D=dd (double door), T=td (triple), Q=qd (quad), P=p (parcel)
          // Also handle: SP=sp (spare parcel), LP=lp (large parcel)
          const typeMap: { [key: string]: string } = {
              's': 'sd',
              'd': 'dd',
              't': 'td',
              'q': 'qd',
              'p': 'p',
              'sp': 'sp',
              'lp': 'lp',
              'm': 'ms',   // mail slot
              'b': 'bms',  // back mail slot
              'md': 'md'   // master door
          };
          return typeMap[type] || type;
      }
      return model; // Fallback to original model
  }

  private addCabinetToWall(def: FrameDefinition, insertIndex?: number) {
      const state = this.stateService.getState();
      const activeWall = state.levels.find((l: Level) => l.level_id === state.active_level_id)
                          ?.walls.find((w: Wall) => w.wall_id === state.active_wall_id);

      if (!activeWall) {
          // If no active wall, maybe create one or alert user
           alert('Please create/select a level and wall first (in main configurator logic, or assume default)');
           // For now, let's assume if no wall, we can't add.
           // But actually we can create one if empty.
           return;
      }

      // Create doors array
      const doors: Door[] = [];
      def.leftColumn.forEach((type, index) => {
          doors.push({ position: index, door_type: type, column: 'left' });
      });
      if (def.rightColumn && def.rightColumn.length > 0) {
          def.rightColumn.forEach((type, index) => {
              doors.push({ position: index, door_type: type, column: 'right' });
          });
      }

      // Height positioning logic from MainConfigurator
      const rows = def.height >= 56 ? 16 : Math.round(def.height / 3.5); // Approximate or use property
      const gridOffset = STARTER_MIN_DEFAULT[def.ih || rows] ?? 15; // use ih (rows) if available
      
      // Note: We don't need 'left' because we auto-layout
      const newFrame: Frame = {
          id: crypto.randomUUID(),
          frame_id: def.model,
          door_type: this.extractDoorTypeFromModel(def.model),
          width: def.width,
          height: def.height,
          bottom: 0,
          iw: def.iw ?? 67, // fallback
          ih: def.ih ?? rows,
          grid_offset: gridOffset,
          rows: def.ih || rows,
          doors: doors
      };

      if (insertIndex !== undefined) {
          const frames = [...activeWall.frames];
          frames.splice(insertIndex, 0, newFrame);
          this.stateService.updateWallFrames(activeWall.wall_id, frames);
      } else {
          this.stateService.addFrame(activeWall.wall_id, newFrame);
      }
      
      // Auto-select the new cabinet
      this.selectedFrameId = newFrame.id;
  }

  private drawGrid() {
    this.gridLayer.destroyChildren();

    const floorY = this.floorY;
    const width = this.width * 2; // Make grid wider for panning

    // Draw Floor
    // American drafting standard for floor line: Thick solid line, often with hash marks below
    const floorLine = new Konva.Line({
      points: [-width, floorY, width*2, floorY],
      stroke: 'black',
      strokeWidth: 4 // Thicker line
    });
    this.gridLayer.add(floorLine);
    
    // Add hash marks (ground indication)
    /* 
       Optional: Add hashes below line.
       For now, just a thick line is standard for "Ground Line" in elevations.
    */

    this.gridLayer.add(new Konva.Text({
        x: -210, // Aligned with other labels
        y: floorY - 15,
        text: 'FLOOR 0"', // Consistent format
        fontSize: 10,
        fontStyle: 'bold', // Consistent style
        fill: '#666',
        align: 'right',
        width: 200
    }));

    const marks = [
        { y: 15, text: 'MIN PARCEL DOOR 15"' },
        { y: 28, text: 'MIN TENANT DOOR 28"' },
        { y: 36, text: 'MIN USPS ACCESS DOOR 36"' },
        { y: 48, text: 'MAX USPS ACCESS DOOR 48"' },
        { y: 54, text: 'ABOVE FINISHED FLOOR 54"' },
        { y: 67, text: 'MAX LOCK HEIGHT 67"' }
    ];
    
    marks.forEach(mark => {
        const y = floorY - (mark.y * this.SCALE);
        
        const line = new Konva.Line({
            points: [-width, y, width*2, y],
            stroke: '#ccc',
            strokeWidth: 0.5,
            dash: [3, 3]
        });
        
        const text = new Konva.Text({
            x: -210, // Move further left to accommodate longer text
            y: y - 12, // Position above the line
            text: mark.text,
            fontSize: 10,
            fontStyle: 'bold',
            fill: '#666',
            align: 'right',
            width: 200
        });

        this.gridLayer.add(line);
        this.gridLayer.add(text);
    });
    
    this.gridLayer.batchDraw();
  }

  private renderFrames(frames: Frame[]) {
      this.layer.destroyChildren();
      
      let currentX = 50; // Start offset

      frames.forEach((frame, index) => {
          const group = this.createFrameGroup(frame, index);
          
          // Calculate Y position based on height logic
          // Top position in inches = MAX (67) - (Height + Grid Offset)
          // Actually, we want Bottom Y.
          // Bottom Y from floor in inches = Grid Offset (roughly, or calculated)
          // Frame Bottom Y (Konva Coords) = FloorY - (Offset * Scale)
          // Frame Top Y = Frame Bottom Y - (Height * Scale)
          
          const offset = frame.grid_offset ?? 15;
          const bottomY = this.floorY - (offset * this.SCALE);
          const heightPx = frame.height * this.SCALE;
          const y = bottomY - heightPx;
          
          group.position({ x: currentX, y: y });
          
          this.layer.add(group);
          
          // Increment X for next frame
          currentX += (frame.width * this.SCALE); // Use physical width * scale
      });
      
      this.layer.batchDraw();
  }

  private updateSelection() {
      // Don't show selection during drag-and-drop to prevent artifacts
      if (this.isReordering) {
          this.selectionLayer.destroyChildren();
          this.selectionLayer.batchDraw();
          return;
      }

      // Clear previous selection
      this.selectionLayer.destroyChildren();

      if (!this.selectedFrameId) {
          this.selectionLayer.batchDraw();
          return;
      }

      // Find the selected group
      const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
      const selectedGroup = groups.find(g => g.attrs.frameId === this.selectedFrameId);

      if (!selectedGroup || !(selectedGroup instanceof Konva.Group)) {
          this.selectionLayer.batchDraw();
          return;
      }

      // Get absolute position and size
      const width = selectedGroup.width();
      const height = selectedGroup.height();
      const x = selectedGroup.x();
      const y = selectedGroup.y();

      // Create stylish selection rect with glow effect
      this.selectionRect = new Konva.Rect({
          x: x - 2,
          y: y - 2,
          width: width + 4,
          height: height + 4,
          stroke: '#00d4ff', // Cyan-like color, more modern
          strokeWidth: 2.5,
          shadowColor: '#00d4ff',
          shadowBlur: 15,
          shadowOpacity: 0.6,
          cornerRadius: 2,
          listening: false
      });

      this.selectionLayer.add(this.selectionRect);

      // Create buttons above cabinet
      const buttonSize = 26;
      const buttonGap = 8;
      const buttonY = y - buttonSize - 6;

      // Edit button (left)
      const editButtonX = x + width - (buttonSize * 2) - buttonGap - 6;

      this.editButton = new Konva.Group({
          x: editButtonX,
          y: buttonY,
          listening: true
      });

      const editBg = new Konva.Circle({
          x: buttonSize / 2,
          y: buttonSize / 2,
          radius: buttonSize / 2,
          fill: '#007bff',
          stroke: '#fff',
          strokeWidth: 1.5,
          shadowColor: 'rgba(0,0,0,0.3)',
          shadowBlur: 3,
          shadowOffset: { x: 0, y: 1 },
          shadowOpacity: 0.4,
          listening: true
      });

      // Edit icon (pencil)
      const center = buttonSize / 2;
      const pencilSize = 10;
      const offsetX = center - pencilSize / 2;
      const offsetY = center - pencilSize / 2 + 1;

      // Pencil body
      const pencilBody = new Konva.Rect({
          x: offsetX + 3,
          y: offsetY + 6,
          width: pencilSize - 4,
          height: 3,
          fill: '#fff',
          rotation: -45,
          listening: false
      });

      // Pencil tip
      const pencilTip = new Konva.Line({
          points: [offsetX + 3, offsetY + 9, offsetX, offsetY + 12],
          stroke: '#fff',
          strokeWidth: 2,
          lineCap: 'round',
          listening: false
      });

      // Pencil top
      const pencilTop = new Konva.Rect({
          x: offsetX + 5,
          y: offsetY + 4,
          width: 3,
          height: 2,
          fill: '#fff',
          listening: false
      });

      this.editButton.add(editBg, pencilBody, pencilTip, pencilTop);

      this.editButton.on('click', (e) => {
          e.cancelBubble = true;
          this.ngZone.run(() => {
              this.openCabinetEditor();
          });
      });

      this.editButton.on('mouseenter', () => {
          this.stage.container().style.cursor = 'pointer';
          editBg.fill('#0056b3');
          this.selectionLayer.batchDraw();
      });

      this.editButton.on('mouseleave', () => {
          this.stage.container().style.cursor = 'default';
          editBg.fill('#007bff');
          this.selectionLayer.batchDraw();
      });

      this.selectionLayer.add(this.editButton);

      // Duplicate button (right)
      const dupButtonX = x + width - buttonSize - 6;

      this.duplicateButton = new Konva.Group({
          x: dupButtonX,
          y: buttonY,
          listening: true
      });

      // Button background - circle
      const buttonBg = new Konva.Circle({
          x: buttonSize / 2,
          y: buttonSize / 2,
          radius: buttonSize / 2,
          fill: '#28a745',
          stroke: '#fff',
          strokeWidth: 1.5,
          shadowColor: 'rgba(0,0,0,0.3)',
          shadowBlur: 3,
          shadowOffset: { x: 0, y: 1 },
          shadowOpacity: 0.4,
          listening: true
      });

      // Plus icon
      const plusLength = 8;
      const plusWidth = 2.5;

      const plusV = new Konva.Line({
          points: [center, center - plusLength / 2, center, center + plusLength / 2],
          stroke: '#fff',
          strokeWidth: plusWidth,
          lineCap: 'round',
          listening: false
      });

      const plusH = new Konva.Line({
          points: [center - plusLength / 2, center, center + plusLength / 2, center],
          stroke: '#fff',
          strokeWidth: plusWidth,
          lineCap: 'round',
          listening: false
      });

      this.duplicateButton.add(buttonBg, plusV, plusH);

      // Button click handler
      this.duplicateButton.on('click', (e) => {
          e.cancelBubble = true;
          this.ngZone.run(() => {
              this.duplicateCabinet(this.selectedFrameId!);
          });
      });

      // Hover effect
      this.duplicateButton.on('mouseenter', () => {
          this.stage.container().style.cursor = 'pointer';
          buttonBg.fill('#218838');
          this.selectionLayer.batchDraw();
      });

      this.duplicateButton.on('mouseleave', () => {
          this.stage.container().style.cursor = 'default';
          buttonBg.fill('#28a745');
          this.selectionLayer.batchDraw();
      });

      this.selectionLayer.add(this.duplicateButton);
      this.selectionLayer.batchDraw();
  }

  private updateHover(frameId: string) {
      // Don't show hover during drag-and-drop
      if (this.isReordering) {
          return;
      }

      // Clear previous hover
      this.hoverLayer.destroyChildren();
      this.hoveredFrameId = frameId;

      const groups = this.layer.getChildren(node => node instanceof Konva.Group) as Konva.Group[];
      const hoveredGroup = groups.find(g => g.attrs.frameId === frameId);

      if (!hoveredGroup || !(hoveredGroup instanceof Konva.Group)) {
          this.hoverLayer.batchDraw();
          return;
      }

      // Get absolute position and size
      const width = hoveredGroup.width();
      const height = hoveredGroup.height();
      const x = hoveredGroup.x();
      const y = hoveredGroup.y();

      // Create hover rect - more subtle than selection
      this.hoverRect = new Konva.Rect({
          x: x - 2,
          y: y - 2,
          width: width + 4,
          height: height + 4,
          stroke: '#00d4ff', // Same cyan color
          strokeWidth: 1.5, // Thinner than selection
          shadowColor: '#00d4ff',
          shadowBlur: 8, // Less glow than selection
          shadowOpacity: 0.4,
          cornerRadius: 2,
          listening: false
      });

      this.hoverLayer.add(this.hoverRect);
      this.hoverLayer.batchDraw();
  }

  private clearHover() {
      this.hoverLayer.destroyChildren();
      this.hoveredFrameId = null;
      this.hoverLayer.batchDraw();
  }

  private duplicateCabinet(frameId: string) {
      const activeWall = this.stateService.getActiveWall();
      if (!activeWall || !activeWall.frames) return;

      // Find the frame to duplicate
      const frameToDuplicate = activeWall.frames.find((f: Frame) => f.id === frameId);
      if (!frameToDuplicate) return;

      // Find the index of the frame
      const frameIndex = activeWall.frames.findIndex((f: Frame) => f.id === frameId);
      if (frameIndex === -1) return;

      // Create a deep copy of the frame with a new ID
      const newFrame: Frame = {
          ...frameToDuplicate,
          id: `frame_${Date.now()}`,
          frame_id: frameToDuplicate.frame_id // Keep the same frame_id for same cabinet type
      };

      // Create new frames array with the duplicate inserted after the original
      const frames = [...activeWall.frames];
      frames.splice(frameIndex + 1, 0, newFrame);

      // Update the wall
      this.stateService.updateWallFrames(activeWall.wall_id, frames);

      // Select the newly duplicated frame
      this.selectedFrameId = newFrame.id;
  }

  openCabinetEditor() {
      const activeWall = this.stateService.getActiveWall();
      if (!activeWall || !activeWall.frames || !this.selectedFrameId) return;

      const frame = activeWall.frames.find((f: Frame) => f.id === this.selectedFrameId);
      if (!frame) return;

      this.editingFrame = frame;
      this.isEditorOpen = true;
  }

  closeCabinetEditor() {
      this.isEditorOpen = false;
      this.editingFrame = null;
  }

  saveEditedCabinet(updatedFrame: Frame) {
      const activeWall = this.stateService.getActiveWall();
      if (!activeWall || !activeWall.frames) return;

      const frames = [...activeWall.frames];
      const index = frames.findIndex((f: Frame) => f.id === updatedFrame.id);

      if (index !== -1) {
          frames[index] = updatedFrame;
          this.stateService.updateWallFrames(activeWall.wall_id, frames);
      }

      this.closeCabinetEditor();
  }

  private createFrameGroup(frame: Frame, index: number): Konva.Group {
      const widthPx = frame.width * this.SCALE;
      const heightPx = frame.height * this.SCALE;
      
      const group = new Konva.Group({
          width: widthPx,
          height: heightPx,
          draggable: true,
          shadowColor: 'black',
          shadowBlur: 10,
          shadowOpacity: 0.2,
          shadowOffset: { x: 5, y: 5 }
      });
      
      // Store index for DnD reordering
      group.setAttr('frameIndex', index);
      group.setAttr('frameId', frame.id);

      // Click handler - different behavior for measure mode vs normal mode
      group.on('click', (e) => {
          e.cancelBubble = true;

          if (this.isMeasuringMode) {
              // In measure mode, handle measurement click
              const pos = this.stage.getPointerPosition();
              if (pos) {
                  const transform = this.stage.getAbsoluteTransform().copy();
                  transform.invert();
                  const localPos = transform.point(pos);
                  this.handleMeasureClick(localPos);
              }
          } else {
              // Normal mode - select frame
              this.selectedFrameId = frame.id;
              this.updateSelection();
          }
      });

      // Hover events - show different things based on mode
      group.on('mouseenter', (e) => {
          if (this.isMeasuringMode) {
              // In measure mode, show snap points
              this.showSnapPointsForGroup(group);
              this.stage.container().style.cursor = 'crosshair';
          } else if (!this.isReordering) {
              // Normal mode - show hover highlight
              this.updateHover(frame.id);
              this.stage.container().style.cursor = 'pointer';
          }
      });

      group.on('mouseleave', (e) => {
          if (this.isMeasuringMode) {
              // Hide snap points when leaving
              this.hideSnapPoints();
          } else if (!this.isReordering && this.hoveredFrameId === frame.id) {
              // Normal mode - clear hover highlight
              this.clearHover();
              this.stage.container().style.cursor = 'default';
          }
      });

      // Frame Background (Total Area)
      // We draw the background invisible or white to catch events
      const bg = new Konva.Rect({
          width: widthPx,
          height: heightPx,
          fill: '#f0f0f0', // Interior color
          // stroke removed here, moved to selection-rect
          name: 'bg-rect'
      });
      group.add(bg);

      // Frame Dimensions (px)
      const fTop = FRAME_TB * this.SCALE;
      const fBot = FRAME_TB * this.SCALE;
      const fSide = FRAME_SIDE * this.SCALE;
      const fMid = FRAME_MID * this.SCALE;

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
          0, adjustColor(this.currentCabinetColor, 20),
          0.4, adjustColor(this.currentCabinetColor, 40),
          0.6, adjustColor(this.currentCabinetColor, 40),
          1, adjustColor(this.currentCabinetColor, 20)
      ];
      const frameStroke = adjustColor(this.currentCabinetColor, -50);

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
          group.add(rect);
          return rect;
      };

      // Left (Vertical Gradient)
      drawFrameRect(0, 0, fSide, heightPx, true);
      // Right (Vertical Gradient)
      drawFrameRect(widthPx - fSide, 0, fSide, heightPx, true);

      // Doors Logic
      const leftDoors = frame.doors.filter(d => d.column === 'left' || !d.column);
      const rightDoors = frame.doors.filter(d => d.column === 'right');
      const hasRight = rightDoors.length > 0;

      // Calculate Column Dimensions
      let colWidth: number;
      let leftColX = fSide;
      let rightColX = 0;
      let middleFrame: Konva.Rect | null = null;

      if (hasRight) {
          // Double Column
          // Draw Middle Frame
          const availWidth = widthPx - (2 * fSide) - fMid;
          colWidth = availWidth / 2;

          const midX = fSide + colWidth;
          // Middle (Vertical Gradient)
          middleFrame = drawFrameRect(midX, 0, fMid, heightPx, true) as Konva.Rect;

          rightColX = midX + fMid;
      } else {
          // Single Column
          colWidth = widthPx - (2 * fSide);
      }

      // Top (Horizontal Gradient) - drawn AFTER middle so it overlaps
      const topFrame = drawFrameRect(0, 0, widthPx, fTop, false) as Konva.Rect;
      // Bottom (Horizontal Gradient) - drawn AFTER middle so it overlaps
      const bottomFrame = drawFrameRect(0, heightPx - fBot, widthPx, fBot, false) as Konva.Rect;

      // Ensure top and bottom frames are on top of middle frame
      if (middleFrame) {
          topFrame.moveToTop();
          bottomFrame.moveToTop();
      }

      const renderColumn = (doors: Door[], colX: number) => {
          // Calculate total units in this column to determine unit height
          let totalUnits = 0;
          doors.forEach(door => {
              const type = (door.door_type || '').toLowerCase();
              totalUnits += getDoorUnits(type);
          });

          // Use fixed unit height (not stretching to fit available space)
          const unitHeight = this.PREVIEW_DOOR_UNIT * this.SCALE;

          let yCursor = fTop; // Start below top frame
          doors.forEach(door => {
              const type = (door.door_type || '').toLowerCase();

              // Use shared getDoorUnits function for consistency
              const units = getDoorUnits(type);

              // Calculate door height based on unit height
              const doorH = units * unitHeight;

              // We need to adjust door width slightly to fit nicely?
              // KonvaDrawerFactory creates a group of width/height.
              // Let's pass the calculated colWidth.

              let displayLabel = door.label;
              // Special handling for 4C16S-BIN labels
              if (frame.frame_id?.toUpperCase().startsWith('4C16S-BIN')) {
                  // Structure: tds1 (Paper), tdh5p, tds1 (Trash), td6
                  if (type === 'tds1') {
                      // Use index from forEach (we need to update the signature)
                      // Or simply rely on position in the doors array
                      const index = doors.indexOf(door);
                      if (index === 0) displayLabel = 'PAPER';
                      if (index === 2) displayLabel = 'TRASH';
                  }
              }

              const drawer = KonvaDrawerFactory.createDrawer(
                  type,
                  colWidth,
                  doorH,
                  {
                      x: colX,
                      y: yCursor,
                      label: displayLabel,
                      cabinetColor: this.currentCabinetColor,
                      textFill: this.currentTextFill,
                      unitHeight: unitHeight,
                      scale: this.SCALE / 5 // Scale door elements proportionally to SCALE (5 was original)
                  }
              );

              // Handle Door Click for Numbering
              drawer.on('click', (e) => {
                  if (this.isNumberingMode) {
                      e.cancelBubble = true;
                      this.ngZone.run(() => {
                          this.startEditing(frame, door, drawer);
                      });
                  }
              });

              // Handle Hover Highlight in numbering mode
              // Note: Main cabinet hover is handled by group mouseenter/mouseleave
              // Here we only change cursor when hovering over doors in numbering mode
              drawer.on('mouseenter', (e) => {
                  if (this.isNumberingMode) {
                      this.stage.container().style.cursor = 'text';
                  }
              });

              drawer.on('mouseleave', (e) => {
                  if (this.isNumberingMode) {
                      this.stage.container().style.cursor = 'default';
                  }
              });

              group.add(drawer);
              // Ensure highlight is on top after adding to group?
              // The createDrawer adds highlight LAST, so it should be on top within the drawer group.
              // That is correct.

              yCursor += doorH;
          });
      };

      renderColumn(leftDoors, leftColX);
      if (hasRight) {
          renderColumn(rightDoors, rightColX);
      }
      
      // Label - Below cabinet, centered, bold
      const label = new Konva.Text({
          x: 0,
          y: heightPx + 5,
          width: widthPx,
          text: frame.frame_id,
          fontSize: 12,
          fill: 'black',
          fontStyle: 'bold',
          align: 'center'
      });
      group.add(label);

      // DnD Events for Reordering
      group.on('dragstart', (e) => {
          // Clear hover on drag start to prevent artifact
          this.clearHover();

          this.isReordering = true;
          this.dragStartIndex = index;
          this.selectedFrameId = frame.id;
          this.updateSelection();
          group.moveToTop();
          
          // Cache siblings for performance
          this.cachedSiblingGroups = this.layer.getChildren(node =>
              node instanceof Konva.Group && node !== group && node.attrs.frameIndex !== undefined
          ).sort((a, b) => a.x() - b.x()) as Konva.Group[];

          // Create stylish placeholder indicator
          // Semi-transparent rectangle with shadow and arrows
          const placeholder = new Konva.Group({
              listening: false
          });

          // Main rectangle showing where cabinet will be inserted
          const placeholderRect = new Konva.Rect({
              x: 0,
              y: this.floorY - heightPx,
              width: 4, // Thin indicator line
              height: heightPx,
              fill: '#00d4ff',
              opacity: 0.3,
              shadowColor: '#00d4ff',
              shadowBlur: 15,
              shadowOpacity: 0.8
          });
          placeholder.add(placeholderRect);

          // Top arrow pointing DOWN (from above to floor level)
          const topArrow = new Konva.Arrow({
              points: [0, this.floorY - 25, 0, this.floorY - 5],
              pointerLength: 8,
              pointerWidth: 8,
              stroke: '#00d4ff',
              strokeWidth: 2,
              fill: '#00d4ff',
              shadowColor: '#00d4ff',
              shadowBlur: 10,
              shadowOpacity: 0.6
          });
          placeholder.add(topArrow);

          // Bottom arrow pointing UP (from below toward the line)
          const bottomArrow = new Konva.Arrow({
              points: [0, this.floorY + 25, 0, this.floorY + 5],
              pointerLength: 8,
              pointerWidth: 8,
              stroke: '#00d4ff',
              strokeWidth: 2,
              fill: '#00d4ff',
              shadowColor: '#00d4ff',
              shadowBlur: 10,
              shadowOpacity: 0.6
          });
          placeholder.add(bottomArrow);

          this.dragPlaceholderLine = placeholder;
          this.layer.add(this.dragPlaceholderLine);
      });
      
      group.on('dragmove', (e) => {
          const x = group.x();
          const otherGroups = this.cachedSiblingGroups;

          // Update selection position while dragging
          if (this.selectedFrameId === frame.id) {
              this.updateSelection();
          }

          // Update hover position while dragging
          if (this.hoveredFrameId === frame.id) {
              this.updateHover(frame.id);
          }

          // Find insertion index
          let insertIndex = otherGroups.length;
          for (let i = 0; i < otherGroups.length; i++) {
              const other = otherGroups[i];
              if (x < other.x() + (other.width() / 2)) {
                  insertIndex = i;
                  break;
              }
          }

          // Calculate placeholder X position
          let targetX = 50; // Default start
          if (otherGroups.length > 0) {
              if (insertIndex === 0) {
                  targetX = otherGroups[0].x();
              } else if (insertIndex < otherGroups.length) {
                  targetX = otherGroups[insertIndex].x();
              } else {
                  const last = otherGroups[otherGroups.length - 1];
                  targetX = last.x() + last.width();
              }
          }

          // Update placeholder position
          if (this.dragPlaceholderLine) {
              this.dragPlaceholderLine.x(targetX - 2); // Center the thin indicator
          }
      });
      
      group.on('dragend', (e) => {
          this.isReordering = false;
          this.cachedSiblingGroups = [];

          // Clear hover to prevent any artifacts
          this.clearHover();

          if (this.dragPlaceholderLine) {
              this.dragPlaceholderLine.destroy();
              this.dragPlaceholderLine = null;
          }
          
          // Calculate new index
          const x = group.x();
          // We can use the cached groups if we re-sort them? No, better to get fresh check.
          const otherGroups = this.layer.getChildren(node => 
              node instanceof Konva.Group && node !== group && node.attrs.frameIndex !== undefined
          ).sort((a, b) => a.x() - b.x());
          
          let newIndex = otherGroups.length; 
          
          for (let i = 0; i < otherGroups.length; i++) {
              const other = otherGroups[i];
              if (x < other.x() + (other.width() / 2)) {
                  newIndex = i;
                  break;
              }
          }
          
          this.reorderFrames(this.dragStartIndex, newIndex);
      });

      // Cache for performance with higher pixel ratio for better quality
      // Disable cache if in numbering mode to allow child events
      if (!this.isNumberingMode) {
          group.cache({
              pixelRatio: 3
          });
      }

      return group;
  }

  startEditing(frame: Frame, door: Door, drawer: Konva.Group) {
      const pos = drawer.getAbsolutePosition();
      // getAbsolutePosition returns coordinates relative to the stage container's top-left corner
      // but NOT accounting for any scrolling of the window or parent elements?
      // Wait, Konva stage is inside a div.
      // pos.x/y are relative to the Konva Stage (canvas) top-left.
      
      const stageBox = this.containerRef.nativeElement.getBoundingClientRect();
      const scale = this.stage.scaleX(); 
      
      // We need to position the input relative to the 'konva-container' which has position: relative
      // So pos.x / pos.y should be correct if the stage fits perfectly.
      // BUT if we panned the stage, pos accounts for that? 
      // getAbsolutePosition() returns the position on the stage relative to stage origin?
      // No, it returns position relative to stage top-left corner (including stage position/scale).
      // So if stage.x = 100, shape.x = 10, absolute is 110.
      
      this.inputPosition = {
          x: pos.x,
          y: pos.y,
          width: drawer.width() * scale,
          height: drawer.height() * scale
      };
      
      // Check if visible
      console.log('Editing start:', this.inputPosition, door.label);

      this.editingDoor = { frameId: frame.id, door };
      this.inputValue = door.label || '';
      
      setTimeout(() => {
          if (this.inlineInput) {
              this.inlineInput.nativeElement.focus();
              this.inlineInput.nativeElement.select();
          }
      });
  }

  finishEditing() {
      if (!this.editingDoor) return;
      
      const { frameId, door } = this.editingDoor;
      const newValue = this.inputValue;
      
      this.editingDoor = null; 
      
      const activeWall = this.stateService.getActiveWall();
      if (!activeWall) return;

      const frames = [...activeWall.frames];
      const frameIndex = frames.findIndex(f => f.id === frameId);
      if (frameIndex === -1) return;

      const updatedFrame = { ...frames[frameIndex] };
      updatedFrame.doors = updatedFrame.doors.map(d => {
          // Compare by reference or properties if needed, but reference should work
          // as long as we haven't mutated the array in between without render
          if (d === door || (d.position === door.position && d.column === door.column)) {
              return { ...d, label: newValue };
          }
          return d;
      });
      
      frames[frameIndex] = updatedFrame;
      this.stateService.updateWallFrames(activeWall.wall_id, frames);
  }

  cancelEditing() {
      this.editingDoor = null;
  }

  // Cabinet Color Methods
  toggleColorDropdown() {
      this.isColorDropdownOpen = !this.isColorDropdownOpen;
  }

  selectCabinetColor(color: CabinetColor) {
      this.selectedColor = color.name;
      this.currentCabinetColor = color.hex;
      this.currentTextFill = color.textFill;
      this.isColorDropdownOpen = false;

      // Save to localStorage
      localStorage.setItem('cabinetColor', JSON.stringify({
          name: color.name,
          hex: color.hex,
          textFill: color.textFill
      }));

      // Save to project
      if (this.currentProject) {
          const projectColorValue = this.getProjectColorFormat(color.name);
          this.projectService.updateProject(this.currentProject.id, {
              suiteColorValue: projectColorValue
          });
      }

      // Re-render frames with new color
      const wall = this.stateService.getActiveWall();
      if (wall) {
          this.renderFrames(wall.frames);
      }
  }

  private reorderFrames(oldIndex: number, newIndex: number) {
      const state = this.stateService.getState();
      const activeWall = state.levels.find((l: Level) => l.level_id === state.active_level_id)
                          ?.walls.find((w: Wall) => w.wall_id === state.active_wall_id);
      
      if (!activeWall) return;
      
      const frames = [...activeWall.frames];
      const moved = frames.splice(oldIndex, 1)[0];

      if (!moved) return;
      
      // Adjust newIndex if we removed item before it
      // if (newIndex > oldIndex) newIndex--; 
      // Actually standard array splice logic:
      // If we move from 0 to 2:
      // [A, B, C] -> remove A -> [B, C]. Insert at 2 -> [B, C, A]. Correct.
      // If we move from 2 to 0:
      // [A, B, C] -> remove C -> [A, B]. Insert at 0 -> [C, A, B]. Correct.
      // However, my calc for newIndex was based on "remaining" items.
      
      frames.splice(newIndex, 0, moved);

      this.stateService.updateWallFrames(activeWall.wall_id, frames);
      // Subscription will re-render
  }

  // ====================================================================
  // LEVELS & WALLS METHODS
  // ====================================================================

  addLevel() {
      const newLevel = this.stateService.addLevel();
      // Switch to new level and its first wall
      this.stateService.setActiveLevel(newLevel.level_id);
      if (newLevel.walls && newLevel.walls.length > 0) {
          this.stateService.setActiveWall(newLevel.walls[0].wall_id);
      }
  }

  removeLevel(levelId: number) {
      if (confirm('Are you sure you want to remove this floor and all its walls?')) {
          this.stateService.removeLevel(levelId);
      }
  }

  toggleLevelExpanded(levelId: number) {
      this.stateService.toggleLevelExpanded(levelId);
  }

  // Actions menu toggles
  toggleLevelActions(levelId: number) {
      const menuKey = `level-${levelId}`;
      this.activeActionsMenu = this.activeActionsMenu === menuKey ? null : menuKey;
      this.editingLevelId = null; // Close editing when opening menu
  }

  toggleWallActions(wallId: number) {
      const menuKey = `wall-${wallId}`;
      this.activeActionsMenu = this.activeActionsMenu === menuKey ? null : menuKey;
      this.editingWallId = null; // Close editing when opening menu
  }

  setActiveWall(wallId: number) {
      this.stateService.setActiveWall(wallId);
      this.activeActionsMenu = null; // Close menu when selecting wall
  }

  // Panel Toggle Methods
  toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
      this.cdr.detectChanges();
  }

  toggleRightPanel() {
      this.rightPanelVisible = !this.rightPanelVisible;
      this.cdr.detectChanges();
  }

  addWall(levelId: number) {
      const newWall = this.stateService.addWall(levelId);
      // Switch to new wall
      this.stateService.setActiveWall(newWall.wall_id);
      this.activeActionsMenu = null; // Close menu
  }

  removeWall(levelId: number, wallId: number) {
      if (confirm('Delete this wall? All cabinets on this wall will be removed.')) {
          this.stateService.removeWall(levelId, wallId);
      }
      this.activeActionsMenu = null; // Close menu
  }

  // Inline editing for level names
  startEditLevel(levelId: number) {
      this.editingLevelId = levelId;
      this.activeActionsMenu = null; // Close menu when editing
  }

  finishEditLevel(levelId: number, input: HTMLInputElement) {
      const newName = input.value.trim();
      if (newName) {
          this.stateService.renameLevel(levelId, newName);
      }
      this.editingLevelId = null;
  }

  onLevelInputKeydown(event: KeyboardEvent, levelId: number, input: HTMLInputElement) {
      if (event.key === 'Enter') {
          this.finishEditLevel(levelId, input);
      } else if (event.key === 'Escape') {
          this.editingLevelId = null;
      }
  }

  // Inline editing for wall names
  startEditWall(wallId: number) {
      this.editingWallId = wallId;
      this.activeActionsMenu = null; // Close menu when editing
  }

  finishEditWall(levelId: number, wallId: number, input: HTMLInputElement) {
      const newName = input.value.trim();
      if (newName) {
          this.stateService.renameWall(levelId, wallId, newName);
      }
      this.editingWallId = null;
  }

  onWallInputKeydown(event: KeyboardEvent, levelId: number, wallId: number, input: HTMLInputElement) {
      if (event.key === 'Enter') {
          this.finishEditWall(levelId, wallId, input);
      } else if (event.key === 'Escape') {
          this.editingWallId = null;
      }
  }

  // ====================================================================
  // PROJECT METHODS
  // ====================================================================

  // Mapping between project color format and canvas color format
  private colorMapping: { [key: string]: { name: string, hex: string, textFill: string } } = {
    '0xdbe0eb_tbd': { name: 'TBD', hex: '#dbe0eb', textFill: '#555' },
    '0xdbe0eb_Silver Speck': { name: 'Silver Speck', hex: '#dbe0eb', textFill: '#555' },
    '0x7b6d61_Antique Bronze': { name: 'Antique Bronze', hex: '#8b7355', textFill: '#fff' },
    '0x4c4c5d_Black': { name: 'Black', hex: '#1a1a1a', textFill: '#fff' },
    '0x75756f_Dark Bronze': { name: 'Dark Bronze', hex: '#4a3728', textFill: '#fff' },
    '0xdec481_Gold Speck': { name: 'Gold Speck', hex: '#d4af37', textFill: '#333' },
    '0xdadbd0_Postal Grey': { name: 'Postal Gray', hex: '#708090', textFill: '#fff' },
    '0xf5ecd4_Sandstone': { name: 'Sandstone', hex: '#f5ecd4', textFill: '#333' },
    '0xffffff_White': { name: 'White', hex: '#ffffff', textFill: '#333' }
  };

  private getCabinetColorFromProjectFormat(colorValue: string | undefined) {
    if (!colorValue) return null;
    return this.colorMapping[colorValue] || this.colorMapping['0xdbe0eb_tbd'];
  }

  private getProjectColorFormat(colorName: string): string {
    const reverseMapping: { [key: string]: string } = {
      'TBD': '0xdbe0eb_tbd',
      'Silver Speck': '0xdbe0eb_Silver Speck',
      'Antique Bronze': '0x7b6d61_Antique Bronze',
      'Black': '0x4c4c5d_Black',
      'Dark Bronze': '0x75756f_Dark Bronze',
      'Gold Speck': '0xdec481_Gold Speck',
      'Postal Gray': '0xdadbd0_Postal Grey',
      'Sandstone': '0xf5ecd4_Sandstone',
      'White': '0xffffff_White'
    };
    return reverseMapping[colorName] || '0xdbe0eb_tbd';
  }

  private loadCabinetColorFromProject() {
    // First try to load from project
    if (this.currentProject?.suiteColorValue) {
      const colorData = this.getCabinetColorFromProjectFormat(this.currentProject.suiteColorValue);
      if (colorData) {
        this.selectedColor = colorData.name;
        this.currentCabinetColor = colorData.hex;
        this.currentTextFill = colorData.textFill;
        return;
      }
    }

    // Fallback to localStorage
    const savedColor = localStorage.getItem('cabinetColor');
    if (savedColor) {
      try {
        const colorData = JSON.parse(savedColor);
        this.selectedColor = colorData.name;
        this.currentCabinetColor = colorData.hex;
        this.currentTextFill = colorData.textFill;
      } catch (e) {
        console.error('Error loading saved cabinet color:', e);
      }
    }
  }

  private loadCurrentProject() {
      this.currentProject = this.projectService.getActiveProject();

      if (this.currentProject && this.currentProject.levels) {
          // Load saved state from project
          this.stateService.loadState(this.currentProject.levels);
          this.stateService.setActiveLevel(this.currentProject.activeLevelId ?? 0);
          this.stateService.setActiveWall(this.currentProject.activeWallId ?? 0);

          // Load cabinet color from project
          this.loadCabinetColorFromProject();
      } else if (!this.currentProject) {
          // No active project - redirect to projects page
          this.router.navigate(['/']);
      }

      this.cdr.detectChanges();
  }

  private subscribeToStateChanges() {
      // Subscribe to state changes and auto-save to project
      this.stateChangeSubscription = this.stateService.state$.subscribe(state => {
          if (this.currentProject && state.levels) {
              this.projectService.updateProject(this.currentProject.id, {
                  levels: state.levels,
                  activeLevelId: state.active_level_id,
                  activeWallId: state.active_wall_id
              } as any);
          }
      });
  }

  startEditingProjectName() {
      this.editingProjectName = true;
      setTimeout(() => {
          if (this.projectNameInput) {
              this.projectNameInput.nativeElement.focus();
              this.projectNameInput.nativeElement.select();
          }
      });
  }

  finishEditingProjectName() {
      if (!this.editingProjectName || !this.currentProject) return;

      const input = this.projectNameInput?.nativeElement;
      if (input) {
          const newName = input.value.trim() || 'Unnamed Project';
          this.projectService.updateProject(this.currentProject.id, { name: newName });
          this.currentProject.name = newName;
      }

      this.editingProjectName = false;
      this.cdr.detectChanges();
  }

  cancelEditingProjectName() {
      this.editingProjectName = false;
      this.cdr.detectChanges();
  }

  goToProjects() {
      // Save current state before leaving
      if (this.currentProject) {
          const state = this.stateService.getState();
          this.projectService.updateProject(this.currentProject.id, {
              levels: state.levels,
              activeLevelId: state.active_level_id,
              activeWallId: state.active_wall_id
          } as any);
      }
      this.router.navigate(['/']);
  }

  // User menu methods
  getUserInitials(): string {
      if (!this.currentUserEmail) return 'U';
      const email = this.currentUserEmail;
      const parts = email.split('@');
      const username = parts[0] || 'U';
      return username.substring(0, 2).toUpperCase();
  }

  toggleUserMenu() {
      this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  onLogout() {
      // TODO: Implement actual logout
      console.log('Logout clicked');
      this.isUserMenuOpen = false;
      this.router.navigate(['/login']);
  }

  // Share modal methods
  openShareModal() {
      if (this.currentProject) {
          this.currentShareProject = this.currentProject;
          this.isShareModalOpen = true;
      }
  }

  closeShareModal() {
      this.isShareModalOpen = false;
      this.currentShareProject = null;
  }

  onShareSave(data: { sharedUsers: SharedUser[] }) {
      if (this.currentShareProject) {
          this.projectService.updateProject(this.currentShareProject.id, {
              sharedUsers: data.sharedUsers
          });
          // Update local project reference
          if (this.currentProject) {
              this.currentProject.sharedUsers = data.sharedUsers;
          }
      }
  }

  openProjectSettings() {
      this.isProjectSettingsOpen = true;
  }

  onProjectSettingsClose() {
      this.isProjectSettingsOpen = false;
  }

  onProjectSettingsSave(updates: Partial<Project>) {
      if (this.currentProject) {
          const updated = this.projectService.updateProject(this.currentProject.id, updates);
          if (updated) {
              this.currentProject = updated;

              // If cabinet color was changed, update canvas
              if (updates.suiteColorValue) {
                  const colorData = this.getCabinetColorFromProjectFormat(updates.suiteColorValue);
                  if (colorData) {
                      this.selectedColor = colorData.name;
                      this.currentCabinetColor = colorData.hex;
                      this.currentTextFill = colorData.textFill;

                      // Re-render frames with new color
                      const wall = this.stateService.getActiveWall();
                      if (wall) {
                          this.renderFrames(wall.frames);
                      }
                  }
              }

              this.cdr.detectChanges();
          }
      }
  }
}
