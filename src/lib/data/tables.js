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
          error:
            "Table not found by URL. Please try entering a VPS ID instead.",
        };

      const tableFile = vpsGame.tableFiles?.find((t) =>
        t?.urls?.some((u) => u?.url === url),
      );
      if (!tableFile)
        return {
          table: null,
          error:
            "Table not found by URL. Please try entering a VPS ID instead.",
        };

      // Now check/create by vpsId for uniqueness
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
        error: `Failed to fetch VPS game data by URL. ${error.message}`,
      };
    }
  } else if (vpsId) {
    try {
      const vpsGame = await getVpsGameById(vpsId);
      //TODO vpsGame will be {} at a minimum
      if (!vpsGame)
        return {
          table: null,
          error: "Table not found with the provided VPS ID.",
        };

      const tableFile = vpsGame.tableFiles?.find((t) => t.id === vpsId);
      if (!tableFile)
        return {
          table: null,
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
        error: `Failed to fetch VPS game data for ID ${vpsId}. ${error.message}`,
      };
    }
  } else {
    return {
      table: null,
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

  const localEntry = await tablesCollection.findOne({
    authors: {
      $elemMatch: {
        vpsId,
        authorName,
        "versions.versionNumber": versionNumber,
      },
    },
  });

  if (localEntry) {
    const author = localEntry.authors.find(
      (a) => a.vpsId === vpsId && a.authorName === authorName,
    );
    const version = author.versions.find(
      (v) => v.versionNumber === versionNumber,
    );
    return {
      table: {
        vpsId: author.vpsId,
        url: version.versionUrl,
        name: localEntry.tableName,
        metadata: {
          authorName: author.authorName,
          versionNumber: version.versionNumber,
        },
      },
      error: null,
    };
  }

  const record = buildTableRecord(vpsGame, tableFile, vpsId);
  await insertOne(record, "tables");
  logger.info(`New table '${record.tableName}' added via vpsId.`);

  const author = record.authors[0];
  const version = author.versions[0];
  return {
    table: {
      vpsId: author.vpsId,
      url: version.versionUrl,
      name: record.tableName,
      metadata: {
        authorName: author.authorName,
        versionNumber: version.versionNumber,
      },
    },
    error: null,
  };
};
