import { Injectable, inject } from "@angular/core";

import { Algorithm } from "../models/algorithm.model";
import { Process } from "../models/process.model";
import { Error } from "../models/error.model";
import { AnalyticsService } from "./analytics.service";

@Injectable({
  providedIn: "root",
})
export class CoreService {

  private analytics = inject(AnalyticsService);

  private algorithm: Algorithm[] = [Algorithm.FirstComeFirstServe];

  private timeQuantum: number[] = [5];
  private rr_step: number[] = [0];

  private runningPId: number[] = [-1];
  private processQueue: Process[][] = [[]];

  private coreCount = 1;

  addCore(): boolean {
    this.coreCount++;
    this.runningPId.push(-1);
    this.processQueue.push([]);
    this.timeQuantum.push(5);
    this.rr_step.push(0);
    this.algorithm.push(Algorithm.FirstComeFirstServe);

    this.analytics.addCore();

    return true;
  }

  removeCore(core: number): boolean {
    if (core < 0 || core >= this.coreCount)
      return false;

    this.runningPId = this.runningPId.filter((elem, i) => i != core);
    this.processQueue = this.processQueue.filter((elem, i) => i != core);
    this.timeQuantum = this.timeQuantum.filter((elem, i) => i != core);
    this.rr_step = this.rr_step.filter((elem, i) => i != core);
    this.algorithm = this.algorithm.filter((elem, i) => i != core);
    this.coreCount--;

    this.analytics.removeCore(core);
    return true;
  }

  reset(): boolean {
    this.algorithm = [Algorithm.FirstComeFirstServe];

    this.timeQuantum = [5];
    this.rr_step = [0];

    this.runningPId = [-1];
    this.processQueue = [[]];

    this.analytics.reset();
    return true;
  }

  queueProcess(core: number, process: Process): boolean {

    if (core < 0 || core >= this.coreCount)
      return false;

    this.processQueue[core].push(process);

    if (this.processQueue[core].length == 1) {
      this.runningPId[core] = this.processQueue[core][0].id;
      this.analytics.processRunning(process.id, core);
      this.analytics.coreBusy(core);
    }
    else {
      this.analytics.processWaiting(process.id, core);
    }

    return true;
  }

  getSchedulingAlgo(core: number): string {

    if (this.algorithm[core] == Algorithm.FirstComeFirstServe) {
      return "First Come First Serve";
    } else if (this.algorithm[core] == Algorithm.ShortestJobFirst) {
      return "Shortest Job First";
    } else if (this.algorithm[core] == Algorithm.RoundRobin) {
      return "Round Robin";
    }

    return "idk";

  }

  getProcessQueue(core: number): Process[] {
    return this.processQueue[core];
  }

  getQueueLength(core: number): number {
    return this.processQueue[core].length;
  }

  getCoreCount(): number {
    return this.coreCount;
  }

  setAlgorithm(core: number, newAlgorithm: Algorithm): void {
    this.algorithm[core] = newAlgorithm;
  }

  setTimeQuantum(core: number, newTimeQuantum: number): number {
    if (newTimeQuantum < 1) {
      return Error.ValueTooSmall;
    }

    this.timeQuantum[core] = newTimeQuantum;
    return this.timeQuantum[core];
  }

  step(core: number): number {

    if (core < 0 || core >= this.coreCount)
      return Error.CoreOutOfBound;

    if (this.processQueue[core].length == 0) {
      this.analytics.coreIdle(core);
      return Error.NoProcessInQueue;
    }

    const runningProc: Process = this.processQueue[core][0];

    runningProc.remaining -= 1;

    if (this.algorithm[core] == Algorithm.FirstComeFirstServe) {
      if (runningProc.remaining == 0) {
        this.analytics.processFinished(this.runningPId[core], core);
        this.removeProcess(core, this.runningPId[core]);
        this.runningPId[core] = -1;

        if (this.processQueue[core].length > 0) {
          this.runningPId[core] = this.processQueue[core][0].id;
          this.analytics.processRunning(this.runningPId[core], core);
        }
      }
    }
    else if (this.algorithm[core] == Algorithm.ShortestJobFirst) {
      if (runningProc.remaining == 0) {
        this.analytics.processFinished(runningProc.id, core);
        this.removeProcess(core, runningProc.id);
      }

      const shortest: Process = [...this.processQueue[core]].sort((a, b) => a.burstLength - b.burstLength)[0];
      this.runningPId[core] = shortest.id;

      if (this.processQueue[core][0].id != this.runningPId[core]) {
        this.analytics.processWaiting(this.processQueue[core][0].id, core);
        this.bringToFront(core, shortest);
        this.analytics.processRunning(this.runningPId[core], core);
      }
    }
    else if (this.algorithm[core] == Algorithm.RoundRobin) {

      if (this.rr_step[core] < this.timeQuantum[core])
        this.rr_step[core]++;

      const change: Boolean = (this.rr_step[core] % this.timeQuantum[core] == 0 && this.processQueue[core].length > 1)
        || runningProc.remaining <= 0;

      if (change) {
        this.rr_step[core] = 0;
        this.removeProcess(core, runningProc.id);

        if (runningProc.remaining > 0) {
          this.analytics.processWaiting(runningProc.id, core);
          this.queueProcess(core, runningProc);
        }
        else {
          this.analytics.processFinished(runningProc.id, core);
        }

        if (this.processQueue[core].length > 0) {
          this.runningPId[core] = this.processQueue[core][0].id;
          this.analytics.processRunning(this.runningPId[core], core);
        }
      }

    }

    return this.runningPId[core];
  }

  private removeProcess(core: number, pId: number) {
    this.processQueue[core] = this.processQueue[core].filter(proc => proc.id != pId);
  }

  private bringToFront(core: number, proc: Process) {
    this.removeProcess(core, proc.id);
    this.processQueue[core].unshift(proc);
  }

}
