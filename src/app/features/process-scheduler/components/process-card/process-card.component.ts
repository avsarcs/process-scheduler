import { Component, input } from "@angular/core";

@Component({
  selector: "process-card",
  templateUrl: "process-card.component.html",
  styleUrl: "process-card.component.scss",
})
export class ProcessCard {

  id = input<number>(-1);
  burstLength = input<number>(1);
  remaining = input<number>(1);

}
