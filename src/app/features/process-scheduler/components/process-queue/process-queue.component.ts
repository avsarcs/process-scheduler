import { Component, input, inject } from "@angular/core";
import { ProcessCard } from "../process-card/process-card.component";
import { CoreService } from "../../services/core.service";

@Component({
  selector: "process-queue",
  templateUrl: "process-queue.component.html",
  styleUrl: "process-queue.component.scss",
  imports: [
    ProcessCard
  ],
})
export class ProcessQueue {

  coreId = input<number>(-1);

  coreService = inject(CoreService);

  pid: number = 1;
  burstLength: number = 100;
  remaining: number = 50;

}
