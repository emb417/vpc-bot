import { getVpsGameById, getVpsGameByUrl } from "./vps.js";
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
      logger.error(`Error fetching VPS game data by URL ${url}:`, error);
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
      logger.error(`Error fetching VPS game data for ID ${vpsId}:`, error);
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
    // Update tableName if it has changed
    if (existingByVpsId.tableName !== tableName) {
      await tablesCollection.updateOne(
        { _id: existingByVpsId._id },
        { $set: { tableName } },
      );
      existingByVpsId.tableName = tableName;
      logger.info(`Updated tableName to '${tableName}' for vpsId '${vpsId}'.`);
    }

    // Find all authors with this vpsId
    const authorsWithVpsId = existingByVpsId.authors.filter(
      (a) => a.vpsId === vpsId,
    );

    // Look for matching version number
    for (const author of authorsWithVpsId) {
      const existingVersion = author.versions.find(
        (v) => v.versionNumber === versionNumber,
      );

      if (existingVersion) {
        if (author.authorName === authorName) {
          // Exact match - return existing
          logger.info(
            `Existing table '${tableName}' found for vpsId '${vpsId}'.`,
          );
          return buildTableResult(
            existingByVpsId,
            author,
            existingVersion,
            "existing",
          );
        } else {
          // Same version, different author - create new author + version
          await tablesCollection.updateOne(
            { _id: existingByVpsId._id },
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
            `New author '${authorName}' with version '${versionNumber}' added to '${tableName}'.`,
          );
          return buildTableResult(
            existingByVpsId,
            { vpsId, authorName },
            { versionUrl, versionNumber },
            "new_author",
          );
        }
      }
    }

    // No matching version found - push new version under first matching author
    const existingAuthor = authorsWithVpsId[0];
    await tablesCollection.updateOne(
      { _id: existingByVpsId._id, "authors.vpsId": vpsId },
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
      `New version '${versionNumber}' added to '${tableName}' for author '${existingAuthor.authorName}'.`,
    );
    return buildTableResult(
      existingByVpsId,
      existingAuthor,
      { versionUrl, versionNumber },
      "new_version",
    );
  }

  // 2. Find by tableName - same game, new vpsId
  const existingByName = await tablesCollection.findOne({ tableName });
  if (existingByName) {
    await tablesCollection.updateOne(
      { tableName },
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
      `New author '${authorName}' (vpsId: ${vpsId}) added to existing table '${tableName}'.`,
    );
    return buildTableResult(
      existingByName,
      { vpsId, authorName },
      { versionUrl, versionNumber },
      "new_author",
    );
  }

  // 3. Brand new table
  const record = buildTableRecord(vpsGame, tableFile, vpsId);
  await insertOne(record, "tables");
  logger.info(`New table '${record.tableName}' added via vpsId '${vpsId}'.`);

  const author = record.authors[0];
  const version = author.versions[0];
  return buildTableResult(record, author, version, "new_table");
};
