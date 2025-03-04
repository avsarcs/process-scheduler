import { Component, output, inject } from "@angular/core";
import { Process } from "../../models/process.model";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { CoreService } from "../../services/core.service";

@Component({
  selector: "process-generation-form",
  imports: [ReactiveFormsModule],
  template: `
<form id="process-create-form">
  <label for="burst-length">Burst Length: </label>
  <input min="1" id="burst-length" type="number" [formControl]="burstInput">

  <div class="generate-buttons">
    <button type="button" (click)="handleGenerateClick(false)">Generate</button>
    <button type="button" (click)="handleGenerateClick(true)">Generate Random Process</button>
  </div>
</form>
  `,
  styleUrl: "process-generation-form.component.scss"
})
export class ProcessGenerationForm {

  generateProcess = output<Process>();
  nextProcessId = 1;

  burstInput = new FormControl<number>(1, { nonNullable: true });

  private scheduler = inject(CoreService);

  handleGenerateClick(random: Boolean) {
    if (random) {
      const randomBurst = Math.floor(Math.random() * 30) + 1;

      this.scheduler.queueProcess(
        {
          id: this.nextProcessId,
          burstLength: randomBurst,
          remaining: randomBurst
        }
      );

    }
    else {

      this.scheduler.queueProcess(
        {
          id: this.nextProcessId,
          burstLength: this.burstInput.value,
          remaining: this.burstInput.value
        }
      );

    }

    this.nextProcessId++;
  }

}
