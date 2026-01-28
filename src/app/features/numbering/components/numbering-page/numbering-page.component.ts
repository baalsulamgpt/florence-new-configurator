import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguratorStateService } from '../../../../core/services/configurator-state.service';
import { Wall, Level } from '../../../../core/models/configurator.models';

import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-numbering-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="numbering-shell">
      <h2>Numbering Configuration</h2>

      <div class="controls">
        <label>Tenant Start: <input type="number" [(ngModel)]="tenantStart" (change)="updateNumbering()"></label>
        <label>Parcel Start: <input type="number" [(ngModel)]="parcelStart" (change)="updateNumbering()"></label>
      </div>

      <div class="walls-preview">
        <div *ngFor="let wall of walls$ | async" class="wall-section">
          <h3>{{ wall.wall_name }}</h3>
          <div class="frames-row">
            <div *ngFor="let frame of wall.frames" class="frame-unit">
               <div *ngFor="let door of frame.doors" class="door-input">
                 <span class="door-type">{{ door.door_type }}</span>
                 <input
                    [value]="getNumber(wall.wall_id, frame.id, door.position)"
                    (input)="setNumber(wall.wall_id, frame.id, door.position, $event)"
                 >
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .numbering-shell { padding: 20px; }
    .frames-row { display: flex; gap: 10px; }
    .frame-unit { border: 1px solid #ccc; padding: 5px; }
    .door-input { display: flex; align-items: center; gap: 5px; margin: 2px 0; }
    .door-type { font-size: 0.8em; color: #666; width: 30px; }
  `]
})
export class NumberingPageComponent implements OnInit {
  walls$: Observable<Wall[]>;
  tenantStart = 1;
  parcelStart = 1;

  constructor(private stateService: ConfiguratorStateService) {
    // Flatten all walls from all levels
    this.walls$ = this.stateService.levels$.pipe(
      map((levels: Level[]) => levels.flatMap(level => level.walls))
    );
  }

  ngOnInit() {}

  updateNumbering() {
    // Logic to auto-fill sequential numbers based on traversal order
    // This would update the configuration_number_array in the state
  }

  getNumber(wallId: number, frameId: string, pos: number): string {
    const key = `w${wallId}_f${frameId}_d${pos}`;
    return this.stateService.getState().configuration_number_array[key] || '';
  }

  setNumber(wallId: number, frameId: string, pos: number, event: any) {
    const key = `w${wallId}_f${frameId}_d${pos}`;
    const val = event.target.value;
    this.stateService.updateNumbering(key, val);
  }
}
