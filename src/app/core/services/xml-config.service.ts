import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap, shareReplay } from 'rxjs/operators';
import { FrameDefinition } from '../../features/configurator/models/door-type.model';

@Injectable({
  providedIn: 'root'
})
export class XmlConfigService {
  private configCache: Map<string, FrameDefinition[]> = new Map();

  constructor(private http: HttpClient) {}

  loadConfig(configType: 'standard' | 'depot' = 'standard'): Observable<FrameDefinition[]> {
    const filename = configType === 'depot' ? 'config_depot.xml' : 'config.xml';
    
    if (this.configCache.has(filename)) {
      return of(this.configCache.get(filename)!);
    }

    // In a real app, ensure this path is correct relative to the deployed assets
    // The spec says assets/config/config.xml
    return this.http.get(`/assets/config/${filename}`, { responseType: 'text' }).pipe(
      map(xml => this.parseXml(xml)),
      tap(data => this.configCache.set(filename, data)),
      shareReplay(1),
      catchError(err => {
        console.error('Failed to load XML config', err);
        return of([]);
      })
    );
  }

  private parseXml(xmlString: string): FrameDefinition[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const boxes = xmlDoc.getElementsByTagName('box');
    const frames: FrameDefinition[] = [];

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      frames.push({
        model: box.getAttribute('model') || '',
        width: parseFloat(box.getAttribute('width') || '0'),
        height: parseFloat(box.getAttribute('height') || '0'),
        weight: parseFloat(box.getAttribute('weight') || '0'),
        tenants: parseInt(box.getAttribute('tenants') || '0', 10),
        parcels: parseInt(box.getAttribute('parcels') || '0', 10),
        leftColumn: (box.getAttribute('l') || '').trim().split(/\s+/).filter(s => s),
        rightColumn: (box.getAttribute('r') || '').trim().split(/\s+/).filter(s => s),
        isConfigurable: box.getAttribute('configurable') === '1',
        mode: (box.getAttribute('mode') as 'standard' | 'advanced') || 'standard',
        ih: parseFloat(box.getAttribute('ih') || '0'),
        iw: parseFloat(box.getAttribute('iw') || '0')
      });
    }

    return frames;
  }
}
