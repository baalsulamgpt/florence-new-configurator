import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService, Project, ProductType } from '../../../../core/services/project.service';

interface ProductTypeInfo {
  type: ProductType;
  name: string;
  description: string;
  image: string;
}

@Component({
  selector: 'app-new-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-project-modal.component.html',
  styleUrls: ['./new-project-modal.component.scss']
})
export class NewProjectModalComponent {
  @Input() isOpen = false;
  @Input() currentUserEmail = '';
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<Project>();

  projectName = '';
  projectEmail = '';
  selectedProductType: ProductType | null = null;

  productTypes: ProductTypeInfo[] = [
    {
      type: '4C',
      name: 'STD-4C',
      description: 'Standard 4C Mailboxes for USPS delivery',
      image: 'assets/images-product/4Cfront.jpg'
    },
    {
      type: 'CBU',
      name: 'Cluster Box Units',
      description: 'Compact cluster mailbox units',
      image: 'assets/images-product/vogue_new.jpg'
    },
    {
      type: 'Horizontal',
      name: 'Horizontal Mailboxes',
      description: 'Horizontal style mailboxes',
      image: 'assets/images-product/1400.jpg'
    },
    {
      type: 'Vertical',
      name: 'Vertical Mailboxes',
      description: 'Vertical style replacement mailboxes',
      image: 'assets/images-product/1250.jpg'
    }
  ];

  constructor(private projectService: ProjectService) {}

  selectProductType(type: ProductType) {
    this.selectedProductType = type;
  }

  isProductTypeSelected(type: ProductType): boolean {
    return this.selectedProductType === type;
  }

  onCancel() {
    this.close.emit();
    this.resetForm();
  }

  onCreate() {
    if (!this.selectedProductType) {
      // Shake animation or show error
      return;
    }

    // Owner is set to projectEmail (will be updated in project settings)
    const project = this.projectService.createProject(
      this.projectName.trim() || 'Unnamed Project',
      this.selectedProductType,
      this.projectEmail || this.currentUserEmail || undefined
    );

    this.create.emit(project);
    this.resetForm();
  }

  private resetForm() {
    this.projectName = '';
    this.projectEmail = '';
    this.selectedProductType = null;
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}
