import { Injectable, inject } from "@angular/core";

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
  private coreWindow: number = 10000; // CPU utilization in the past [CPUWindow] milliseconds

  private waitingTime: RunningAverage[] = [
    {
      "average": 0,
      "count": 0,
    }
  ] // unit: milliseconds
  private turnaroundTime: RunningAverage[] = [
    {
      "average": 0,
      "count": 0,
    }
  ] // unit: milliseconds
  private coreUtilization: number[] = [0]; // percentage

  private overallWaitingTime: RunningAverage = {
    "average": 0,
    "count": 0,
  }

  private overallTurnaroundTime: RunningAverage = {
    "average": 0,
    "count": 0,
  }

  private overallCoreUtilization: number = 0;

  private processData: ProcessData[][] = [[]];
  private coreTimeBlocks: TimeBlock[][] = [[]];
  private coreData: CoreData[] = [
    {
      "totalIdleTime": 0,
      "totalBusyTime": 0,
    }
  ];

  private coreOpen: Boolean[] = [false];
  private coreProcrastinating: Boolean[] = [false];

  reset() {
    this.coreOpen = [false];
    this.coreProcrastinating = [false];

    this.processData = [[]];
    this.coreTimeBlocks = [[]];
    this.coreData = [
      {
        "totalIdleTime": 0,
        "totalBusyTime": 0,
      }
    ];

    this.correctedUntil = [0];

    this.overallCoreUtilization = 0;

    this.overallWaitingTime = {
      "average": 0,
      "count": 0,
    }

    this.overallTurnaroundTime = {
      "average": 0,
      "count": 0,
    }

    this.waitingTime = [
      {
        "average": 0,
        "count": 0,
      }
    ];
    this.turnaroundTime = [
      {
        "average": 0,
        "count": 0,
      }
    ];
    this.coreUtilization = [0];

    this.window = 200;
    this.coreWindow = 100000;
  }

  addCore() {
    this.ensureCoreCount(this.coreUtilization.length);
  }

  removeCore(core: number): boolean {
    if (core < 0 || core >= this.coreUtilization.length)
      return false;

    this.waitingTime = this.waitingTime.filter((elem, i) => i != core);
    this.turnaroundTime = this.turnaroundTime.filter((elem, i) => i != core);
    this.coreUtilization = this.coreUtilization.filter((elem, i) => i != core);

    this.coreTimeBlocks = this.coreTimeBlocks.filter((elem, i) => i != core);
    this.coreData = this.coreData.filter((elem, i) => i != core);

    this.processData = this.processData.filter((elem, i) => i != core);

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

    this.coreProcrastinating[core] = false;

    const timeblocks = this.coreTimeBlocks[core];
    const timeblockCount = timeblocks.length;

    if (timeblocks[timeblockCount - 1]?.state == CoreState.IDLE) {
      return;
    }

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

    this.coreProcrastinating[core] = true;

    if (!this.coreOpen[core])
      return;

    this.coreProcrastinating[core] = false;

    const timeblocks = this.coreTimeBlocks[core];
    const timeblockCount = timeblocks.length;

    if (timeblocks[timeblockCount - 1]?.state == CoreState.BUSY) {
      return;
    }

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

  openCore(core: number) {
    this.ensureCoreCount(core);
    this.coreOpen[core] = true;

    if (this.coreProcrastinating[core])
      this.coreBusy(core);
  }

  closeCore(core: number) {
    this.ensureCoreCount(core);
    this.coreOpen[core] = false;
    this.coreIdle(core);
  }

  private ensureCoreCount(core: number) {

    while (this.coreOpen.length - 1 < core)
      this.coreOpen.push(false);

    while (this.coreProcrastinating.length - 1 < core)
      this.coreProcrastinating.push(false);

    while (this.processData.length - 1 < core)
      this.processData.push([]);

    while (this.coreUtilization.length - 1 < core)
      this.coreUtilization.push(0);

    while (this.coreData.length - 1 < core)
      this.coreData.push(
        {
          "totalIdleTime": 0,
          "totalBusyTime": 0,
        }
      );

    // console.log("coreTimeblocks before trying to add");
    // console.log(JSON.stringify(this.coreTimeBlocks));
    while (this.coreTimeBlocks.length - 1 < core)
      this.coreTimeBlocks.push([]);

    console.log("coreTimeblocks after addition");
    console.log(JSON.stringify(this.coreTimeBlocks));

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

  private correctedUntil: number[] = [0]
  updateCoreUtilization() {
    const now = Date.now();

    for (let core = 0; core < this.coreTimeBlocks.length; core++) {
      const timeblocks = this.coreTimeBlocks[core];

      if (timeblocks.length === 0) {
        continue;
      }

      this.coreData[core].totalIdleTime = 0;
      this.coreData[core].totalBusyTime = 0;

      let j = this.correctedUntil[core];

      // Process timeblocks that are now outside the coreWindow
      while (j < timeblocks.length && now - timeblocks[j].from > this.coreWindow) {
        const timeblock = timeblocks[j];

        if (timeblock.to == Time.NOT_ASSIGNED_YET) {
          // If the timeblock hasn't ended yet, but started before the window
          const timeInWindow = this.coreWindow;

          if (timeblock.state == CoreState.IDLE) {
            this.coreData[core].totalIdleTime += timeInWindow;
          }
          else if (timeblock.state == CoreState.BUSY) {
            this.coreData[core].totalBusyTime += timeInWindow;
          }

          timeblock.factoredIn = timeInWindow;
        }
        else if (now - timeblock.to < this.coreWindow) {
          // If the timeblock ends within the window but started before it
          const timeInWindow = timeblock.to - (now - this.coreWindow);

          if (timeblock.state == CoreState.IDLE) {
            this.coreData[core].totalIdleTime += timeInWindow;
          }
          else if (timeblock.state == CoreState.BUSY) {
            this.coreData[core].totalBusyTime += timeInWindow;
          }

          timeblock.factoredIn = timeInWindow;
        }
        else {
          timeblock.factoredIn = 0;
        }

        j++;
      }

      this.correctedUntil[core] = j > 0 ? j - 1 : 0;

      // Process timeblocks that are within the coreWindow
      for (; j < timeblocks.length; j++) {
        const timeblock = timeblocks[j];
        let timeInWindow;

        if (timeblock.to == Time.NOT_ASSIGNED_YET) {
          timeInWindow = Math.min(now - timeblock.from, this.coreWindow);
        }
        else {
          const blockStart = Math.max(timeblock.from, now - this.coreWindow);
          timeInWindow = timeblock.to - blockStart;
        }

        timeInWindow = Math.max(0, timeInWindow);

        if (timeblock.state == CoreState.IDLE) {
          this.coreData[core].totalIdleTime += timeInWindow;
        }
        else if (timeblock.state == CoreState.BUSY) {
          this.coreData[core].totalBusyTime += timeInWindow;
        }

        timeblock.factoredIn = timeInWindow;
      }

      const totalTime = this.coreData[core].totalIdleTime + this.coreData[core].totalBusyTime;
      if (totalTime > this.coreWindow) {
        const scale = this.coreWindow / totalTime;
        this.coreData[core].totalIdleTime *= scale;
        this.coreData[core].totalBusyTime *= scale;
      }
    }

    // Since we are not considering timeblocks beyond the window, it is acceptable to clean them up
    // only occasionally, thus reducing the frequency of this costly operation
    if (Math.random() < 0.2) {
      for (let core = 0; core < this.correctedUntil.length; core++) {
        if (this.correctedUntil[core] > 0) {
          const sliceIndex = this.correctedUntil[core];
          this.coreTimeBlocks[core] = this.coreTimeBlocks[core].slice(sliceIndex);
          this.correctedUntil[core] = 0;
        }
      }
    }

    for (let core = 0; core < this.coreUtilization.length; core++) {
      const cData = this.coreData[core];
      const totalTime = cData.totalBusyTime + cData.totalIdleTime;

      if (totalTime <= 0) {
        this.coreUtilization[core] = 0;
      } else {
        const utilization = cData.totalBusyTime / totalTime;
        this.coreUtilization[core] = Math.max(0, Math.min(1, utilization));
      }
    }

    if (this.coreUtilization.length > 0) {
      const sum = this.coreUtilization.reduce((a, b) => a + b, 0);
      this.overallCoreUtilization = Math.max(0, Math.min(1, sum / this.coreUtilization.length));
    } else {
      this.overallCoreUtilization = 0;
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

  getWindow(): number {
    return this.window;
  }

  getCoreWindow(): number {
    return this.coreWindow;
  }

  getWaitingTime(core: number): number {
    if (core < 0 || core >= this.waitingTime.length)
      return -1;

    return this.waitingTime[core].average;
  }

  getTurnaroundTime(core: number): number {
    if (core < 0 || core >= this.turnaroundTime.length)
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
    if (core < 0 || core >= this.coreUtilization.length) {
      return -1;
    }

    return this.coreUtilization[core];
  }

  getOverallCoreUtilization(): number {
    return this.overallCoreUtilization;
  }

}
