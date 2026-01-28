# Technical Specification: 4C Mailbox Configurator (Angular)

## Table of Contents
1. [Overview](#overview)
2. [Source Code References](#source-code-references)
3. [Application Architecture](#application-architecture)
4. [Main Configurator Page](#main-configurator-page)
5. [Module System](#module-system)
6. [Wall/Elevation System](#wallelevation-system)
7. [State Management](#state-management)
8. [Numbering System](#numbering-system)
9. [Data Models](#data-models)
10. [Configuration Reference](#configuration-reference)

---

## Overview

The 4C Mailbox Configurator is a visual drag-and-drop application that allows users to design and configure STD-4C mailbox systems for USPS-approved installations. The application features a canvas-based interface where users can drag mailbox modules, arrange them across multiple walls/elevations, and configure compartment numbering.

### Key Features
- Visual drag-and-drop configuration interface
- Support for multiple walls/elevations per project (up to 16)
- Real-time validation and error handling
- Auto-save functionality using localStorage
- Substitute door replacement system
- Height adjustment with locking mechanisms
- USPS and Advanced mode support

### Application Modes

1. **USPS Mode** (`app_mode = 'standard'`)
   - Restricted to USPS-approved configurations
   - Stricter validation rules
   - Limited door types

2. **Advanced Mode** (`app_mode = 'advanced'`)
   - All options available
   - More flexible bottom position limits

---

## Source Code References

The original PHP/CodeIgniter implementation serves as the reference for this Angular rewrite. All file paths are relative to the PHP project root at:
```
C:\Users\vmnas\source\repos\florence-site\
```

### Main Configurator View (Primary Reference)
**File:** `app/Views/steps/configurators/c4.php`
- **Lines 1-500:** Configuration initialization, PHP variables, JavaScript setup
- **Lines 500-1000:** Tab system for substitute doors, draggable setup
- **Lines 1000+:** Main canvas HTML structure, wall management UI
- **Purpose:** This is the single-page template that renders the entire configurator interface

### Controllers
| File | Purpose | Key Methods |
|------|---------|-------------|
| `app/Controllers/ConfigureControllers/ConfigureC4Controller.php` | Main configurator controller | `index()`, `process()`, `numbering()`, `completed()` |
| `app/Controllers/ConfigureControllers/aConfigureController.php` | Base abstract controller | Common methods for all configurators |
| `app/Controllers/Step1Controller.php` | Step 1 logic (for context) | `index()`, `acceptForm()` |
| `app/Controllers/Step2Controller.php` | Step 2 logic (for context) | `index()`, `acceptForm()`, `getFormByProductType()` |
| `app/Controllers/Step3Controller.php` | Step 3 wizard logic | `index()`, `calculate()` |

### State Management
**File:** `app/Libraries/ConfiguratorState.php`
- Manages all session state
- Handles cookie-based auto-save
- Methods: `getStep1Data()`, `getConfJson()`, `setConfJson()`, `restoreSteps()`, etc.

### Configuration XML
**Files:**
- `config-xml/config.xml` - Standard configuration for 4C mailboxes
- `config-xml/config_depot.xml` - Depot color configuration

**XML Contains:**
- Door type definitions and properties
- Installation type spacing parameters
- Height constraints for each door position
- Width specifications
- Color definitions

### Models & Business Logic
| File | Purpose |
|------|---------|
| `app/Models/Numbering/Numbering4c.php` | Door numbering system logic |
| `app/Models/Process4c.php` | JSON to XML conversion |
| `app/Models/Project.php` | Permanent project storage |
| `app/Models/ProjectTmp.php` | Temporary project storage |
| `app/Models/ModelMatch.php` | Wizard mode model matching |

### Views
| File | Purpose |
|------|---------|
| `app/Views/steps/numbering/4c.php` | Numbering form interface |
| `app/Views/steps/complete_view_alt.php` | Completion page |
| `app/Views/forms/4c/_form_2_4c.php` | Step 2 options form (color, ID type, etc.) |

### Public Assets (for reference)
| Path | Purpose |
|------|---------|
| `public/css/configurator-c4.css` | Main stylesheet |
| `public/images/` | Product images |
| `public/boxes/d_boxes/` | Door thumbnail images |

---

## Application Architecture

### Component Structure

```
src/
├── app/
│   ├── core/
│   │   ├── config/
│   │   │   └── app.config.ts           # App configuration
│   │   └── ...
│   ├── features/
│   │   ├── configurator/
│   │   │   ├── components/
│   │   │   │   ├── main-configurator/
│   │   │   │   │   ├── main-configurator.component.ts
│   │   │   │   │   ├── main-configurator.component.html
│   │   │   │   │   └── main-configurator.component.scss
│   │   │   │   ├── module-palette/
│   │   │   │   │   ├── module-palette.component.ts
│   │   │   │   │   ├── module-palette.component.html
│   │   │   │   │   └── module-palette.component.scss
│   │   │   │   ├── configuration-canvas/
│   │   │   │   │   ├── configuration-canvas.component.ts
│   │   │   │   │   ├── configuration-canvas.component.html
│   │   │   │   │   └── configuration-canvas.component.scss
│   │   │   │   ├── wall-manager/
│   │   │   │   │   ├── wall-manager.component.ts
│   │   │   │   │   ├── wall-manager.component.html
│   │   │   │   │   └── wall-manager.component.scss
│   │   │   │   ├── frame-display/
│   │   │   │   │   ├── frame-display.component.ts
│   │   │   │   │   ├── frame-display.component.html
│   │   │   │   │   └── frame-display.component.scss
│   │   │   │   └── door/
│   │   │   │       ├── door.component.ts
│   │   │   │       ├── door.component.html
│   │   │   │       └── door.component.scss
│   │   │   ├── services/
│   │   │   │   ├── configurator-state.service.ts
│   │   │   │   ├── xml-config.service.ts
│   │   │   │   ├── validation.service.ts
│   │   │   │   └── storage.service.ts
│   │   │   ├── models/
│   │   │   │   ├── configuration.model.ts
│   │   │   │   ├── wall.model.ts
│   │   │   │   ├── frame.model.ts
│   │   │   │   ├── door.model.ts
│   │   │   │   └── door-type.model.ts
│   │   │   └── configurator.routes.ts
│   │   └── numbering/
│   │       ├── components/
│   │       │   ├── numbering-page/
│   │       │   │   ├── numbering-page.component.ts
│   │       │   │   ├── numbering-page.component.html
│   │       │   │   └── numbering-page.component.scss
│   │       │   └── door-numbering-input/
│   │       │       ├── door-numbering-input.component.ts
│   │       │       ├── door-numbering-input.component.html
│   │       │       └── door-numbering-input.component.scss
│   │       ├── services/
│   │       │   └── numbering.service.ts
│   │       └── numbering.routes.ts
│   └── shared/
│       ├── ui/
│       │   ├── draggable/
│       │   ├── droppable/
│       │   └── modal/
│       └── validators/
└── assets/
    └── config/
        ├── config.xml
        └── config_depot.xml
```

---

## Main Configurator Page

**URL:** `/configure`
**Component:** `MainConfiguratorComponent`

### Application Modes

Based on configuration settings (from initial setup or stored state):

1. **USPS Mode** (`app_mode = 'standard'`)
   - Only USPS-approved doors shown
   - Height constraints: `min_tenant`, `min_other`, `max_bottom` arrays with strict values
   - Slotted doors hidden

2. **Advanced Mode** (`app_mode = 'advanced'`)
   - All door types available
   - Height constraints: More flexible (15" minimum vs 28"+ for some positions)

### Initial Configuration (Pre-set Values)

These values would normally come from Step 1/2, but for standalone configurator should have defaults:

```typescript
interface AppConfig {
    install_type: 'recessed' | 'surface' | 'depot' | 'pedestal' | 'express';
    kit_color_value: string;      // Format: "0xdbe0eb_Silver Speck"
    kit_color_name: string;       // "Silver Speck", "TBD", etc.
    ada_mode: 'all' | 'ada';      // 'all' = minimum 5%, 'ada' = 100% below 48"
    delivery_mode: 'usps' | 'all';
    app_mode: 'standard' | 'advanced';
    depot_color?: string;         // When install_type = 'depot'
    door_id_type: string;         // 'Decal_Numbers', 'Engraved', etc.
}
```

### Main Interface Components

#### 1. Left Panel - Module Palette

**Component:** `ModulePaletteComponent`

Contains draggable mailbox modules organized in tabs:

**Standard Doors Tab (default, active/green button)**
- Single Door (sd) - 1 unit width
- Double Door (dd) - 4 units width
- Triple Door (td) - 4 units width
- Quadruple Door (qd) - 4 units width
- Quintuple Door (qud) - 4 units width
- High Tenant doors (htsd1-5)
- And more...

**Outgoing Mail Tab**
- Various outgoing mail door configurations
- Slotted options (hidden in USPS mode)

**Parcel Lockers Tab**
- p2, p3, p4, p5, p6 - Parcel locker configurations
- Different door arrangements for parcel access

**Substitute Doors Tab**
- Appears when a door is clicked in substitute mode
- Shows replacement options for selected door position

Each module displayed as:
- Thumbnail image (from `public/boxes/d_boxes/{type}.png`)
- Draggable with visual feedback
- Revert animation on invalid drop

**Reference:** `c4.php` lines 150-210 (tab system HTML generation)

#### 2. Center - Configuration Canvas

**Component:** `ConfigurationCanvasComponent`

**Drop Zone:**
- Accepts whole frames (not individual doors)
- Validates maximum width limit:
  - Standard: 480 inches (40 feet)
  - Express: 1188 inches (99 feet)
- Shows visual feedback during drag
- CSS class `#droppable`

**Configuration Display:**
- Added modules shown as `FrameDisplayComponent` instances
- Each frame contains multiple `DoorComponent` instances
- Frames can be rearranged (drag to reorder)
- Visual indicators for locked/unlocked state

**Reference:** `c4.php` lines 413-436 (drop zone setup), lines 2100+ (canvas HTML)

#### 3. Right Panel - Wall Management

**Component:** `WallManagerComponent`

**Wall Selector:**
- Dropdown: `<select id="wall_selector">`
- Shows all walls in project
- Maximum 16 walls per project
- Each wall can be renamed via input field

**Wall Controls:**
- **Add Wall Button** (`#add_wall`): Creates new wall/elevation
- **Rename Wall Button** (`#rename_wall`): Updates active wall name
- **Delete Wall Button** (`#delete_wall`): Removes active wall (min 1)

**Active Wall Display:**
- Shows current wall number/ID
- Height adjustment controls (up/down buttons, direct input)
- Width information display

**Reference:** `c4.php` lines 458-480 (wall management JavaScript)

#### 4. Top Bar - Configuration Summary

**Counters Displayed:**
```html
Tenant Doors: <span id="all_tenant_br">0</span>
Parcel Doors: <span id="all_parcel_br">0</span>
Total Width: <span id="all_conf_width">0</span>"
Total Height: <span id="all_wdh_ft">0</span>' <span id="all_wdh_in">0</span>"
```

**Action Buttons:**
- **Save** (`#save_config`): Saves to localStorage
- **Save & Continue** (`#save_continue`): Saves and routes to numbering
- **Reset** (`#reset_config`): Clears current wall with confirmation

**Reference:** `c4.php` lines 2000-2100 (summary display and buttons)

---

## Module System

### Door Types

Each door has a `door_type` value indicating spacing units:

**Reference:** `c4.php` lines 299-314

```typescript
const DOOR_TYPE_UNITS: Record<string, number> = {
    // Standard tenant doors
    sd: 1,      // Single Door
    dd: 4,      // Double Door
    td: 4,      // Triple Door
    qd: 4,      // Quadruple Door
    qud: 4,     // Quintuple Door

    // High tenant doors
    htsd1: 1, htsd2: 4, htsd3: 4, htsd4: 14, htsd5: 4,

    // Parcel lockers
    p2: 4, p3: 4, p4: 4, p5: 4, p6: 4,

    // Master doors
    md: 2, mdsd: 2, mddd: 2, mdtd: 2, mdqd: 2,
    mdrear: 2, mdrearsd: 2, mdreardd: 2, mdreartd: 2, mdrearqd: 2,

    // Special doors
    s: 3, bs: 3, ms: 3, bms: 3,           // Slots
    sp: 4, lp: 4,                          // Small/Large parcel
    td5: 4, td5p: 4, tdh5: 4, tdh5p: 4,    // Triple door variants
    tdh6: 4, tdh8: 4, tdh8p: 4, tdh9: 4,
    tds1: 4, tds2: 4, tds3: 4,
    hopsp55: 4, hopsp50: 4, hopsp40: 4, hopsp10: 4,
    hopd: 4, hopbp: 4, hopsp: 4
};
```

### Frame Structure

A frame is a complete mailbox unit (column):

**Reference:** `Process4c.php`, `Numbering4c.php` for frame processing

```typescript
interface Frame {
    id: string;                    // Unique identifier
    doorType: string;              // 'sd', 'dd', 'td', etc.
    width: number;                 // Width in inches
    height: number;                // Total height in inches
    bottom: number;                // Distance from floor to bottom (inches)
    doors: Door[];                 // Array of doors in frame
}
```

### Module Modes

**Reference:** `c4.php` function `module_mode()` around line 382

**1. Module Mode** (default)
- Adding whole frames to configuration
- Frames drop into canvas
- Visual representation shows complete units

**2. Substitute Door Mode**
- Replacing individual doors within frames
- Click on door in frame → enters substitute mode
- Shows substitute door palette (different tabs)
- Drag substitute door onto target door
- Updates door configuration

**Toggle Logic:**
```javascript
// Original logic from c4.php
function module_mode() {
    // Shows/hides frame vs substitute door palettes
    // Updates visual state
}
```

---

## Wall/Elevation System

### Wall Data Structure

**Reference:** `ConfiguratorState.php` methods `getWallsArray()`, `setWallsArray()`

```typescript
interface Wall {
    wallId: number;           // 0-15 (max 16 walls)
    wallName: string;         // User-defined name
    frames: Frame[];          // Array of frames in this wall
}

interface WallsState {
    walls: Wall[];
    activeWallId: number;     // Currently displayed wall
}
```

### Wall Operations

**Reference:** `c4.php` JavaScript functions around lines 700-900

**1. Add Wall**
```javascript
function add_wall() {
    // Creates new wall with next available ID
    // Initializes empty frame array
    // Switches to new wall as active
    // Updates wall_selector dropdown
    // Saves configuration
}
```

**2. Switch Wall**
```javascript
function load_wall(wall_data) {
    // Saves current wall state to walls_ar
    // Clears canvas
    // Loads selected wall from walls_ar
    // Renders frames for selected wall
    // Updates active_wall variable
}

// From dropdown change
$('#wall_selector').change(function() {
    active_wall = Number($(this).val());
    load_wall(walls_ar[active_wall]);
});
```

**3. Rename Wall**
```javascript
$('#rename_wall').click(function() {
    if($("#current_wall_name").val() !== ""){
        $('#wall_selector option[value="'+active_wall+'"]')
            .text($("#current_wall_name").val());
        update_counters();
        save_configuration();
    }
});
```

**4. Delete Wall**
```javascript
$('#delete_wall').click(function() {
    if($('select#wall_selector option').length > 1) {
        if(confirm('Are you sure?')) {
            $("#wall_selector option[value='"+active_wall+"']").remove();
            setTimeout(function() {
                active_wall = Number($('#wall_selector').find(":selected").val());
                $("#wall_selector").val(active_wall);
                load_wall(walls_ar[active_wall]);
                save_configuration();
            }, 200);
        }
    }
});
```

---

## State Management

### State Architecture

**Reference:** `ConfiguratorState.php` (complete implementation)

The Angular version should use a centralized state service:

```typescript
@Injectable({ providedIn: 'root' })
export class ConfiguratorStateService {
    private state$ = new BehaviorSubject<ConfiguratorState>(initialState);

    // Observable streams
    readonly walls$ = this.state$.pipe(map(s => s.walls));
    readonly activeWallId$ = this.state$.pipe(map(s => s.activeWallId));
    readonly config$ = this.state$.pipe(map(s => s.config));

    // State accessors
    getState(): ConfiguratorState { ... }
    getStateSnapshot(): ConfiguratorState { ... }

    // State mutators
    setFrame(wallId: number, frame: Frame): void { ... }
    removeFrame(wallId: number, frameId: string): void { ... }
    setActiveWall(wallId: number): void { ... }

    // Persistence
    saveToLocalStorage(): void { ... }
    loadFromLocalStorage(): boolean { ... }
    reset(): void { ... }
}
```

### State Interface

```typescript
interface ConfiguratorState {
    // Configuration data
    config: AppConfig;
    walls: Wall[];
    activeWallId: number;

    // Numbering
    numberingStart: {
        tenant: number | null;
        parcel: number | null;
    };
    numberingMap: Map<string, string>;  // doorId -> number

    // UI State
    ui: {
        moduleMode: 'frame' | 'substitute';
        selectedDoorId: string | null;
        heightLockConfig: boolean;
        heightLockWall: boolean;
        lockedRow: string | null;
    };

    // Metadata
    metadata: {
        jobName: string;
        createdAt: Date;
        updatedAt: Date;
        isDirty: boolean;
    };
}
```

### Persistence

**Reference:** `ConfiguratorState.php` methods:
- `saveSteps()` - saves to project_tmp table
- `restoreSteps()` - restores from project_tmp
- Cookie management in `c4.php` JavaScript

**Angular Implementation:**
1. **Primary:** localStorage (for standalone)
2. **Optional:** Backend API endpoints matching original:
   - POST `/api/configurator/save` - Save configuration
   - GET `/api/configurator/load/{id}` - Load configuration
   - GET `/api/configurator/restore-cookie/{cookieId}` - Restore from cookie

---

## Numbering System

**URL:** `/numbering`
**Component:** `NumberingPageComponent`

**Reference:** `app/Views/steps/numbering/4c.php`, `Numbering4c.php`

### Numbering Form

**Start Value Inputs:**

```html
<!-- Tenant Door Numbering Start -->
<label>Tenant door numbering starts from:</label>
<input type="text" id="tenant_num_start" size="4" />
<em>(To leave blank, click SKIP NUMBERING below)</em>

<!-- Parcel Door Numbering Start -->
<label>Parcel door numbering starts from:</label>
<input type="text" id="parcel_num_start" size="4"
       onkeyup="this.value=this.value.replace(/[^\d]/,'')" />
<em>*Number only, "P" will automatically be added</em>
```

### Numbering Actions

**Reference:** `ConfigureC4Controller.php` method `updateNumbering()`

```typescript
interface NumberingActions {
    updateStartValues(): void;
    skipNumbering(): void;
    saveNumbering(): void;
}
```

**1. Update Start Values**
```typescript
updateStartValues() {
    // Validates input
    // Clears existing numbering map
    // Regenerates sequential numbering
    // Refreshes display
    // Shows warning: "Will reset custom numbering"
}
```

**2. Skip Numbering**
```typescript
skipNumbering() {
    // Clears tenant_num_start
    // Clears parcel_num_start
    // Clears numbering map
    // Proceedes to completion
}
```

**3. Save Numbering**
```typescript
saveNumbering() {
    // Collects all form inputs
    // Updates numberingMap in state
    // Saves to backend/storage
    // Redirects to completion
}
```

### Numbering Display

**Reference:** `Numbering4c.php` method `build_numbering_html()`

Each door in configuration gets an input field organized by wall → frame → door position:

```typescript
interface DoorNumberingInput {
    wallId: number;
    frameId: string;
    doorPosition: number;
    doorType: string;
    value: string;
}
```

**Numbering Logic:**

**Reference:** `Numbering4c.php` for door iteration logic

1. **Tenant Doors:**
   - Sequential increment from `tenant_num_start`
   - Increment by 1 for each tenant door
   - Applied left-to-right, top-to-bottom

2. **Parcel Doors:**
   - Sequential increment from `parcel_num_start`
   - Prefixed with "P"
   - Increment by 1 for each parcel door

### Maximum Symbol Limits

**Reference:** `ConfiguratorState.php` method `getMaxSymbolInLine()`

```typescript
const MAX_SYMBOLS_BY_ID_TYPE: Record<string, number> = {
    'Decal_Numbers': 4,
    'Engraved': 11,
    'Engraved_with_Black_Color_Fill': 7,
    'Engraved_with_White_Color_Fill': 7,
    'tbd': 7  // default
};
```

### Dirty Tracking

**Reference:** `4c.php` lines 42-76 in numbering view

```typescript
@Injectable({ providedIn: 'root' })
export class NumberingService {
    private isDirty$ = new BehaviorSubject<boolean>(false);
    private dirtySubject = new Subject<void>();

    markDirty(): void {
        this.isDirty$.next(true);
    }

    async saveIfNeeded(): Promise<boolean> {
        if (this.isDirty$.value) {
            const saved = await this.saveNumbering();
            if (saved) {
                this.isDirty$.next(false);
            }
            return saved;
        }
        return true;
    }
}
```

---

## Data Models

### Complete Configuration Model

**Reference:** Combined from `Process4c.php`, JSON structure in `c4.php`

```typescript
interface ConfigurationJSON {
    // Application settings
    app_mode: 'standard' | 'advanced';
    install_type: 'recessed' | 'surface' | 'depot' | 'pedestal' | 'express';
    kit_color: string;
    ada_mode: 'all' | 'ada';
    delivery_mode: 'usps' | 'all';

    // Door identification
    door_id_type: string;
    door_id_font?: string;

    // Lock settings
    lock_type: string;

    // Walls and frames
    walls: Wall[];
    height_lock_config: boolean;
    height_lock_wall: boolean;
    locked_row?: string;

    // Numbering
    tenant_num_start?: number;
    parcel_num_start?: number;
}

interface Wall {
    wall_id: number;
    wall_name: string;
    frames: Frame[];
}

interface Frame {
    frame_id: string;
    door_type: string;
    width: number;
    height: number;
    bottom: number;
    doors: Door[];
    grid_offset: number;
}

interface Door {
    position: number;
    door_type: string;
    substitute?: string;
}

interface NumberingMap {
    [key: string]: string;
    // Format: "wall_{wallId}_frame_{frameId}_door_{position}": value
    // Example: "wall_0_frame_abc123_door_0": "101"
    //          "wall_0_frame_abc123_door_1": "P1"
}
```

### Door Type Catalog

**Reference:** `config.xml` file for complete door definitions

```typescript
interface DoorTypeDefinition {
    name: string;
    displayName: string;
    units: number;
    width: number;
    heightPerUnit: number;
    category: 'tenant' | 'parcel' | 'master' | 'special';
    uspsApproved: boolean;
    thumbnailPath: string;
}

// Example definitions
const DOOR_TYPES: DoorTypeDefinition[] = [
    {
        name: 'sd',
        displayName: 'Single Door',
        units: 1,
        width: 20,
        heightPerUnit: 15,
        category: 'tenant',
        uspsApproved: true,
        thumbnailPath: 'assets/boxes/d_boxes/sd.png'
    },
    {
        name: 'dd',
        displayName: 'Double Door',
        units: 4,
        width: 20,
        heightPerUnit: 15,
        category: 'tenant',
        uspsApproved: true,
        thumbnailPath: 'assets/boxes/d_boxes/dd.png'
    },
    // ... all other door types
];
```

### Height Constraints

**Reference:** `c4.php` lines 487-496

```typescript
interface HeightConstraints {
    mode: 'usps' | 'advanced';
    minTenant: number[];
    minOther: number[];
    maxBottom: number[];
}

// USPS Mode (standard)
const USPS_CONSTRAINTS: HeightConstraints = {
    mode: 'usps',
    minTenant: [
        0, 0, 0, 36.375, 36.375, 28, 28, 28, 28, 28, 28, 28,
        15, 15, 15, 15, 15
    ],
    minOther: [
        0, 0, 0, 34.375, 30.875, 27.75, 27.75, 24.25, 20.75,
        20.75, 20.75, 17.25, 15, 15, 15, 15, 15
    ],
    maxBottom: [
        0, 0, 0, 46.75, 43.25, 39.75, 39.75, 39.75, 32.75,
        32.75, 32.75, 29.25, 25.75, 22.25, 20.25, 16.75, 15
    ]
};

// Advanced Mode
const ADVANCED_CONSTRAINTS: HeightConstraints = {
    mode: 'advanced',
    minTenant: Array(17).fill(15),
    minOther: Array(17).fill(15),
    maxBottom: [
        0, 0, 0, 58.75, 55.25, 51.75, 48.25, 44.75, 41.25,
        37.75, 34.25, 30.75, 27.25, 23.75, 20.25, 16.75, 15
    ]
};
```

### Installation Spacing

**Reference:** `c4.php` lines 214-251

```typescript
interface InstallationSpacing {
    x_margin: number;
    x_space: number;
    x_margin_px: number;
    x_space_px: number;
    max_width_inches: number;
}

const INSTALLATION_SPACING: Record<string, InstallationSpacing> = {
    recessed: {
        x_margin: 2,
        x_space: 0.5,
        x_margin_px: 20,
        x_space_px: 5,
        max_width_inches: 480
    },
    rear: {
        x_margin: 2,
        x_space: 0.5,
        x_margin_px: 20,
        x_space_px: 5,
        max_width_inches: 480
    },
    surface: {
        x_margin: 2,
        x_space: 0.5,
        x_margin_px: 20,
        x_space_px: 5,
        max_width_inches: 480
    },
    pedestal: {
        x_margin: 2,
        x_space: 0.5,
        x_margin_px: 20,
        x_space_px: 5,
        max_width_inches: 480
    },
    depot: {
        x_margin: 0.25,
        x_space: 0,
        x_margin_px: 2.5,
        x_space_px: 0,
        max_width_inches: 480
    },
    express: {
        x_margin: 0,
        x_space: 0,
        x_margin_px: 0,
        x_space_px: 0,
        max_width_inches: 1188
    }
};
```

---

## Configuration Reference

### Maximum Values

```typescript
const MAX_VALUES = {
    WALLS: 16,
    WIDTH_STANDARD: 480,    // 40 feet in inches
    WIDTH_EXPRESS: 1188,    // 99 feet in inches
    MAILBOX_COUNT: 500,     // Wizard mode limit
    FIELD_LENGTHS: {
        DEALER_NAME: 75,
        ARCHITECT_NAME: 75,
        DRAWN_BY: 30,
        PO_NUMBER: 30,
        QUOTE_NUMBER: 30,
        NUMBERING_INSTRUCTIONS: 256
    }
};
```

### Color Codes

**Reference:** `_form_2_4c.php` for color definitions

```typescript
interface ColorOption {
    value: string;     // "0xdbe0eb_Silver Speck"
    hex: string;       // "#dbe0eb"
    name: string;      // "Silver Speck"
}

const STANDARD_COLORS: ColorOption[] = [
    { value: '0xdbe0eb_tbd', hex: '#dbe0eb', name: 'TBD' },
    { value: '0xdbe0eb_Silver Speck', hex: '#dbe0eb', name: 'Silver Speck' },
    { value: '0x7b6d61_Antique Bronze', hex: '#7b6d61', name: 'Antique Bronze' },
    { value: '0x4c4c5d_Black', hex: '#4c4c5d', name: 'Black' },
    { value: '0x75756f_Dark Bronze', hex: '#75756f', name: 'Dark Bronze' },
    { value: '0xdec481_Gold Speck', hex: '#dec481', name: 'Gold Speck' },
    { value: '0xdadbd0_Postal Grey', hex: '#dadbd0', name: 'Postal Grey' },
    { value: '#f5ecd4_Sandstone', hex: '#f5ecd4', name: 'Sandstone' },
    { value: '0xffffff_White', hex: '#ffffff', name: 'White' }
];
```

### Door Identification Types

```typescript
interface DoorIdType {
    value: string;
    displayName: string;
    fontRequired?: string;
    maxChars: number;
}

const DOOR_ID_TYPES: DoorIdType[] = [
    { value: 'tbd', displayName: 'TBD', maxChars: 7 },
    { value: 'Decal_Numbers', displayName: 'Decal Numbers', maxChars: 4 },
    { value: 'Engraved', displayName: 'Engraved', fontRequired: 'US Block', maxChars: 11 },
    { value: 'Engraved_with_Black_Color_Fill', displayName: 'Engraved with Black Color Fill', fontRequired: 'US Block', maxChars: 7 },
    { value: 'Engraved_with_White_Color_Fill', displayName: 'Engraved with White Color Fill', fontRequired: 'US Block', maxChars: 7 }
];
```

### XML Configuration Loading

**Service to load and parse XML:**

```typescript
@Injectable({ providedIn: 'root' })
export class XmlConfigService {
    private configCache: Map<string, any> = new Map();

    constructor(private http: HttpClient) {}

    loadConfig(configType: 'standard' | 'depot'): Observable<any> {
        const filename = configType === 'depot' ? 'config_depot.xml' : 'config.xml';

        if (this.configCache.has(filename)) {
            return of(this.configCache.get(filename));
        }

        return this.http.get(`assets/config/${filename}`, {
            responseType: 'text'
        }).pipe(
            map(xmlString => this.parseXml(xmlString)),
            tap(config => this.configCache.set(filename, config)),
            catchError(error => {
                console.error('Failed to load config:', error);
                return throwError(() => error);
            })
        );
    }

    private parseXml(xmlString: string): any {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        return {
            installation: this.parseInstallation(xmlDoc),
            substitute_doors: this.parseSubstituteDoors(xmlDoc),
            door_types: this.parseDoorTypes(xmlDoc),
            // ... other sections
        };
    }
}
```

---

## Appendix A: Key JavaScript Functions from Original

### Frame Operations

**Reference:** `c4.php` around lines 900-1500

```typescript
// Original function signatures to implement
function add_frame(drop_obj, event_pagex, event_pagey, subst_doors, subst_subst, grid_offset) {
    // Adds a new frame to the configuration
    // Validates width constraints
    // Creates frame HTML
    // Updates counters
    // Saves configuration
}

function remove_frame(frame_id) {
    // Removes frame from active wall
    // Updates counters
    // Saves configuration
}

function subst_revert(valid, element) {
    // Handles substitute door revert animation
    // Returns true if should revert
}

function subst_drag(event, ui) {
    // Visual feedback during substitute door drag
    // Red/green highlighting
}
```

### Height Management

**Reference:** `c4.php` around lines 1600-2000

```typescript
function up_grid(clicked_element) {
    // Moves frame/door up
    // Validates against min_height constraints
}

function down_grid(clicked_element) {
    // Moves frame/door down
    // Validates against max_bottom constraints
}

function lock_height(type) {
    // type: 'config' or 'wall'
    // Enables height locking
}
```

### Counter Updates

**Reference:** `c4.php` around lines 800-900

```typescript
function update_counters() {
    // Counts all tenant doors
    // Counts all parcel doors
    // Calculates total width
    // Calculates total height
    // Updates display elements
}
```

---

## Appendix B: Validation Rules Reference

**Reference:** `Step2Controller.php` validation rules, JavaScript validation in forms

### Client-Side Validation

```typescript
@Injectable({ providedIn: 'root' })
export class ValidationService {
    validateFrameDrop(
        currentWidth: number,
        frameWidth: number,
        maxWitdh: number
    ): ValidationResult {
        if (currentWidth + frameWidth > maxWitdh) {
            return {
                valid: false,
                message: 'Maximum limit per wall reached'
            };
        }
        return { valid: true };
    }

    validateDoorHeight(
        doorType: string,
        position: number,
        bottom: number,
        constraints: HeightConstraints
    ): ValidationResult {
        const isTenant = this.isTenantDoor(doorType);
        const mins = isTenant ? constraints.minTenant : constraints.minOther;

        if (bottom < mins[position]) {
            return {
                valid: false,
                message: `Door position too high. Minimum: ${mins[position]}"`
            };
        }

        if (bottom > constraints.maxBottom[position]) {
            return {
                valid: false,
                message: `Door position too low. Maximum: ${constraints.maxBottom[position]}"`
            };
        }

        return { valid: true };
    }

    private isTenantDoor(doorType: string): boolean {
        return ['sd', 'dd', 'td', 'qd', 'qud', 'htsd1', 'htsd2', 'htsd3', 'htsd4', 'htsd5']
            .includes(doorType);
    }
}
```

---

## Appendix C: CSS Reference

**Original file:** `public/css/configurator-c4.css`

Key CSS classes to implement:

```css
/* Main layout */
.config_shell {
    /* Main container */
}

#droppable {
    /* Drop zone for frames */
    min-height: 600px;
    border: 2px dashed #ccc;
}

/* Module palette */
.module {
    /* Draggable module */
    cursor: move;
}

.door {
    /* Door element */
    position: absolute;
}

/* Wall management */
#wall_selector {
    /* Wall dropdown */
}

/* Substitute doors */
.button_tab {
    /* Tab button */
    background-color: #ddd;
}

.button_tab.active {
    background-color: green;
    color: white;
}

/* Validation */
.error {
    border: 2px solid #ff0000;
}

/* Feedback */
.saving-note {
    /* Auto-save notification */
}
```

---

## Document Information

**Version:** 2.0 (Angular Edition)
**Date:** 2025-01-21
**Scope:** STD-4C Mailbox Configurator - Main Configurator Page Only
**Target Framework:** Angular 18+
**TypeScript Version:** 5.6+

**Changes from v1.0:**
- Removed Step 1, 2, 3 sections (configurator is now standalone)
- Added Angular-specific architecture and component structure
- Added source code file references with line numbers
- Reorganized for component-based implementation
- Added TypeScript interfaces and service patterns

**Key Reference Files:**
- `app/Views/steps/configurators/c4.php` - Main template (~1300 lines)
- `app/Libraries/ConfiguratorState.php` - State management
- `config-xml/config.xml` - Door and configuration definitions
- `app/Controllers/ConfigureControllers/ConfigureC4Controller.php` - Backend logic
