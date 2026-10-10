// World-class attendance system - smart scheduling, auto-marking, live integration
// Timezone: Africa/Lagos (WAT, UTC+1)
// Classes: Mon/Wed/Fri 21:00-23:59 (9PM-12AM)
// Assignments: Tue/Thu/Sat 00:00-23:59
// Mindset Shift: 1st and 3rd Sundays, event 19:00-23:00, attendance 22:00-23:00
// Hangout: Last Sunday of month, same times

export type AttendanceType = 'class' | 'assignment' | 'mindset' | 'hangout';

export interface AttendanceWindow {
  type: AttendanceType;
  isOpen: boolean;
  reason: string;
  nextOpen?: Date;
  schedule: string;
  canOverride: boolean;
}

const LAGOS_OFFSET_MINUTES = 60;

export function getLagosNow(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + LAGOS_OFFSET_MINUTES * 60000);
}

function getDayInLagos(date: Date = getLagosNow()): number { return date.getDay(); }
function getHoursInLagos(date: Date = getLagosNow()): number { return date.getHours(); }
function getMinutesInLagos(date: Date = getLagosNow()): number { return date.getMinutes(); }

function isTimeBetween(date: Date, startHour: number, startMin: number, endHour: number, endMin: number): boolean {
  const h = date.getHours();
  const m = date.getMinutes();
  const current = h * 60 + m;
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

export function getFirstAndThirdSundays(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) sundays.push(date);
  }
  const result: Date[] = [];
  if (sundays[0]) result.push(sundays[0]);
  if (sundays[2]) result.push(sundays[2]);
  return result;
}

export function getLastSunday(year: number, month: number): Date | null {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = daysInMonth; d >= 1; d--) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) return date;
  }
  return null;
}

export function isMindsetSunday(date: Date = getLagosNow()): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const firstThird = getFirstAndThirdSundays(year, month);
  return firstThird.some(s => s.getDate() === day);
}

export function isHangoutSunday(date: Date = getLagosNow()): boolean {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const last = getLastSunday(year, month);
  return last ? last.getDate() === day : false;
}

export function getAttendanceStatus(type: AttendanceType, overrideOpen?: Record<string, boolean | null>, now: Date = getLagosNow()): AttendanceWindow {
  const day = now.getDay();
  const override = overrideOpen?.[type];
  if (override === true) {
    return { type, isOpen: true, reason: `Admin override: Open for ${type}`, schedule: getScheduleText(type), canOverride: true };
  }
  if (override === false) {
    return { type, isOpen: false, reason: `Admin override: Closed for ${type}`, schedule: getScheduleText(type), canOverride: true };
  }

  switch (type) {
    case 'class': {
      const isClassDay = day === 1 || day === 3 || day === 5;
      const inWindow = isTimeBetween(now, 21, 0, 23, 59);
      if (isClassDay && inWindow) {
        return { type, isOpen: true, reason: 'Class attendance is open — Monday, Wednesday, Friday 9PM-12AM WAT', schedule: 'Mon, Wed, Fri 9PM-12AM', canOverride: true };
      }
      const next = getNextClassWindow(now);
      return { type, isOpen: false, reason: isClassDay ? 'Class window closed for today (open 9PM-12AM)' : 'Class only on Mon, Wed, Fri 9PM-12AM WAT', nextOpen: next, schedule: 'Mon, Wed, Fri 9PM-12AM', canOverride: true };
    }
    case 'assignment': {
      const isAssignmentDay = day === 2 || day === 4 || day === 6;
      if (isAssignmentDay) {
        return { type, isOpen: true, reason: 'Assignment attendance is open — all day Tuesday, Thursday, Saturday', schedule: 'Tue, Thu, Sat 12AM-11:59PM', canOverride: true };
      }
      const next = getNextAssignmentWindow(now);
      return { type, isOpen: false, reason: 'Assignment only on Tue, Thu, Sat', nextOpen: next, schedule: 'Tue, Thu, Sat 12AM-11:59PM', canOverride: true };
    }
    case 'mindset': {
      const isMindsetDay = isMindsetSunday(now);
      const inEvent = isTimeBetween(now, 19, 0, 23, 0);
      const inAttendanceWindow = isTimeBetween(now, 22, 0, 23, 0);
      if (isMindsetDay && inAttendanceWindow) {
        return { type, isOpen: true, reason: 'Mindset Shift attendance is LIVE — auto-marked via live stream (10PM-11PM)', schedule: '1st & 3rd Sundays 7PM-11PM, attendance 10PM-11PM', canOverride: true };
      }
      if (isMindsetDay && inEvent) {
        return { type, isOpen: false, reason: 'Mindset Shift event is live (7PM-11PM) — attendance opens at 10PM', schedule: '1st & 3rd Sundays 7PM-11PM, attendance 10PM-11PM', canOverride: true };
      }
      const next = getNextMindsetSunday(now);
      return { type, isOpen: false, reason: isMindsetDay ? 'Mindset Shift attendance closed (open 10PM-11PM)' : 'Mindset Shift only on 1st & 3rd Sundays', nextOpen: next, schedule: '1st & 3rd Sundays 7PM-11PM, attendance 10PM-11PM', canOverride: true };
    }
    case 'hangout': {
      const isHangoutDay = isHangoutSunday(now);
      const inEvent = isTimeBetween(now, 19, 0, 23, 0);
      const inAttendanceWindow = isTimeBetween(now, 22, 0, 23, 0);
      if (isHangoutDay && inAttendanceWindow) {
        return { type, isOpen: true, reason: 'Hangout attendance is LIVE — auto-marked via live stream (10PM-11PM)', schedule: 'Last Sunday 7PM-11PM, attendance 10PM-11PM', canOverride: true };
      }
      if (isHangoutDay && inEvent) {
        return { type, isOpen: false, reason: 'Hangout event is live (7PM-11PM) — attendance opens at 10PM', schedule: 'Last Sunday 7PM-11PM, attendance 10PM-11PM', canOverride: true };
      }
      const next = getNextHangoutSunday(now);
      return { type, isOpen: false, reason: isHangoutDay ? 'Hangout attendance closed (open 10PM-11PM)' : 'Hangout only on last Sunday of month', nextOpen: next, schedule: 'Last Sunday 7PM-11PM, attendance 10PM-11PM', canOverride: true };
    }
  }
}

function getScheduleText(type: AttendanceType): string {
  switch (type) {
    case 'class': return 'Mon, Wed, Fri 9PM-12AM WAT';
    case 'assignment': return 'Tue, Thu, Sat 12AM-11:59PM WAT';
    case 'mindset': return '1st & 3rd Sundays 7PM-11PM, attendance 10PM-11PM';
    case 'hangout': return 'Last Sunday 7PM-11PM, attendance 10PM-11PM';
  }
}

function getNextClassWindow(from: Date): Date {
  const d = new Date(from);
  for (let i = 0; i < 7; i++) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 1 || day === 3 || day === 5) { d.setHours(21, 0, 0, 0); return new Date(d); }
  }
  const next = new Date(from); next.setDate(next.getDate() + 1); next.setHours(21, 0, 0, 0); return next;
}

function getNextAssignmentWindow(from: Date): Date {
  const d = new Date(from);
  for (let i = 0; i < 7; i++) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 2 || day === 4 || day === 6) { d.setHours(0, 0, 0, 0); return new Date(d); }
  }
  const next = new Date(from); next.setDate(next.getDate() + 1); next.setHours(0, 0, 0, 0); return next;
}

function getNextMindsetSunday(from: Date): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  const candidates: Date[] = [];
  const firstThirdThisMonth = getFirstAndThirdSundays(year, month);
  for (const s of firstThirdThisMonth) {
    if (s.getDate() > from.getDate() || (s.getDate() === from.getDate() && from.getHours() < 23)) {
      const d = new Date(s); d.setHours(19, 0, 0, 0); candidates.push(d);
    }
  }
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const firstThirdNextMonth = getFirstAndThirdSundays(nextYear, nextMonth);
  for (const s of firstThirdNextMonth) { const d = new Date(s); d.setHours(19, 0, 0, 0); candidates.push(d); }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] || new Date(from.getTime() + 86400000 * 7);
}

function getNextHangoutSunday(from: Date): Date {
  const year = from.getFullYear();
  const month = from.getMonth();
  const lastThisMonth = getLastSunday(year, month);
  if (lastThisMonth && (lastThisMonth.getDate() > from.getDate() || (lastThisMonth.getDate() === from.getDate() && from.getHours() < 23))) {
    const d = new Date(lastThisMonth); d.setHours(19, 0, 0, 0); return d;
  }
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const lastNextMonth = getLastSunday(nextYear, nextMonth);
  if (lastNextMonth) { const d = new Date(lastNextMonth); d.setHours(19, 0, 0, 0); return d; }
  const d = new Date(from); d.setDate(d.getDate() + 7); d.setHours(19, 0, 0, 0); return d;
}

export function formatNextOpen(date?: Date): string {
  if (!date) return 'Soon';
  const now = getLagosNow();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `in ${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `in ${diffHours}h`;
  const diffMins = Math.floor((diffMs % 3600000) / 60000);
  return `in ${diffMins}m`;
}

export function shouldAutoMarkLiveAttendance(livePurpose: string, typeOrDate?: AttendanceType | Date, joinedAt: Date = getLagosNow()): boolean {
  if (typeof typeOrDate === 'string') {
    const t = typeOrDate as AttendanceType;
    const now = joinedAt;
    const lower = livePurpose.toLowerCase();
    if (t === 'mindset') {
      if (isMindsetSunday(now) && (isTimeBetween(now, 22, 0, 23, 0) || isTimeBetween(now, 19, 0, 23, 0))) return true;
      if (lower.includes('mindset') || lower.includes('shift')) return true;
      return false;
    }
    if (t === 'hangout') {
      if (isHangoutSunday(now) && (isTimeBetween(now, 22, 0, 23, 0) || isTimeBetween(now, 19, 0, 23, 0))) return true;
      if (lower.includes('hangout')) return true;
      return false;
    }
    return false;
  }
  const actualDate = (typeOrDate instanceof Date ? typeOrDate : getLagosNow()) as Date;
  const lower2 = livePurpose.toLowerCase();
  if (lower2.includes('mindset') || lower2.includes('shift')) {
    if (isMindsetSunday(actualDate) && (isTimeBetween(actualDate, 22, 0, 23, 0) || isTimeBetween(actualDate, 19, 0, 23, 0))) return true;
    return false;
  }
  if (lower2.includes('hangout')) {
    if (isHangoutSunday(actualDate) && (isTimeBetween(actualDate, 22, 0, 23, 0) || isTimeBetween(actualDate, 19, 0, 23, 0))) return true;
    return false;
  }
  return false;
}

export function shouldAutoMarkLiveAttendanceDetailed(livePurpose: string, joinedAt: Date = getLagosNow()): { shouldMark: boolean; type: AttendanceType | null; reason: string } {
  const lower = livePurpose.toLowerCase();
  const isMindset = lower.includes('mindset') || lower.includes('shift');
  const isHangout = lower.includes('hangout') || lower.includes('creator hangout');
  if (isMindset) {
    if (isMindsetSunday(joinedAt) && isTimeBetween(joinedAt, 22, 0, 23, 0)) return { shouldMark: true, type: 'mindset', reason: `Auto-marked: Joined Mindset Shift live "${livePurpose}" during attendance window` };
    if (isMindsetSunday(joinedAt) && isTimeBetween(joinedAt, 19, 0, 23, 0)) return { shouldMark: true, type: 'mindset', reason: `Auto-marked (early): Joined Mindset Shift live \"${livePurpose}\" during event` };
    return { shouldMark: false, type: null, reason: 'Not mindset Sunday attendance window' };
  }
  if (isHangout) {
    if (isHangoutSunday(joinedAt) && isTimeBetween(joinedAt, 22, 0, 23, 0)) return { shouldMark: true, type: 'hangout', reason: `Auto-marked: Joined Hangout live "${livePurpose}" during attendance window` };
    if (isHangoutSunday(joinedAt) && isTimeBetween(joinedAt, 19, 0, 23, 0)) return { shouldMark: true, type: 'hangout', reason: `Auto-marked (early): Joined Hangout live \"${livePurpose}\" during event` };
    return { shouldMark: false, type: null, reason: 'Not hangout Sunday attendance window' };
  }
  return { shouldMark: false, type: null, reason: 'Live purpose not mindset/hangout' };
}

export function getLagosTimeString(date: Date = getLagosNow()): string {
  return date.toLocaleString('en-NG', { timeZone: 'Africa/Lagos', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export const ATTENDANCE_SCHEDULES = {
  class: { days: [1,3,5], label: 'Mon, Wed, Fri', open: '21:00', close: '23:59', tz: 'WAT' },
  assignment: { days: [2,4,6], label: 'Tue, Thu, Sat', open: '00:00', close: '23:59', tz: 'WAT' },
  mindset: { days: '1st & 3rd Sunday', label: '1st & 3rd Sun', event: '19:00-23:00', attendance: '22:00-23:00', tz: 'WAT' },
  hangout: { days: 'Last Sunday', label: 'Last Sun', event: '19:00-23:00', attendance: '22:00-23:00', tz: 'WAT' },
};
