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
  txLogModel = require('../models/txLogModel'),
  eventToQueryConverter = require('../utils/converters/eventToQueryConverter'),
  queryResultToEventArgsConverter = require('../utils/converters/queryResultToEventArgsConverter'),
  bytes32toBase58 = require('../utils/encode/bytes32toBase58');

module.exports = async (eventName, newHashName, oldHashName) => {

  /*  let badPins = await pinModel.find({
      created: {
        $lt: new Date(Date.now() - 30 * 24 * 3600000)
      },
      fail_tries: {$gte: 100}
    });

    badPins = badPins.map(pin => pin.bytes32);*/

  let outdatedHashesInBlocks = [];

  if (oldHashName) {
    let outdatedRecordsQuery = eventToQueryConverter(eventName, {[oldHashName]: {$ne: '0x0000000000000000000000000000000000000000000000000000000000000000'}});

    let outdatedRecords = await txLogModel.find(outdatedRecordsQuery);
    outdatedRecords = queryResultToEventArgsConverter(eventName, outdatedRecords);

    outdatedHashesInBlocks = _.chain(outdatedRecords)
      .map(rec => ({[oldHashName]: rec[oldHashName], blockNumber: rec.includedIn.blockNumber}))
      .orderBy('blockNumber', 'desc')
      .uniqBy(oldHashName)
      .value();
  }


/*
  for(let item of outdatedHashesInBlocks){

    let actualRecordsQuery = eventToQueryConverter(eventName,{[newHashName]: {$ne: item[oldHashName]}});
    actualRecordsQuery.blockNumber = {$lte: item.blockNumber};
    let actualRecordsQuery2 = eventToQueryConverter(eventName, {[newHashName]: item[oldHashName], blockNumber: item.blockNumber});





    let totalCount = await txLogModel.count({signature: actualRecordsQuery.signature, address: actualRecordsQuery.address});

    let count = await txLogModel.count(actualRecordsQuery);
    let count2 = await txLogModel.count(actualRecordsQuery2);

    console.log(count, count2)
    console.log(require('util').inspect(actualRecordsQuery, null, 6));
    process.exit(0);
  }

  process.exit(0);

*/



  //let actualRecordsQuery = eventToQueryConverter(eventName, outdatedHashesInBlocks.length ? {[newHashName]: {$nin: [outdatedHashesInBlocks[0]]}} : {});
  let actualRecordsQuery = eventToQueryConverter(eventName, outdatedHashesInBlocks.length ?
    {$and: outdatedHashesInBlocks.map(item=>({
        [newHashName]: {$ne: item.hash},
        blockNumber: {$lte: item.blockNumber}
      }))} : {});

  console.log(require('util').inspect(actualRecordsQuery, null, 6));

  process.exit(0);

  let actualRecords = await txLogModel.find(actualRecordsQuery);

  return _.chain(actualRecords)
    .thru(records => queryResultToEventArgsConverter(eventName, records))
    .map(item => item[newHashName] ? bytes32toBase58(item[newHashName]) : null)
    .compact()
    //.uniq()
    .value();
};
