import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Cabinet, CabinetType } from '../models/configurator.models';

/**
 * Cabinet Loader Service
 * Loads and parses cabinet definitions from config.xml
 */
@Injectable({
  providedIn: 'root'
})
export class CabinetLoaderService {
  private cabinetsSubject = new BehaviorSubject<Cabinet[]>([]);
  public cabinets$ = this.cabinetsSubject.asObservable();

  private cabinetsByRows: Map<number, Cabinet[]> = new Map();

  constructor(private http: HttpClient) {
    this.loadCabinets();
  }

  /**
   * Load cabinets from XML config file
   */
  private loadCabinets(): void {
    this.http.get('config-xml/config.xml', { responseType: 'text' }).pipe(
      map(xml => this.parseXML(xml)),
      catchError(error => {
        console.error('Failed to load cabinet config:', error);
        return of([]);
      })
    ).subscribe(cabinets => {
      this.cabinetsSubject.next(cabinets);
      this.indexCabinets(cabinets);
    });
  }

  /**
   * Parse XML string and extract cabinet definitions
   */
  private parseXML(xmlString: string): Cabinet[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const boxElements = xmlDoc.querySelectorAll('box');

    const cabinets: Cabinet[] = [];

    boxElements.forEach(box => {
      const cabinet = this.parseBoxElement(box);
      if (cabinet) {
        cabinets.push(cabinet);
      }
    });

    return cabinets;
  }

  /**
   * Parse a single <box> element into Cabinet
   */
  private parseBoxElement(box: Element): Cabinet | null {
    // Get attributes
    const model = box.getAttribute('model') || '';
    const title = box.getAttribute('title') || model;
    const height = parseFloat(box.getAttribute('height') || '0');
    const width = parseFloat(box.getAttribute('width') || '0');
    const ih = parseFloat(box.getAttribute('ih') || '0');
    const iw = parseFloat(box.getAttribute('iw') || '0');
    const s = box.getAttribute('s') || '';
    const mode = (box.getAttribute('mode') || 'standard') as 'standard' | 'advanced';
    const configurable = box.getAttribute('configurable') === '1';
    const weight = parseInt(box.getAttribute('weight') || '1', 10);
    const tenants = parseInt(box.getAttribute('tenants') || '0', 10);
    const parcels = parseInt(box.getAttribute('parcels') || '0', 10);
    const leftDoorsStr = box.getAttribute('l') || '';
    const rightDoorsStr = box.getAttribute('r') || undefined;

    // Parse s attribute: "type_columns_rows"
    const sParts = s.split('_');
    const type = parseInt(sParts[0] || '0', 10);  // 1=standard, 2=parcel, 3=bin, 4=hopper
    const columns = parseInt(sParts[1] || '1', 10); // 1=single, 2=double
    const rows = parseInt(sParts[2] || '0', 10);    // 6-16

    // Parse door arrays
    const leftDoors = leftDoorsStr ? leftDoorsStr.split(' ').filter(d => d) : [];
    const rightDoors = rightDoorsStr ? rightDoorsStr.split(' ').filter(d => d) : undefined;

    // Determine cabinet type
    const cabinetType: CabinetType = columns === 2 ? 'double' : 'single';

    // Get thumbnail path
    const thumbnail = this.getThumbnailPath(model);

    return {
      model,
      title,
      height,
      width,
      ih,
      iw,
      s,
      mode,
      configurable,
      weight,
      tenants,
      parcels,
      leftDoors,
      rightDoors,
      rows,
      columns,
      cabinetType,
      thumbnail
    };
  }

  /**
   * Get thumbnail image path for cabinet
   */
  private getThumbnailPath(model: string): string {
    // Try to find a matching image in assets/boxes/
    // For now, return a generic path - can be enhanced later
    return `assets/boxes/d_boxes/${model}.png`;
  }

  /**
   * Index cabinets by rows for quick lookup
   */
  private indexCabinets(cabinets: Cabinet[]): void {
    this.cabinetsByRows.clear();

    cabinets.forEach(cabinet => {
      const rows = cabinet.rows;
      if (!this.cabinetsByRows.has(rows)) {
        this.cabinetsByRows.set(rows, []);
      }
      this.cabinetsByRows.get(rows)!.push(cabinet);
    });
  }

  /**
   * Get cabinets filtered by rows
   */
  getCabinetsByRows(rows: number): Cabinet[] {
    // ADA mode uses 99
    if (rows === 99) {
      // Return cabinets that fit ADA height (37.25")
      return this.cabinetsSubject.value.filter(c => c.height <= 37.25);
    }
    return this.cabinetsByRows.get(rows) || [];
  }

  /**
   * Get all cabinets
   */
  getAllCabinets(): Cabinet[] {
    return this.cabinetsSubject.value;
  }

  /**
   * Get cabinet by model
   */
  getCabinetByModel(model: string): Cabinet | undefined {
    return this.cabinetsSubject.value.find(c => c.model === model);
  }

  /**
   * Get available row values
   */
  getAvailableRows(): number[] {
    const rows = new Set(this.cabinetsSubject.value.map(c => c.rows));
    return Array.from(rows).sort((a, b) => a - b);
  }
}
