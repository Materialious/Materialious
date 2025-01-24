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