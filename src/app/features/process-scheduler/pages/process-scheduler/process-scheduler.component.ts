import { Component, inject, OnDestroy } from "@angular/core";
import { CoreCard } from "../../components/core-card/core-card.component";
import { ProcessGenerator } from "../../components/process-generator/process-generator.component";
import { CoreService } from "../../services/core.service";
import { AnalyticsService } from "../../services/analytics.service";
import { CommonModule } from "@angular/common";
import { WindowSetter } from "../../components/window-setter/window-setter.component";
@Component({
  selector: "process-scheduler",
  templateUrl: "process-scheduler.component.html",
  imports: [
    CommonModule,
    CoreCard,
    ProcessGenerator,
    WindowSetter
  ],
  styleUrl: "process-scheduler.component.scss"
})
export class ProcessScheduler implements OnDestroy {
  coreCount: number = 1;
  coreSpeeds: number[] = [10];

  nextPid: number = 1;

  coreService = inject(CoreService);
  analyticsService = inject(AnalyticsService);

  private utilUpdateInterval: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.utilUpdateInterval = setInterval(() => {
      this.analyticsService.updateCoreUtilization();
    }, 100);
  }

  ngOnDestroy(): void {
    clearInterval(this.utilUpdateInterval);
  }

  addCore () {
    this.coreCount++;
    this.coreSpeeds.push(10);
    this.coreService.addCore();
  }

  reset() {
    this.coreCount = 1;
    this.nextPid = 1;
    this.coreSpeeds = [10];
    this.coreService.reset();
  }
}
