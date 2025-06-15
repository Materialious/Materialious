import shaka from 'shaka-player/dist/shaka-player.ui';

export class EndTimeElement extends shaka.ui.Element {
	public video: HTMLMediaElement;
	protected button: HTMLButtonElement;

	constructor(parent: HTMLElement, controls: shaka.ui.Controls) {
		super(parent, controls);

		this.video = (this.player as shaka.Player).getMediaElement() as HTMLMediaElement;
		this.button = document.createElement('button');
		this.button.classList.add('shaka-current-time');
		this.button.disabled = true;
		(this.parent as HTMLElement).appendChild(this.button);

		this.updateTime = this.updateTime.bind(this);
		(this.eventManager as shaka.util.EventManager).listen(
			this.video,
			'timeupdate',
			this.updateTime
		);
	}

	private updateTime(): void {
		const duration = this.video.duration;
		const currentTime = this.video.currentTime;

		if (isNaN(duration) || isNaN(currentTime)) return;

		const remainingTime: number = duration - currentTime;
		const end: Date = new Date(Date.now() + remainingTime * 1000);

		const formatted: string = end.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});

		this.button.textContent = `Ends at ${formatted}`;
	}
}
