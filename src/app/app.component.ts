import { Component } from '@angular/core';
import { ProcessScheduler } from './features/process-scheduler/pages/process-scheduler/process-scheduler.component';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [
    ProcessScheduler
  ]
})
export class AppComponent {
  title = 'ProcessScheduler';
}
