/**
 * CONFIGURATOR DATA MODELS
 * Reference: Configuration JSON from c4.php, Process4c.php
 */

// ====================================================================
// APPLICATION CONFIGURATION
// ====================================================================

export interface AppConfig {
  // Installation
  install_type: InstallType;
  kit_color_value: string;      // "0xdbe0eb_Silver Speck"
  kit_color_name: string;       // "Silver Speck"
  depot_color?: string;         // When install_type = 'depot'

  // Modes
  ada_mode: 'all' | 'ada';      // 'all' = minimum 5%, 'ada' = 100% below 48"
  delivery_mode: 'usps' | 'all';
  app_mode: 'standard' | 'advanced';

  // Door identification
  door_id_type: DoorIdType;
  door_id_font?: string;        // "US Block" for engraving

  // Lock (currently only one option)
  lock_type: 'Standard';
}

export type InstallType =
  | 'recessed'
  | 'surface'
  | 'depot'
  | 'pedestal'
  | 'express'
  | 'rear';

export type DoorIdType =
  | 'tbd'
  | 'Decal_Numbers'
  | 'Engraved'
  | 'Engraved_with_Black_Color_Fill'
  | 'Engraved_with_White_Color_Fill';

// ====================================================================
// DOOR MODEL
// ====================================================================

export interface Door {
  // Position
  position: number;             // Row position (0-indexed from bottom)
  door_type: string;            // 'sd', 'dd', 'td', etc.

  // Substitution
  substitute?: string;          // If replaced, new door type

  // Display
  label?: string;               // Calculated numbering
  column?: 'left' | 'right';    // For two-column frames

  // Validation
  isValid?: boolean;
  validationErrors?: string[];
}

// ====================================================================
// CABINET MODEL (from XML config)
// Reference: config.xml <box> elements
// ====================================================================

export interface Cabinet {
  // Identification
  model: string;                // e.g., '4C14D-16', '4C15S-08'
  title: string;                // Display title

  // Physical properties (inches)
  height: number;               // Total height (e.g., 51.25 for 14 rows)
  width: number;                // Width in inches
  ih: number;                   // Individual door height (15, 14, 13...)
  iw: number;                   // Image width for display

  // Configuration
  s: string;                    // Format: "type_columns_rows" e.g., "1_2_14"
  mode: 'standard' | 'advanced';
  configurable?: boolean;       // Whether cabinet is configurable
  weight: number;               // 1 or 2 (for shipping/weight calc)

  // Door counts
  tenants: number;              // Number of tenant doors
  parcels: number;              // Number of parcel doors

  // Door layout (space-separated door types)
  leftDoors: string[];          // Left column doors (bottom to top)
  rightDoors?: string[];        // Right column doors (if double column)

  // Calculated properties
  rows: number;                 // Number of rows (extracted from s)
  columns: number;              // 1 = single (S), 2 = double (D)
  cabinetType: CabinetType;     // 'single' or 'double'

  // UI State
  thumbnail?: string;
}

export type CabinetType = 'single' | 'double';
export type CabinetCategory = 'standard' | 'parcel' | 'hopper' | 'bin';

// ====================================================================
// FRAME MODEL
// Reference: c4.php, Process4c.php for frame structure
// ====================================================================

export interface Frame {
  // Identification
  id: string;                   // Unique ID (UUID)
  frame_id: string;             // Model ID from XML (e.g., '4C16D-20')

  // Door type that defines this frame
  door_type: string;            // 'sd', 'dd', 'td', etc.

  // Physical properties (inches)
  width: number;                // Frame width in inches
  height: number;               // Total height in inches
  bottom: number;               // Distance from floor to bottom of frame
  rows?: number;

  // Display properties (pixels) - from XML
  iw: number;                   // Image width for display (67 for single, 122 for double)
  ih: number;                   // Individual door height (rows count: 15, 14, 13...)

  // Position (for horizontal layout)
  left?: number;                // Left position in pixels/inches

  // Grid position (for display)
  grid_offset: number;          // Vertical position in grid units

  // Doors in frame
  doors: Door[];                // Array of doors, bottom to top

  // UI State
  isSelected?: boolean;
  isDragging?: boolean;
  isValid?: boolean;
  validationErrors?: string[];
}

// ====================================================================
// WALL / ELEVATION MODEL
// ====================================================================

export interface Wall {
  wall_id: number;              // Unique ID within level
  wall_name: string;            // User-defined name

  // Frames on this wall
  frames: Frame[];

  // Mounting/positioning
  mounting_height?: number;     // Height above floor (inches)

  // UI State
  is_active?: boolean;
}

// ====================================================================
// LEVEL / FLOOR MODEL
// ====================================================================

export interface Level {
  level_id: number;             // Unique ID
  level_name: string;           // User-defined name (e.g., "Level 1", "Floor 1")

  // Walls in this level
  walls: Wall[];

  // UI State
  expanded?: boolean;           // Whether level is expanded in tree view
}

// ====================================================================
// CONFIGURATOR STATE
// Reference: ConfiguratorState.php
// ====================================================================

export interface ConfiguratorState {
  // Configuration
  config: AppConfig;

  // Levels and Walls
  levels: Level[];
  active_level_id: number;      // Currently selected level
  active_wall_id: number;       // Currently selected wall (within active level)

  // Numbering
  tenant_num_start?: number;
  parcel_num_start?: number;
  configuration_number_array: Record<string, string>;  // "wall_X_frame_Y_door_Z": "101"

  // Offsets for Z-positioning
  offsets_z: number[];

  // UI State
  height_lock_config: boolean;
  height_lock_wall: boolean;
  locked_row?: string;

  // Module mode: 'frame' or 'substitute'
  module_mode: 'frame' | 'substitute';
  selected_door_id?: string;

  // Flags
  config_pdf_created?: boolean;
  config_revit_created?: boolean;
  cloned_conf?: boolean;
  is_edit_configuration?: boolean;

  // Metadata
  job_name: string;
  project_cookie_id: string;
  project_id?: number;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// ====================================================================
// VALIDATION RESULT
// ====================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  frameId?: string;
  wallId?: number;
  doorIndex?: number;
}

// ====================================================================
// COUNTERS (for display)
// ====================================================================

export interface ConfiguratorCounters {
  tenant_doors: number;
  parcel_doors: number;
  total_width: number;        // inches
  total_height_ft: number;
  total_height_in: number;
}

// ====================================================================
// NUMBERING STATE
// ====================================================================

export interface NumberingState {
  tenantStart: number | null;
  parcelStart: number | null;
  numberingMap: Map<string, string>;
  isDirty: boolean;
}

// ====================================================================
// WALL KEEPER (for wall management)
// Reference: WallsKeeper class in original
// ====================================================================

export interface WallsKeeper {
  levels: Level[];
  activeLevelId: number;
  activeWallId: number;

  // Level methods
  getLevel(levelId: number): Level | null;
  addLevel(): Level;
  removeLevel(levelId: number): boolean;
  setActiveLevel(levelId: number): void;
  renameLevel(levelId: number, newName: string): void;
  getActiveLevel(): Level | null;

  // Wall methods
  getWall(levelId: number, wallId: number): Wall | null;
  addWall(levelId: number): Wall;
  removeWall(levelId: number, wallId: number): boolean;
  setActiveWall(wallId: number): void;
  renameWall(levelId: number, wallId: number, newName: string): void;
  getActiveWall(): Wall | null;
}
