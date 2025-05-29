export interface CacheEntry {
	data: Uint8Array<ArrayBuffer>;
	timestamp: number;
	size: number;
}

/**
 * A "proper" cache for storing segments.
 */
export class CacheManager {
	private initSegmentCache = new Map<string, CacheEntry>();
	private segmentCache = new Map<string, CacheEntry>();
	private currentSize = 0;
	private readonly maxCacheSize: number;
	private readonly maxAge: number;

	constructor(maxSizeMB = 100, maxAgeSeconds = 600) {
		this.maxCacheSize = maxSizeMB * 1024 * 1024;
		this.maxAge = maxAgeSeconds * 1000;
		this.startGarbageCollection();
	}

	public setInitSegment(key: string, data: Uint8Array<ArrayBuffer>): void {
		const entry: CacheEntry = {
			data,
			timestamp: Date.now(),
			size: data.byteLength
		};

		if (!this.initSegmentCache.has(key)) {
			this.currentSize += entry.size;
			this.enforceStorageLimit();
		}

		this.initSegmentCache.set(key, entry);
	}

	public setSegment(key: string, data: Uint8Array<ArrayBuffer>): void {
		const entry: CacheEntry = {
			data,
			timestamp: Date.now(),
			size: data.byteLength
		};

		this.currentSize += entry.size;
		this.enforceStorageLimit();
		this.segmentCache.set(key, entry);
	}

	public getInitSegment(key: string): Uint8Array<ArrayBuffer> | undefined {
		const entry = this.initSegmentCache.get(key);

		if (entry && !this.isExpired(entry)) {
			entry.timestamp = Date.now(); // Update last access time
			return entry.data;
		}

		// Expired. Get rid of it.
		if (entry) {
			this.initSegmentCache.delete(key);
			this.currentSize -= entry.size;
		}

		return undefined;
	}

	public getSegment(key: string): Uint8Array<ArrayBuffer> | undefined {
		const entry = this.segmentCache.get(key);
		if (entry && !this.isExpired(entry)) {
			const data = entry.data;
			this.segmentCache.delete(key);
			this.currentSize -= entry.size;
			return data;
		}

		// Expired. Get rid of it.
		if (entry) {
			this.segmentCache.delete(key);
			this.currentSize -= entry.size;
		}

		return undefined;
	}

	private isExpired(entry: CacheEntry): boolean {
		return Date.now() - entry.timestamp > this.maxAge;
	}

	private enforceStorageLimit(): void {
		if (this.currentSize <= this.maxCacheSize) return;

		this.clearExpiredEntries();

		// If still over limit, remove oldest entries
		if (this.currentSize > this.maxCacheSize) {
			this.removeOldestEntries();
		}
	}

	private clearExpiredEntries(): void {
		const now = Date.now();

		for (const [key, entry] of this.segmentCache.entries()) {
			if (now - entry.timestamp > this.maxAge) {
				this.segmentCache.delete(key);
				this.currentSize -= entry.size;
			}
		}

		for (const [key, entry] of this.initSegmentCache.entries()) {
			if (now - entry.timestamp > this.maxAge) {
				this.initSegmentCache.delete(key);
				this.currentSize -= entry.size;
			}
		}
	}

	private removeOldestEntries(): void {
		const segments = Array.from(this.segmentCache.entries());
		const initSegments = Array.from(this.initSegmentCache.entries());

		const allEntries = [...segments, ...initSegments].sort(
			(a, b) => a[1].timestamp - b[1].timestamp
		);

		// Remove oldest entries until under limit
		while (this.currentSize > this.maxCacheSize && allEntries.length > 0) {
			const [key, entry] = allEntries.shift()!;
			this.segmentCache.delete(key);
			this.initSegmentCache.delete(key);
			this.currentSize -= entry.size;
		}
	}

	private startGarbageCollection(): void {
		// Should there be a way to stop this? :p
		setInterval(() => {
			this.clearExpiredEntries();
		}, 60000);
	}

	public clearCache(): void {
		this.initSegmentCache.clear();
		this.segmentCache.clear();
		this.currentSize = 0;
	}
}
