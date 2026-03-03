import { z } from 'zod';
import type { FeedItem } from './feed';
import isSafeRegex from 'safe-regex2';
import { filterContentListStore } from './store';
import { get } from 'svelte/store';

const zFilterOperatorEnum = z.enum([
	'equals', // equal to
	'in', // in a set of values
	'like', // contains (string matching)
	'gt', // greater than
	'lt', // less than
	'regex' // regular expression matching
]);

// Filter condition schema
const zFilterCondition = z.object({
	field: z.string(), // Field to filter
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
const zFilterGroup = z.object({
	conditions: z.array(zFilterCondition), // A list of conditions to apply
	operator: z.enum(['AND', 'OR']).optional() // Logical grouping of conditions
});

export const zFilterSchema = z.array(zFilterGroup);

const zFilterRootSchema = z.object({
	version: z.literal('v1'),
	for: z.literal('materialious'),
	filterBy: zFilterSchema
});

export function isItemFiltered(item: FeedItem): boolean {
	const filteredContent = get(filterContentListStore);
	if (!filteredContent) return false;

	return filteredContent.every((filterGroup) => {
		return filterGroup.conditions.every((condition) => {
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
						fieldValue.includes(condition.value)
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
		});
	});
}

export async function loadContentFilterFromURL(url: string) {
	const resp = await fetch(url, { method: 'GET', credentials: 'omit' });
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

	filterContentListStore.set(parsedFilterList.data.filterBy);
}
