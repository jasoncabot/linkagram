import { registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface LinkagramNativePlugin {
    syncGameState(options: {
        streak: number;
        maxStreak: number;
        played: string[];
        completed: string[];
        hintCount: number;
        fixes: string[];
    }): Promise<{ status: string }>;

    updateWidgetData(options: {
        todayKey: string;
        letters: string[];
        status: string;
        wordsFound: number;
        wordsTotal: number;
    }): Promise<{ status: string }>;

    getCloudState(): Promise<{
        status?: string;
        streak?: number;
        maxStreak?: number;
        played?: string[];
        completed?: string[];
        hintCount?: number;
        fixes?: string[];
    }>;

    requestNotificationPermission(): Promise<{
        granted: boolean;
        error: string;
    }>;

    scheduleDailyReminder(): Promise<{ status: string }>;
    cancelDailyReminder(): Promise<{ status: string }>;

    scheduleStreakReminder(options: { streak: number }): Promise<{ status: string }>;
    cancelStreakReminder(): Promise<{ status: string }>;

    cacheDictionary(options: { words: string[] }): Promise<{ status: string }>;
}

const LinkagramNative = registerPlugin<LinkagramNativePlugin>('LinkagramNative');

export async function syncGameStateToNative(state: {
    streak: number;
    maxStreak: number;
    played: string[];
    completed: string[];
    hintCount: number;
    fixes: string[];
}) {
    if (!isNative()) return;
    try {
        await LinkagramNative.syncGameState(state);
    } catch (e) {
        console.warn('Failed to sync game state to native:', e);
    }
}

export async function updateWidgetData(data: {
    todayKey: string;
    letters: string[];
    status: string;
    wordsFound: number;
    wordsTotal: number;
}) {
    if (!isNative()) return;
    try {
        await LinkagramNative.updateWidgetData(data);
    } catch (e) {
        console.warn('Failed to update widget data:', e);
    }
}

export async function getCloudState(): Promise<{
    streak?: number;
    maxStreak?: number;
    played?: string[];
    completed?: string[];
    hintCount?: number;
    fixes?: string[];
} | null> {
    if (!isNative()) return null;
    try {
        const result = await LinkagramNative.getCloudState();
        if (result.status === 'no_update') return null;
        return result;
    } catch (e) {
        console.warn('Failed to get cloud state:', e);
        return null;
    }
}

export async function requestNotificationPermissionIfNeeded(streak: number) {
    if (!isNative()) return;
    // Only prompt after completing 2 games in a streak
    if (streak < 2) return;
    // Only ask once — check if we already asked
    const asked = localStorage.getItem('notificationPermissionAsked_v2');
    if (asked) return;
    try {
        const result = await LinkagramNative.requestNotificationPermission();
        // Only mark as asked after the native prompt actually resolved
        localStorage.setItem('notificationPermissionAsked_v2', 'true');
        return result.granted;
    } catch (e) {
        console.warn('Failed to request notification permission:', e);
    }
}

export async function scheduleStreakReminder(streak: number) {
    if (!isNative()) return;
    try {
        await LinkagramNative.scheduleStreakReminder({ streak });
    } catch (e) {
        console.warn('Failed to schedule streak reminder:', e);
    }
}

export async function cancelStreakReminder() {
    if (!isNative()) return;
    try {
        await LinkagramNative.cancelStreakReminder();
    } catch (e) {
        console.warn('Failed to cancel streak reminder:', e);
    }
}

export async function cacheDictionary(words: string[]) {
    if (!isNative()) return;
    try {
        await LinkagramNative.cacheDictionary({ words });
    } catch (e) {
        console.warn('Failed to cache dictionary:', e);
    }
}

const REMOTE_DICTIONARY_URL = 'https://linkagram.jasoncabot.me/data/small.json';
const REMOTE_DICTIONARY_KEY = 'cachedRemoteDictionary';

/**
 * Returns the word list using stale-while-revalidate:
 *   1. Immediately returns a previously-fetched remote copy from localStorage (if any).
 *   2. Falls back to the provided bundled words if no cached copy exists.
 *   3. Fires a background fetch; on success, stores the result in localStorage
 *      (and updates the native App Group cache for the widget) so the next
 *      launch picks up the fresh list.
 */
export function loadDictionaryWithRevalidation(bundledWords: string[]): string[] {
    const stored = localStorage.getItem(REMOTE_DICTIONARY_KEY);
    const cachedWords: string[] | null = stored ? JSON.parse(stored) : null;

    // Background revalidation — intentionally not awaited
    (async () => {
        try {
            const response = await fetch(REMOTE_DICTIONARY_URL);
            if (!response.ok) return;
            const fresh: unknown = await response.json();
            if (!Array.isArray(fresh) || fresh.length === 0) return;
            localStorage.setItem(REMOTE_DICTIONARY_KEY, JSON.stringify(fresh));
            if (isNative()) {
                await cacheDictionary(fresh as string[]);
            }
        } catch (e) {
            console.warn('Failed to refresh dictionary from remote:', e);
        }
    })();

    return cachedWords ?? bundledWords;
}

