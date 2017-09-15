const _ = require('lodash'),
  url = require('url');
require('dotenv').config();

const config = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/data'
  },	
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672'
  },
  schedule: {
    job: process.env.SCHEDULE_JOB || '30 * * * * *',
    checkTime: parseInt(process.env.SCHEDULE_CHECK_TIME) || 0
  },
  nodes: process.env.IPFS_NODES ? _.chain(process.env.IPFS_NODES)
    .split(',')
    .map(i => {
      i = url.parse(i.trim());
      return {host: i.hostname, port: i.port, protocol: i.protocol.replace(':', '')};
    })
    .value() :
    [{'host': 'localhost', 'port': '5001', 'protocol': 'http'}]
};

module.exports = config;
