const config = require('./config'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  pinModel = require('./models/pinModel'),
  scheduleService = require('./services/scheduleService'),
  bytes32toBase58 = require('./helpers/bytes32toBase58'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'core.balanceProcessor'}),
  amqp = require('amqplib');

/**
 * @module entry point
 * @description update balances for accounts, which addresses were specified
 * in received transactions from blockParser via amqp
 */

mongoose.Promise = Promise;
mongoose.connect(config.mongo.uri, {useMongoClient: true});

let init = async () => {

  let conn = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('rabbitmq is not available!');
      process.exit(0);
    });

  let channel = await conn.createChannel();

  channel.on('close', () => {
    log.error('rabbitmq process has finished!');
    process.exit(0);
  });

  const defaultQueue = `app_${config.rabbit.serviceName}.ipfs`;

  await channel.assertExchange('events', 'topic', {durable: false});
  await channel.assertQueue(defaultQueue);

  for (let contract of config.contracts)
    await channel.bindQueue(defaultQueue, 'events', `${config.rabbit.serviceName}_chrono_sc.${contract.eventName.toLowerCase()}`);

  channel.consume(defaultQueue, async (data) => {
    try {
      let event = JSON.parse(data.content.toString());

      let eventDefinition = _.chain(config.contracts)
        .find({eventName: event.name})
        .pick(['newHashField', 'oldHashField'])
        .value();

      let hash = _.get(event, `payload.${eventDefinition.newHashField}`);
      let oldHash = _.get(event, `payload.${eventDefinition.oldHashField}`);

      if (hash)
        await pinModel.update(
          oldHash ? {hash: bytes32toBase58(oldHash)} : {},
          {
            $set: {
              updated: Date.now(),
              hash: bytes32toBase58(hash)
            }
          },
          {upsert: true, setDefaultsOnInsert: true}
        );

    } catch (e) {
      log.error(e);
    }

    channel.ack(data);
  });

  scheduleService();

};

module.exports = init();
