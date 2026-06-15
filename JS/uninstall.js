// RecarregaAi! V.1.2.10

const feedbackSubmitUrl = "https://formsubmit.co/ajax/vinim0106@icloud.com";
const defaultVersionLabel = "V.1.2.10";
const defaultReason = "Nao informou motivo";

const uninstallElements = {
  copyFeedbackButton: document.querySelector("#copy-feedback-button"),
  contactEmail: document.querySelector("#contact-email"),
  feedbackButtons: document.querySelectorAll("[data-feedback-reason]"),
  extensionVersion: document.querySelector("#extension-version"),
  feedbackBrowserInput: document.querySelector("#feedback-browser-input"),
  feedbackDateInput: document.querySelector("#feedback-date-input"),
  feedbackForm: document.querySelector("#feedback-form"),
  feedbackMessage: document.querySelector("#feedback-message"),
  feedbackReasonInput: document.querySelector("#feedback-reason-input"),
  feedbackStatus: document.querySelector("#feedback-status"),
  feedbackVersionInput: document.querySelector("#feedback-version-input"),
  sendFeedbackButton: document.querySelector("#send-feedback-button"),
  selectedReasonFeedback: document.querySelector("#selected-reason-feedback")
};

let isSendingFeedback = false;

const getVersionLabel = () => defaultVersionLabel;

const getSelectedReason = () => uninstallElements.feedbackReasonInput.value
  || defaultReason;

const hasSelectedReason = () => getSelectedReason() !== defaultReason;

const updateStatus = (message) => {
  uninstallElements.feedbackStatus.textContent = message;
};

const updateSelectedReasonFeedback = (label) => {
  if (!label) {
    uninstallElements.selectedReasonFeedback.textContent =
      "Nenhum motivo selecionado.";
    return;
  }

  const labelElement = document.createElement("strong");

  labelElement.textContent = label;
  uninstallElements.selectedReasonFeedback.replaceChildren(
    "Selecionado: ",
    labelElement
  );
};

const selectFeedbackReason = (selectedButton) => {
  uninstallElements.feedbackButtons.forEach((button) => {
    const isSelected = button === selectedButton;

    button.classList.toggle("reason-button--selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  uninstallElements.feedbackReasonInput.value =
    selectedButton.dataset.feedbackReason || defaultReason;
  updateSelectedReasonFeedback(selectedButton.dataset.feedbackLabel);
  uninstallElements.copyFeedbackButton.disabled = false;
  uninstallElements.sendFeedbackButton.disabled = false;
  updateStatus("Motivo selecionado. Clique em Enviar feedback para concluir.");
};

const setFeedbackControlsDisabled = (isDisabled) => {
  uninstallElements.feedbackButtons.forEach((button) => {
    button.disabled = isDisabled;
  });
  uninstallElements.copyFeedbackButton.disabled =
    isDisabled || !hasSelectedReason();
  uninstallElements.contactEmail.disabled = isDisabled;
  uninstallElements.feedbackMessage.disabled = isDisabled;
  uninstallElements.sendFeedbackButton.disabled =
    isDisabled || !hasSelectedReason();
};

const prepareHiddenFields = () => {
  uninstallElements.feedbackVersionInput.value = getVersionLabel();
  uninstallElements.feedbackDateInput.value = new Date().toISOString();
  uninstallElements.feedbackBrowserInput.value = navigator.userAgent;
};

const buildFeedbackBody = () => {
  const message = uninstallElements.feedbackMessage.value.trim()
    || "O usuario nao informou detalhes adicionais.";
  const email = uninstallElements.contactEmail.value.trim()
    || "Nao informado";

  return [
    "Feedback de desinstalacao",
    "",
    `Versao: ${getVersionLabel()}`,
    `Motivo: ${getSelectedReason()}`,
    `Email para contato: ${email}`,
    `Data: ${new Date().toISOString()}`,
    "",
    "Comentario:",
    message,
    "",
    `Navegador: ${navigator.userAgent}`
  ].join("\n");
};

const clearOptionalFields = () => {
  uninstallElements.feedbackMessage.value = "";
  uninstallElements.contactEmail.value = "";
};

const submitFeedback = async (reason, successMessage) => {
  if (isSendingFeedback) {
    return;
  }

  isSendingFeedback = true;
  uninstallElements.feedbackReasonInput.value = reason || defaultReason;
  prepareHiddenFields();
  updateStatus("Enviando feedback...");

  const formData = new FormData(uninstallElements.feedbackForm);
  setFeedbackControlsDisabled(true);

  try {
    const response = await fetch(feedbackSubmitUrl, {
      body: formData,
      headers: {
        Accept: "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Envio automatico recusado.");
    }

    updateStatus(successMessage);
    clearOptionalFields();
    prepareHiddenFields();
  } catch (error) {
    console.error("Erro ao enviar feedback automaticamente:", error);
    updateStatus(
      "Nao consegui enviar. Confirme o FormSubmit no email ou use Copiar resposta."
    );
  } finally {
    isSendingFeedback = false;
    setFeedbackControlsDisabled(false);
  }
};

const copyFeedback = async () => {
  try {
    await navigator.clipboard.writeText(buildFeedbackBody());
    updateStatus("Feedback copiado. Obrigado por ajudar a melhorar.");
  } catch (error) {
    console.error("Erro ao copiar feedback:", error);
    updateStatus("Nao foi possivel copiar agora. Selecione o texto manualmente.");
  }
};

const submitDetailedFeedback = (event) => {
  event.preventDefault();

  if (!hasSelectedReason()) {
    updateStatus("Selecione um motivo antes de enviar.");
    return;
  }

  submitFeedback(
    getSelectedReason(),
    "Feedback enviado. Obrigado por ajudar a melhorar."
  );
};

const handleFeedbackReasonClick = (button) => {
  selectFeedbackReason(button);
};

const initializePage = () => {
  uninstallElements.extensionVersion.textContent = getVersionLabel();
  prepareHiddenFields();
};

uninstallElements.feedbackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleFeedbackReasonClick(button);
  });
});
uninstallElements.feedbackForm.addEventListener("submit", submitDetailedFeedback);
uninstallElements.copyFeedbackButton.addEventListener("click", () => {
  copyFeedback();
});

initializePage();
