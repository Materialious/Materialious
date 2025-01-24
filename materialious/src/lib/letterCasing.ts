import { get } from "svelte/store";
import { interfaceForceCase } from "./store";

export type TitleCase = 'uppercase' | 'lowercase' | 'sentence case' | 'title case' | null;
export const titleCases: TitleCase[] = [
  'lowercase',
  'uppercase',
  'title case',
  'sentence case'
];

export function letterCase(text: string, caseTypeOverwrite?: TitleCase): string {
  const casing = caseTypeOverwrite ? caseTypeOverwrite : get(interfaceForceCase);
  if (!casing) return text;

  switch (casing) {
    case 'lowercase':
      return text.toLowerCase();
    case 'uppercase':
      return text.toUpperCase();
    case 'sentence case':
      return sentenceCase(text);
    default:
      return titleCase(text);
  }
}

export function sentenceCase(text: string): string {
  let sentences: string[] = text.match(/[^.!?]*[.!?]*/g) || [];

  let casedSentences: string[] = sentences.map(sentence => {
    sentence = sentence.trim();
    if (sentence.length === 0) return '';
    return sentence.charAt(0).toUpperCase() + sentence.slice(1).toLowerCase();
  });

  return casedSentences.join(' ');
}

export function titleCase(text: string): string {
  if (!text) return '';

  let words: string[] = text.split(/(\s+)/).filter(word => word.trim().length > 0);

  let titleCasedWords: string[] = words.map(word => {
    if (word.length === 0) return '';

    const firstChar = word.charAt(0);
    const restOfWord = word.slice(1).toLowerCase();

    // Capitalize if the first character is a letter
    if (/[a-zA-Z]/.test(firstChar)) {
      return firstChar.toUpperCase() + restOfWord;
    }

    return word;
  });

  return titleCasedWords.join(' ');
}

