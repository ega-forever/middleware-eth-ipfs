# middleware-eth-ipfs [![Build Status](https://travis-ci.org/ChronoBank/middleware-eth-ipfs.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-eth-ipfs)

Middleware service for maintaining records in ipfs

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used to maintain the ipfs hashes.


#### How does it work

1) this module listen to the specified events in config.
For instance:
```
setHash:newHash:oldHash
```
where setHash - is event name, newHash - is a new encoded multihash for ipfs, and old hash - is an old hash (this arg is optional).
2) it grabs the ipfs hash and put it to pins collection. In case, the 3 argument (in our case oldHash) is present - the ipfs module will search a record with this hash in collection, and replace it with new hash(in our example - newHash)
3) each time interval - module tries to ping addresses (which are regsitered in pins collection)


### Where does it take data?
The data, which use this plugin is located in ethTxLogs collection, which is maintained by [eth-blockprocessor service](https://github.com/ChronoBank/middleware-eth-blockprocessor).

### How do I need to store IPFS hashes in event args?
You should convert your base58 hash to bytes32 representation. Please refer to `utils/encode` directory for converter implementation.


##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_DATA_URI=mongodb://localhost:27017/data
MONGO_DATA_COLLECTION_PREFIX=eth
IPFS_NODES=http://localhost:5001, http://localhost:5001
SCHEDULE_JOB=30 * * * * *
RABBIT_URI=amqp://localhost:5672
RABBIT_SERVICE_NAME: 'app_eth'

NETWORK=development

SM_EVENTS: 'setHash:newHash:oldHash'

```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| MONGO_DATA_URI   | the URI string for mongo connection, which holds data collections (for instance, processed block's height). In case, it's not specified, then default MONGO_URI connection will be used)
| MONGO_DATA_COLLECTION_PREFIX   | the collection prefix for data collections in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| IPFS_NODES   | should contain a comma separated uri connection strings for ipfs nodes
| SCHEDULE_JOB   | a configuration for ipfs pin and update actual hashes jobs in a cron based format
| SCHEDULE_PIN_JOB   | a configuration for ipfs pin plugin in a cron based format (if not specified, then SCHEDULE_JOB param will be used)
| SCHEDULE_FETCH_JOB   | a configuration for ipfs update actual hashes job in a cron based format (if not specified, then SCHEDULE_JOB param will be used)
| SCHEDULE_CHECK_TIME   | an option, which defines how old should be records, which have to be pinned
| SMART_CONTRACTS_NETWORK_ID   | the network id (1-mainnet, 4-rinkeby and so on)
| SM_EVENTS   | smart contract's event definition for hash create/update (ipfs multihash). Has the following signature: 'event_name:new_hash_field:old_hash_field'. 3 argument (old_hash_field) is optional
| SYSTEM_RABBIT_URI   | rabbitmq URI connection string for infrastructure
| SYSTEM_RABBIT_SERVICE_NAME   | rabbitmq service name for infrastructure
| SYSTEM_RABBIT_EXCHANGE   | rabbitmq exchange name for infrastructure
| CHECK_SYSTEM | check infrastructure or not (default = true)
| LOG_LEVEL   | the logging level. Can be 'error' (which prints only errors) or 'info' (prints errors + info logs). Default is 'info' level


License
----
 [GNU AGPLv3](LICENSE)
=======
Copyright
LaborX PTY
