// RecarregaAi! 1.8.3

(() => {
  const guardFlag = "__recarregaAiMainWorldMediaGuardLoaded";
  const mediaStateType = "RECARREGA_AI_PAGE_MEDIA_STATE";
  const source = "RECARREGA_AI_PAGE_MEDIA_GUARD";

  if (window[guardFlag]) {
    return;
  }

  window[guardFlag] = true;

  const activeRecorders = new Set();
  const audioContexts = new Set();
  const trackedStreams = new Set();

  const hasLiveTrack = (stream) => (
    Boolean(
      stream
        && typeof stream.getTracks === "function"
        && stream.getTracks().some((track) => track.readyState === "live")
    )
  );

  const hasRunningAudioContext = () => (
    Array.from(audioContexts).some((context) => context.state === "running")
  );

  const hasRecordingMediaRecorder = () => (
    Array.from(activeRecorders).some((recorder) => recorder.state === "recording")
  );

  const hasLiveTrackedStream = () => (
    Array.from(trackedStreams).some(hasLiveTrack)
  );

  const postMediaState = () => {
    window.postMessage({
      payload: {
        isMediaActive:
          hasLiveTrackedStream()
          || hasRecordingMediaRecorder()
          || hasRunningAudioContext()
      },
      source,
      type: mediaStateType
    }, "*");
  };

  const syncTrackedStream = (stream) => {
    if (hasLiveTrack(stream)) {
      trackedStreams.add(stream);
    } else {
      trackedStreams.delete(stream);
    }

    postMediaState();
  };

  const watchStream = (stream) => {
    if (!stream || typeof stream.getTracks !== "function") {
      return stream;
    }

    stream.getTracks().forEach((track) => {
      if (typeof track.addEventListener === "function") {
        track.addEventListener("ended", () => {
          syncTrackedStream(stream);
        }, {
          once: true
        });
      }
    });

    syncTrackedStream(stream);

    return stream;
  };

  const patchGetUserMedia = () => {
    const mediaDevices = navigator.mediaDevices;

    if (
      !mediaDevices
      || typeof mediaDevices.getUserMedia !== "function"
      || mediaDevices.getUserMedia.__recarregaAiWrapped
    ) {
      return;
    }

    const nativeGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    const wrappedGetUserMedia = (...args) => (
      nativeGetUserMedia(...args).then((stream) => watchStream(stream))
    );

    Object.defineProperty(wrappedGetUserMedia, "__recarregaAiWrapped", {
      value: true
    });

    mediaDevices.getUserMedia = wrappedGetUserMedia;
  };

  const patchLegacyGetUserMedia = (methodName) => {
    const nativeGetUserMedia = navigator[methodName];

    if (
      typeof nativeGetUserMedia !== "function"
      || nativeGetUserMedia.__recarregaAiWrapped
    ) {
      return;
    }

    const wrappedGetUserMedia = (constraints, onSuccess, onError) => (
      nativeGetUserMedia.call(
        navigator,
        constraints,
        (stream) => {
          watchStream(stream);

          if (typeof onSuccess === "function") {
            onSuccess(stream);
          }
        },
        onError
      )
    );

    Object.defineProperty(wrappedGetUserMedia, "__recarregaAiWrapped", {
      value: true
    });

    navigator[methodName] = wrappedGetUserMedia;
  };

  const patchMediaRecorder = () => {
    if (
      typeof window.MediaRecorder !== "function"
      || window.MediaRecorder.__recarregaAiWrapped
    ) {
      return;
    }

    const NativeMediaRecorder = window.MediaRecorder;

    function RecarregaAiMediaRecorder(...args) {
      const recorder = new NativeMediaRecorder(...args);
      const syncRecorder = () => {
        if (recorder.state === "recording") {
          activeRecorders.add(recorder);
        } else {
          activeRecorders.delete(recorder);
        }

        postMediaState();
      };

      ["error", "pause", "resume", "start", "stop"].forEach((eventName) => {
        recorder.addEventListener(eventName, syncRecorder);
      });

      watchStream(args[0]);
      syncRecorder();

      return recorder;
    }

    Object.setPrototypeOf(RecarregaAiMediaRecorder, NativeMediaRecorder);
    RecarregaAiMediaRecorder.prototype = NativeMediaRecorder.prototype;
    Object.defineProperty(RecarregaAiMediaRecorder, "__recarregaAiWrapped", {
      value: true
    });

    window.MediaRecorder = RecarregaAiMediaRecorder;
  };

  const patchAudioContext = (contextName) => {
    const NativeAudioContext = window[contextName];

    if (
      typeof NativeAudioContext !== "function"
      || NativeAudioContext.__recarregaAiWrapped
    ) {
      return;
    }

    function RecarregaAiAudioContext(...args) {
      const context = new NativeAudioContext(...args);

      audioContexts.add(context);

      if (typeof context.addEventListener === "function") {
        context.addEventListener("statechange", postMediaState);
      }

      postMediaState();

      return context;
    }

    Object.setPrototypeOf(RecarregaAiAudioContext, NativeAudioContext);
    RecarregaAiAudioContext.prototype = NativeAudioContext.prototype;
    Object.defineProperty(RecarregaAiAudioContext, "__recarregaAiWrapped", {
      value: true
    });

    window[contextName] = RecarregaAiAudioContext;
  };

  try {
    patchGetUserMedia();
    patchLegacyGetUserMedia("getUserMedia");
    patchLegacyGetUserMedia("mozGetUserMedia");
    patchLegacyGetUserMedia("webkitGetUserMedia");
    patchMediaRecorder();
    patchAudioContext("AudioContext");
    patchAudioContext("webkitAudioContext");
    postMediaState();
  } catch (error) {
    console.warn("RecarregaAi! nao conseguiu ativar a protecao de midia:", error);
  }
})();
