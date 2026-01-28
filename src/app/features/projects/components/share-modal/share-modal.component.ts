import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, SharedUser } from '../../../../core/services/project.service';
import { CustomDropdownComponent } from '../../../../shared/components/custom-dropdown/custom-dropdown.component';

type ShareRole = 'viewer' | 'commentator' | 'editor';

interface RoleOption {
  value: ShareRole;
  label: string;
  description: string;
}

@Component({
  selector: 'app-share-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomDropdownComponent],
  templateUrl: './share-modal.component.html',
  styleUrls: ['./share-modal.component.scss']
})
export class ShareModalComponent {
  @Input() isOpen = false;
  @Input() project!: Project;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ sharedUsers: SharedUser[] }>();

  // Form data
  newShareEmail = '';
  selectedRole: ShareRole = 'viewer';

  // Mock shared users (will be replaced with project.sharedUsers)
  sharedUsers: SharedUser[] = [];

  roleOptions: RoleOption[] = [
    {
      value: 'viewer',
      label: 'Viewer',
      description: 'Can only view'
    },
    {
      value: 'commentator',
      label: 'Commentator',
      description: 'Can view and comment'
    },
    {
      value: 'editor',
      label: 'Editor',
      description: 'Can edit'
    }
  ];

  // Dropdown options for CustomDropdown
  get dropdownOptions() {
    return this.roleOptions.map(r => ({ value: r.value, label: r.label }));
  }

  ngOnChanges() {
    if (this.project) {
      // Use project's shared users or mock data
      this.sharedUsers = this.project.sharedUsers || this.getMockSharedUsers();
    }
  }

  private getMockSharedUsers(): SharedUser[] {
    return [
      { email: 'john.doe@example.com', role: 'editor', avatar: 'JD' },
      { email: 'sarah.smith@example.com', role: 'commentator', avatar: 'SS' },
      { email: 'mike.wilson@example.com', role: 'viewer', avatar: 'MW' }
    ];
  }

  getRoleLabel(role: ShareRole): string {
    return this.roleOptions.find(r => r.value === role)?.label || role;
  }

  getRoleDescription(role: ShareRole): string {
    return this.roleOptions.find(r => r.value === role)?.description || '';
  }

  getUserInitials(email: string): string {
    const parts = email.split('@');
    const username = parts[0] || 'U';
    return username.substring(0, 2).toUpperCase();
  }

  onAddShare() {
    const email = this.newShareEmail.trim();
    if (!email) return;

    // Check if user already exists
    const existingIndex = this.sharedUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingIndex >= 0) {
      // Update existing user's role
      this.sharedUsers[existingIndex].role = this.selectedRole;
    } else {
      // Add new user
      this.sharedUsers.push({
        email,
        role: this.selectedRole,
        avatar: this.getUserInitials(email)
      });
    }

    this.newShareEmail = '';
    this.selectedRole = 'viewer';
  }

  onRemoveShare(user: SharedUser) {
    const index = this.sharedUsers.findIndex(u => u.email === user.email);
    if (index >= 0) {
      this.sharedUsers.splice(index, 1);
    }
  }

  onRoleChange(user: SharedUser, newRole: ShareRole) {
    user.role = newRole;
  }

  onSave() {
    this.save.emit({ sharedUsers: [...this.sharedUsers] });
    this.close.emit();
  }

  onCancel() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  isOwner(email: string): boolean {
    return email === this.project.owner;
  }

  canRemoveUser(user: SharedUser): boolean {
    // Cannot remove the owner
    return !this.isOwner(user.email);
  }
}
