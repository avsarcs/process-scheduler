import { Component, input, signal, computed, effect, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Core } from '../../models/core.model';

@Component({
  selector: 'core-probability-distributor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: 'core-probability-distributor.component.html',
  styleUrls: ['core-probability-distributor.component.scss']
})
export class CoreProbabilityDistributor {

  coreCount = input<number>(1);
  coreSpeeds = input<number[]>([]);
  coreProbabilities = model<Core[]>([]);

  showOverlay = signal<boolean>(false);
  manualProbabilities: string[] = [];
  overlayError = signal<string>('');
  currentTotal = signal<string>('0.0');

  constructor() {
    effect(() => {
      const count = this.coreCount();
      const speeds = this.coreSpeeds();

      if (count && speeds.length > 0) {
        // Initialize cores with equal probability
        const equalProbability = 1 / count;
        const newCores = Array.from({ length: count }, (_, i) => ({
          id: i,
          speed: speeds[i] || 1,
          probability: equalProbability
        }));

        this.coreProbabilities.set(newCores);
      }
    });
  }

  totalProbability = computed(() => {
    return this.coreProbabilities().reduce((sum, core) => sum + core.probability, 0);
  });

  updateProbability(coreIndex: number, newValue: number): void {
    const cores = this.coreProbabilities();

    if (cores.length <= 1) return;

    const oldValue = cores[coreIndex].probability;
    const delta = newValue - oldValue;

    if (newValue >= 1 && cores.length > 1) return;

    if (newValue <= 0) return;

    const otherCores = cores.filter((_, i) => i !== coreIndex);
    const totalOtherProb = otherCores.reduce((sum, c) => sum + c.probability, 0);

    if (delta > 0 && totalOtherProb - delta < 0) return;

    const updatedCores = [...cores];
    updatedCores[coreIndex] = { ...cores[coreIndex], probability: newValue };

    // distribute the delta among other cores proportionally
    for (let i = 0; i < updatedCores.length; i++) {
      if (i !== coreIndex) {
        const ratio = cores[i].probability / totalOtherProb;
        updatedCores[i] = {
          ...cores[i],
          probability: Math.max(0, cores[i].probability - delta * ratio)
        };
      }
    }

    // we need to ensure that the total probability adds up to 0
    const newTotal = updatedCores.reduce((sum, c) => sum + c.probability, 0);
    if (Math.abs(newTotal - 1) > 0.0001) {

      const adjustIndex = updatedCores
        .map((c, i) => ({ i, p: c.probability }))
        .filter(c => c.i !== coreIndex)
        .sort((a, b) => b.p - a.p)[0]?.i;

      if (adjustIndex !== undefined) {
        updatedCores[adjustIndex].probability += (1 - newTotal);
      }
    }

    this.coreProbabilities.set(updatedCores);
  }

  setEqualDistribution(): void {
    const count = this.coreProbabilities().length;
    const equalProbability = 1 / count;

    const updatedCores = this.coreProbabilities().map(core => ({
      ...core,
      probability: equalProbability
    }));

    this.coreProbabilities.set(updatedCores);
  }

  setProportionalToSpeed(): void {
    const cores = this.coreProbabilities();
    const totalSpeed = cores.reduce((sum, core) => sum + core.speed, 0);

    const updatedCores = cores.map(core => ({
      ...core,
      probability: core.speed / totalSpeed
    }));

    this.coreProbabilities.set(updatedCores);
  }

  openProbabilityOverlay(): void {

    this.manualProbabilities = this.coreProbabilities().map(core =>
      (core.probability * 100).toFixed(1)
    );

    this.overlayError.set('');

    this.updateTotalPercentage();

    this.showOverlay.set(true);
  }

  updateTotalPercentage(): void {
    const total = this.manualProbabilities
      .map(value => {
        const numValue = parseFloat(value.replace('%', ''));
        return isNaN(numValue) ? 0 : numValue;
      })
      .reduce((sum, value) => sum + value, 0);

    this.currentTotal.set(total.toFixed(1));
  }

  closeOverlay(): void {
    this.showOverlay.set(false);
    this.overlayError.set('');
  }

  applyManualProbabilities(): void {

    const numValues = this.manualProbabilities.map(value => {
      const numValue = parseFloat(value.replace('%', ''));
      return isNaN(numValue) ? -1 : numValue;
    });

    if (numValues.some(value => value < 0)) {
      this.overlayError.set('All values must be valid numbers');
      return;
    }


    const total = numValues.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 0.1) {
      this.overlayError.set(`Total must be 100%. Current total: ${total.toFixed(1)}%`);
      return;
    }

    const updatedCores = this.coreProbabilities().map((core, index) => ({
      ...core,
      probability: numValues[index] / 100
    }));

    this.coreProbabilities.set(updatedCores);
    this.showOverlay.set(false);
  }


  updateManualProbability(index: number, value: string): void {
    this.manualProbabilities[index] = value;
    this.updateTotalPercentage();
  }

  formatProbability(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }


  handleDirectInput(coreIndex: number, event: Event): void {
    if (!event || !event.target) {
      return;
    }

    const inputElement = event.target as HTMLInputElement;
    if (!inputElement) {
      return;
    }

    const inputValue = inputElement.value;

    const numValue = parseFloat(inputValue.replace('%', ''));

    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      // revert to value before the change attempt
      inputElement.value = this.formatProbability(this.coreProbabilities()[coreIndex].probability);
      return;
    }

    const decimalValue = numValue / 100;

    this.updateProbability(coreIndex, decimalValue);
  }


  handleInputAndBlur(coreIndex: number, event: Event): void {

    this.handleDirectInput(coreIndex, event);

    if (event && event.target) {
      try {
        const element = event.target as HTMLElement;

        setTimeout(() => {
          element.blur();
        }, 0);

      }
      catch (error) {
        console.error('Error trying to blur element', error);
      }
    }
  }

}
