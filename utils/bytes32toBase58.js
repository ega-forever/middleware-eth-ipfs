/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

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
