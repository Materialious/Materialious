import humanNumber from 'human-number';

export function numberWithCommas(number: number) {
	if (typeof number === 'undefined') return;
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function cleanNumber(number: number): string {
	return humanNumber(number, (number: number) =>
		Number.parseFloat(number.toString()).toFixed(1)
	).replace('.0', '');
}

export function videoLength(lengthSeconds: number): string {
	const hours = Math.floor(lengthSeconds / 3600);
	let minutes: number | string = Math.floor((lengthSeconds % 3600) / 60);
	let seconds: number | string = Math.round(lengthSeconds % 60);

	if (minutes < 10) {
		minutes = `0${minutes}`;
	}

	if (seconds < 10) {
		seconds = `0${seconds}`;
	}

	if (hours !== 0) {
		return `${hours}:${minutes}:${seconds}`;
	} else {
		return `${minutes}:${seconds}`;
	}
}
