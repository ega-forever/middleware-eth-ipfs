/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Mongoose model. Used to store hashes, which need to be pinned.
 * @module models/pinModel
 * @returns {Object} Mongoose model
 */

const mongoose = require('mongoose'),
  config = require('../config');

const Pin = new mongoose.Schema({
  hash: {type: String, required: true, unique: true},
  bytes32: {type: String, required: true, unique: true},
  created: {type: Date, required: true, default: Date.now},
  updated: {type: Date, required: true, default: Date.now},
  payload: {type: String},
  fail_tries: {type: Number, default: 0},
  network: {type: String}
});

module.exports = mongoose.model(`${config.mongo.data.collectionPrefix}Pin`, Pin);
