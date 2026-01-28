import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Range Pipe - Creates an array of numbers from 0 to n-1
 * Usage: *ngFor="let i of count | range"
 */
@Pipe({
  name: 'range',
  standalone: true
})
export class RangePipe implements PipeTransform {
  transform(value: number): number[] {
    if (typeof value !== 'number' || value < 0) {
      return [];
    }
    return Array.from({ length: value }, (_, i) => i);
  }
}
