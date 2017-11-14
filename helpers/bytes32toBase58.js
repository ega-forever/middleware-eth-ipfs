/**
 * Converts stored hash in byte32 format (from eth) to base58
 * @module helpers/bytes32toBase58
 */

const bs58 = require('bs58');

/**
 * Function for conversion
 * @param {string} hexString The hash representation in byte32 format
 * @return {string}
 */
module.exports = hexString =>
  bs58.encode(Buffer.from(hexString.replace('0x', '1220'), 'hex'));
