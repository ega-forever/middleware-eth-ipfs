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
  scheduleService = require('./services/scheduleService'),
  bunyan = require('bunyan'),
  requireAll = require('require-all'),
  _ = require('lodash'),
  eventsModelsBuilder = require('./utils/eventsModelsBuilder'),
  log = bunyan.createLogger({name: 'core.balanceProcessor'}),
  contracts = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: config.smartContracts.path,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
  });

mongoose.Promise = Promise;
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});

mongoose.connection.on('disconnected', function () {
  log.error('mongo disconnected!');
  process.exit(0);
});

let init = async () => {

  let events = eventsModelsBuilder(contracts);

  events = _.chain(events)
    .toPairs()
    .transform((result, pair) => {

      let confEvent = _.find(config.smartContracts.events, ev => ev.eventName.toLowerCase() === pair[0].toLowerCase());

      if (confEvent)
        result.push(_.merge({
          model: pair[1],
        }, confEvent));

    }, [])
    .value();

  for (const event of events)
    scheduleService(event);

};

module.exports = init();
