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
  requireAll = require('require-all'),
  _ = require('lodash'),
  pinModel = require('./models/pinModel'),
  contract = require('truffle-contract'),
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

  const contracts = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: config.smartContracts.path,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
    resolve: Contract => contract(Contract)
  });

  let events = eventsModelsBuilder(contracts);

  const ipfsStack = config.nodes.map(node => ipfsAPI(node));
  let isPending = false;
  let rule = new schedule.RecurrenceRule();
  _.merge(rule, config.schedule.job);

  schedule.scheduleJob(rule, async () => {

    if (isPending)
      return;

    log.info('pinning...');
    isPending = true;

    let records = await Promise.mapSeries(config.events, async event =>
      events[event.eventName] ?
        await fetchHashesService(events[event.eventName], event.newHashField, event.oldHashField) : []
    );

    records = _.chain(records)
      .flattenDeep()
      .uniq()
      .compact()
      .value();

    const otherPins = await pinModel.find({
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
    });

    records = _.chain(otherPins)
      .map(pin => pin.hash)
      .union(records)
      .uniq()
      .value();

    const pinResult = await pinOrRestoreHashService(records, ipfsStack);

    if (pinResult.inactiveHashes) {
      log.info('inactive hashes count: ', pinResult.inactiveHashes.length);
      log.info('inactive hashes: ', pinResult.inactiveHashes);
    }

    isPending = false;

  });

};

module.exports = init();
