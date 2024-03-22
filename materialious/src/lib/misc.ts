import humanNumber from "human-number";

export function truncate(value: string, maxLength: number = 50): string {
  return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}

export function numberWithCommas(number: number) {
  if (typeof number === "undefined") return;
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function cleanNumber(number: number): string {
  return humanNumber(number, (number: number) => Number.parseFloat(number.toString()).toFixed(1));
}

export function phaseDescription(content: string): {
  description: string, timestamps: { title: string; time: number; timePretty: string; }[];
} {
  const timestamps: { title: string; time: number; timePretty: string; }[] = [];
  const lines = content.split('\n');

  const regex = /(\d+:\d+(?::\d+)?)(?:\s(.+))?/;
  const filteredLines = lines.filter(line => {
    const match = regex.exec(line);

    if (match !== null) {
      const timestamp = match[1];
      const title = match[2] || '';
      timestamps.push({
        time: convertToSeconds(timestamp),
        title: title,
        timePretty: timestamp
      });
      return false;
    }

    return true;
  });

  const filteredContent = filteredLines.join('\n');

  return { description: filteredContent, timestamps: timestamps };
}

function convertToSeconds(time: string): number {
  const parts = time.split(':').map(part => parseInt(part));
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