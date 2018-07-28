/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Ping IPFS by specified time in config
 * @module services/scheduleService
 * @see module:config
 */

const _ = require('lodash'),
  pinModel = require('../models/pinModel'),
  Promise = require('bluebird'),
  txLogModel = require('../models/txLogModel'),
  base58toBytes32 = require('../utils/encode/base58toBytes32'),
  eventToQueryConverter = require('../utils/converters/eventToQueryConverter'),
  queryResultToEventArgsConverter = require('../utils/converters/queryResultToEventArgsConverter'),
  bytes32toBase58 = require('../utils/encode/bytes32toBase58'),
  PREFETCH_LIMIT = 10;


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
              payload: null,
              fail_tries: 0
            }
          },
          upsert: true
        }
      }));

      await pinModel.bulkWrite(bulkOps);
    }

  });
};


const udpateStateWithOutdated = async ()=>{

};


module.exports = async (eventName, newHashName, oldHashName) => {

  //let queryWithOutDated = {};

  if (oldHashName) {
    let outdatedRecordsQuery = eventToQueryConverter(eventName, {[oldHashName]: {$ne: '0x0000000000000000000000000000000000000000000000000000000000000000'}});

    let outdatedRecordsCount = await txLogModel.count(outdatedRecordsQuery);

    return await Promise.mapSeries(_.range(0, outdatedRecordsCount, PREFETCH_LIMIT), async startIndex => {

      let outDatedLogRecords = await txLogModel.find(outdatedRecordsQuery).sort({blockNumber: 1}).skip(startIndex).limit(PREFETCH_LIMIT);
      let minOutDateBlockNumber = _.chain(outDatedLogRecords).last().get('blockNumber', 0).value();
      let maxOutDateBlockNumber = _.chain(outDatedLogRecords).head().get('blockNumber', 0).value();

      console.log(startIndex, minOutDateBlockNumber, maxOutDateBlockNumber)

      let outdatedRecords = queryResultToEventArgsConverter(eventName, outDatedLogRecords);

      let outdatedHashesInBlocks = _.chain(outdatedRecords)
        .map(rec => ({[oldHashName]: rec[oldHashName], blockNumber: rec.includedIn.blockNumber}))
        .orderBy('blockNumber', 'desc')
        .uniqBy(oldHashName)
        .value();

      const removed = await pinModel.remove({bytes32: {$in: outdatedHashesInBlocks.map(item=>item[oldHashName])}});

      console.log(removed.result)

      let queryWithOutDated = {
        $or: outdatedHashesInBlocks.map(item => ({
          [newHashName]: item[oldHashName],
          blockNumber: {$gt: item.blockNumber, $lte: maxOutDateBlockNumber} //todo may be do {$gt: blocknumberMin, $lt: blocknumberMax}
        }))
      };

      queryWithOutDated.$or.push({
          [newHashName]: {$nin: outdatedHashesInBlocks.map(item => item[oldHashName])},
          blockNumber: {$gte: minOutDateBlockNumber, $lte: maxOutDateBlockNumber}
        });

      return await updateState(eventName, newHashName, queryWithOutDated);

    });

    /*    outdatedRecords = _.flatten(outdatedRecords);

        // let outdatedRecords = await txLogModel.find(outdatedRecordsQuery);
        outdatedRecords = queryResultToEventArgsConverter(eventName, outdatedRecords);

        let outdatedHashesInBlocks = _.chain(outdatedRecords)
          .map(rec => ({[oldHashName]: rec[oldHashName], blockNumber: rec.includedIn.blockNumber}))
          .orderBy('blockNumber', 'desc')
          .uniqBy(oldHashName)
          .value();

        queryWithOutDated = {
          $or: outdatedHashesInBlocks.map(item => ({
            [newHashName]: item[oldHashName],
            blockNumber: {$gt: item.blockNumber}
          }))
        };

        queryWithOutDated.$or.push(
          {[newHashName]: {$nin: outdatedHashesInBlocks.map(item => item[oldHashName])}}
        );*/
  }

  await updateState(eventName, newHashName);

/*  let actualRecordsQuery = eventToQueryConverter(eventName, Object.keys(queryWithOutDated).length ? queryWithOutDated : {});
  let actualRecords = await txLogModel.find(actualRecordsQuery);


  return _.chain(actualRecords)
    .thru(records => queryResultToEventArgsConverter(eventName, records))
    .map(item => item[newHashName] ? bytes32toBase58(item[newHashName]) : null)
    .compact()
    .uniq()
    .value();*/
};
