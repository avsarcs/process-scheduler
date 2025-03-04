import { Component } from '@angular/core';
import { ProcessScheduler } from './features/process-scheduler/pages/process-scheduler/process-scheduler.component';

@Component({
  selector: 'app-root',
  imports: [
    ProcessScheduler
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'ProcessScheduler';
}
