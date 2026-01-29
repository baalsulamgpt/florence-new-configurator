import { Pipe, PipeTransform } from '@angular/core';
import { Wall, Frame, Door } from '../../../core/models/configurator.models';

interface WallStats {
    totalCabinets: number;
    tenantCabinets: number;
    parcelCabinets: number;
    tenantRange: string;
    parcelRange: string;
    maxWidth: string;
    maxHeight: string;
    roMin: string;
    roMax: string;
}

@Pipe({
    name: 'wallStats',
    pure: true,
    standalone: true
})
export class WallStatsPipe implements PipeTransform {
    private cache = new Map<string, WallStats>();

    transform(wall: Wall): WallStats {
        if (!wall) {
            return {
                totalCabinets: 0,
                tenantCabinets: 0,
                parcelCabinets: 0,
                tenantRange: '',
                parcelRange: '',
                maxWidth: '',
                maxHeight: '',
                roMin: '',
                roMax: ''
            };
        }

        // Create cache key from wall data
        const cacheKey = JSON.stringify(wall.frames?.map(f => ({
            id: f.id,
            frame_id: f.frame_id,
            width: f.width,
            height: f.height,
            doors: f.doors?.map(d => ({ label: d.label }))
        })) || []);

        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        const stats = this.calculateStats(wall);
        this.cache.set(cacheKey, stats);
        return stats;
    }

    private calculateStats(wall: Wall): WallStats {
        const stats = {
            totalCabinets: 0,
            tenantCabinets: 0,
            parcelCabinets: 0,
            tenantRange: '',
            parcelRange: '',
            maxWidth: '',
            maxHeight: '',
            roMin: '',
            roMax: ''
        };

        let maxWidthNum = 0;
        let maxHeightNum = 0;

        if (!wall.frames || wall.frames.length === 0) {
            return stats;
        }

        const tenantNumbers: number[] = [];
        const parcelNumbers: number[] = [];

        console.log('[WallStatsPipe] Processing wall:', wall.wall_id, 'frames:', wall.frames.length);

        wall.frames.forEach((frame: Frame) => {
            stats.totalCabinets++;

            // Accumulate dimensions
            maxWidthNum += frame.width;
            if (frame.height > maxHeightNum) {
                maxHeightNum = frame.height;
            }

            // Count individual doors (not cabinets)
            frame.doors?.forEach((door: Door) => {
                const doorType = (door.door_type || '').toLowerCase();

                // Skip special doors (master door, mail slots)
                if (['md', 'bms', 'ms', 'om'].includes(doorType)) {
                    return;
                }

                // Parcel door types: p, p2, p3, p4, p5, p6, sp, lp, hopper, bin
                const isParcelDoor = doorType.match(/^p\d*/) || doorType === 'sp' || doorType === 'lp' ||
                                     doorType === 'hopper' || doorType === 'bin' ||
                                     doorType.startsWith('hop') || doorType.startsWith('td');

                if (isParcelDoor) {
                    stats.parcelCabinets++;
                    // Parcel labels have format "1P", "2P", etc. - strip 'P' suffix
                    const labelWithoutSuffix = (door.label || '').replace(/P$/i, '');
                    const number = parseInt(labelWithoutSuffix, 10);
                    if (!isNaN(number)) {
                        parcelNumbers.push(number);
                    }
                } else {
                    // Tenant door types: sd, dd, td, qd, etc.
                    stats.tenantCabinets++;
                    const number = parseInt(door.label || '', 10);
                    if (!isNaN(number)) {
                        tenantNumbers.push(number);
                    }
                }
            });
        });

        console.log('[WallStatsPipe] Result:', stats, 'tenantNumbers:', tenantNumbers, 'parcelNumbers:', parcelNumbers);

        // Calculate ranges
        if (tenantNumbers.length > 0) {
            const minT = Math.min(...tenantNumbers);
            const maxT = Math.max(...tenantNumbers);
            stats.tenantRange = minT === maxT ? `${minT}` : `${minT}-${maxT}`;
        }

        if (parcelNumbers.length > 0) {
            const minP = Math.min(...parcelNumbers);
            const maxP = Math.max(...parcelNumbers);
            stats.parcelRange = minP === maxP ? `${minP}P` : `${minP}P-${maxP}P`;
        }

        // Format dimensions with fractions
        stats.maxWidth = this.formatInches(maxWidthNum);
        stats.maxHeight = this.formatInches(maxHeightNum);

        // Calculate RO MIN and RO MAX
        // Count single vs double column cabinets
        let singleColumnCount = 0;
        let doubleColumnCount = 0;

        wall.frames?.forEach((frame: Frame) => {
            const hasRightColumn = frame.doors?.some(d => d.column === 'right');
            if (hasRightColumn) {
                doubleColumnCount++;
            } else {
                singleColumnCount++;
            }
        });

        const overallWidth = maxWidthNum;
        let roMaxDeduction = 0;
        let roMinDeduction = 0;

        if (doubleColumnCount > 0 && singleColumnCount === 0) {
            // Double column units only
            roMaxDeduction = 15 / 16; // 0.9375"
            roMinDeduction = 1 + 3 / 16; // 1.1875"
        } else if (singleColumnCount > 0 && doubleColumnCount === 0) {
            // Single column units only
            roMaxDeduction = 1;
            roMinDeduction = 1 + 1 / 4; // 1.25"
        } else {
            // Mixed single and double column units
            roMaxDeduction = 31 / 32; // 0.96875"
            roMinDeduction = 1 + 7 / 32; // 1.21875"
        }

        stats.roMax = this.formatInches(overallWidth - roMaxDeduction);
        stats.roMin = this.formatInches(overallWidth - roMinDeduction);

        return stats;
    }

    private formatInches(value: number): string {
        const whole = Math.floor(value);
        const fraction = value - whole;
        const fractionDenominators = [32, 16, 8, 4, 2];

        // Find the best fraction representation
        for (const denom of fractionDenominators) {
            const numer = Math.round(fraction * denom);
            if (Math.abs(numer / denom - fraction) < 0.01) {
                if (numer === 0) {
                    return `${whole}"`;
                } else if (numer === 1 && denom === 2) {
                    return `${whole} 1/2"`;
                } else if (denom === 4) {
                    return `${whole} ${numer}/4"`;
                } else if (denom === 8) {
                    return `${whole} ${numer}/8"`;
                } else if (denom === 16) {
                    return `${whole} ${numer}/16"`;
                } else if (denom === 32) {
                    return `${whole} ${numer}/32"`;
                }
            }
        }

        // Fallback to decimal
        return `${value.toFixed(2)}"`;
    }

    clearCache(): void {
        this.cache.clear();
    }
}
