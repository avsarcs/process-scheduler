import { Component, output, inject } from "@angular/core";
import { CoreService } from "../../services/core.service";
import { Algorithm } from "../../models/algorithm.model";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { TimeoutInfo } from "rxjs";

@Component({
  selector: "process-queue",
  template:`
<div class="processes">
  @for (process of this.scheduler.getProcessQueue(); track process.id) {
    <span>{{ process.remaining }} || </span>
  }
</div>
<button (click)="nextStepHandle()">Step</button>
<button (click)="play()">Play</button>
<button (click)="stop()">Stop</button>
<form id="select-sched-alg">
  <input type="radio" id="fcfs" name="scheduling_algo" (click)="handleAlgoChange($event)" [value]="algo.FirstComeFirstServe" checked>
  <label for="fcfs">FCFS</label><br>
  <input type="radio" id="SJF" name="scheduling_algo" (click)="handleAlgoChange($event)" [value]="algo.ShortestJobFirst">
  <label for="sjf">SJF</label><br>
  <input type="radio" id="RR" name="scheduling_algo" (click)="handleAlgoChange($event)" [value]="algo.RoundRobin">
  <label for="rr">RR</label>
</form>
<span>Current Scheduling Algorithm: {{this.scheduler.getSchedulingAlgo()}}</span>
  `,
  imports: [
    ReactiveFormsModule
  ],
  styleUrl: "process-queue.component.scss"
})
export class ProcessQueue {
  algo = Algorithm;
  scheduler = inject(CoreService);
  nextStep = output<void>();
  playing: Boolean = false;
  playerId: number = -1;

  handleAlgoChange(e: Event) {
    let newAlgo = parseInt( (e.target as HTMLInputElement).value ) as Algorithm;
    this.scheduler.setAlgorithm( newAlgo );
  }

  play() {
    if (!this.playing) {
      // @ts-ignore
      this.playerId = setInterval(() => { this.scheduler.step(); }, 200);
      console.log("we in");
      this.playing = true;
    }
  }

  stop() {
    if (this.playing) {
      clearInterval(this.playerId);
      this.playing = false;
    }
  }

  nextStepHandle() {
    this.scheduler.step();
  }
}
