import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppConfig, DoorIdType, InstallType } from '../models/configurator.models';

export interface SharedUser {
  email: string;
  role: 'viewer' | 'commentator' | 'editor';
  avatar?: string; // User initials
}

export interface Project {
  id: string;
  name: string;
  productType: ProductType;
  createdAt: string;
  updatedAt: string;
  owner?: string; // Email of the project owner
  sharedUsers?: SharedUser[]; // Users with access to the project
  // Step 1 Data
  projectName?: string;
  projectEmail?: string;
  projectType?: 'New Construction' | 'Replacement';
  deliveryMode?: 'usps' | 'all';
  adaMode?: 'all' | 'ada';
  projectAddress?: string;
  projectCity?: string;
  projectState?: string;
  dealerName?: string;
  architectName?: string;
  drawnBy?: string;
  poNumber?: string;
  quoteNumber?: string;
  // Step 2 Data
  installType?: InstallType;
  depotColor?: string;
  suiteColorValue?: string;
  suiteIdType?: string;
  suiteLockType?: string;
  suiteRearCover?: string;
  suiteMaster?: string;
  numberingInstructions?: string;
  // Full AppConfig (all configurator settings)
  kitColorValue?: string;        // "0xdbe0eb_Silver Speck" - cabinet color!
  kitColorName?: string;         // "Silver Speck"
  appMode?: 'standard' | 'advanced';
  doorIdType?: DoorIdType;
  doorIdFont?: string;
  lockType?: string;
  // Numbering state
  tenantNumStart?: number;
  parcelNumStart?: number;
  configurationNumberArray?: Record<string, string>;
  // Configurator State
  levels?: any[];
  activeLevelId?: number;
  activeWallId?: number;
  // Module mode
  moduleMode?: 'frame' | 'substitute';
}

export type ProductType = '4C' | 'CBU' | 'Horizontal' | 'Vertical';

const PROJECTS_KEY = 'florence_projects';
const ACTIVE_PROJECT_KEY = 'florence_active_project';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private projects: Project[] = [];
  private activeProjectId: string | null = null;
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private activeProjectSubject = new BehaviorSubject<Project | null>(null);

  projects$ = this.projectsSubject.asObservable();
  activeProject$ = this.activeProjectSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const projectsData = localStorage.getItem(PROJECTS_KEY);
      if (projectsData) {
        this.projects = JSON.parse(projectsData);
        this.projectsSubject.next([...this.projects]);
      }

      const activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (activeProjectId) {
        this.activeProjectId = activeProjectId;
        const activeProject = this.projects.find(p => p.id === activeProjectId);
        if (activeProject) {
          this.activeProjectSubject.next(activeProject);
        }
      }
    } catch (e) {
      console.error('Error loading projects from storage:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(this.projects));
      this.projectsSubject.next([...this.projects]);
    } catch (e) {
      console.error('Error saving projects to storage:', e);
    }
  }

  private saveActiveProject() {
    if (this.activeProjectId) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, this.activeProjectId);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  }

  getAllProjects(): Project[] {
    return [...this.projects];
  }

  getProject(id: string): Project | undefined {
    return this.projects.find(p => p.id === id);
  }

  getActiveProject(): Project | null {
    return this.activeProjectSubject.value;
  }

  createProject(name: string, productType: ProductType, owner?: string): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name: name || 'Unnamed Project',
      productType,
      owner,
      createdAt: now,
      updatedAt: now
    };

    this.projects.unshift(project);
    this.saveToStorage();

    return project;
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) return null;

    const updated = {
      ...this.projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.projects[index] = updated;
    this.saveToStorage();

    // Update active project if it's the same
    if (this.activeProjectId === id) {
      this.activeProjectSubject.next(updated);
    }

    return updated;
  }

  deleteProject(id: string): boolean {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.projects.splice(index, 1);
    this.saveToStorage();

    // Clear active project if it was deleted
    if (this.activeProjectId === id) {
      this.activeProjectId = null;
      this.activeProjectSubject.next(null);
      this.saveActiveProject();
    }

    return true;
  }

  setActiveProject(id: string | null): void {
    this.activeProjectId = id;
    this.saveActiveProject();

    if (id) {
      const project = this.projects.find(p => p.id === id);
      this.activeProjectSubject.next(project || null);
    } else {
      this.activeProjectSubject.next(null);
    }
  }

  duplicateProject(id: string): Project | null {
    const original = this.projects.find(p => p.id === id);
    if (!original) return null;

    const duplicate: Project = {
      ...JSON.parse(JSON.stringify(original)),
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.projects.unshift(duplicate);
    this.saveToStorage();

    return duplicate;
  }
}
