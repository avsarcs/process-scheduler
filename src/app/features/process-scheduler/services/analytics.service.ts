import { Injectable } from "@angular/core";

interface ProcessData {
  id: number;
  arrived: number;
  becameWaiting: number;
  becameRunning: number; // milliseconds since UNIX epoch
}

enum CoreState {
  IDLE,
  BUSY,
}

enum Time {
  NOT_ASSIGNED_YET = -1
}

interface TimeBlock {
  state: CoreState;
  from: number;
  to: number; // milliseconds since UNIX epoch
  factoredIn: number; // milliseconds of this timeblock factored in to total idle / busy time in CoreData
}

interface CoreData {
  totalIdleTime: number; // unit: milliseconds
  totalBusyTime: number; // unit: milliseconds
}

interface RunningAverage {
  "average": number,
  "count": number,
}

@Injectable({
  providedIn: "root",
})
export class AnalyticsService {

  private window: number = 200; // number of operations (process arrived / executing / waiting / finished)
  private coreWindow: number = 100000; // CPU utilization in the past [CPUWindow] milliseconds

  private waitingTime: RunningAverage[] = [] // unit: milliseconds
  private turnaroundTime : RunningAverage[] = [] // unit: milliseconds
  private coreUtilization: number[] = []; // percentage

  private overallWaitingTime: RunningAverage = {
    "average": 0,
    "count": 0,
  }

  private overallTurnaroundTime: RunningAverage = {
    "average": 0,
    "count": 0,
  }

  private overallCoreUtilization: number = 0;

  private processData: ProcessData[][] = [];
  private coreTimeBlocks: TimeBlock[][] = [];
  private coreData: CoreData[] = [];

  reset() {
    this.processData = [];
    this.coreTimeBlocks = [];
    this.coreData = [];

    this.correctedUntil = [];

    this.overallCoreUtilization = 0;

    this.overallWaitingTime = {
      "average": 0,
      "count": 0,
    }

    this.overallTurnaroundTime = {
      "average": 0,
      "count": 0,
    }

    this.waitingTime = [];
    this.turnaroundTime = [];
    this.coreUtilization = [];

    this.window = 200;
    this.coreWindow = 100000;
  }

  removeCore(core: number): boolean {
    if (core < 0 || core >= this.coreUtilization.length)
      return false;

    this.waitingTime = this.waitingTime.filter( (elem, i) => i != core );
    this.turnaroundTime = this.turnaroundTime.filter( (elem, i) => i != core );
    this.coreUtilization = this.coreUtilization.filter( (elem, i) => i != core );

    this.coreTimeBlocks = this.coreTimeBlocks.filter( (elem, i) => i != core);
    this.coreData = this.coreData.filter( (elem, i) => i != core );

    this.processData = this.processData.filter( (elem, i) => i != core );

    return true;
  }

  processWaiting(id: number, core: number): void {
    const now = Date.now();

    const pData: ProcessData | undefined = this.processData[core].find((p) => p.id == id);

    if (!pData) {
      const newPData: ProcessData = {
        id,
        arrived: now,
        becameWaiting: now,
        becameRunning: Time.NOT_ASSIGNED_YET
      }

      this.processData[core].push(newPData);
    }
    else {
      pData.becameWaiting = now;
    }

  }


  processRunning(id: number, core: number): void {
    const now = Date.now();

    let pData: ProcessData | undefined = this.processData[core].find((p) => p.id == id);

    if (!pData) {
      pData = {
        "id": id,
        "arrived": now,
        "becameWaiting": now,
        "becameRunning": now,
      }

      this.processData[core].push(pData);
    }

    pData.becameRunning = now;

    const waited: number = pData.becameRunning - pData.becameWaiting;

    this.waitingTime[core].average =
      ((this.waitingTime[core].average * this.waitingTime[core].count) + waited) / (this.waitingTime[core].count + 1);

    if (this.waitingTime[core].count < this.window)
      this.waitingTime[core].count++;

    this.overallWaitingTime.average =
      ((this.overallWaitingTime.average * this.overallWaitingTime.count) + waited) / (this.overallWaitingTime.count + 1);

    if (this.overallWaitingTime.count < this.window)
      this.overallWaitingTime.count++;

  }

  processFinished(id: number, core: number): void {
    const now = Date.now();

    const pData: ProcessData | undefined = this.processData[core].find((p) => p.id == id);

    if (pData) {
      const finished = now;
      const turnaround = finished - pData.arrived;

      this.turnaroundTime[core].average =
        ((this.turnaroundTime[core].average * this.turnaroundTime[core].count) + turnaround) / (this.turnaroundTime[core].count + 1);

      if (this.turnaroundTime[core].count < this.window)
        this.turnaroundTime[core].count++;

      this.overallTurnaroundTime.average =
        ((this.overallTurnaroundTime.average * this.overallTurnaroundTime.count) + turnaround) / (this.overallTurnaroundTime.count + 1);

      if (this.overallTurnaroundTime.count < this.window)
        this.overallTurnaroundTime.count++;

      this.processData[core] = this.processData[core].filter((p) => p.id != id);
    }
  }

  coreIdle(core: number): void {
    const now = Date.now();
    this.ensureCoreCount(core);

    const timeblocks = this.coreTimeBlocks[core];
    const timeblockCount = timeblocks.length;

    if (timeblockCount > 0) {
      if (timeblocks[timeblockCount - 1].state == CoreState.IDLE)
        return;

      if (timeblocks[timeblockCount - 1].to < 0)
        timeblocks[timeblockCount - 1].to = now;
    }

    timeblocks.push({
      "state": CoreState.IDLE,
      "from": now,
      "to": Time.NOT_ASSIGNED_YET,
      "factoredIn": 0,
    });
  }

  coreBusy(core: number): void {
    const now = Date.now();
    this.ensureCoreCount(core);

    const timeblocks = this.coreTimeBlocks[core];
    const timeblockCount = timeblocks.length;

    if (timeblockCount > 0) {
      if (timeblocks[timeblockCount - 1].state == CoreState.BUSY)
        return;

      if (timeblocks[timeblockCount - 1].to < 0)
        timeblocks[timeblockCount - 1].to = now;
    }

    timeblocks.push({
      "state": CoreState.BUSY,
      "from": now,
      "to": Time.NOT_ASSIGNED_YET,
      "factoredIn": 0,
    });
  }

  private ensureCoreCount(core: number) {

    while (this.coreUtilization.length - 1 < core)
      this.coreUtilization.push(0);

    while (this.coreData.length - 1 < core)
      this.coreData.push(
        {
          "totalIdleTime": 0,
          "totalBusyTime": 0,
        }
      );

    while (this.coreTimeBlocks.length - 1 < core)
      this.coreTimeBlocks.push([]);

    while (this.correctedUntil.length - 1 < core)
      this.correctedUntil.push(0);

    while (this.waitingTime.length - 1 < core)
      this.waitingTime.push(
        {
          "average": 0,
          "count": 0,
        }
      );

    while (this.turnaroundTime.length - 1 < core)
      this.turnaroundTime.push(
        {
          "average": 0,
          "count": 0,
        }
      );

  }

  private correctedUntil: number[] = []
  updateCoreUtilization() {

    const now = Date.now();

    for (let core = 0; core < this.coreTimeBlocks.length; core++) {
      const timeblocks = this.coreTimeBlocks[core];

      let j;
      for (
        j = this.correctedUntil[core];
        now - timeblocks[j].from > this.coreWindow && j < timeblocks.length;
        j++
      )
      {
        const timeblock = timeblocks[j];

        if (timeblock.to == Time.NOT_ASSIGNED_YET) {

          if (timeblock.state == CoreState.IDLE) {

            this.coreData[core].totalIdleTime = this.coreWindow;
            this.coreData[core].totalBusyTime = 0;

          }
          else if (timeblock.state == CoreState.BUSY) {

            this.coreData[core].totalBusyTime = this.coreWindow;
            this.coreData[core].totalIdleTime = 0;

          }

          timeblock.factoredIn = now - timeblock.from;
        }
        else if (now - timeblock.to < this.coreWindow) {

          const needToFactorIn = timeblock.to - (now - this.coreWindow);
          const diff = needToFactorIn - timeblock.factoredIn;

          if (timeblock.state == CoreState.IDLE) {
            this.coreData[core].totalIdleTime += diff;
          }
          else if (timeblock.state == CoreState.BUSY) {
            this.coreData[core].totalBusyTime += diff;
          }

          timeblock.factoredIn += diff;
        }
        else if (now - timeblock.to >= this.coreWindow) {
          const erase = timeblock.factoredIn;

          if (timeblock.state == CoreState.IDLE) {
            this.coreData[core].totalIdleTime -= erase;
          }
          else if (timeblock.state == CoreState.BUSY) {
            this.coreData[core].totalBusyTime -= erase;
          }

          timeblock.factoredIn = 0;
        }
      }

      this.correctedUntil[core] = j - 1 >= 0 ? j - 1 : 0;

      for (j; j < timeblocks.length; j++) {

        const timeblock = timeblocks[j];

        let needToFactorIn;
        if (timeblock.to == Time.NOT_ASSIGNED_YET) {
          needToFactorIn = now - timeblock.from;
        }
        else {
          needToFactorIn = timeblock.to - timeblock.from;
        }

        const diff = needToFactorIn - timeblock.factoredIn;

        if (timeblock.state == CoreState.IDLE) {
          this.coreData[core].totalIdleTime += diff;
        }
        else if (timeblock.state == CoreState.BUSY) {
          this.coreData[core].totalBusyTime += diff;
        }

      }

    }

    // It is okay if we erase the timeblocks beyond the coreWindow only every now and then
    // as long as we don't consider them, thus decreasing the frequency of this costly operation.
    if (Math.random() < 0.05) {
      for (let core = 0; core < this.correctedUntil.length; core++) {

        if (this.correctedUntil[core] - 1 >= 0) {
          const sliceIndex = this.correctedUntil[core] - 1;
          this.coreTimeBlocks[core] = this.coreTimeBlocks[core].slice(sliceIndex);
          this.correctedUntil[core] = 0;
        }

      }
    }

    for (let core = 0; core < this.coreUtilization.length; core++) {
      const cData = this.coreData[core];
      this.coreUtilization[core] = cData.totalBusyTime / (cData.totalBusyTime + cData.totalIdleTime);
    }

    if (this.coreUtilization.length > 0) {
      this.overallCoreUtilization = this.coreUtilization.reduce((a, b) => a + b) / this.coreUtilization.length;
    }

  }

  setWindow(window: number): boolean {
    if (window > 0) {
      this.window = window;
      return true;
    }

    return false;
  }

  setCoreWindow(coreWindow: number): boolean {
    if (coreWindow > 100) {
      this.coreWindow = coreWindow;
      return true;
    }

    return false;
  }

  getWaitingTime(core: number): number {
    if (core < 0 || this.waitingTime.length - 1 > core)
      return -1;

    return this.waitingTime[core].average;
  }

  getTurnaroundTime(core: number): number {
    if (core < 0 || this.turnaroundTime.length - 1 > core)
      return -1;

    return this.turnaroundTime[core].average;
  }

  getOverallWaitingTime(): number {
    return this.overallWaitingTime.average;
  }

  getOverallTurnaroundTime(): number {
    return this.overallTurnaroundTime.average;
  }

  getCoreUtilization(core: number): number {

    if (this.coreUtilization.length - 1 > core) {
      return -1;
    }

    return this.coreUtilization[core];
  }

  getOverallCoreUtilization(): number {
    return this.overallCoreUtilization;
  }

}
