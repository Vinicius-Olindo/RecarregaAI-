// RecarregaAi! V.1.4.6

import {
  defaultAppSettings,
  normalizeTimerCollection,
  storageKeys
} from "./shared.js";

export const getTimerSettingsFromCollection = (timerCollection, tabId) => {
  if (typeof tabId !== "number") {
    return null;
  }

  return timerCollection.timers[String(tabId)] || null;
};

export const getAllTimerSettingsFromCollection = (timerCollection) => (
  Object.values(timerCollection.timers)
    .sort((firstTimer, secondTimer) => (
      String(firstTimer.tabTitle || firstTimer.mainOrigin)
        .localeCompare(String(secondTimer.tabTitle || secondTimer.mainOrigin))
    ))
);

export const getStoredTimerCollection = async () => {
  const storedData = await chrome.storage.local.get(storageKeys.timerSettings);

  return normalizeTimerCollection(storedData[storageKeys.timerSettings]);
};

export const saveTimerCollection = async (timerCollection) => {
  await chrome.storage.local.set({
    [storageKeys.timerSettings]: timerCollection
  });
};

export const getAllTimerSettings = async () => {
  const timerCollection = await getStoredTimerCollection();

  return getAllTimerSettingsFromCollection(timerCollection);
};

export const getTimerSettingsByTabId = async (tabId) => {
  const timerCollection = await getStoredTimerCollection();

  return getTimerSettingsFromCollection(timerCollection, tabId);
};

export const upsertTimerSettings = async (timerSettings) => {
  const timerCollection = await getStoredTimerCollection();

  timerCollection.timers[String(timerSettings.tabId)] = timerSettings;

  await saveTimerCollection(timerCollection);

  return timerCollection;
};

export const removeTimerSettingsByTabId = async (tabId) => {
  const timerCollection = await getStoredTimerCollection();

  delete timerCollection.timers[String(tabId)];
  await saveTimerCollection(timerCollection);

  return timerCollection;
};

export const updateTimerSettingsByTabId = async (tabId, updater) => {
  const timerCollection = await getStoredTimerCollection();
  const timerSettings = getTimerSettingsFromCollection(timerCollection, tabId);

  if (!timerSettings) {
    return null;
  }

  const updatedTimerSettings = updater(timerSettings);

  timerCollection.timers[String(tabId)] = updatedTimerSettings;
  await saveTimerCollection(timerCollection);

  return updatedTimerSettings;
};

export const getLastTimerRun = async () => {
  const storedData = await chrome.storage.local.get(storageKeys.lastTimerRun);

  return storedData[storageKeys.lastTimerRun];
};

export const saveLastTimerRun = async (result) => {
  await chrome.storage.local.set({
    [storageKeys.lastTimerRun]: result
  });
};

export const getAppSettings = async () => {
  const storedData = await chrome.storage.local.get(storageKeys.appSettings);
  const storedSettings = storedData[storageKeys.appSettings] || {};

  return {
    ...defaultAppSettings,
    ...storedSettings,
    autoStartSites: Array.isArray(storedSettings.autoStartSites)
      ? storedSettings.autoStartSites
      : []
  };
};
