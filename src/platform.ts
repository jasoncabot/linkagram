import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

export const apiUrl = (path: string) =>
  isNative() ? `https://linkagram.jasoncabot.me${path}` : path;
