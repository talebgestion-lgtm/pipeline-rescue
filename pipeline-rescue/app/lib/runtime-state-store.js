const fs = require("node:fs");
const path = require("node:path");

const STRUCTURED_RUNTIME_STORAGE_FORMAT = "SCENARIO_SHARDS_V1";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonAtomic(filePath, payload) {
  const tempFilePath = `${filePath}.tmp`;
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFilePath, filePath);
}

function createCorruptStateError(message, corruptFiles) {
  const error = new Error(message);
  error.corruptFiles = corruptFiles;
  return error;
}

function getScenarioShardFileName(scenarioId) {
  return `${Buffer.from(String(scenarioId), "utf8").toString("hex")}.json`;
}

function isStructuredRuntimeManifest(payload) {
  return Boolean(
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && payload.storageFormat === STRUCTURED_RUNTIME_STORAGE_FORMAT
  );
}

function createStructuredRuntimeManifest(payload) {
  const scenarios = payload.scenarios || {};

  return {
    version: 2,
    storageFormat: STRUCTURED_RUNTIME_STORAGE_FORMAT,
    persistedAt: payload.persistedAt,
    scenarioCount: Object.keys(scenarios).length,
    scenarios: Object.fromEntries(
      Object.entries(scenarios).map(([scenarioId, scenarioState]) => [
        scenarioId,
        {
          fileName: getScenarioShardFileName(scenarioId),
          updatedAt: payload.persistedAt,
          sequence: scenarioState.sequence || 1,
          taskCount: Object.keys(scenarioState.taskStates || {}).length,
          feedbackEntryCount: Array.isArray(scenarioState.feedbackHistory)
            ? scenarioState.feedbackHistory.length
            : 0,
          eventCount: Array.isArray(scenarioState.events)
            ? scenarioState.events.length
            : 0
        }
      ])
    )
  };
}

function removeStaleScenarioShards(scenarioStoreDir, activeShardNames) {
  if (!fs.existsSync(scenarioStoreDir)) {
    return;
  }

  for (const entry of fs.readdirSync(scenarioStoreDir)) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    if (activeShardNames.has(entry)) {
      continue;
    }

    fs.unlinkSync(path.join(scenarioStoreDir, entry));
  }
}

function persistStructuredRuntimeState(options) {
  const { stateFilePath, scenarioStoreDir, payload } = options;
  const manifest = createStructuredRuntimeManifest(payload);
  const activeShardNames = new Set();

  ensureDir(scenarioStoreDir);

  for (const [scenarioId, descriptor] of Object.entries(manifest.scenarios)) {
    const shardName = descriptor.fileName || getScenarioShardFileName(scenarioId);
    const scenarioFilePath = path.join(scenarioStoreDir, shardName);

    activeShardNames.add(shardName);
    writeJsonAtomic(scenarioFilePath, {
      version: 1,
      scenarioId,
      persistedAt: payload.persistedAt,
      state: payload.scenarios[scenarioId]
    });
  }

  writeJsonAtomic(stateFilePath, manifest);
  removeStaleScenarioShards(scenarioStoreDir, activeShardNames);

  return {
    manifest,
    scenarioShardCount: activeShardNames.size
  };
}

function loadStructuredRuntimeState(options) {
  const {
    stateFilePath,
    scenarioStoreDir,
    manifestPayload
  } = options;

  if (!isStructuredRuntimeManifest(manifestPayload)) {
    throw createCorruptStateError("Structured runtime manifest is invalid.", [
      {
        filePath: stateFilePath,
        content: fs.existsSync(stateFilePath) ? fs.readFileSync(stateFilePath, "utf8") : null
      }
    ]);
  }

  if (typeof manifestPayload.scenarios !== "object" || Array.isArray(manifestPayload.scenarios) || !manifestPayload.scenarios) {
    throw createCorruptStateError("Structured runtime manifest scenarios are invalid.", [
      {
        filePath: stateFilePath,
        content: fs.existsSync(stateFilePath) ? fs.readFileSync(stateFilePath, "utf8") : null
      }
    ]);
  }

  const scenarios = {};

  for (const [scenarioId, descriptor] of Object.entries(manifestPayload.scenarios)) {
    const shardName = descriptor && descriptor.fileName
      ? descriptor.fileName
      : getScenarioShardFileName(scenarioId);
    const scenarioFilePath = path.join(scenarioStoreDir, shardName);

    if (!fs.existsSync(scenarioFilePath)) {
      throw createCorruptStateError("Structured runtime scenario shard is missing.", [
        {
          filePath: scenarioFilePath,
          content: null
        }
      ]);
    }

    const raw = fs.readFileSync(scenarioFilePath, "utf8");
    let shardPayload;

    try {
      shardPayload = JSON.parse(raw);
    } catch (error) {
      throw createCorruptStateError("Structured runtime scenario shard is invalid.", [
        {
          filePath: scenarioFilePath,
          content: raw
        }
      ]);
    }

    if (!shardPayload || typeof shardPayload !== "object" || Array.isArray(shardPayload) || !shardPayload.state || typeof shardPayload.state !== "object" || Array.isArray(shardPayload.state)) {
      throw createCorruptStateError("Structured runtime scenario shard payload is invalid.", [
        {
          filePath: scenarioFilePath,
          content: raw
        }
      ]);
    }

    scenarios[scenarioId] = shardPayload.state;
  }

  return {
    payload: {
      persistedAt: manifestPayload.persistedAt || null,
      scenarios
    },
    scenarioShardCount: Object.keys(scenarios).length,
    storageFormat: manifestPayload.storageFormat
  };
}

module.exports = {
  STRUCTURED_RUNTIME_STORAGE_FORMAT,
  getScenarioShardFileName,
  isStructuredRuntimeManifest,
  loadStructuredRuntimeState,
  persistStructuredRuntimeState
};
