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
  AmqpService = require('middleware_common_infrastructure/AmqpService'),
  InfrastructureInfo = require('middleware_common_infrastructure/InfrastructureInfo'),
  InfrastructureService = require('middleware_common_infrastructure/InfrastructureService'),
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

const runSystem = async function () {
  const rabbit = new AmqpService(
    config.systemRabbit.url, 
    config.systemRabbit.exchange,
    config.systemRabbit.serviceName
  );
  const info = new InfrastructureInfo(require('./package.json'));
  const system = new InfrastructureService(info, rabbit, {checkInterval: 10000});
  await system.start();
  system.on(system.REQUIREMENT_ERROR, ({requirement, version}) => {
    log.error(`Not found requirement with name ${requirement.name} version=${requirement.version}.` +
        ` Last version of this middleware=${version}`);
    process.exit(1);
  });
  await system.checkRequirements();
  system.periodicallyCheck();
};

let init = async () => {
  if (config.checkSystem)
    await runSystem();

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
