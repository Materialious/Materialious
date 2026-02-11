import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(advancedFormat);

export function humanizeTimestamp(epochTime: number): string {
	return dayjs.utc(epochTime).local().format('hh:mm A DD/MM/YYYY');
}

export function relativeTimestamp(epochTime: number): string {
	const now = dayjs();
	const timestamp = dayjs.utc(epochTime).local();

	const isSameDay = now.isSame(timestamp, 'day');
	const isSameWeek = now.isSame(timestamp, 'week');
	const isSameMonth = now.isSame(timestamp, 'month');
	const isThisYear = now.isSame(timestamp, 'year');

	const diffMilliseconds = timestamp.diff(now);
	const diffDuration = dayjs.duration(diffMilliseconds);

	if (isSameDay || isSameWeek) {
		return diffDuration.humanize(true);
	} else if (isSameMonth) {
		return timestamp.format('Do @ h:mm A');
	} else if (isThisYear) {
		return timestamp.format('MMMM Do @ h:mm A');
	} else {
		return timestamp.format('MMMM Do YYYY h:mm A');
	}
}

export function padTime(time: string): string {
	let timeParts = time.split(':');

	if (timeParts.length < 3) {
		timeParts = ('00:' + time).split(':');
	}

	const hours = (timeParts[0] || '0').padStart(2, '0');
	const minutes = (timeParts[1] || '0').padStart(2, '0');

	let seconds = timeParts[2] || '0';
	let milliseconds = '';

	if (seconds.includes('.')) {
		const [sec, ms] = seconds.split('.');
		seconds = sec.padStart(2, '0');
		milliseconds = `.${ms.padStart(3, '0')}`;
	} else {
		seconds = seconds.padStart(2, '0');
	}

	return `${hours}:${minutes}:${seconds}${milliseconds}`;
}

export function convertToSeconds(time: string): number {
	const parts = time.split(':').map((part) => parseInt(part));
	let seconds = 0;
	if (parts.length === 3) {
		// hh:mm:ss
		seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
	} else if (parts.length === 2) {
		// hh:ss or m:ss
		seconds = parts[0] * 60 + parts[1];
	} else if (parts.length === 1) {
		// s
		seconds = parts[0];
	}
	return seconds;
}

export function humanizeSeconds(totalSeconds: number): string {
	const secondsInMinute = 60;
	const secondsInHour = 3600;

	const hours = Math.floor(totalSeconds / secondsInHour);
	const minutes = Math.floor((totalSeconds % secondsInHour) / secondsInMinute);

	const parts: string[] = [];

	if (hours > 0) {
		parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
	}
	if (minutes > 0) {
		parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
	}

	return parts.join(', ');
}
