/**
 * Complete door configurations with all properties needed for rendering and validation
 * Single source of truth for all door types
 */

// Position types for door elements
export type ElementPosition =
  | { type: 'absolute'; x: number; y: number }     // pixels (will be scaled)
  | { type: 'relative'; x: number; y: number }     // % of width/height
  | { type: 'units'; x: number; yUnits: number }   // x in px, y in unitHeight
  | { type: 'mixed'; x: number; yUnits: number };  // x as % of width, y in unitHeight

export interface DoorElement {
  type: 'lock' | 'master-lock' | 'handle';
  position: ElementPosition;
  handleType?: 'circle' | 'rectangular';
}

export interface SpecialElement {
  type: 'slot' | 'pill';
  width: number;    // % of door width
  height: number;   // % of door height
  x: number;        // % of door width
  y: number;        // % of door height
}

export interface DoorConfig {
  // Basic properties
  name: string;              // 'sd', 'dd', 'md', etc.
  displayName: string;       // 'Single Door', 'Master Door', etc.
  units: number;             // 1, 2, 3, 4.5, etc.
  category: 'tenant' | 'parcel' | 'master' | 'special';
  uspsApproved: boolean;

  // Visual elements (locks, handles)
  elements: DoorElement[];
  special?: SpecialElement;

  // Rendering options
  hasGradient?: boolean;
  showTypeText?: boolean;
}

export const DOOR_CONFIGS: Record<string, DoorConfig> = {
  // ====================================================================
  // STANDARD TENANT DOORS
  // ====================================================================
  sd: {
    name: 'sd',
    displayName: 'Single Door',
    units: 1,
    category: 'tenant',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 0.5 }
      }
    ]
  },

  dd: {
    name: 'dd',
    displayName: 'Double Door',
    units: 2,
    category: 'tenant',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 1.5 }
      }
    ]
  },

  td: {
    name: 'td',
    displayName: 'Triple Door',
    units: 3,
    category: 'tenant',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 2.5 }
      }
    ]
  },

  qd: {
    name: 'qd',
    displayName: 'Quadruple Door',
    units: 4,
    category: 'tenant',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      }
    ]
  },

  qud: {
    name: 'qud',
    displayName: 'Quintuple Door',
    units: 5,
    category: 'tenant',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      }
    ]
  },

  // ====================================================================
  // PARCEL LOCKERS
  // ====================================================================
  p2: {
    name: 'p2',
    displayName: 'Parcel 2-Door',
    units: 2,
    category: 'parcel',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'mixed', x: 0.3, yUnits: 0.5 }
      },
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 1 }
      }
    ]
  },

  p3: {
    name: 'p3',
    displayName: 'Parcel 3-Door',
    units: 3,
    category: 'parcel',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'mixed', x: 0.3, yUnits: 0.5 }
      },
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 2 }
      }
    ]
  },

  p4: {
    name: 'p4',
    displayName: 'Parcel 4-Door',
    units: 4,
    category: 'parcel',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'mixed', x: 0.3, yUnits: 0.5 }
      },
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 3 }
      }
    ]
  },

  p5: {
    name: 'p5',
    displayName: 'Parcel 5-Door',
    units: 5,
    category: 'parcel',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'mixed', x: 0.3, yUnits: 0.5 }
      },
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 4 }
      }
    ]
  },

  p6: {
    name: 'p6',
    displayName: 'Parcel 6-Door',
    units: 6,
    category: 'parcel',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'mixed', x: 0.3, yUnits: 0.5 }
      },
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 5 }
      }
    ]
  },

  sp: {
    name: 'sp',
    displayName: 'Spare Parcel',
    units: 4.5,
    category: 'parcel',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'mixed', x: 0.3, yUnits: 0.5 }
      },
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 3.5 }
      }
    ]
  },

  // ====================================================================
  // MASTER DOORS
  // ====================================================================
  md: {
    name: 'md',
    displayName: 'Master Door',
    units: 1,
    category: 'master',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      {
        type: 'master-lock',
        position: { type: 'relative', x: 0.25, y: 0.5 }
      }
    ]
  },

  mdsd: {
    name: 'mdsd',
    displayName: 'Master + Single Door',
    units: 2,
    category: 'master',
    uspsApproved: true,
    hasGradient: true,
    elements: [
      // Top half (MD) - master lock
      {
        type: 'master-lock',
        position: { type: 'relative', x: 0.25, y: 0.25 }
      },
      // Bottom half (SD) - regular lock
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1.5 }
      }
    ],
    showTypeText: true
  },

  // ====================================================================
  // SPECIAL DOORS (Slots, Mail)
  // ====================================================================
  s: {
    name: 's',
    displayName: 'Slot',
    units: 1,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [],
    special: {
      type: 'slot',
      width: 0.5,
      height: 0.2,
      x: 0.25,
      y: 0.4
    }
  },

  bs: {
    name: 'bs',
    displayName: 'Bit Slot',
    units: 1,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  ms: {
    name: 'ms',
    displayName: 'Mail Slot',
    units: 1,
    category: 'special',
    uspsApproved: true,
    hasGradient: true,
    elements: [],
    special: {
      type: 'slot',
      width: 0.7,
      height: 0.2,
      x: 0.15,
      y: 0.12
    }
  },

  bms: {
    name: 'bms',
    displayName: 'Bit Mail Slot',
    units: 1,
    category: 'special',
    uspsApproved: true,
    hasGradient: true,
    elements: [],
    special: {
      type: 'slot',
      width: 0.7,
      height: 0.2,
      x: 0.15,
      y: 0.12
    }
  },

  // ====================================================================
  // HOPPER DOORS
  // ====================================================================
  hopd: {
    name: 'hopd',
    displayName: 'Hopper Door',
    units: 2.5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [],
    special: {
      type: 'slot',
      width: 0.4,
      height: 0.1,
      x: 0.3,
      y: 0.15
    }
  },

  hopbp: {
    name: 'hopbp',
    displayName: 'Hopper Bin Parcel',
    units: 7.5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 1 }
      },
      {
        type: 'master-lock',
        position: { type: 'relative', x: 0.25, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'circle',
        position: { type: 'units', x: 8, yUnits: 6.5 }
      }
    ]
  },

  // Hopper spacers
  hopsp10: {
    name: 'hopsp10',
    displayName: 'Hopper Spacer 1',
    units: 1,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  hopsp20: {
    name: 'hopsp20',
    displayName: 'Hopper Spacer 2',
    units: 2,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  hopsp30: {
    name: 'hopsp30',
    displayName: 'Hopper Spacer 3',
    units: 3,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  hopsp40: {
    name: 'hopsp40',
    displayName: 'Hopper Spacer 4',
    units: 4,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  hopsp50: {
    name: 'hopsp50',
    displayName: 'Hopper Spacer 5',
    units: 5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  hopsp55: {
    name: 'hopsp55',
    displayName: 'Hopper Spacer 5.5',
    units: 5.5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  // ====================================================================
  // TRIPLE DOOR VARIANTS (BIN doors)
  // ====================================================================
  tds1: {
    name: 'tds1',
    displayName: 'Triple Door Small 1',
    units: 2,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [],
    special: {
      type: 'pill',
      width: 60,
      height: 20,
      x: 0.5,
      y: 0.5
    },
    showTypeText: true
  },

  td5: {
    name: 'td5',
    displayName: 'Triple Door 5',
    units: 5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  td5p: {
    name: 'td5p',
    displayName: 'Triple Door 5 with Parcel',
    units: 5.5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 5 }
      }
    ]
  },

  tdh5: {
    name: 'tdh5',
    displayName: 'Triple Door High 5',
    units: 5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  tdh5p: {
    name: 'tdh5p',
    displayName: 'Triple Door High 5 with Parcel',
    units: 5.5,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'units', x: 8, yUnits: 5 }
      }
    ]
  },

  tdh6: {
    name: 'tdh6',
    displayName: 'Triple Door High 6',
    units: 6,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  tdh8: {
    name: 'tdh8',
    displayName: 'Triple Door High 8',
    units: 8,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  tdh8p: {
    name: 'tdh8p',
    displayName: 'Triple Door High 8 with Parcel',
    units: 8,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  tdh9: {
    name: 'tdh9',
    displayName: 'Triple Door High 9',
    units: 9,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  td6: {
    name: 'td6',
    displayName: 'Triple Door 6',
    units: 6,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: []
  },

  tdh10: {
    name: 'tdh10',
    displayName: 'Triple Door High 10',
    units: 10,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  },

  tdh11: {
    name: 'tdh11',
    displayName: 'Triple Door High 11',
    units: 11,
    category: 'special',
    uspsApproved: false,
    hasGradient: true,
    elements: [
      {
        type: 'lock',
        position: { type: 'relative', x: 8, y: 0.5 }
      },
      {
        type: 'handle',
        handleType: 'rectangular',
        position: { type: 'relative', x: 0.25, y: 0.2 }
      }
    ]
  }
};

// Helper functions
export function getDoorLabel(name: string): string {
  return name.toUpperCase();
}

export function getDoorUnits(name: string): number {
  const config = DOOR_CONFIGS[name];
  return config?.units ?? 1;
}

export function getDoorCategory(name: string): string {
  const config = DOOR_CONFIGS[name];
  return config?.category ?? 'special';
}

export function getDoorConfig(name: string): DoorConfig | undefined {
  return DOOR_CONFIGS[name];
}
