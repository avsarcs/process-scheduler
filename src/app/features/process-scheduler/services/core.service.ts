import { Injectable } from "@angular/core";

import { Algorithm } from "../models/algorithm.model";
import { Process } from "../models/process.model";
import { Error } from "../models/error.model";

@Injectable({
  providedIn: "root",
})
export class CoreService {

  private algorithm: Algorithm[] = [ Algorithm.FirstComeFirstServe ];

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
    this.algorithm.push( Algorithm.FirstComeFirstServe );

    return true;
  }

  removeCore(core: number): boolean {
    if (core < 0 || core >= this.coreCount)
      return false;

    this.runningPId = this.runningPId.filter( (elem, i) => i != core );
    this.processQueue = this.processQueue.filter( (elem, i) => i != core );
    this.timeQuantum = this.timeQuantum.filter( (elem, i) => i != core );
    this.rr_step = this.rr_step.filter( (elem, i) => i != core );
    this.algorithm = this.rr_step.filter( (elem, i) => i != core );
    this.coreCount--;

    return true;
  }

  reset(): boolean {
    this.algorithm = [ Algorithm.FirstComeFirstServe ];

    this.timeQuantum = [5];
    this.rr_step = [0];

    this.runningPId = [-1];
    this.processQueue = [[]];

    return true;
  }

  queueProcess(core: number, process: Process): boolean {

    if ( core < 0 ||  core >= this.coreCount )
      return false;

    this.processQueue[core].push(process);

    if (this.processQueue[core].length == 1) {
      this.runningPId[core] = this.processQueue[core][0].id;
    }

    return true;
  }

  getSchedulingAlgo(core: number): string {

    switch (this.algorithm[core]) {
      case (Algorithm.FirstComeFirstServe):
        return "First Come First Serve";
      case (Algorithm.ShortestJobFirst):
        return "Shortest Job First";
      case (Algorithm.RoundRobin):
        return "Round Robin";
    }

  }

  getProcessQueue(core: number): Process[] {
    return this.processQueue[core];
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
      return -1;

    const runningProc: Process | undefined = this.processQueue[core].find(proc => proc.id == this.runningPId[core]);

    if (!runningProc) {
      return Error.ProcNotFound;
    }

    runningProc.remaining -= 1;

    switch(this.algorithm[core]) {
      case Algorithm.FirstComeFirstServe:

        if (runningProc.remaining > 0)
          break;

        this.removeProcess(core, this.runningPId[core]);
        this.runningPId[core] = -1;

        if (this.processQueue.length > 0)
          this.runningPId[core] = this.processQueue[core][0].id;

        break;

      case Algorithm.ShortestJobFirst:

        this.runningPId[core] = -1;

        if (this.processQueue.length > 0) {

          if (runningProc.remaining == 0) {
            this.removeProcess(core, runningProc.id);
          }

          const shortest: Process = [...this.processQueue[core]].sort((a, b) => a.burstLength - b.burstLength)[0];
          this.runningPId[core] = shortest.id;

          if (this.processQueue[core][0].id != this.runningPId[core]) {
            this.bringToFront(core, shortest);
          }

        }

        break;
      case Algorithm.RoundRobin:
        this.rr_step[core]++;
        const change: Boolean = runningProc.remaining <= 0 || this.rr_step[core] % this.timeQuantum[core] == 0;

        if (change) {
          this.rr_step[core] = 0;
          this.removeProcess(core, runningProc.id);

          if (runningProc.remaining > 0) {
            this.queueProcess(core, runningProc);
          }

          this.runningPId[core] = this.processQueue[core][0].id;
        }

        break;
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
