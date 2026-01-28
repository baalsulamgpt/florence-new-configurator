export interface DoorTypeDefinition {
    name: string; // e.g., 'sd', 'dd'
    displayName: string;
    units: number;
    width: number;
    heightPerUnit: number;
    category: 'tenant' | 'parcel' | 'master' | 'special';
    uspsApproved: boolean;
    thumbnailPath: string;
}

export interface FrameDefinition {
    model: string;
    width: number;
    height: number;
    weight: number;
    tenants: number;
    parcels: number;
    leftColumn: string[]; // Array of door type codes
    rightColumn: string[];
    isConfigurable: boolean;
    mode: 'standard' | 'advanced';
    iw?: number; // Image width for display (67 for single, 122 for double)
    ih?: number; // Individual door height (rows count)
}
