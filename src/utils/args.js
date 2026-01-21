/**
 * Get an argument from a Discord interaction options data array.
 * @param {Array} argList - The interaction options data array
 * @param {string} type - The type of argument: 'bool', 'int', or 'string'
 * @param {string} name - The name of the argument
 * @returns {*} The argument value
 */
export const getArg = (argList, type, name) => {
  switch (type) {
    case "bool":
      return argList.some(
        (x) => x.name === name && x.value?.toLowerCase() === "true"
      );
    case "int":
      return parseInt(argList.find((x) => x.name === name)?.value);
    case "string":
    default:
      return argList.find((x) => x.name === name)?.value;
  }
};

/**
 * Get a string argument from interaction options.
 */
export const getString = (interaction, name) => {
  return interaction.options.getString(name);
};

/**
 * Get an integer argument from interaction options.
 */
export const getInteger = (interaction, name) => {
  return interaction.options.getInteger(name);
};

/**
 * Get a boolean argument from interaction options.
 */
export const getBoolean = (interaction, name) => {
  return interaction.options.getBoolean(name);
};

/**
 * Get a user argument from interaction options.
 */
export const getUser = (interaction, name) => {
  return interaction.options.getUser(name);
};

/**
 * Get a channel argument from interaction options.
 */
export const getChannel = (interaction, name) => {
  return interaction.options.getChannel(name);
};

export default {
  getArg,
  getString,
  getInteger,
  getBoolean,
  getUser,
  getChannel,
};
