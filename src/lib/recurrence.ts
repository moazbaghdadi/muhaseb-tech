import type { RecurringRule, Transaction } from '../types';
import { parseDate } from './format';

// All recurrence math is string-based on ISO YYYY-MM-DD dates. Because the
// format is fixed-width, lexicographic string comparison equals chronological
// comparison — so we compare dates as strings and never juggle Date objects
// across timezones.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoOf(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function daysInMonth(year: number, month0: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(year, month0 + 1, 0).getDate();
}

/** The ISO date one day before `iso`. Used as an exclusive lower watermark. */
export function prevDayIso(iso: string): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Defensive iteration cap (100 years of months) so a bad watermark can never
// spin forever.
const MAX_MONTHS = 1200;

/**
 * Monthly occurrence dates on `dayOfMonth` (clamped to each month's length, so
 * day 31 lands on Feb 28/29) that fall strictly after `fromExclusive` and on or
 * before `toInclusive`. Returns ISO date strings in ascending order.
 */
export function monthlyOccurrences(
  dayOfMonth: number,
  fromExclusive: string,
  toInclusive: string,
): string[] {
  const out: string[] = [];
  if (toInclusive <= fromExclusive) return out;
  const start = parseDate(fromExclusive);
  let y = start.getFullYear();
  let m = start.getMonth();
  for (let i = 0; i < MAX_MONTHS; i++) {
    const iso = isoOf(y, m, Math.min(dayOfMonth, daysInMonth(y, m)));
    if (iso > toInclusive) break;
    if (iso > fromExclusive) out.push(iso);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/** First monthly occurrence on `dayOfMonth` that is on or after `onOrAfter`. */
export function nextOccurrence(dayOfMonth: number, onOrAfter: string): string {
  const d = parseDate(onOrAfter);
  let y = d.getFullYear();
  let m = d.getMonth();
  for (let i = 0; i < MAX_MONTHS; i++) {
    const iso = isoOf(y, m, Math.min(dayOfMonth, daysInMonth(y, m)));
    if (iso >= onOrAfter) return iso;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return onOrAfter;
}

export type PendingOccurrence = { rule: RecurringRule; date: string };

/**
 * Every occurrence across all rules that is due but not yet materialized — i.e.
 * occurrences in `(rule.lastMaterialized, today]`. Pure; the caller assigns ids.
 */
export function pendingOccurrences(
  rules: RecurringRule[],
  today: string,
): PendingOccurrence[] {
  const out: PendingOccurrence[] = [];
  for (const rule of rules) {
    for (const date of monthlyOccurrences(rule.dayOfMonth, rule.lastMaterialized, today)) {
      out.push({ rule, date });
    }
  }
  return out;
}

/** Build the transaction a rule generates for a given occurrence date. */
export function occurrenceToTx(rule: RecurringRule, date: string, id: string): Transaction {
  return {
    id,
    date,
    type: rule.type,
    category: rule.category,
    description: rule.description,
    amount: rule.amount,
    attachments: [],
    bucket: rule.bucket,
    ...(rule.type === 'transfer' && rule.toBucket ? { toBucket: rule.toBucket } : {}),
    recurringId: rule.id,
  };
}
