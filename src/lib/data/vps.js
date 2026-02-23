import "dotenv/config";
import logger from "../../utils/logger.js";

const baseApiUrl = process.env.VPS_DATA_SERVICE_API_URI;

/**
 * Get VPS game data by VPS ID.
 */
export const getVpsGameById = async (vpsId) => {
  try {
    const response = await fetch(`${baseApiUrl}/games/tables/${vpsId}`);
    if (!response.ok) {
      logger.error(`VPS API error for ID ${vpsId}: ${response.statusText}`);
      throw new Error(`Failed to fetch VPS game data: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    logger.error(`Error fetching VPS game data for ID ${vpsId}:`, error);
    throw new Error(
      "Could not retrieve VPS game data. Please try again later.",
    );
  }
};

export const getVpsGameByUrl = async (url) => {
  try {
    const response = await fetch(
      `${baseApiUrl}/games/tables/by-url?url=${encodeURIComponent(url)}`,
    );
    if (!response.ok) {
      logger.error(`VPS API error for URL ${url}: ${response.statusText}`);
      throw new Error(`Failed to fetch VPS game data: ${response.statusText}`);
    }
    const vpsGame = await response.json();
    return Object.keys(vpsGame).length > 0 ? vpsGame : null;
  } catch (error) {
    logger.error(`Error fetching VPS game data for URL ${url}:`, error);
    throw new Error(
      "Could not retrieve VPS game data. Please try again later.",
    );
  }
};

export default {
  getVpsGameById,
  getVpsGameByUrl,
};
