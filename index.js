/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Middleware service for maintaining records in IPFS
 * See required modules
 * models/pinModel {@link models/pinModel}
 * @module Chronobank/eth-ipfs
 * @requires models/pinModel
 * @requires services/scheduleService
 * @requires helpers/bytes32toBase58
 */

const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  fetchHashesService = require('./services/fetchHashesService'),
  schedule = require('node-schedule'),
  ipfsAPI = require('ipfs-api'),
  bunyan = require('bunyan'),
  _ = require('lodash'),
  pinModel = require('./models/pinModel'),
  smartContractsEventsFactory = require('./factories/smartContractsEventsFactory'),
  pinOrRestoreHashService = require('./services/pinOrRestoreHashService'),
  eventsModelsBuilder = require('./utils/eventsModelsBuilder'),
  log = bunyan.createLogger({name: 'core.balanceProcessor'});

mongoose.Promise = Promise;
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});

mongoose.connection.on('disconnected', function () {
  log.error('mongo disconnected!');
  process.exit(0);
});

let init = async () => {


  const ipfsStack = config.nodes.map(node => ipfsAPI(node));
  let isPending = false;
  let rule = new schedule.RecurrenceRule();
  _.merge(rule, config.schedule.job);

//  schedule.scheduleJob(rule, async () => {

  if (isPending)
    return;

  log.info('pinning...');
  isPending = true;

  let records = await Promise.mapSeries(config.events, async event => {

    let definition = _.find(smartContractsEventsFactory.events, ev=> ev.name.toLowerCase() === event.eventName);

    if(!definition)
      return [];

    return await fetchHashesService(event.eventName, event.newHashField, event.oldHashField);
  });

  records = _.flattenDeep(records);

  console.log(records.length);//todo refill
  process.exit(0);


/*  const otherPins = await pinModel.find({
    $or: [
      {
        created: {
          $gte: new Date(Date.now() - 30 * 24 * 3600000)
        }
      },
      {
        created: {
          $lt: new Date(Date.now() - 30 * 24 * 3600000)
        },
        fail_tries: {$lt: 100}
      }
    ],
    hash: {$nin: records}
  });*/

  records = _.chain(otherPins)
    .map(pin => pin.hash)
    .union(records)
    .uniq()
    .value();

/*  const pinResult = await pinOrRestoreHashService(records, ipfsStack);

  if (pinResult.inactiveHashes) {
    log.info('inactive hashes count: ', pinResult.inactiveHashes.length);
    log.info('inactive hashes: ', pinResult.inactiveHashes);
  }*/

  isPending = false;

  //});

};

module.exports = init();
