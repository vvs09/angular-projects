import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from './split';

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(minor: number, currency: string, signed = false): string {
    return formatMoney(minor, currency, signed);
  }
}
