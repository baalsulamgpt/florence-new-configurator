/**
 * KONVA CONFIGURATOR STATE SERVICE
 * Isolated state management for Konva 4C Mailbox Configurator
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import {
  ConfiguratorState,
  Level,
  Wall,
  Frame,
  Door,
  AppConfig,
  ConfiguratorCounters,
  WallsKeeper,
  NumberingState
} from '../../../core/models/configurator.models';

// ====================================================================
// DEFAULT CONFIGURATION
// ====================================================================

const DEFAULT_CONFIG: AppConfig = {
  install_type: 'recessed',
  kit_color_value: '0xdbe0eb_tbd',
  kit_color_name: 'TBD',
  ada_mode: 'all',
  delivery_mode: 'usps',
  app_mode: 'standard',
  door_id_type: 'tbd',
  lock_type: 'Standard'
};

const INITIAL_STATE: ConfiguratorState = {
  config: DEFAULT_CONFIG,
  levels: [
    {
      level_id: 0,
      level_name: 'Level 1',
      walls: [{ wall_id: 0, wall_name: 'Wall 1', frames: [] }],
      expanded: true
    }
  ],
  active_level_id: 0,
  active_wall_id: 0,
  configuration_number_array: {},
  offsets_z: [],
  height_lock_config: false,
  height_lock_wall: false,
  module_mode: 'frame',
  job_name: '',
  project_cookie_id: '',
};

// ====================================================================
// SERVICE
// ====================================================================

@Injectable({
  providedIn: 'root'
})
export class KonvaStateService implements WallsKeeper {
  private _state$ = new BehaviorSubject<ConfiguratorState>(
    this.loadFromStorage() || { ...INITIAL_STATE }
  );

  // ====================================================================
  // OBSERVABLE STREAMS
  // ====================================================================

  readonly state$ = this._state$.asObservable();
  readonly levels$ = this.state$.pipe(map(s => s.levels));
  readonly stateForProject$ = this.state$.pipe(
    map(s => ({
      levels: s.levels || [],
      activeLevelId: s.active_level_id,
      activeWallId: s.active_wall_id,
      // Config fields
      installType: s.config.install_type,
      kitColorValue: s.config.kit_color_value,
      kitColorName: s.config.kit_color_name,
      adaMode: s.config.ada_mode,
      deliveryMode: s.config.delivery_mode,
      appMode: s.config.app_mode,
      doorIdType: s.config.door_id_type,
      lockType: s.config.lock_type,
      depotColor: s.config.depot_color,
      doorIdFont: s.config.door_id_font,
      // Numbering fields
      tenantNumStart: s.tenant_num_start,
      parcelNumStart: s.parcel_num_start,
      configurationNumberArray: s.configuration_number_array,
      // Module mode
      moduleMode: s.module_mode || 'frame'
    } as Partial<Record<string, any>>))
  );
  readonly activeLevelId$ = this.state$.pipe(map(s => s.active_level_id));
  readonly activeWallId$ = this.state$.pipe(map(s => s.active_wall_id));
  readonly activeLevel$ = this.state$.pipe(
    map(s => s.levels.find(l => l.level_id === s.active_level_id) || undefined)
  );
  readonly activeWall$ = this.state$.pipe(
    map(s => {
      const activeLevel = s.levels.find(l => l.level_id === s.active_level_id);
      return activeLevel?.walls.find(w => w.wall_id === s.active_wall_id) || undefined;
    })
  );
  readonly config$ = this.state$.pipe(map(s => s.config));
  readonly moduleMode$ = this.state$.pipe(map(s => s.module_mode));
  readonly counters$ = this.state$.pipe(map(s => this.calculateCounters(s)));

  // ====================================================================
  // STATE ACCESS
  // ====================================================================

  getState(): ConfiguratorState {
    return this._state$.value;
  }

  getStateSnapshot(): ConfiguratorState {
    return this.getState();
  }

  loadState(levels: Level[]): void {
    const currentState = this.getState();
    this.setState({
      ...currentState,
      levels: levels || currentState.levels
    });
  }

  // ====================================================================
  // CONFIGURATION METHODS
  // ====================================================================

  updateConfig(config: Partial<AppConfig>): void {
    const state = this.getState();
    this.setState({
      ...state,
      config: { ...state.config, ...config }
    });
  }

  // ====================================================================
  // LEVEL METHODS (WallsKeeper interface)
  // ====================================================================

  get levels(): Level[] {
    return this.getState().levels || [];
  }

  get activeLevelId(): number {
    return this.getState().active_level_id;
  }

  get activeWallId(): number {
    return this.getState().active_wall_id;
  }

  getLevel(levelId: number): Level | null {
    return this.levels.find(l => l.level_id === levelId) || null;
  }

  getActiveLevel(): Level | null {
    return this.getLevel(this.activeLevelId);
  }

  addLevel(): Level {
    const state = this.getState();
    const levels = state.levels || [];
    const newLevelId = levels.length > 0 ? Math.max(...levels.map(l => l.level_id)) + 1 : 0;

    // Find max wall_id across all levels (for uniqueness)
    const allWallIds = levels.flatMap(l => l.walls.map(w => w.wall_id));
    const newWallId = allWallIds.length > 0 ? Math.max(...allWallIds) + 1 : 0;

    // Create first wall for the level
    const newWall: Wall = {
      wall_id: newWallId,
      wall_name: '', // Empty name - will be displayed as "Wall 1" in UI
      frames: []
    };

    const newLevel: Level = {
      level_id: newLevelId,
      level_name: `Level ${newLevelId + 1}`,
      walls: [newWall],
      expanded: true
    };

    this.setState({
      ...state,
      levels: [...levels, newLevel]
    });

    return newLevel;
  }

  removeLevel(levelId: number): boolean {
    const state = this.getState();
    const levels = state.levels || [];

    // Cannot remove level 0
    if (levelId === 0) {
      return false;
    }

    // Must have at least 1 level
    if (levels.length <= 1) {
      return false;
    }

    const newLevels = levels.filter(l => l.level_id !== levelId);

    // If we removed the active level, switch to another
    let newActiveLevelId = state.active_level_id;
    if (newActiveLevelId === levelId) {
      newActiveLevelId = newLevels[0].level_id;
    }

    // Also reset active wall if needed
    const newActiveLevel = newLevels.find(l => l.level_id === newActiveLevelId);
    const newActiveWallId = newActiveLevel?.walls[0]?.wall_id || 0;

    this.setState({
      ...state,
      levels: newLevels,
      active_level_id: newActiveLevelId,
      active_wall_id: newActiveWallId
    });

    return true;
  }

  setActiveLevel(levelId: number): void {
    const state = this.getState();
    const level = this.getLevel(levelId);
    if (!level) {
      throw new Error(`Level ${levelId} not found`);
    }

    // Set active wall to first wall in this level
    const firstWall = level.walls[0];
    const newActiveWallId = firstWall?.wall_id || 0;

    this.setState({
      ...state,
      active_level_id: levelId,
      active_wall_id: newActiveWallId
    });
  }

  renameLevel(levelId: number, newName: string): void {
    const state = this.getState();
    const levels = (state.levels || []).map(l =>
      l.level_id === levelId ? { ...l, level_name: newName } : l
    );
    this.setState({ ...state, levels });
  }

  toggleLevelExpanded(levelId: number): void {
    const state = this.getState();
    const levels = (state.levels || []).map(l =>
      l.level_id === levelId ? { ...l, expanded: !l.expanded } : l
    );
    this.setState({ ...state, levels });
  }

  // ====================================================================
  // WALL METHODS (WallsKeeper interface)
  // ====================================================================

  getWall(levelId: number, wallId: number): Wall | null {
    const level = this.getLevel(levelId);
    return level?.walls.find(w => w.wall_id === wallId) || null;
  }

  getActiveWall(): Wall | null {
    const activeLevel = this.getActiveLevel();
    if (!activeLevel) return null;
    return activeLevel.walls.find(w => w.wall_id === this.activeWallId) || null;
  }

  addWall(levelId: number): Wall {
    const state = this.getState();
    const levels = state.levels || [];
    const level = levels.find(l => l.level_id === levelId);
    if (!level) {
      throw new Error(`Level ${levelId} not found`);
    }

    // Find max wall_id across all levels (for uniqueness)
    const allWallIds = levels.flatMap(l => l.walls.map(w => w.wall_id));
    const newWallId = allWallIds.length > 0 ? Math.max(...allWallIds) + 1 : 0;

    const newWall: Wall = {
      wall_id: newWallId,
      wall_name: '', // Empty name - will be displayed as "Wall {index + 1}" in UI
      frames: []
    };

    const updatedLevels = levels.map(l => {
      if (l.level_id === levelId) {
        return { ...l, walls: [...l.walls, newWall] };
      }
      return l;
    });

    this.setState({ ...state, levels: updatedLevels });
    return newWall;
  }

  removeWall(levelId: number, wallId: number): boolean {
    const state = this.getState();
    const levels = state.levels || [];
    const level = levels.find(l => l.level_id === levelId);
    if (!level) {
      return false;
    }

    // Level must have at least 1 wall
    if (level.walls.length <= 1) {
      return false;
    }

    const updatedLevels = levels.map(l => {
      if (l.level_id === levelId) {
        const newWalls = l.walls.filter(w => w.wall_id !== wallId);

        // If we removed the active wall, switch to another
        let newActiveWallId = state.active_wall_id;
        if (newActiveWallId === wallId) {
          newActiveWallId = newWalls[0].wall_id;
        }

        return { ...l, walls: newWalls };
      }
      return l;
    });

    // Update active wall if needed
    const updatedLevel = updatedLevels.find(l => l.level_id === levelId);
    const newActiveWallId = updatedLevel?.walls.find(w => w.wall_id === state.active_wall_id)
      ? state.active_wall_id
      : updatedLevel?.walls[0]?.wall_id || 0;

    this.setState({ ...state, levels: updatedLevels, active_wall_id: newActiveWallId });
    return true;
  }

  setActiveWall(wallId: number): void {
    const state = this.getState();
    const levels = state.levels || [];

    // Find the wall and its level
    let foundLevel: Level | null = null;
    let foundWall: Wall | null = null;

    for (const level of levels) {
      const wall = level.walls.find(w => w.wall_id === wallId);
      if (wall) {
        foundLevel = level;
        foundWall = wall;
        break;
      }
    }

    if (!foundLevel || !foundWall) {
      throw new Error(`Wall ${wallId} not found`);
    }

    this.setState({
      ...state,
      active_level_id: foundLevel.level_id,
      active_wall_id: wallId
    });
  }

  renameWall(levelId: number, wallId: number, newName: string): void {
    const state = this.getState();
    const levels = (state.levels || []).map(l => {
      if (l.level_id === levelId) {
        return {
          ...l,
          walls: l.walls.map(w =>
            w.wall_id === wallId ? { ...w, wall_name: newName } : w
          )
        };
      }
      return l;
    });
    this.setState({ ...state, levels });
  }

  // ====================================================================
  // FRAME METHODS
  // ====================================================================

  addFrame(wallId: number, frame: Omit<Frame, 'id'>): Frame {
    const state = this.getState();
    const newFrame: Frame = {
      ...frame,
      id: this.generateId()
    };

    const levels = state.levels.map(l => ({
      ...l,
      walls: l.walls.map(w => {
        if (w.wall_id === wallId) {
          return { ...w, frames: [...w.frames, newFrame] };
        }
        return w;
      })
    }));

    this.setState({ ...state, levels });
    return newFrame;
  }

  removeFrame(wallId: number, frameId: string): void {
    const state = this.getState();
    const levels = state.levels.map(l => ({
      ...l,
      walls: l.walls.map(w => {
        if (w.wall_id === wallId) {
          return { ...w, frames: w.frames.filter(f => f.id !== frameId) };
        }
        return w;
      })
    }));

    this.setState({ ...state, levels });
  }

  updateFrame(wallId: number, frameId: string, updates: Partial<Frame>): void {
    const state = this.getState();
    const levels = state.levels.map(l => ({
      ...l,
      walls: l.walls.map(w => {
        if (w.wall_id === wallId) {
          return {
            ...w,
            frames: w.frames.map(f =>
              f.id === frameId ? { ...f, ...updates } : f
            )
          };
        }
        return w;
      })
    }));

    this.setState({ ...state, levels });
  }

  updateWallFrames(wallId: number, frames: Frame[]): void {
    const state = this.getState();
    const levels = state.levels.map(l => ({
      ...l,
      walls: l.walls.map(w => {
        if (w.wall_id === wallId) {
          return { ...w, frames };
        }
        return w;
      })
    }));

    this.setState({ ...state, levels });
  }

  // ====================================================================
  // DOOR METHODS
  // ====================================================================

  substituteDoor(
    wallId: number,
    frameId: string,
    doorPosition: number,
    newDoorType: string
  ): void {
    const state = this.getState();
    const levels = state.levels.map(l => ({
      ...l,
      walls: l.walls.map(w => {
        if (w.wall_id === wallId) {
          return {
            ...w,
            frames: w.frames.map(f => {
              if (f.id === frameId) {
                return {
                  ...f,
                  doors: f.doors.map(d =>
                    d.position === doorPosition
                      ? { ...d, substitute: newDoorType }
                      : d
                  )
                };
              }
              return f;
            })
          };
        }
        return w;
      })
    }));

    this.setState({ ...state, levels });
  }

  // ====================================================================
  // NUMBERING METHODS
  // ====================================================================

  setTenantNumStart(value: number | undefined): void {
    this.setState({ ...this.getState(), tenant_num_start: value });
  }

  setParcelNumStart(value: number | undefined): void {
    this.setState({ ...this.getState(), parcel_num_start: value });
  }

  updateNumbering(doorKey: string, value: string): void {
    const state = this.getState();
    this.setState({
      ...state,
      configuration_number_array: {
        ...state.configuration_number_array,
        [doorKey]: value
      }
    });
  }

  clearNumbering(): void {
    const state = this.getState();
    this.setState({
      ...state,
      tenant_num_start: undefined,
      parcel_num_start: undefined,
      configuration_number_array: {}
    });
  }

  // ====================================================================
  // UI STATE METHODS
  // ====================================================================

  setModuleMode(mode: 'frame' | 'substitute'): void {
    this.setState({ ...this.getState(), module_mode: mode });
  }

  toggleHeightLockConfig(): void {
    const state = this.getState();
    this.setState({
      ...state,
      height_lock_config: !state.height_lock_config
    });
  }

  toggleHeightLockWall(): void {
    const state = this.getState();
    this.setState({
      ...state,
      height_lock_wall: !state.height_lock_wall
    });
  }

  // ====================================================================
  // PERSISTENCE
  // ====================================================================

  saveToStorage(): void {
    const state = this.getState();
    try {
      localStorage.setItem('c4-konva-configurator-state', JSON.stringify(state));
      localStorage.setItem('c4-konva-configurator-timestamp', new Date().toISOString());
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  loadFromStorage(): ConfiguratorState | null {
    try {
      const saved = localStorage.getItem('c4-konva-configurator-state');
      if (saved) {
        const state = JSON.parse(saved);
        // Migrate old format (walls) to new format (levels)
        if (state.walls && !state.levels) {
          state.levels = [
            {
              level_id: 0,
              level_name: 'Level 1',
              walls: state.walls,
              expanded: true
            }
          ];
          state.active_level_id = 0;
          delete state.walls;
        }
        // Ensure levels exists
        if (!state.levels || !Array.isArray(state.levels)) {
          return null;
        }
        return state;
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
    return null;
  }

  clearStorage(): void {
    localStorage.removeItem('c4-konva-configurator-state');
    localStorage.removeItem('c4-konva-configurator-timestamp');
  }

  reset(): void {
    this.clearStorage();
    this.setState({ ...INITIAL_STATE });
  }

  // ====================================================================
  // PROJECT-SPECIFIC STATE METHODS
  // ====================================================================

  /**
   * Reset state for a new project - clears all data and starts fresh
   */
  resetForNewProject(): void {
    this.clearStorage();
    this.setState({ ...INITIAL_STATE });
  }

  /**
   * Load state from a project (restores saved levels and state)
   */
  loadStateFromProject(projectState: {
    levels?: any[];
    activeLevelId?: number;
    activeWallId?: number;
    // Config fields
    installType?: string;
    kitColorValue?: string;
    kitColorName?: string;
    depotColor?: string;
    adaMode?: string;
    deliveryMode?: string;
    appMode?: string;
    doorIdType?: string;
    doorIdFont?: string;
    lockType?: string;
    // Numbering fields
    tenantNumStart?: number;
    parcelNumStart?: number;
    configurationNumberArray?: Record<string, string>;
    // Module mode
    moduleMode?: 'frame' | 'substitute';
  }): void {
    const state = this.getState();

    // Build new state from project data or fall back to defaults
    const loadedLevels = projectState.levels && projectState.levels.length > 0
      ? projectState.levels
      : INITIAL_STATE.levels;

    // Build config from project data or keep current
    const config = { ...state.config };
    if (projectState.installType) config.install_type = projectState.installType as any;
    if (projectState.kitColorValue) config.kit_color_value = projectState.kitColorValue;
    if (projectState.kitColorName) config.kit_color_name = projectState.kitColorName;
    if (projectState.depotColor) config.depot_color = projectState.depotColor;
    if (projectState.adaMode) config.ada_mode = projectState.adaMode as any;
    if (projectState.deliveryMode) config.delivery_mode = projectState.deliveryMode as any;
    if (projectState.appMode) config.app_mode = projectState.appMode as any;
    if (projectState.doorIdType) config.door_id_type = projectState.doorIdType as any;
    if (projectState.doorIdFont) config.door_id_font = projectState.doorIdFont;
    if (projectState.lockType) config.lock_type = projectState.lockType as any;

    const newState: ConfiguratorState = {
      ...state,
      config,
      levels: loadedLevels,
      active_level_id: projectState.activeLevelId ?? INITIAL_STATE.active_level_id,
      active_wall_id: projectState.activeWallId ?? INITIAL_STATE.active_wall_id,
      tenant_num_start: projectState.tenantNumStart,
      parcel_num_start: projectState.parcelNumStart,
      configuration_number_array: projectState.configurationNumberArray || {},
      module_mode: projectState.moduleMode || 'frame'
    };

    this._state$.next(newState);
    this.saveToStorage();
  }

  /**
   * Export current state for saving to project (returns full project update object)
   */
  exportStateForProject(): Partial<Record<string, any>> {
    const state = this.getState();
    return {
      levels: state.levels || [],
      activeLevelId: state.active_level_id,
      activeWallId: state.active_wall_id,
      // Config fields
      installType: state.config.install_type,
      kitColorValue: state.config.kit_color_value,
      kitColorName: state.config.kit_color_name,
      adaMode: state.config.ada_mode,
      deliveryMode: state.config.delivery_mode,
      appMode: state.config.app_mode,
      doorIdType: state.config.door_id_type,
      lockType: state.config.lock_type,
      depotColor: state.config.depot_color,
      doorIdFont: state.config.door_id_font,
      // Numbering fields
      tenantNumStart: state.tenant_num_start,
      parcelNumStart: state.parcel_num_start,
      configurationNumberArray: state.configuration_number_array,
      // Module mode
      moduleMode: state.module_mode || 'frame'
    };
  }

  // ====================================================================
  // PROJECT METHODS
  // ====================================================================

  initJobName(): void {
    const state = this.getState();
    const ip = this.getIP();
    const timestamp = this.formatTimestamp(new Date());
    const jobName = `${ip}${timestamp}`;

    this.setState({
      ...state,
      job_name: jobName
    });
  }

  initProjectCookieId(): void {
    const state = this.getState();
    const ip = this.getIP();
    const timestamp = this.formatTimestamp(new Date());
    const cookieId = `${timestamp}${ip}`;

    this.setState({
      ...state,
      project_cookie_id: cookieId
    });
  }

  // ====================================================================
  // COUNTERS
  // ====================================================================

  private calculateCounters(state: ConfiguratorState): ConfiguratorCounters {
    let tenant_doors = 0;
    let parcel_doors = 0;
    let total_width = 0;
    let max_height = 0;

    const levels = state.levels || [];
    levels.forEach(level => {
      const walls = level.walls || [];
      walls.forEach(wall => {
        const frames = wall.frames || [];
        frames.forEach(frame => {
          total_width += frame.width;
          max_height = Math.max(max_height, frame.bottom + frame.height);

          const doors = frame.doors || [];
          doors.forEach(door => {
            if (this.isParcelDoor(door.door_type) || this.isParcelDoor(door.substitute || '')) {
              parcel_doors++;
            } else {
              tenant_doors++;
            }
          });
        });
      });
    });

    const total_height_ft = Math.floor(max_height / 12);
    const total_height_in = Math.round(max_height % 12);

    return {
      tenant_doors,
      parcel_doors,
      total_width: Math.round(total_width * 10) / 10,
      total_height_ft,
      total_height_in
    };
  }

  // ====================================================================
  // PRIVATE HELPERS
  // ====================================================================

  private setState(newState: Partial<ConfiguratorState>): void {
    const currentState = this.getState();
    const updated = {
      ...currentState,
      ...newState,
      updated_at: new Date().toISOString()
    };
    this._state$.next(updated);
    this.saveToStorage();
  }

  private generateId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatTimestamp(date: Date): string {
    const y = date.getFullYear().toString().substr(2);
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${y}${m}${d}${h}${min}${s}`;
  }

  private getIP(): string {
    // Generate fake IP based on timestamp for job name
    return Date.now().toString().substr(-8);
  }

  private isParcelDoor(doorType: string): boolean {
    if (!doorType) return false;
    return ['p2', 'p3', 'p4', 'p5', 'p6', 'sp', 'lp'].includes(doorType);
  }
}