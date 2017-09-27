# middleware-eth-ipfs [![Build Status](https://travis-ci.org/ChronoBank/middleware-eth-ipfs.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-eth-ipfs)

Middleware service for maintaining records in ipfs

###Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used to maintain user profiles in ipfs.


#### How does it work

This how does it work:
1) this module listen to setHash event (which is an event, emitted when user register/update his info on platform)
2) it grab the ipfs hash and put it to pins collection
3) each time interval - module tries to ping addresses (which are regsitered in pins collection)



##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_URI=mongodb://localhost:27017/data
IPFS_NODES=http://localhost:5001, http://localhost:5001
SCHEDULE_JOB=30 * * * * *
SCHEDULE_CHECK_TIME=0
RABBIT_URI=amqp://localhost:5672
NETWORK=development
```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| IPFS_NODES   | should contain a comma separated uri connection strings for ipfs nodes
| SCHEDULE_JOB   | a configuration for ipfs pin plugin in a cron based format
| SCHEDULE_CHECK_TIME   | an option, which defines how old should be records, which have to be pinned
| RABBIT_URI   | rabbitmq URI connection string
| NETWORK   | network name (alias)- is used for connecting via ipc (see block processor section)

License
----

MIT