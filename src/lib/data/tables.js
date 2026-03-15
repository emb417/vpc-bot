import { getVpsGameById, getVpsGameByUrl, getVpsGameByName } from "./vps.js";
import {
  getCollection,
  insertOne,
  generateObjectId,
} from "../../services/database.js";
import logger from "../../utils/logger.js";

const buildTableRecord = (vpsGame, tableFile, vpsId) => ({
  _id: generateObjectId(),
  tableName: `${vpsGame.name} (${vpsGame.manufacturer} ${vpsGame.year})`,
  authors: [
    {
      _id: generateObjectId(),
      authorName: tableFile.authors?.join(", ") ?? "",
      versions: [
        {
          _id: generateObjectId(),
          versionNumber: tableFile.version ?? "",
          versionUrl: tableFile.urls?.[0]?.url ?? "",
          romName: vpsGame?.romFiles?.[0]?.version ?? "",
          scores: [],
        },
      ],
      vpsId: vpsId ?? tableFile.id,
      comment: tableFile.comment ?? "",
    },
  ],
});

export const findTable = async ({ url, vpsId }) => {
  const tablesCollection = await getCollection("tables");

  if (url && !vpsId) {
    try {
      const vpsGame = await getVpsGameByUrl(url);
      if (!vpsGame)
        return {
          table: null,
          status: null,
          error:
            "Table not found by URL. Please try entering a VPS ID instead.",
        };

      const tableFile = vpsGame.tableFiles?.find((t) =>
        t?.urls?.some((u) => u?.url === url),
      );
      if (!tableFile)
        return {
          table: null,
          status: null,
          error:
            "Table not found by URL. Please try entering a VPS ID instead.",
        };

      return await findOrCreateByVpsId(
        tablesCollection,
        vpsGame,
        tableFile,
        tableFile.id,
      );
    } catch (error) {
      logger.error(
        { err: error },
        `Error fetching VPS game data by URL ${url}:`,
      );
      return {
        table: null,
        status: null,
        error: `Failed to fetch VPS game data by URL. ${error.message}`,
      };
    }
  } else if (vpsId) {
    try {
      const vpsGame = await getVpsGameById(vpsId);
      if (!vpsGame)
        return {
          table: null,
          status: null,
          error: "Table not found with the provided VPS ID.",
        };

      const tableFile = vpsGame.tableFiles?.find((t) => t.id === vpsId);
      if (!tableFile)
        return {
          table: null,
          status: null,
          error:
            "VPS game data found, but no matching table file for the provided VPS ID.",
        };

      return await findOrCreateByVpsId(
        tablesCollection,
        vpsGame,
        tableFile,
        vpsId,
      );
    } catch (error) {
      logger.error(
        { err: error },
        `Error fetching VPS game data for ID ${vpsId}:`,
      );
      return {
        table: null,
        status: null,
        error: `Failed to fetch VPS game data for ID ${vpsId}. ${error.message}`,
      };
    }
  } else {
    return {
      table: null,
      status: null,
      error: "You must provide either a `vpsid` or a `url`.",
    };
  }
};

/**
 * Search VPS by name and return up to maxResults table option objects for
 * building a select menu. Does NOT write anything to the local tables collection
 * — upsert happens later via findTable({ vpsId }) once the user confirms.
 *
 * Each result: { vpsId, name, authorName, versionNumber }
 */
export const findTablesByName = async (name, maxResults = 10) => {
  try {
    const vpsGames = await getVpsGameByName(name);

    if (!vpsGames || vpsGames.length === 0) {
      return { tables: [], error: null };
    }

    const results = [];

    for (const vpsGame of vpsGames) {
      if (results.length >= maxResults) break;

      for (const tableFile of vpsGame.tableFiles ?? []) {
        if (results.length >= maxResults) break;

        const vpsId = tableFile.id;
        if (!vpsId) continue;

        results.push({
          vpsId,
          name: `${vpsGame.name} (${vpsGame.manufacturer} ${vpsGame.year})`,
          authorName: tableFile.authors?.join(", ") ?? "Unknown Author",
          versionNumber: tableFile.version ?? "",
        });
      }
    }

    return { tables: results, error: null };
  } catch (error) {
    logger.error({ err: error }, `Error in findTablesByName for "${name}":`);
    return {
      tables: [],
      error: `Failed to search VPS game data. ${error.message}`,
    };
  }
};

const findOrCreateByVpsId = async (
  tablesCollection,
  vpsGame,
  tableFile,
  vpsId,
) => {
  const authorName = tableFile.authors?.join(", ") ?? "";
  const versionNumber = tableFile.version ?? "";
  const versionUrl = tableFile.urls?.[0]?.url ?? "";
  const romUrl = vpsGame.romFiles?.[0]?.urls?.[0]?.url ?? null;
  const romName = vpsGame?.romFiles?.[0]?.version ?? "";
  const tableName = `${vpsGame.name} (${vpsGame.manufacturer} ${vpsGame.year})`;

  const buildTableResult = (doc, authorObj, versionObj, status) => ({
    table: {
      vpsId: authorObj.vpsId,
      url: versionObj.versionUrl,
      name: doc.tableName,
      romUrl,
      metadata: {
        authorName: authorObj.authorName,
        versionNumber: versionObj.versionNumber,
      },
    },
    status,
    error: null,
  });

  // 1. Find by vpsId
  const existingByVpsId = await tablesCollection.findOne({
    "authors.vpsId": vpsId,
  });

  if (existingByVpsId) {
    // Update tableName if drifted
    if (existingByVpsId.tableName !== tableName) {
      await tablesCollection.updateOne(
        { _id: existingByVpsId._id },
        { $set: { tableName } },
      );
      existingByVpsId.tableName = tableName;
    }

    const authorWithVersion = existingByVpsId.authors.find(
      (a) =>
        a.vpsId === vpsId &&
        a.versions.some((v) => v.versionNumber === versionNumber),
    );

    if (authorWithVersion) {
      const existingVersion = authorWithVersion.versions.find(
        (v) => v.versionNumber === versionNumber,
      );
      // Always sync author name from VPS — it's the source of truth
      if (authorWithVersion.authorName !== authorName) {
        await tablesCollection.updateOne(
          { _id: existingByVpsId._id, "authors._id": authorWithVersion._id },
          { $set: { "authors.$.authorName": authorName } },
        );
        logger.info(
          `Updated authorName from '${authorWithVersion.authorName}' to '${authorName}' for vpsId '${vpsId}'.`,
        );
      }
      return buildTableResult(
        existingByVpsId,
        { ...authorWithVersion, authorName },
        existingVersion,
        "existing",
      );
    }

    // vpsId exists but this versionNumber is new — add under first matching author
    const firstMatchingAuthor = existingByVpsId.authors.find(
      (a) => a.vpsId === vpsId,
    );
    await tablesCollection.updateOne(
      { _id: existingByVpsId._id, "authors._id": firstMatchingAuthor._id },
      {
        $push: {
          "authors.$.versions": {
            _id: generateObjectId(),
            versionNumber,
            versionUrl,
            romName,
            scores: [],
          },
        },
      },
    );
    logger.info(
      `New version '${versionNumber}' added to '${tableName}' for vpsId '${vpsId}'.`,
    );
    return buildTableResult(
      existingByVpsId,
      { ...firstMatchingAuthor, authorName },
      { versionUrl, versionNumber },
      "new_version",
    );
  }

  // 2. Find by sibling vpsId — same game, different author/version
  const siblingVpsIds =
    vpsGame.tableFiles?.map((t) => t.id).filter((id) => id && id !== vpsId) ??
    [];

  const existingBysibling = siblingVpsIds.length
    ? await tablesCollection.findOne({
        "authors.vpsId": { $in: siblingVpsIds },
      })
    : null;

  if (existingBysibling) {
    await tablesCollection.updateOne(
      { _id: existingBysibling._id },
      {
        $push: {
          authors: {
            _id: generateObjectId(),
            authorName,
            versions: [
              {
                _id: generateObjectId(),
                versionNumber,
                versionUrl,
                romName,
                scores: [],
              },
            ],
            vpsId,
            comment: tableFile.comment ?? "",
          },
        },
      },
    );
    logger.info(
      `New author '${authorName}' (vpsId: ${vpsId}) added to existing table '${existingBysibling.tableName}' via sibling vpsId.`,
    );
    // Update tableName if drifted
    if (existingBysibling.tableName !== tableName) {
      await tablesCollection.updateOne(
        { _id: existingBysibling._id },
        { $set: { tableName } },
      );
      existingBysibling.tableName = tableName;
    }
    return buildTableResult(
      existingBysibling,
      { vpsId, authorName },
      { versionUrl, versionNumber },
      "new_author",
    );
  }

  // 3. Brand new table — no existing document found by vpsId or sibling
  const record = buildTableRecord(vpsGame, tableFile, vpsId);
  await insertOne(record, "tables");
  logger.info(`New table '${record.tableName}' added via vpsId '${vpsId}'.`);

  const author = record.authors[0];
  const version = author.versions[0];
  return buildTableResult(record, author, version, "new_table");
};
