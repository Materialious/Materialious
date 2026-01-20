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
	const isSameMonth = now.isSame(timestamp, 'month');
	const isThisYear = now.isSame(timestamp, 'year');

	const diffMilliseconds = timestamp.diff(now);
	const diffDuration = dayjs.duration(diffMilliseconds);

	if (isSameDay) {
		return diffDuration.humanize(true);
	} else if (isSameMonth) {
		return timestamp.format('Do @ h:mm A');
	} else if (isThisYear) {
		return timestamp.format('MMMM Do @ h:mm A');
	} else {
		return timestamp.format('MMMM Do YYYY h:mm A');
	}
}
