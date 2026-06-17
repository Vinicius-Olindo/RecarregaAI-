// RecarregaAi! 1.7.2

import { cacheDataTypes } from "./shared.js";

export const clearCacheForOrigins = async (origins) => {
  await chrome.browsingData.remove(
    {
      origins
    },
    cacheDataTypes
  );
};

export const reloadTabIgnoringCache = async (tabId) => {
  await chrome.tabs.reload(tabId, {
    bypassCache: true
  });
};
