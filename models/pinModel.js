/** 
 * Mongoose model. Used to store hashes, which need to be pinned.
 * @module models/pinModel
 * @returns {Object} Mongoose model
 */

const mongoose = require('mongoose');

const Pin = new mongoose.Schema({
  hash: {type: String, required: true, unique: true},
  created: {type: Date, required: true, default: Date.now},
  updated: {type: Date, required: true, default: Date.now},
  network: {type: String}
});

module.exports = mongoose.model('EthPin', Pin);
