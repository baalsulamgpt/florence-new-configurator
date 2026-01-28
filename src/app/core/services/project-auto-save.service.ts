/**
 * PROJECT AUTO-SAVE SERVICE
 * Automatically saves configurator state changes to the active project
 */

import { Injectable } from '@angular/core';
import { debounceTime, filter } from 'rxjs/operators';
import { ProjectService } from './project.service';
import { KonvaStateService } from '../../features/configurator/services/konva-state.service';

@Injectable({
  providedIn: 'root'
})
export class ProjectAutoSaveService {
  private isEnabled = true;

  constructor(
    private projectService: ProjectService,
    konvaStateService: KonvaStateService
  ) {
    // Subscribe to configurator state changes and auto-save with debounce
    konvaStateService.stateForProject$.pipe(
      debounceTime(1000), // Wait 1 second after last change before saving
      filter(() => this.isEnabled)
    ).subscribe(state => {
      this.saveToActiveProject(state);
    });
  }

  /**
   * Enable auto-save
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable auto-save (useful during bulk operations)
   */
  disable(): void {
    this.isEnabled = false;
  }

  /**
   * Save state to the active project
   */
  private saveToActiveProject(state: Partial<Record<string, any>>): void {
    const activeProject = this.projectService.getActiveProject();
    if (!activeProject) return;

    this.projectService.updateProject(activeProject.id, state as any);
  }
}
