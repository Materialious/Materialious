interface MediaQuality {
  bandwidth: string;
  videoUrl: string;
  audioUrl: string;
  resolution?: string;
  frameRate?: string;
  audioChannels?: string;
  audioBandwidth?: string;
}

// https://github.com/ffmpegwasm/ffmpeg.wasm/issues/603#issuecomment-1982289892
// Ripped from https://github.com/ffmpegwasm/ffmpeg.wasm/blob/ae1cdac7db79c5315f9a1b716fcbd9bcfe27c902/packages/util/src/index.ts#L49
export async function fetchFile(
  file: string,
  onProgress?: (progress: number) => void
): Promise<Uint8Array> {
  const response = await fetch(file);

  const contentLength = response.headers.get('content-length');

  // If content-length is missing, download without progress tracking
  if (!contentLength) {
    const data = await response.arrayBuffer();
    return new Uint8Array(data);
  }

  const totalBytes = parseInt(contentLength, 10);
  const data = new Uint8Array(totalBytes);
  let position = 0;
  let downloadBytes = 0;

  const reader = response.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    data.set(value, position);
    position += value.length;
    downloadBytes += value.byteLength;

    if (onProgress) {
      onProgress((downloadBytes / totalBytes) * 100);
    }
  }

  return data;
}

export async function toBlobURL(
  url: string,
  mimeType: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  return URL.createObjectURL(new Blob([await fetchFile(url, onProgress)], { type: mimeType }));
}


// Fetch and parse the DASH manifest
async function fetchDASHManifest(manifestUrl: string) {
  const response = await fetch(manifestUrl);
  const manifestText = await response.text();
  const parser = new DOMParser();
  const manifest = parser.parseFromString(manifestText, "text/xml");
  return manifest;
}


export async function listCombinedQualities(manifestUrl: string): Promise<MediaQuality[]> {
  const manifest = await fetchDASHManifest(`${manifestUrl}?local=true`);
  const qualities: MediaQuality[] = [];

  // Fetch all AdaptationSets (both video and audio)
  const adaptationSets = manifest.getElementsByTagName('AdaptationSet');

  let videoRepresentations: Element[] = [];
  let audioRepresentations: Element[] = [];

  // Separate video and audio AdaptationSets based on mimeType
  for (let i = 0; i < adaptationSets.length; i++) {
    const mimeType = adaptationSets[i].getAttribute('mimeType');
    const representations = adaptationSets[i].getElementsByTagName('Representation');

    if (mimeType && mimeType === 'video/mp4') {
      videoRepresentations = [...videoRepresentations, ...Array.from(representations)];
    } else if (mimeType && mimeType === 'audio/mp4') {
      audioRepresentations = [...audioRepresentations, ...Array.from(representations)];
    }
  }

  // Combine video and audio representations
  videoRepresentations.forEach((videoRep) => {
    const videoBandwidth = videoRep.getAttribute('bandwidth');
    const videoUrl = videoRep.getElementsByTagName('BaseURL')[0].textContent as string;
    const width = videoRep.getAttribute('width');
    const height = videoRep.getAttribute('height');
    const resolution = width && height ? `${width}x${height}` : undefined;
    const frameRate = videoRep.getAttribute('frameRate') || '';

    // Pair this video representation with each audio representation
    audioRepresentations.forEach((audioRep) => {
      const audioUrl = audioRep.getElementsByTagName('BaseURL')[0].textContent as string;
      const audioChannels = audioRep.getElementsByTagName('AudioChannelConfiguration')[0]?.getAttribute('value') || '';
      const audioBandwidth = audioRep.getAttribute('bandwidth') || '';

      qualities.push({
        bandwidth: videoBandwidth || '',
        videoUrl,
        audioUrl,
        resolution,
        frameRate,
        audioChannels,
        audioBandwidth
      });
    });
  });

  return qualities;
}


export async function mergeMediaFromDASH(
  selectedQuality: MediaQuality,
  fileName: string,
  progressCallbacks?: {
    video?: (progress: number) => void,
    audio?: (progress: number) => void,
    merging?: (progress: number) => void,
    loadingFfmpeg?: (completed: boolean) => void;
    classWorker?: (progress: number) => void,
    core?: (progress: number) => void;
    wasm?: (progress: number) => void;
    worker?: (progress: number) => void;
  }
) {
  if (progressCallbacks?.loadingFfmpeg) {
    progressCallbacks.loadingFfmpeg(false);
  }

  const FFmpeg = await import('@ffmpeg/ffmpeg');

  const ffmpeg = new FFmpeg.FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    if (progressCallbacks?.merging) {
      progressCallbacks.merging(progress * 100);
    }
  });

  await ffmpeg.load({
    classWorkerURL: await toBlobURL('/ffmpeg/ffmpeg-worker.js', 'text/javascript', progressCallbacks?.classWorker),
    coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript', progressCallbacks?.core),
    wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm', progressCallbacks?.wasm),
    workerURL: await toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript', progressCallbacks?.worker)
  });

  if (progressCallbacks?.loadingFfmpeg) {
    progressCallbacks.loadingFfmpeg(true);
  }

  const { videoUrl, audioUrl } = selectedQuality;

  ffmpeg.writeFile('input.mp4', await fetchFile(videoUrl, progressCallbacks?.video));
  ffmpeg.writeFile('input.mp3', await fetchFile(audioUrl, progressCallbacks?.audio));

  await ffmpeg.exec(['-i', 'input.mp4', '-i', 'input.mp3', '-c:v', 'copy', '-c:a', 'aac', 'output.mp4']);

  const data = await ffmpeg.readFile('output.mp4');
  const mergedFile = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(mergedFile);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName} - ${selectedQuality.resolution}.mp4`;
  document.body.appendChild(a);
  a.click();

  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
