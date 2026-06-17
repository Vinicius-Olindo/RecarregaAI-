// RecarregaAi! 1.5.11

const defaultLanguage = "pt-BR";
const supportedLanguages = ["pt-BR", "en", "es"];

const getElement = (selector, root = document) => root.querySelector(selector);

const normalizeLanguage = (language) => (
  supportedLanguages.includes(language) ? language : defaultLanguage
);

export const initLanguageDialog = ({
  closeSelector = "#close-language-button",
  dialogSelector = "#language-dialog",
  optionSelector = "[data-language-option]",
  openSelector = "#open-language-button",
  storageKey,
  triggerFocusOnClose = true
} = {}) => {
  const dialog = getElement(dialogSelector);
  const openButton = getElement(openSelector);
  const closeButton = getElement(closeSelector);
  const optionButtons = [...document.querySelectorAll(optionSelector)];

  if (!dialog || !openButton || !closeButton || optionButtons.length === 0) {
    return;
  }

  const getStoredLanguage = () => {
    if (!storageKey) {
      return document.documentElement.lang;
    }

    return localStorage.getItem(storageKey) || document.documentElement.lang;
  };

  const applyLanguage = (language) => {
    const nextLanguage = normalizeLanguage(language);

    document.documentElement.lang = nextLanguage;

    optionButtons.forEach((button) => {
      const isSelected = button.dataset.languageOption === nextLanguage;

      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    if (storageKey) {
      localStorage.setItem(storageKey, nextLanguage);
    }
  };

  const openDialog = () => {
    dialog.hidden = false;
    document.body.classList.add("has-open-dialog");

    const selectedButton = optionButtons.find((button) => (
      button.dataset.languageOption === document.documentElement.lang
    ));

    (selectedButton || closeButton).focus();
  };

  const closeDialog = () => {
    dialog.hidden = true;
    document.body.classList.remove("has-open-dialog");

    if (triggerFocusOnClose) {
      openButton.focus();
    }
  };

  openButton.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);

  dialog.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-language]")) {
      closeDialog();
    }
  });

  optionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyLanguage(button.dataset.languageOption);
      closeDialog();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) {
      closeDialog();
    }
  });

  applyLanguage(getStoredLanguage());
};
