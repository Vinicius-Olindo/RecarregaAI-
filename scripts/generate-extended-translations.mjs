import fs from "node:fs/promises";
import vm from "node:vm";

const projectRoot = new URL("../", import.meta.url);
const targetLocales = ["fr", "de", "it", "id", "tr"];
const pageConfigs = [
  ["popup", "JS/popup.js", "popupTranslations"],
  ["welcome", "JS/welcome.js", "welcomeTranslations"],
  ["options", "JS/options.js", "optionsTranslations"],
  ["privacy", "JS/privacy.js", "privacyTranslations"],
  ["uninstall", "JS/uninstall.js", "translations"]
];
const separatorPrefix = "__RECARREGAAI_ITEM_";
const batchSize = 12;
const cacheUrl = new URL(".translation-cache.json", projectRoot);
const translationHosts = [
  "https://translate.google.com/translate_a/single",
  "https://translate.googleapis.com/translate_a/single"
];
let translationCache = {};

try {
  translationCache = JSON.parse(await fs.readFile(cacheUrl, "utf8"));
} catch {
  translationCache = {};
}

const extractObjectLiteral = (source, variableName) => {
  const declaration = `const ${variableName} =`;
  const declarationIndex = source.indexOf(declaration);

  if (declarationIndex < 0) {
    throw new Error(`Objeto ${variableName} nao encontrado.`);
  }

  const startIndex = source.indexOf("{", declarationIndex);
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (["\"", "'", "`"].includes(character)) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error(`Objeto ${variableName} incompleto.`);
};

const readTranslationObject = async (relativePath, variableName) => {
  const source = await fs.readFile(new URL(relativePath, projectRoot), "utf8");
  const literal = extractObjectLiteral(source, variableName);

  return vm.runInNewContext(`(${literal})`);
};

const getTranslatedText = (payload) => (
  payload[0].map((segment) => segment[0]).join("")
);

const requestTranslation = async (text, locale) => {
  let lastError;

  for (const host of translationHosts) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const url = new URL(host);

      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", "en");
      url.searchParams.set("tl", locale);
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", text);

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": "RecarregaAi-translation-build/1.0"
          },
          signal: AbortSignal.timeout(30000)
        });

        if (response.ok) {
          return getTranslatedText(await response.json());
        }

        lastError = new Error(`Falha de traducao ${response.status}.`);
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 600 * (attempt + 1));
      });
    }
  }

  throw lastError;
};

const parseBatchTranslation = (translatedText, itemCount) => {
  const values = Array(itemCount).fill(null);
  const markerPattern = new RegExp(
    `${separatorPrefix}(\\d+)__([\\s\\S]*?)(?=${separatorPrefix}\\d+__|$)`,
    "g"
  );

  for (const match of translatedText.matchAll(markerPattern)) {
    values[Number(match[1])] = match[2].trim();
  }

  return values.every((value) => typeof value === "string") ? values : null;
};

const translateBatch = async (texts, locale) => {
  const cachedValues = texts.map((text) => (
    translationCache[`${locale}:${text}`] || null
  ));
  const missingEntries = texts
    .map((text, index) => ({ index, text }))
    .filter(({ index }) => !cachedValues[index]);

  if (missingEntries.length === 0) {
    return cachedValues;
  }

  const markedText = missingEntries
    .map(({ text }, index) => `${separatorPrefix}${index}__ ${text}`)
    .join("\n");
  const translatedText = await requestTranslation(markedText, locale);
  const parsedValues = parseBatchTranslation(
    translatedText,
    missingEntries.length
  );
  const translatedValues = parsedValues || await Promise.all(
    missingEntries.map(({ text }) => requestTranslation(text, locale))
  );

  missingEntries.forEach(({ index, text }, missingIndex) => {
    const translatedValue = translatedValues[missingIndex];

    cachedValues[index] = translatedValue;
    translationCache[`${locale}:${text}`] = translatedValue;
  });

  await fs.writeFile(
    cacheUrl,
    JSON.stringify(translationCache, null, 2),
    "utf8"
  );

  return cachedValues;
};

const restoreTemplateTokens = (sourceText, translatedText) => {
  const sourceTokens = sourceText.match(/\{[^}]+\}/g) || [];
  const translatedTokens = translatedText.match(/\{[^}]+\}/g) || [];

  if (sourceTokens.length !== translatedTokens.length) {
    return translatedText;
  }

  let tokenIndex = 0;

  return translatedText.replace(/\{[^}]+\}/g, () => (
    sourceTokens[tokenIndex++]
  ));
};

const translateRecord = async (record, locale) => {
  const entries = Object.entries(record);
  const translatedEntries = [];

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const translatedValues = await translateBatch(
      batch.map(([, value]) => value),
      locale
    );

    translatedEntries.push(...batch.map(([key, sourceText], batchIndex) => [
      key,
      restoreTemplateTokens(sourceText, translatedValues[batchIndex])
    ]));
  }

  return Object.fromEntries(translatedEntries);
};

const pageTranslations = {};

for (const [pageName, relativePath, variableName] of pageConfigs) {
  const translationObject = await readTranslationObject(relativePath, variableName);

  pageTranslations[pageName] = {};

  for (const locale of targetLocales) {
    pageTranslations[pageName][locale] = await translateRecord(
      translationObject.en,
      locale
    );
  }
}

const reasonTranslationObject = await readTranslationObject(
  "JS/uninstall.js",
  "reasonTranslations"
);
const reasonTranslations = {};

for (const locale of targetLocales) {
  reasonTranslations[locale] = {};

  for (const [reasonId, translations] of Object.entries(reasonTranslationObject)) {
    reasonTranslations[locale][reasonId] = await translateRecord(
      translations.en,
      locale
    );
  }
}

const moduleSource = `// Generated from the English interface copy.\n\n`
  + `export const extendedPageTranslations = ${JSON.stringify(pageTranslations, null, 2)};\n\n`
  + `export const extendedReasonTranslations = ${JSON.stringify(reasonTranslations, null, 2)};\n\n`
  + `export const extendPageTranslations = (baseTranslations, pageName) => {\n`
  + `  const pageTranslations = extendedPageTranslations[pageName] || {};\n\n`
  + `  return Object.entries(pageTranslations).reduce((translations, [locale, copy]) => ({\n`
  + `    ...translations,\n`
  + `    [locale]: {\n`
  + `      ...baseTranslations.en,\n`
  + `      ...copy\n`
  + `    }\n`
  + `  }), { ...baseTranslations });\n`
  + `};\n\n`
  + `export const extendReasonTranslationMap = (baseTranslations) => (\n`
  + `  Object.fromEntries(Object.entries(baseTranslations).map(([reasonId, copy]) => [\n`
  + `    reasonId,\n`
  + `    Object.entries(extendedReasonTranslations).reduce((translations, [locale, reasons]) => ({\n`
  + `      ...translations,\n`
  + `      [locale]: reasons[reasonId] || copy.en\n`
  + `    }), { ...copy })\n`
  + `  ]))\n`
  + `);\n`;

await fs.writeFile(
  new URL("JS/modules/extended-translations.js", projectRoot),
  moduleSource,
  "utf8"
);
