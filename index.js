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
  Web3 = require('web3'),
  fetchUserHashesService = require('./services/fetchUserHashesService'),
  fetchPollHashesService = require('./services/fetchPollHashesService'),
  schedule = require('node-schedule'),
  ipfsAPI = require('ipfs-api'),
  bunyan = require('bunyan'),
  requireAll = require('require-all'),
  _ = require('lodash'),
  net = require('net'),
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

let provider = new Web3.providers.IpcProvider(config.web3.uri, net);
const web3 = new Web3();
web3.setProvider(provider);

web3.currentProvider.connection.on('end', () => {
  log.error('ipc process has finished!');
  process.exit(0);
});

web3.currentProvider.connection.on('error', () => {
  log.error('ipc process has finished!');
  process.exit(0);
});

const contracts = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
  dirname: config.smartContracts.path,
  filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
  resolve: Contract => {
    let contractInstance = contract(Contract);
    contractInstance.setProvider(provider);
    return contractInstance;
  }
});

let init = async () => {

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

    const userPinRecords = await fetchUserHashesService(events, ipfsStack);
    const pollPinRecords = await contracts.MultiEventsHistory.deployed().catch(() => null) ?
      await fetchPollHashesService(contracts, ipfsStack) : [];

    const records = _.chain(userPinRecords)
      .union(pollPinRecords)
      .uniq()
      .compact()
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
