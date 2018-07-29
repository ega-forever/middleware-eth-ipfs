/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  pinModel = require('../models/pinModel'),
  Promise = require('bluebird'),
  txLogModel = require('../models/txLogModel'),
  base58toBytes32 = require('../utils/encode/base58toBytes32'),
  eventToQueryConverter = require('../utils/converters/eventToQueryConverter'),
  queryResultToEventArgsConverter = require('../utils/converters/queryResultToEventArgsConverter'),
  bytes32toBase58 = require('../utils/encode/bytes32toBase58'),
  PREFETCH_LIMIT = 100;

/**
 * @function
 * @description update ethPins collection with actual hashes
 * @param eventName - the name of sm event
 * @param newHashName - the name of param, which holds hash in bytes32 representation
 * @param query - the query sub request to filter actual records (optional)
 * @return {Promise<void>}
 */
const updateState = async (eventName, newHashName, query = {}) => {
  let actualRecordsQuery = eventToQueryConverter(eventName, query);

  let actualRecordsCount = await txLogModel.count(actualRecordsQuery);

  await Promise.mapSeries(_.range(0, actualRecordsCount, PREFETCH_LIMIT), async startIndex => {

    let actualRecords = await txLogModel.find(actualRecordsQuery).sort({blockNumber: -1}).skip(startIndex).limit(PREFETCH_LIMIT);

    const hashes = _.chain(actualRecords)
      .thru(records => queryResultToEventArgsConverter(eventName, records))
      .map(item => item[newHashName] ? bytes32toBase58(item[newHashName]) : null)
      .compact()
      .uniq()
      .value();

    if (hashes.length) {
      let bulkOps = hashes.map(hash => ({
        updateOne: {
          filter: {hash: hash},
          update: {
            $set: {
              hash: hash,
              bytes32: base58toBytes32(hash),
              updated: Date.now(),
            }
          },
          upsert: true
        }
      }));

      await pinModel.bulkWrite(bulkOps);
    }

  });
};

/**
 * @function
 * @description update ethPins collection with actual hashes, including outdated hashes.
 * @param eventName - the name of sm event
 * @param newHashName - the name of param, which holds hash in bytes32 representation
 * @param oldHashName - the name of param, which holds old hash in bytes32 representation (which shouldn't be maintained anymore). The param is optional
 * @return {Promise<void>}
 */
const updateStateWithOutdated = async (eventName, newHashName, oldHashName) => {

  let outdatedRecordsQuery = eventToQueryConverter(eventName, {[oldHashName]: {$nin: ['0x1000000000000000000000000000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000000000000000000000000000']}});
  let outdatedRecordsCount = await txLogModel.count(outdatedRecordsQuery);

  outdatedRecordsCount === 0 ? await updateState(eventName, newHashName) :
    await Promise.mapSeries(_.range(0, outdatedRecordsCount, PREFETCH_LIMIT), async startIndex => {

      let outDatedLogRecords = await txLogModel.find(outdatedRecordsQuery).sort({blockNumber: 1}).skip(startIndex).limit(PREFETCH_LIMIT);
      let minOutDateBlockNumber = _.chain(outDatedLogRecords).head().get('blockNumber', 0).value();
      let maxOutDateBlockNumber = _.chain(outDatedLogRecords).last().get('blockNumber', 0).value();

      let outdatedRecords = queryResultToEventArgsConverter(eventName, outDatedLogRecords);

      let outdatedHashesInBlocks = _.chain(outdatedRecords)
        .map(rec => ({[oldHashName]: rec[oldHashName], blockNumber: rec.includedIn.blockNumber}))
        .orderBy('blockNumber', 'desc')
        .uniqBy(oldHashName)
        .value();

      await pinModel.remove({bytes32: {$in: outdatedHashesInBlocks.map(item => item[oldHashName])}});

      let queryWithOutDated = {
        $or: outdatedHashesInBlocks.map(item => ({
          [newHashName]: item[oldHashName],
          blockNumber: {$gt: item.blockNumber, $lte: maxOutDateBlockNumber}
        }))
      };

      queryWithOutDated.$or.push({
        [newHashName]: {$nin: outdatedHashesInBlocks.map(item => item[oldHashName])},
        blockNumber: {$gte: minOutDateBlockNumber, $lte: maxOutDateBlockNumber}
      });

      return await updateState(eventName, newHashName, queryWithOutDated);
    });

};


module.exports = async (eventName, newHashName, oldHashName) => {
  oldHashName ? await updateStateWithOutdated(eventName, newHashName, oldHashName) :
    await updateState(eventName, newHashName);
};
