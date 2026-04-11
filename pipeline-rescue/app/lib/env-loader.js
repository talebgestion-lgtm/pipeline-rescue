const fs = require("node:fs");

function parseDotEnv(raw) {
  const values = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadEnvFile(filePath, env = process.env) {
  if (!fs.existsSync(filePath)) {
    return { loaded: false, keys: [] };
  }

  const parsed = parseDotEnv(fs.readFileSync(filePath, "utf8"));
  const loadedKeys = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] == null || env[key] === "") {
      env[key] = value;
      loadedKeys.push(key);
    }
  }

  return {
    loaded: true,
    keys: loadedKeys
  };
}

module.exports = {
  loadEnvFile,
  parseDotEnv
};
