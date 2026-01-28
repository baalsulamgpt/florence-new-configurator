import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, ProjectService } from '../../../../core/services/project.service';
import { CustomDropdownComponent } from '../../../../shared/components/custom-dropdown/custom-dropdown.component';
import { InstallType } from '../../../../core/models/configurator.models';

@Component({
  selector: 'app-project-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CustomDropdownComponent],
  templateUrl: './project-settings-modal.component.html',
  styleUrls: ['./project-settings-modal.component.scss']
})
export class ProjectSettingsModalComponent {
  @Input() isOpen = false;
  @Input() project!: Project;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<Project>>();

  // Form data
  projectName = '';
  projectEmail = '';
  projectType: 'New Construction' | 'Replacement' = 'New Construction';
  deliveryMode: 'usps' | 'all' = 'all';
  adaMode: 'all' | 'ada' = 'all';
  projectAddress = '';
  projectCity = '';
  projectState = '';
  dealerName = '';
  architectName = '';
  drawnBy = '';
  poNumber = '';
  quoteNumber = '';

  // Installation data
  installType: InstallType = 'recessed';
  depotColor = 'TBD';
  suiteColorValue = '0xdbe0eb_tbd';
  suiteIdType = 'tbd';
  numberingInstructions = '';

  // Color options with color hex
  colorOptions = [
    { value: '0xdbe0eb_tbd', label: 'TBD', color: '#dbe0eb' },
    { value: '0xdbe0eb_Silver Speck', label: 'Silver Speck', color: '#c0c0c0' },
    { value: '0x7b6d61_Antique Bronze', label: 'Antique Bronze', color: '#7b6d61' },
    { value: '0x4c4c5d_Black', label: 'Black', color: '#4c4c5d' },
    { value: '0x75756f_Dark Bronze', label: 'Dark Bronze', color: '#75756f' },
    { value: '0xdec481_Gold Speck', label: 'Gold Speck', color: '#dec481' },
    { value: '0xdadbd0_Postal Grey', label: 'Postal Grey', color: '#dadbd0' },
    { value: '0xf5ecd4_Sandstone', label: 'Sandstone', color: '#f5ecd4' },
    { value: '0xffffff_White', label: 'White', color: '#ffffff' }
  ];

  depotColorOptions = [
    { value: 'TBD', label: 'TBD' },
    { value: 'Silver Speck', label: 'Silver Speck' },
    { value: 'Antique Bronze', label: 'Antique Bronze' },
    { value: 'Black', label: 'Black' },
    { value: 'Dark Bronze', label: 'Dark Bronze' },
    { value: 'Gold Speck', label: 'Gold Speck' },
    { value: 'Postal Grey', label: 'Postal Grey' },
    { value: 'Sandstone', label: 'Sandstone' },
    { value: 'White', label: 'White' }
  ];

  idTypeOptions = [
    { value: 'tbd', label: 'TBD' },
    { value: 'Decal_Numbers', label: 'Decal Numbers' },
    { value: 'Engraved', label: 'Engraved' },
    { value: 'Engraved_with_Black_Color_Fill', label: 'Engraved with Black Color Fill' },
    { value: 'Engraved_with_White_Color_Fill', label: 'Engraved with White Color Fill' }
  ];

  projectTypeOptions = [
    { value: 'New Construction', label: 'New Construction' },
    { value: 'Replacement', label: 'Replacement' }
  ];

  deliveryModeOptions = [
    { value: 'all', label: 'All USPS' },
    { value: 'usps', label: 'USPS Only' }
  ];

  adaModeOptions = [
    { value: 'all', label: 'All' },
    { value: 'ada', label: 'ADA Only' }
  ];

  installTypeOptions = [
    { value: 'recessed', label: 'Recessed' },
    { value: 'surface', label: 'Surface Mount' },
    { value: 'depot', label: 'Depot' }
  ];

  constructor(private projectService: ProjectService) {}

  onDeliveryModeChange() {
    // When switching to USPS mode, force install_type to 'recessed'
    if (this.deliveryMode === 'usps') {
      this.installType = 'recessed';
    }
  }

  ngOnChanges() {
    if (this.project) {
      this.loadFormData();
    }
  }

  loadFormData() {
    this.projectName = this.project.name || '';
    this.projectEmail = this.project.projectEmail || '';
    this.projectType = this.project.projectType || 'New Construction';
    this.deliveryMode = this.project.deliveryMode || 'all';
    this.adaMode = this.project.adaMode || 'all';
    this.projectAddress = this.project.projectAddress || '';
    this.projectCity = this.project.projectCity || '';
    this.projectState = this.project.projectState || '';
    this.dealerName = this.project.dealerName || '';
    this.architectName = this.project.architectName || '';
    this.drawnBy = this.project.drawnBy || '';
    this.poNumber = this.project.poNumber || '';
    this.quoteNumber = this.project.quoteNumber || '';

    this.installType = this.project.installType || 'recessed';
    this.depotColor = this.project.depotColor || 'TBD';
    this.suiteColorValue = this.project.suiteColorValue || '0xdbe0eb_tbd';
    this.suiteIdType = this.project.suiteIdType || 'tbd';
    this.numberingInstructions = this.project.numberingInstructions || '';
  }

  onCancel() {
    this.close.emit();
  }

  onSave() {
    const updates: Partial<Project> = {
      name: this.projectName.trim() || 'Unnamed Project',
      projectEmail: this.projectEmail,
      projectType: this.projectType,
      deliveryMode: this.deliveryMode,
      adaMode: this.adaMode,
      projectAddress: this.projectAddress,
      projectCity: this.projectCity,
      projectState: this.projectState,
      dealerName: this.dealerName,
      architectName: this.architectName,
      drawnBy: this.drawnBy,
      poNumber: this.poNumber,
      quoteNumber: this.quoteNumber,
      installType: this.installType,
      depotColor: this.depotColor,
      suiteColorValue: this.suiteColorValue,
      suiteIdType: this.suiteIdType,
      numberingInstructions: this.numberingInstructions
    };

    this.save.emit(updates);
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}
