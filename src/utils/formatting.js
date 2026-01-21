/**
 * Format a number with thousands separators.
 * Replaces numeral library.
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("en-US", { minimumFractionDigits: 0 });
};

/**
 * Format a date as MM/DD/YYYY HH:mm:ss.
 * Replaces moment/date-and-time for formatting.
 */
export const formatDateTime = (date = new Date()) => {
  const pad = (n) => n.toString().padStart(2, "0");
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Format a date as MM/DD/YYYY.
 */
export const formatDate = (date = new Date()) => {
  const pad = (n) => n.toString().padStart(2, "0");
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Format a date as YYYY-MM-DD.
 */
export const formatDateISO = (date = new Date()) => {
  const pad = (n) => n.toString().padStart(2, "0");
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};

/**
 * Parse a date string in YYYY-MM-DD format.
 */
export const parseDate = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Add days to a date.
 */
export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export const truncate = (str, maxLength) => {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
};

/**
 * Transform a date from one format to another.
 * Simple replacement for date-and-time transform.
 */
export const transformDate = (dateStr, fromFormat, toFormat) => {
  // Only supporting MM/DD/YYYY... to MM/DD/YYYY for now
  if (fromFormat.startsWith("MM/DD/YYYY") && toFormat === "MM/DD/YYYY") {
    return dateStr.substring(0, 10);
  }
  return dateStr;
};

export default {
  formatNumber,
  formatDateTime,
  formatDate,
  formatDateISO,
  parseDate,
  addDays,
  truncate,
  transformDate,
};
