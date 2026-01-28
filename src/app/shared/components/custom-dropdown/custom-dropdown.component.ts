import { Component, Input, Output, EventEmitter, HostListener, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface DropdownOption {
  value: any;
  label: string;
  color?: string; // Optional color hex for color indicators
}

@Component({
  selector: 'app-custom-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-dropdown.component.html',
  styleUrls: ['./custom-dropdown.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDropdownComponent),
      multi: true
    }
  ]
})
export class CustomDropdownComponent implements ControlValueAccessor {
  @Input() options: DropdownOption[] = [];
  @Input() placeholder = 'Select...';
  @Input() disabled = false;
  @Input() showColorIndicators = false;

  @Output() selectionChange = new EventEmitter<any>();

  isOpen = false;
  selectedValue: any = null;

  // For ControlValueAccessor
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};

  selectOption(value: any) {
    this.selectedValue = value;
    this.onChange(value);
    this.selectionChange.emit(value);
    this.onTouched();
    this.isOpen = false;
  }

  writeValue(value: any): void {
    this.selectedValue = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  getSelectedLabel(): string {
    if (!this.selectedValue) return this.placeholder;
    const selected = this.options.find(o => o.value === this.selectedValue);
    return selected ? selected.label : this.placeholder;
  }

  getSelectedColor(): string {
    if (!this.selectedValue) return '#dbe0eb';
    const selected = this.options.find(o => o.value === this.selectedValue);
    return selected?.color || '#dbe0eb';
  }

  toggle() {
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.isOpen = false;
    }
  }
}
