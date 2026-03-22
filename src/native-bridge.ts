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
    const asked = localStorage.getItem('notificationPermissionAsked');
    if (asked) return;
    try {
        localStorage.setItem('notificationPermissionAsked', 'true');
        await LinkagramNative.requestNotificationPermission();
    } catch (e) {
        console.warn('Failed to request notification permission:', e);
    }
}
