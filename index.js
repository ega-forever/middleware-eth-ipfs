/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Middleware service for maintaining records in IPFS
 * @module Chronobank/eth-ipfs
 */

const config = require('./config'),
  Promise = require('bluebird'),
  cronParser = require('cron-parser'),
  mongoose = require('mongoose'),
  fetchHashesService = require('./services/fetchHashesService'),
  schedule = require('node-schedule'),
  ipfsAPI = require('ipfs-api'),
  bunyan = require('bunyan'),
  _ = require('lodash'),
  AmqpService = require('middleware_common_infrastructure/AmqpService'),
  InfrastructureInfo = require('middleware_common_infrastructure/InfrastructureInfo'),
  InfrastructureService = require('middleware_common_infrastructure/InfrastructureService'),
  smartContractsEventsFactory = require('./factories/smartContractsEventsFactory'),
  sem = require('semaphore')(1),,
  pinOrRestoreHashService = require('./services/pinOrRestoreHashService'),
  log = bunyan.createLogger({name: 'plugins.ipfs', level: config.logs.level});

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

  const ipfsStack = config.nodes.map(node => ipfsAPI(node));
  const rulePin = new schedule.RecurrenceRule();
  const ruleFetch = new schedule.RecurrenceRule();

  _.merge(rulePin, _.pick(cronParser.parseExpression(config.schedule.pinJob)._fields, ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']));
  _.merge(ruleFetch, _.pick(cronParser.parseExpression(config.schedule.fetchJob)._fields, ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']));


  let isFetchHashesPending = false;
  let isPinHashesPending = false;

  schedule.scheduleJob(ruleFetch, async () => {
    if (isFetchHashesPending)
      return;

    isFetchHashesPending = true;
    sem.take(async () => {
      log.info('start scanning cache for hashes');
      await Promise.mapSeries(config.events, async event => {

        let definition = _.find(smartContractsEventsFactory.events, ev => ev.name.toLowerCase() === event.eventName);
        if (!definition)
          return [];

        return await fetchHashesService(event.eventName, event.newHashField, event.oldHashField);
      });

      log.info('successfully cached records');
      isFetchHashesPending = false;
      sem.leave();
    });
  });


  schedule.scheduleJob(rulePin, async () => {
    if (isPinHashesPending)
      return;

    isPinHashesPending = true;
    sem.take(async () => {
      log.info('start pinning records');
      await pinOrRestoreHashService(ipfsStack);
      log.info('successfully pinned records');
      isPinHashesPending = false;
      sem.leave();
    });
  });
};

module.exports = init();
