import { z } from 'zod';
import type { FeedItem } from '$lib/feed';
import isSafeRegex from 'safe-regex2';
import { filterContentListStore } from '$lib/store';
import { get } from 'svelte/store';
import { originalFetch } from '$lib/fetchProxy';
import { ChannelSchema, VideoSchema } from './schemas';

export const zFilterOperatorEnum = z.enum([
	'equals', // equal to
	'in', // in a set of values
	'like', // contains (string matching)
	'gt', // greater than
	'lt', // less than
	'regex' // regular expression matching
]);

const allowedFields = new Set([...Object.keys(VideoSchema), ...Object.keys(ChannelSchema)]);

// Filter condition schema
const zFilterCondition = z.object({
	field: z.string().refine((val) => allowedFields.has(val), {
		message: 'Invalid field'
	}), // Field to filter
	operator: zFilterOperatorEnum, // Operator
	value: z.union([
		// Value to compare against
		z.string(),
		z.number(),
		z.array(z.string()),
		z.array(z.number()),
		z.string().regex(/.*/)
	])
});

// Logical grouping operator
export const zFilterGroup = z.object({
	conditions: z.array(zFilterCondition), // A list of conditions to apply
	type: z.union([z.literal('video'), z.literal('channel')]) // Type of content
});

export const zFilterSchema = z.array(zFilterGroup);

const zFilterRootSchema = z.object({
	version: z.literal('v1'),
	createdFor: z.literal('materialious'),
	filterBy: zFilterSchema
});

export function isItemFiltered(item: FeedItem): boolean {
	const filteredContent = get(filterContentListStore);
	if (!filteredContent) return false;

	return filteredContent.some((filterGroup) => {
		if (filterGroup.type !== item.type) {
			// Video is an alias for shortVideo & stream
			if (filterGroup.type !== 'video' || (item.type !== 'shortVideo' && item.type !== 'stream')) {
				return false;
			}
		}

		if (filterGroup.conditions.length === 0) return false;

		const evaluateCondition = (condition: (typeof filterGroup.conditions)[number]): boolean => {
			if (!(condition.field in item)) return false;

			const fieldValue = item[condition.field as keyof FeedItem];

			switch (condition.operator) {
				case 'equals':
					return fieldValue === condition.value;

				case 'in':
					return Array.isArray(condition.value) && (condition.value as any[]).includes(fieldValue);

				case 'like':
					return (
						typeof fieldValue === 'string' &&
						typeof condition.value === 'string' &&
						fieldValue.toLowerCase().includes(condition.value.toLowerCase())
					);

				case 'gt':
					return (
						typeof fieldValue === 'number' &&
						typeof condition.value === 'number' &&
						fieldValue > condition.value
					);

				case 'lt':
					return (
						typeof fieldValue === 'number' &&
						typeof condition.value === 'number' &&
						fieldValue < condition.value
					);

				case 'regex':
					if (typeof condition.value !== 'string' || !isSafeRegex(condition.value)) return false;

					return typeof fieldValue === 'string' && new RegExp(condition.value).test(fieldValue);

				default:
					return false;
			}
		};

		return filterGroup.conditions.every(evaluateCondition);
	});
}

export async function loadContentFilterFromURL(
	url: string
): Promise<z.infer<typeof zFilterSchema>> {
	const resp = await originalFetch(url, { method: 'GET', credentials: 'omit' });
	if (!resp.ok) throw new Error('Response status code');

	let respJson;
	try {
		respJson = await resp.json();
	} catch {
		// Handled outside of catch
	}

	if (!respJson) throw new Error('Invalid JSON');

	const parsedFilterList = zFilterRootSchema.safeParse(respJson);

	if (!parsedFilterList.success) throw new Error(parsedFilterList.error.message);

	return parsedFilterList.data.filterBy;
}
