import { Pipe, PipeTransform } from '@angular/core';
import { Wall, Frame, Door } from '../../../core/models/configurator.models';

interface WallStats {
    totalCabinets: number;
    tenantCabinets: number;
    parcelCabinets: number;
    tenantRange: string;
    parcelRange: string;
    maxWidth: number;
    maxHeight: number;
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
                maxWidth: 0,
                maxHeight: 0
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
            maxWidth: 0,
            maxHeight: 0
        };

        if (!wall.frames || wall.frames.length === 0) {
            return stats;
        }

        const tenantNumbers: number[] = [];
        const parcelNumbers: number[] = [];

        console.log('[WallStatsPipe] Processing wall:', wall.wall_id, 'frames:', wall.frames.length);

        wall.frames.forEach((frame: Frame) => {
            stats.totalCabinets++;

            // Accumulate dimensions
            stats.maxWidth += frame.width;
            if (frame.height > stats.maxHeight) {
                stats.maxHeight = frame.height;
            }

            // Count doors by type (each door can be tenant or parcel)
            let hasTenant = false;
            let hasParcel = false;

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
                    hasParcel = true;
                    // Parcel labels have format "1P", "2P", etc. - strip 'P' suffix
                    const labelWithoutSuffix = (door.label || '').replace(/P$/i, '');
                    const number = parseInt(labelWithoutSuffix, 10);
                    if (!isNaN(number)) {
                        parcelNumbers.push(number);
                    }
                } else {
                    // Tenant door types: sd, dd, td, qd, etc.
                    hasTenant = true;
                    const number = parseInt(door.label || '', 10);
                    if (!isNaN(number)) {
                        tenantNumbers.push(number);
                    }
                }
            });

            // Count cabinet based on what doors it contains
            if (hasParcel && !hasTenant) {
                stats.parcelCabinets++;
            } else if (hasTenant && !hasParcel) {
                stats.tenantCabinets++;
            } else {
                // Mixed cabinet - count in both (or could count as tenant)
                stats.tenantCabinets++;
                if (hasParcel) {
                    stats.parcelCabinets++;
                }
            }
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

        return stats;
    }

    clearCache(): void {
        this.cache.clear();
    }
}
