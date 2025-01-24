import { type PhasedDescription, decodeHtmlCharCodes } from "./misc";
import { convertToSeconds } from "./time";

export function phaseDescription(content: string, usingYoutubeJs: boolean = false): PhasedDescription {
  const timestamps: { title: string; time: number; timePretty: string; }[] = [];
  const lines = content.split('\n');

  // Regular expressions for different timestamp formats
  const urlRegex = /<a href="([^"]+)"/;
  const timestampRegexInvidious = /<a href="([^"]+)" data-onclick="jump_to_time" data-jump-time="(\d+)">(\d+:\d+(?::\d+)?)<\/a>\s*(.+)/;
  const timestampRegexYtJs = /&(?:\S*?&)?t=(\d+)\s*s.*?<span[^>]*>([^<]*)<\/span>.*?>(.*?)<\/span>/;

  let filteredLines: string[] = [];
  lines.forEach((line) => {
    const urlMatch = urlRegex.exec(line);
    // Use appropriate regex based on the `usingYoutubeJs` flag
    const timestampMatch = (usingYoutubeJs ? timestampRegexYtJs : timestampRegexInvidious).exec(usingYoutubeJs ? line + '</span>' : line);

    if (urlMatch !== null && timestampMatch === null) {
      // If line contains a URL but not a timestamp, modify the URL
      const modifiedLine = line.replace(
        /<a href="([^"]+)"/,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="link"'
      );
      filteredLines.push(modifiedLine);
    } else if (timestampMatch !== null) {
      // If line contains a timestamp, extract details and push into timestamps array
      const time = usingYoutubeJs ? timestampMatch[1] : timestampMatch[2];
      const timestamp = usingYoutubeJs ? timestampMatch[2] : timestampMatch[3];
      const title = usingYoutubeJs ? timestampMatch[3] || '' : timestampMatch[4] || '';
      timestamps.push({
        time: convertToSeconds(time),
        // Remove any HTML in the timestamp title.
        title: decodeHtmlCharCodes(title.replace(/<[^>]+>/g, '').replace(/\n/g, '').trim()),
        timePretty: timestamp
      });
    } else {
      filteredLines.push(line);
    }
  });

  const filteredContent = filteredLines.join('\n');

  return { description: filteredContent, timestamps: timestamps };
}