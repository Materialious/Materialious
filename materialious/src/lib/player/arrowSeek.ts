const TAP_SEEK_SECONDS = 5;
const SCRUB_ENGAGE_AFTER_SECONDS = 0.2;
const SCRUB_BASE_VELOCITY = 10;
const SCRUB_MAX_VELOCITY = 120;
const SCRUB_RAMP_SECONDS = 3;
const SCRUB_FULL_TRAVERSE_SECONDS = 30;

export interface ArrowSeekHost {
	getPlayerElement(): HTMLMediaElement | undefined;
	getDuration(): number;
	getCurrentTime(): number;
	setCurrentTime(time: number): void;
	onSeek(time: number): void;
	onScrubFrame(time: number): Promise<void>;
	onScrubEnd(): void;
}

export interface ArrowSeek {
	start(direction: 1 | -1): void;
	stop(): void;
}

/** Arrow keys seek a fixed step on a tap, and ramp into a scrub when held. */
export function createArrowSeek(host: ArrowSeekHost): ArrowSeek {
	let direction: 1 | -1 = 1;
	let isHeld = false;
	let isScrubbing = false;
	let holdSeconds = 0;
	let lastFrameTimestamp: number | null = null;
	let playbackStateBeforeScrub: 'paused' | 'playing' | undefined;

	function clampToVideo(time: number): number {
		return Math.min(Math.max(time, 0), host.getDuration());
	}

	function scrubVelocityAt(secondsSpentScrubbing: number): number {
		const traverseVelocity = host.getDuration() / SCRUB_FULL_TRAVERSE_SECONDS;
		const maxVelocity = Math.min(
			Math.max(traverseVelocity, SCRUB_BASE_VELOCITY),
			SCRUB_MAX_VELOCITY
		);

		const rampRatio = Math.min(secondsSpentScrubbing / SCRUB_RAMP_SECONDS, 1);
		const rampFactor = rampRatio * rampRatio;

		return SCRUB_BASE_VELOCITY + (maxVelocity - SCRUB_BASE_VELOCITY) * rampFactor;
	}

	async function onFrame(frameTimestamp: number) {
		const media = host.getPlayerElement();
		if (!isHeld || !media) return;

		if (lastFrameTimestamp === null) lastFrameTimestamp = frameTimestamp;
		const frameSeconds = (frameTimestamp - lastFrameTimestamp) / 1000;

		lastFrameTimestamp = frameTimestamp;
		holdSeconds += frameSeconds;

		if (holdSeconds < SCRUB_ENGAGE_AFTER_SECONDS) {
			requestAnimationFrame(onFrame);
			return;
		}

		if (!isScrubbing) {
			isScrubbing = true;
			playbackStateBeforeScrub = media.paused ? 'paused' : 'playing';
		}

		media.pause();

		const velocity = scrubVelocityAt(holdSeconds - SCRUB_ENGAGE_AFTER_SECONDS);
		const scrubbedTo = clampToVideo(host.getCurrentTime() + velocity * frameSeconds * direction);

		host.setCurrentTime(scrubbedTo);
		await host.onScrubFrame(scrubbedTo);

		requestAnimationFrame(onFrame);
	}

	function start(seekDirection: 1 | -1) {
		const media = host.getPlayerElement();
		if (isHeld || !media) return;

		direction = seekDirection;
		holdSeconds = 0;
		lastFrameTimestamp = null;
		isHeld = true;
		isScrubbing = false;

		const seekedTo = clampToVideo(host.getCurrentTime() + TAP_SEEK_SECONDS * seekDirection);

		host.setCurrentTime(seekedTo);
		media.currentTime = seekedTo;
		host.onSeek(seekedTo);

		requestAnimationFrame(onFrame);
	}

	function stop() {
		const media = host.getPlayerElement();
		if (!isHeld || !media) return;

		isHeld = false;
		holdSeconds = 0;
		lastFrameTimestamp = null;

		if (isScrubbing) {
			media.currentTime = host.getCurrentTime();
			if (playbackStateBeforeScrub === 'playing') media.play();
		}

		isScrubbing = false;
		playbackStateBeforeScrub = undefined;

		host.onScrubEnd();
	}

	return { start, stop };
}
