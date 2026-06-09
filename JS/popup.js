const timerSettingsKey = "recarregaAiTimerSettings";
const themeStorageKey = "recarregaAiTheme";

const themeModes = {
  dark: "dark",
  light: "light"
};

const runtimeMessageTypes = {
  startTimer: "RECARREGA_AI_START_TIMER",
  stopTimer: "RECARREGA_AI_STOP_TIMER"
};

const popupElements = {
  customTimerInput: document.querySelector("#custom-timer-input"),
  extensionVersion: document.querySelector("#extension-version"),
  reloadPageButton: document.querySelector("#reload-page-button"),
  startTimerButton: document.querySelector("#start-timer-button"),
  statusPanel: document.querySelector(".popup__status"),
  statusMessage: document.querySelector("#status-message"),
  stopTimerButton: document.querySelector("#stop-timer-button"),
  themeToggleButton: document.querySelector("#theme-toggle-button"),
  themeToggleLabel: document.querySelector("#theme-toggle-label"),
  timerIntervalInputs: document.querySelectorAll("[name='timer-interval']")
};

const unsupportedPageMessage = "Essa pagina nao permite limpeza de cache pela extensao.";
const defaultReloadButtonText = "Limpar e recarregar";
const defaultStartTimerButtonText = "Ativar timer";
const presetTimerIntervals = [3, 5, 10];

const cacheDataTypes = {
  cache: true,
  cacheStorage: true,
  serviceWorkers: true
};

const updateStatusMessage = (message, status = "neutral") => {
  popupElements.statusMessage.textContent = message;
  popupElements.statusPanel.dataset.status = status;
};

const updateButtonState = (button, isLoading, loadingText, defaultText) => {
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
};

const loadExtensionVersion = () => {
  const manifest = chrome.runtime.getManifest();

  popupElements.extensionVersion.textContent = manifest.version_name
    || `V.${manifest.version}`;
};

const applyTheme = (theme) => {
  const nextTheme = theme === themeModes.light
    ? themeModes.light
    : themeModes.dark;
  const isDarkTheme = nextTheme === themeModes.dark;

  document.documentElement.dataset.theme = nextTheme;
  popupElements.themeToggleButton.setAttribute("aria-pressed", String(isDarkTheme));
  popupElements.themeToggleButton.title = isDarkTheme
    ? "Mudar para tema claro"
    : "Mudar para tema escuro";
  popupElements.themeToggleLabel.textContent = isDarkTheme ? "Claro" : "Escuro";
};

const loadTheme = async () => {
  const storedData = await chrome.storage.local.get(themeStorageKey);

  applyTheme(storedData[themeStorageKey] || themeModes.dark);
};

const toggleTheme = async () => {
  const currentTheme = document.documentElement.dataset.theme;
  const nextTheme = currentTheme === themeModes.dark
    ? themeModes.light
    : themeModes.dark;

  applyTheme(nextTheme);

  await chrome.storage.local.set({
    [themeStorageKey]: nextTheme
  });
};

const sendRuntimeMessage = (message) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage(message, (response) => {
    const runtimeError = chrome.runtime.lastError;

    if (runtimeError) {
      reject(new Error(runtimeError.message));
      return;
    }

    if (response?.ok === false) {
      reject(new Error(response.error));
      return;
    }

    resolve(response);
  });
});

const getActiveTab = async () => {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return activeTab;
};

const getUrlOrigin = (urlValue) => {
  try {
    const url = new URL(urlValue);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.origin;
  } catch (error) {
    console.error("URL invalida para limpeza de cache:", error);
    return null;
  }
};

const collectFrameOrigins = () => {
  const allowedProtocols = ["http:", "https:"];
  const origins = new Set();

  const addOriginFromUrl = (urlValue) => {
    if (!urlValue) {
      return;
    }

    try {
      const url = new URL(urlValue, window.location.href);

      if (allowedProtocols.includes(url.protocol)) {
        origins.add(url.origin);
      }
    } catch (error) {
      console.debug("URL ignorada pelo RecarregaAi:", error);
    }
  };

  addOriginFromUrl(window.location.href);

  performance.getEntries().forEach((entry) => {
    addOriginFromUrl(entry.name);
  });

  document.querySelectorAll("[href], [src]").forEach((element) => {
    addOriginFromUrl(element.href);
    addOriginFromUrl(element.src);
    addOriginFromUrl(element.currentSrc);
    addOriginFromUrl(element.getAttribute("href"));
    addOriginFromUrl(element.getAttribute("src"));
  });

  return Array.from(origins);
};

const collectLoadedOrigins = async (tabId, mainOrigin) => {
  const origins = new Set([mainOrigin]);

  try {
    const frameResults = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true
      },
      func: collectFrameOrigins
    });

    frameResults.forEach((frameResult) => {
      if (!Array.isArray(frameResult.result)) {
        return;
      }

      frameResult.result.forEach((origin) => {
        origins.add(origin);
      });
    });
  } catch (error) {
    console.warn("Nao foi possivel coletar todas as origens carregadas:", error);
  }

  return Array.from(origins);
};

const clearPageCache = async (origins) => {
  await chrome.browsingData.remove(
    {
      origins
    },
    cacheDataTypes
  );
};

const reloadCurrentPageIgnoringCache = async (tabId) => {
  await chrome.tabs.reload(tabId, {
    bypassCache: true
  });
};

const clearCacheAndReloadCurrentPage = async () => {
  try {
    updateButtonState(
      popupElements.reloadPageButton,
      true,
      "Limpando...",
      defaultReloadButtonText
    );
    updateStatusMessage("Coletando recursos carregados pela pagina...", "working");

    const activeTab = await getActiveTab();

    if (typeof activeTab?.id !== "number") {
      updateStatusMessage("Nao foi possivel encontrar a aba atual.", "error");
      return;
    }

    const origin = getUrlOrigin(activeTab.url);

    if (!origin) {
      updateStatusMessage(unsupportedPageMessage, "error");
      return;
    }

    const loadedOrigins = await collectLoadedOrigins(activeTab.id, origin);

    updateStatusMessage(
      `Limpando cache de ${loadedOrigins.length} origem(ns)...`,
      "working"
    );

    await clearPageCache(loadedOrigins);
    await reloadCurrentPageIgnoringCache(activeTab.id);

    updateStatusMessage("Cache limpo e pagina recarregada.", "success");
  } catch (error) {
    console.error("Erro ao limpar cache e recarregar:", error);
    updateStatusMessage("Nao foi possivel limpar o cache agora.", "error");
  } finally {
    updateButtonState(
      popupElements.reloadPageButton,
      false,
      "Limpando...",
      defaultReloadButtonText
    );
  }
};

const getSelectedTimerInterval = () => {
  const selectedTimerInput = document.querySelector("[name='timer-interval']:checked");

  if (selectedTimerInput?.value !== "custom") {
    return Number(selectedTimerInput.value);
  }

  const customInterval = Number(popupElements.customTimerInput.value);

  if (!Number.isFinite(customInterval) || customInterval < 1) {
    throw new Error("Informe um tempo personalizado de pelo menos 1 minuto.");
  }

  return Math.floor(customInterval);
};

const formatTimerInterval = (intervalInMinutes) => {
  if (intervalInMinutes === 1) {
    return "1 minuto";
  }

  return `${intervalInMinutes} minutos`;
};

const syncCustomTimerInputState = () => {
  const selectedTimerInput = document.querySelector("[name='timer-interval']:checked");
  const isCustomTimer = selectedTimerInput?.value === "custom";

  popupElements.customTimerInput.disabled = !isCustomTimer;

  if (isCustomTimer) {
    popupElements.customTimerInput.focus();
  }
};

const selectTimerInterval = (intervalInMinutes) => {
  const presetValue = presetTimerIntervals.includes(intervalInMinutes)
    ? String(intervalInMinutes)
    : "custom";

  const timerInput = document.querySelector(`[name='timer-interval'][value='${presetValue}']`);

  if (timerInput) {
    timerInput.checked = true;
  }

  if (presetValue === "custom") {
    popupElements.customTimerInput.value = intervalInMinutes;
  }

  syncCustomTimerInputState();
};

const loadTimerState = async () => {
  const storedData = await chrome.storage.local.get(timerSettingsKey);
  const timerSettings = storedData[timerSettingsKey];

  if (!timerSettings?.enabled) {
    return;
  }

  selectTimerInterval(timerSettings.intervalInMinutes);

  const activeTab = await getActiveTab();
  const timerIntervalText = formatTimerInterval(timerSettings.intervalInMinutes);

  if (activeTab?.id === timerSettings.tabId) {
    updateStatusMessage(
      `Timer ativo nesta guia: a cada ${timerIntervalText}.`,
      "active"
    );
    return;
  }

  updateStatusMessage(
    `Timer ativo em outra guia. Ativar aqui substitui a guia anterior.`,
    "warning"
  );
};

const startTimer = async () => {
  try {
    updateButtonState(
      popupElements.startTimerButton,
      true,
      "Ativando...",
      defaultStartTimerButtonText
    );
    updateStatusMessage("Preparando timer para a aba atual...", "working");

    const activeTab = await getActiveTab();

    if (typeof activeTab?.id !== "number") {
      updateStatusMessage("Nao foi possivel encontrar a aba atual.", "error");
      return;
    }

    const origin = getUrlOrigin(activeTab.url);

    if (!origin) {
      updateStatusMessage(unsupportedPageMessage, "error");
      return;
    }

    const intervalInMinutes = getSelectedTimerInterval();
    const loadedOrigins = await collectLoadedOrigins(activeTab.id, origin);

    await sendRuntimeMessage({
      type: runtimeMessageTypes.startTimer,
      payload: {
        intervalInMinutes,
        mainOrigin: origin,
        origins: loadedOrigins,
        tabId: activeTab.id,
        tabTitle: activeTab.title,
        tabUrl: activeTab.url,
        windowId: activeTab.windowId
      }
    });

    updateStatusMessage(
      `Timer ativo: a cada ${formatTimerInterval(intervalInMinutes)}.`,
      "active"
    );
  } catch (error) {
    console.error("Erro ao ativar timer:", error);
    updateStatusMessage(
      error.message || "Nao foi possivel ativar o timer agora.",
      "error"
    );
  } finally {
    updateButtonState(
      popupElements.startTimerButton,
      false,
      "Ativando...",
      defaultStartTimerButtonText
    );
  }
};

const stopTimer = async () => {
  try {
    await sendRuntimeMessage({
      type: runtimeMessageTypes.stopTimer
    });

    updateStatusMessage("Timer pausado.", "warning");
  } catch (error) {
    console.error("Erro ao parar timer:", error);
    updateStatusMessage("Nao foi possivel parar o timer agora.", "error");
  }
};

popupElements.reloadPageButton.addEventListener("click", clearCacheAndReloadCurrentPage);
popupElements.startTimerButton.addEventListener("click", startTimer);
popupElements.stopTimerButton.addEventListener("click", stopTimer);
popupElements.themeToggleButton.addEventListener("click", () => {
  toggleTheme().catch((error) => {
    console.error("Erro ao alternar tema:", error);
  });
});

popupElements.timerIntervalInputs.forEach((timerInput) => {
  timerInput.addEventListener("change", syncCustomTimerInputState);
});

syncCustomTimerInputState();
loadExtensionVersion();
loadTheme().catch((error) => {
  console.error("Erro ao carregar tema:", error);
});
loadTimerState().catch((error) => {
  console.error("Erro ao carregar estado do timer:", error);
});
