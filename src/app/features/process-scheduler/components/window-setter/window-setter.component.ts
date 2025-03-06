import { Component, OnInit, inject } from '@angular/core';
import { AnalyticsService } from '../../services/analytics.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'window-setter',
  templateUrl: './window-setter.component.html',
  styleUrls: ['./window-setter.component.scss'],
  imports: [
    CommonModule
  ],
})
export class WindowSetter {
  processWindowError: string = '';
  coreWindowError: string = '';

  private analyticsService = inject(AnalyticsService);

  processWindow: number = this.analyticsService.getWindow();
  coreWindow: number = this.analyticsService.getCoreWindow();

  changeProcessWindow(e: Event): void {
    const input = e.target as HTMLInputElement;
    const newWindow = parseInt(input.value);

    if (newWindow <= 0 || newWindow > 999999999999999 || isNaN(newWindow)) {
      this.processWindowError = 'Process window must be greater than 0 and less than 1000000000000000';
      input.value = this.processWindow.toString();
    } else {
      this.processWindowError = '';
      if (this.analyticsService.setWindow(newWindow)) {
        this.processWindow = newWindow;
      } else {
        this.processWindowError = 'Failed to set process window';
        input.value = this.processWindow.toString();
      }
    }
  }

  changeCoreWindow(e: Event): void {
    const input = e.target as HTMLInputElement;
    const newWindow = parseInt(input.value);

    if (newWindow <= 100 || newWindow > 999999999999999 || isNaN(newWindow)) {
      this.coreWindowError = 'Core window must be greater than 100 and less than 1000000000000000';
      input.value = this.coreWindow.toString();
    } else {
      this.coreWindowError = '';
      if (this.analyticsService.setCoreWindow(newWindow)) {
        this.coreWindow = newWindow;
      } else {
        this.coreWindowError = 'Failed to set core window';
        input.value = this.coreWindow.toString();
      }
    }
  }
}
