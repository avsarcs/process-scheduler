import { Component, input, model, inject, OnInit, OnDestroy } from "@angular/core";
import { FormGroup, FormControl, ReactiveFormsModule } from "@angular/forms";
import { CommonModule, Time } from "@angular/common";
import { CoreService } from "../../services/core.service";
import { CoreProbabilityDistributor } from "../core-probability-distributor/core-probability-distributor.component";
import { Core } from "../../models/core.model";
import { Process } from "../../models/process.model";

enum GenerationParadigm {
  POISSON,
  LINEAR
}

enum TimeUnit {
  SECOND,
  MINUTE,
  HOUR
}

@Component({
  selector: "process-generator",
  templateUrl: "process-generator.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CoreProbabilityDistributor
  ],
  styleUrl: "process-generator.component.scss",
  standalone: true
})
export class ProcessGenerator implements OnDestroy {
  coreService = inject(CoreService);
  coreCount = input<number>(1);
  coreSpeeds = input<number[]>([1]);

  gParadigm = GenerationParadigm;
  tUnit = TimeUnit;

  processGenerationForm = new FormGroup({
    meanArrivalCount: new FormControl(1, { nonNullable: true }),
    timeUnit: new FormControl(TimeUnit.SECOND),
    generationParadigm: new FormControl(GenerationParadigm.POISSON)
  });

  errorMessage: string = '';
  isGenerating: boolean = false;
  coreProbabilities: Core[] = [];

  nextPId = model<number>(1);
  private arrivalRateMs: number = 1000;
  private intervalMs: number = 1000;

  private processTimer: any = null;

  constructor() {
    this.updateArrivalRate();
  }

  ngOnDestroy() {
    this.stopProcessGeneration();
  }

  updateGenerationParadigm() {
    this.updateArrivalRate();

    if (this.isGenerating) {
      this.restartProcessGeneration();
    }
  }

  updateCount(e: Event) {
    const input = e.target as HTMLInputElement;
    const newValue = parseFloat(input.value);

    if (isNaN(newValue) || newValue <= 0) {
      this.errorMessage = 'Arrival rate must be greater than 0';
      this.processGenerationForm.get('meanArrivalCount')?.setValue(1);
      return;
    }

    const formValue = this.processGenerationForm.value

    if (formValue.timeUnit == undefined || formValue.meanArrivalCount == undefined)
      return;

    const max = this.getMaxLimit(formValue.timeUnit);

    if (formValue.meanArrivalCount > max) {
      this.errorMessage = `Maximum value for the selected time unit is ${max}`;
      this.processGenerationForm.get('meanArrivalCount')?.setValue(max);
      return;
    }

    this.errorMessage = '';
    this.updateArrivalRate();

    if (this.isGenerating) {
      this.restartProcessGeneration();
    }
  }

  private getMaxLimit(timeUnit: TimeUnit): number {
    let max = -1;

    if (timeUnit == TimeUnit.SECOND)
      max = 100;
    else if (timeUnit == TimeUnit.MINUTE)
      max = 1000;
    else if (timeUnit == TimeUnit.HOUR)
      max = 10000;

    return max;
  }

  updateTimeUnit() {

    const formValue = this.processGenerationForm.value;

    if (formValue.timeUnit == undefined || formValue.meanArrivalCount == undefined)
      return;

    let max = this.getMaxLimit( formValue.timeUnit );

    if (formValue.meanArrivalCount > max) {
      this.errorMessage = `Maximum value for the selected time unit is ${max}`;
      this.processGenerationForm.get("meanArrivalCount")?.setValue(max);
    } else {
      this.errorMessage = '';
    }

    this.updateArrivalRate();

    if (this.isGenerating) {
      this.restartProcessGeneration();
    }
  }


  startGeneration() {
    if (!this.isGenerating) {
      this.isGenerating = true;
      this.startProcessGeneration();
    }
  }

  stopGeneration() {
    if (this.isGenerating) {
      this.isGenerating = false;
      this.stopProcessGeneration();
    }
  }

  toggleGeneration() {
    if (this.isGenerating) {
      this.stopGeneration();
    } else {
      this.startGeneration();
    }
  }

  private updateArrivalRate() {
    const formValue = this.processGenerationForm.value;

    if (formValue.meanArrivalCount == undefined || formValue.timeUnit == undefined)
      return;


    let msPerUnit = -1;

    if (formValue.timeUnit == TimeUnit.SECOND)
      msPerUnit = 1000;
    else if (formValue.timeUnit == TimeUnit.MINUTE)
      msPerUnit = 60000;
    else if (formValue.timeUnit == TimeUnit.HOUR)
      msPerUnit = 3600000



    if (formValue.generationParadigm == GenerationParadigm.POISSON) {

        const lambda = formValue.meanArrivalCount / msPerUnit;
        this.arrivalRateMs = lambda;

    }
    else if (formValue.generationParadigm == GenerationParadigm.LINEAR) {

      this.intervalMs = formValue.meanArrivalCount > 0 ?
        msPerUnit / formValue.meanArrivalCount :
        Number.MAX_SAFE_INTEGER;
    }

    if (this.isGenerating) {
      this.restartProcessGeneration();
    }
  }

  private restartProcessGeneration() {
    this.stopProcessGeneration();
    if (this.isGenerating) {
      this.startProcessGeneration();
    }
  }

  private startProcessGeneration() {
    const formValue = this.processGenerationForm.value;

    if (formValue.generationParadigm == undefined)
      return;

    if (formValue.generationParadigm == GenerationParadigm.POISSON) {
      this.schedulePoissonEvent();
    } else {
      this.scheduleLinearEvent();
    }
  }

  private stopProcessGeneration() {
    const formValue = this.processGenerationForm.value;

    if (formValue.generationParadigm == undefined)
      return;

    if (this.processTimer) {
      if (formValue.generationParadigm == GenerationParadigm.LINEAR) {
        clearInterval(this.processTimer);
      } else {
        clearTimeout(this.processTimer);
      }
      this.processTimer = null;
    }
  }

  private scheduleLinearEvent() {
    this.processTimer = setInterval(() => {
      this.pickCoreAndQueue();
    }, this.intervalMs);
  }

  private schedulePoissonEvent() {

    // inter-arrival times are modeled by an exponential distribution
    const waitTime = this.generateExponentialRandomTime(this.arrivalRateMs);

    this.processTimer = setTimeout(() => {
      this.pickCoreAndQueue();

      if (this.isGenerating) {
        this.schedulePoissonEvent();
      }
    }, waitTime);
  }

  private generateExponentialRandomTime(lambda: number): number {

    // we can find a suitable interarrival time with the formula
    // -ln(U)/lambda where U is a random number in (0,1]
    const u = Math.random();

    if (lambda <= 0) return 3600000;

    const waitTime = Math.round(-Math.log(u) / lambda);

    return Math.min(waitTime, 3600000);
  }

  private pickCoreAndQueue() {
    const coreDice = Math.random();
    let prob = 0;
    for (const coreProb of this.coreProbabilities) {
      prob += coreProb.probability;

      if (coreDice <= prob) {

        const burstLength = Math.ceil( Math.random() * 100 );

        const proc: Process = {
          "id": this.nextPId(),
          "burstLength": burstLength,
          "remaining": burstLength,
        }

        this.coreService.queueProcess(coreProb.id, proc);
        this.nextPId.set(this.nextPId() + 1);

        break;
      }
    }
  }
}
