import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProjectService, Project, ProductType, SharedUser } from '../../../../core/services/project.service';
import { KonvaStateService } from '../../../configurator/services/konva-state.service';
import { NewProjectModalComponent } from '../new-project-modal/new-project-modal.component';
import { ShareModalComponent } from '../share-modal/share-modal.component';

interface ProductTypeInfo {
  type: ProductType;
  name: string;
  image: string;
}

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, NewProjectModalComponent, ShareModalComponent],
  templateUrl: './projects-page.component.html',
  styleUrls: ['./projects-page.component.scss']
})
export class ProjectsPageComponent implements OnInit {
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  searchQuery = '';
  isNewProjectModalOpen = false;
  isShareModalOpen = false;
  currentShareProject: Project | null = null;

  // View mode: 'grid' or 'table'
  viewMode: 'grid' | 'table' = 'grid';
  private readonly VIEW_MODE_KEY = 'projects_view_mode';

  // User menu
  isUserMenuOpen = false;
  currentUserEmail = 'user@example.com'; // TODO: Get from Drupal/session

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const userMenu = document.querySelector('.user-menu-container');
    if (userMenu && !userMenu.contains(target)) {
      this.isUserMenuOpen = false;
    }
  }

  productTypes: ProductTypeInfo[] = [
    { type: '4C', name: 'STD-4C', image: 'assets/images-product/4Cfront.jpg' },
    { type: 'CBU', name: 'Cluster Box Units', image: 'assets/images-product/vogue_new.jpg' },
    { type: 'Horizontal', name: 'Horizontal Mailboxes', image: 'assets/images-product/1400.jpg' },
    { type: 'Vertical', name: 'Vertical Mailboxes', image: 'assets/images-product/1250.jpg' }
  ];

  constructor(
    private projectService: ProjectService,
    private konvaStateService: KonvaStateService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadViewMode();
    this.loadProjects();
  }

  private loadViewMode() {
    const saved = localStorage.getItem(this.VIEW_MODE_KEY);
    if (saved === 'grid' || saved === 'table') {
      this.viewMode = saved;
    }
  }

  private saveViewMode() {
    localStorage.setItem(this.VIEW_MODE_KEY, this.viewMode);
  }

  setViewMode(mode: 'grid' | 'table') {
    this.viewMode = mode;
    this.saveViewMode();
  }

  loadProjects() {
    this.projects = this.projectService.getAllProjects();
    this.applyFilter();
  }

  applyFilter() {
    if (!this.searchQuery.trim()) {
      this.filteredProjects = [...this.projects];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredProjects = this.projects.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.productType.toLowerCase().includes(query)
      );
    }
  }

  onSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.applyFilter();
  }

  openNewProjectModal() {
    this.isNewProjectModalOpen = true;
  }

  closeNewProjectModal() {
    this.isNewProjectModalOpen = false;
  }

  onProjectCreated(project: Project) {
    this.closeNewProjectModal();
    this.loadProjects();

    // Reset configurator state for new project (start fresh)
    this.konvaStateService.resetForNewProject();

    // Set as active and navigate to konva
    this.projectService.setActiveProject(project.id);
    this.router.navigate(['/konva']);
  }

  openProject(project: Project) {
    // Load project's configurator state (including all config fields)
    this.konvaStateService.loadStateFromProject({
      levels: project.levels,
      activeLevelId: project.activeLevelId,
      activeWallId: project.activeWallId,
      // Config fields
      installType: project.installType,
      kitColorValue: project.kitColorValue,
      kitColorName: project.kitColorName,
      adaMode: project.adaMode,
      deliveryMode: project.deliveryMode,
      appMode: project.appMode,
      doorIdType: project.doorIdType,
      lockType: project.lockType,
      depotColor: project.depotColor,
      doorIdFont: project.doorIdFont,
      // Numbering fields
      tenantNumStart: project.tenantNumStart,
      parcelNumStart: project.parcelNumStart,
      configurationNumberArray: project.configurationNumberArray,
      // Module mode
      moduleMode: project.moduleMode
    });

    this.projectService.setActiveProject(project.id);
    this.router.navigate(['/konva']);
  }

  duplicateProject(project: Project) {
    const duplicate = this.projectService.duplicateProject(project.id);
    if (duplicate) {
      this.loadProjects();
    }
  }

  deleteProject(project: Project, event: Event) {
    event.stopPropagation();

    if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
      this.projectService.deleteProject(project.id);
      this.loadProjects();
    }
  }

  getProductTypeLabel(type: ProductType): string {
    const info = this.productTypes.find(pt => pt.type === type);
    return info?.name || type;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  // User menu methods
  getUserInitials(): string {
    if (!this.currentUserEmail) return 'U';
    const email = this.currentUserEmail;
    const parts = email.split('@');
    const username = parts[0] || 'U';
    return username.substring(0, 2).toUpperCase();
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu() {
    this.isUserMenuOpen = false;
  }

  onLogout() {
    // TODO: Implement actual logout
    console.log('Logout clicked');
    this.closeUserMenu();
  }

  // Share methods
  openShareModal(project: Project, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.currentShareProject = project;
    this.isShareModalOpen = true;
  }

  closeShareModal() {
    this.isShareModalOpen = false;
    this.currentShareProject = null;
  }

  onShareSave(data: { sharedUsers: SharedUser[] }) {
    if (this.currentShareProject) {
      this.projectService.updateProject(this.currentShareProject.id, {
        sharedUsers: data.sharedUsers
      });
      this.loadProjects();
    }
  }

  getSharedUsersCount(project: Project): number {
    return project.sharedUsers?.length || 0;
  }
}
