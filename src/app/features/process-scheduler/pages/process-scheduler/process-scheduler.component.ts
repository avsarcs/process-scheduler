import { Component } from "@angular/core";
import { ProcessQueue } from "../../components/process-queue/process-queue.component";
import { ProcessGenerationForm } from "../../components/process-generation-form/process-generation-form.component";

@Component({
  selector: "process-scheduler",
  template: `
<div class="proc-display">
  <process-generation-form/>
  <process-queue/>
</div>
  `,
  imports: [
    ProcessQueue,
    ProcessGenerationForm
  ],
  styleUrl: "process-scheduler.component.scss"
})
export class ProcessScheduler {

}
