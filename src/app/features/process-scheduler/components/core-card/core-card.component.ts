import { Component, input, inject, model } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Algorithm } from "../../models/algorithm.model";
import { CoreService } from "../../services/core.service";
import { Validators } from "@angular/forms";
import { ProcessQueue } from "../process-queue/process-queue.component";
import { AnalyticsService } from "../../services/analytics.service";
import { CommonModule } from "@angular/common";

@Component({
  selector: "core-card",
  templateUrl: "core-card.component.html",
  styleUrl: "core-card.component.scss",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ProcessQueue
]
})
export class CoreCard {

  coreId = input(-1);
  speed = model<number[]>([10]);
  coreService = inject(CoreService);
  analytics = inject(AnalyticsService);

  private coreInterval: ReturnType<typeof setInterval> | undefined;

  algoEnum = Algorithm;
  playing = false;
  errorMessage = '';

  coreConfigForm = new FormGroup({
    algorithm: new FormControl(Algorithm.FirstComeFirstServe, { nonNullable: true }),
    timeQuantum: new FormControl(5, {
      nonNullable: true,
      validators: [ Validators.min(1) ]
    })
  });

  togglePlaying() {
    this.playing = !this.playing;

    if (this.playing) {
      this.analytics.openCore(this.coreId());
      const interval = 1000 / this.speed()[this.coreId()];

      this.coreInterval = setInterval(() => {
        this.coreService.step(this.coreId());
      }, interval)

      if (this.coreService.getQueueLength(this.coreId()) > 0)
        this.analytics.coreBusy(this.coreId());
    }
    else {
      this.analytics.closeCore(this.coreId());

      clearInterval(this.coreInterval);
    }
  }

  handleAlgorithmChange() {

    if (this.coreConfigForm.value.algorithm) {
      this.coreService.setAlgorithm(
        this.coreId(),
        this.coreConfigForm.value.algorithm
      );
    }

  }

  changeSpeed(e: Event) {
    const input = e.target as HTMLInputElement;
    const newSpeed = parseInt(input.value);

    if (newSpeed < 10 || newSpeed > 250 || isNaN(newSpeed)) {
      this.errorMessage = 'Speed must be between 10 and 250';
      input.value = this.speed()[this.coreId()].toString();
    } else {
      this.errorMessage = '';

      const updatedSpeed = [...this.speed()];
      updatedSpeed[this.coreId()] = newSpeed;
      this.speed.set(updatedSpeed);

      this.togglePlaying();
      this.togglePlaying();
    }
  }

  changeTimeQuantum(e: Event) {
    const input = e.target as HTMLInputElement;
    const newTimeQuantum = parseInt(input.value);

    if (newTimeQuantum < 1 || newTimeQuantum > 10000 || isNaN(newTimeQuantum)) {
      this.errorMessage = 'Time quantum must be between 1 and 10000';
      this.coreConfigForm.get('timeQuantum')?.setValue(5);
    } else {
      this.errorMessage = '';
      this.coreConfigForm.get('timeQuantum')?.setValue(newTimeQuantum);
      this.coreService.setTimeQuantum(this.coreId(), newTimeQuantum);
    }
  }
}
