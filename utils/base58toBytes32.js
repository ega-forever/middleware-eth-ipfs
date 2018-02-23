/**
 * Converts stored hash in byte32 format (from eth) to base58
 * @module helpers/bytes32toBase58
 */

const bs58 = require('bs58');

/**
 * Function for conversion
 * @param {string} hash The hash representation in base58 format
 * @return {string}
 */
module.exports = hash =>
  bs58.decode(hash).toString('hex').replace('1220', '0x');
