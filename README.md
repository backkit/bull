# BackKit Bull

Backkit service for [bull](https://github.com/OptimalBits/bull), redis based job queue


# Interactive + Autoconf Install

```
npm install --foreground-scripts --progress false @backkit/bull --save
```

# Non-Interactive Install with Default Autoconf Install

```
npm install --save @backkit/bull
```

# Non-Interactive Non-Autoconf Install

```
NO_AUTOCONF=y npm install @backkit/bull --save
```

# Migration

### 0.2.x

- Starting with 0.2.x, a new and prefered way to connect to redis is using connection string (see below).
- To avoid ECONNRESET error, when using `rediss://` schema you have to set at least and empty `queue.options.tls = {}` object !
- You can still use a host|port|username|password|db object, instead of connection string, but it is deprecated in favor of connection strings
- 0.2.x unlocks a lot of custom configuration options. Please check "Advanced configuration" section


# Configuration examples

/config/bull.yml

### Secure connection, using connection string

```yml
test:
  queue:
    redis: "rediss://username:password@example.com:6379"
    options:
      redis:
        tls: {}
        connectTimeout: 5000
  worker:
    concurency: 1
```

### Unsecure connection, using connection string

```yml
test:
  queue:
    redis: "redis://127.0.0.1:6379"
    options:
      redis:
        connectTimeout: 5000
  worker:
    concurency: 1
```

### Unsecure connection, using host|port|db|username|password object

This is strictly equivalent to the previous example

```yml
test:
  queue:
    redis:
      host: 127.0.0.1
      port: 6379
      db: 0
    options:
      redis:
        connectTimeout: 5000
  worker:
    concurency: 1
```


# Worker example

/res/bull/test.js

```node
module.exports = ({bull}) => bull.worker('test', (job) => {
  return Promise.resolve(true);
});

```

# Job producer example

/services/bull-job-producer.js

```node
class BullJobProducerService {
  constructor({bull}) {
    this.bull = bull;
  }
    
  run() {
    setInterval(() => {
      this.bull
      .getQueue('test')
      .add({x: Math.random()*1000, y: Math.random()*1000}, {
        attempts: 3,
        timeout: 5*1000
      })
      .then(job => {
        console.log("job created successfully", job.id);
        job
        .finished()
        .then(result => {
          console.log(`job ${job.id} completed`, result);
        })
        .catch(err => {
          console.log(`job ${job.id} failed`, err.message);
        });
      })
      .catch(err => {
        console.log("error creating job", err)
      });
    }, 3000);
  }
}

module.exports = BullJobProducerService;
```

# Run example

run all registered bull job queues

```bash
ENTRYPOINT=bull node index.js
```

run job producer example

```bash
ENTRYPOINT=bullJobProducer node index.js
```



# Advanced configuration


### Redis key prefix

```

  queue.options.prefix

  ===

  prefix: "myapp"
```

### Worker rate limit

```

  queue.options.limiter

  ===

  limiter: {
    // Max number of jobs processed
    max: 10000,
    // per duration in milliseconds
    duration: 10*60*1000,
    // When jobs get rate limited, they stay in the waiting queue and are not moved to the delayed queue
    bounceBack: false
  },
```


### Redis connection syntaxes

```

  queue.redis

  @see https://github.com/redis/ioredis?tab=readme-ov-file#connect-to-redis

  ===

  redis: rediss://...

  OR

  redis: {
    host: ...,
    port: ...,
    db: ...,
    password: ...,
  }

  !!! In case you use a secure connection string, you have to set queue.options.redis.tls = {} to avoid ECONNRESET
  !!! https://github.com/OptimalBits/bull/issues/1464#issuecomment-532700395
  !!! https://github.com/redis/ioredis/blob/f68290e/lib/redis/RedisOptions.ts#L184
```


### Advanced queue settings

```
  
  queue.options.settings

  ===

  settings: {
    // Key expiration time for job locks.
    lockDuration: 30000,
    // How often check for stalled jobs (use 0 for never checking).
    stalledInterval: 30000,
    // Max amount of times a stalled job will be re-processed.
    maxStalledCount: 3,
    // Poll interval for delayed jobs and added jobs.
    guardInterval: 5000,
    // delay before processing next job in case of internal error.
    retryProcessDelay: 5000,
    // A set of custom backoff strategies keyed by name.
    backoffStrategies: {},
    // A timeout for when the queue is in drained state (empty waiting for jobs).
    drainDelay: 5
  },
```


### Metrics options

```
  queue.options.metrics

  metrics: {
    maxDataPoints?: number; //  Max number of data points to collect, granularity is fixed at one minute.
  }

```


### Redis options

```
  !!!!!!  Do not confuse it with the redis connection string/object located at queue.redis !!!!!!!!
  !!!!!!  Overall ioredis is confusing because you can set host/port/username/passsword in at least 3 places !!!!!!!!
  !!!!!!  So be careful !!!!!!!!
  queue.options.redis

  Full list of options: https://github.com/redis/ioredis/blob/v4/API.md#new-redisport-host-options

  redis: {
    // Port of the Redis server, or a URL string, or the options object.
    port: 6379,
    // Host of the Redis server, when the first argument is a URL string, this argument is an object represents the options.
    host: "localhost",
    // Other options.
    options: {
        // Port of the Redis server.
        port: 6379,
        // Host of the Redis server.
        host: "localhost",
        // Version of IP stack. Defaults to 4.
        family: 4,
        // Local domain socket path. If set the port, host and family will be ignored.
        path: null,
        // TCP KeepAlive on the socket with a X ms delay before start. Set to a non-number value to disable keepAlive.
        keepAlive: 0,
        // Whether to disable the Nagle's Algorithm. By default we disable it to reduce the latency.
        noDelay: true,
        // Connection name.
        connectionName: null,
        // Database index to use.
        db: 0,
        // If set, client will send AUTH command with the value of this option when connected.
        password: null,
        // Similar to password. Provide this for Redis ACL support.
        username: null,
        // Drop the buffer support for better performance. This option is recommended to be enabled when handling large array response and you don't need the buffer support.
        dropBufferSupport: false,
        // When a connection is established to the Redis server, the server might still be loading the database from disk. While loading, the server not respond to any commands. To work around this, when this option is true, ioredis will check the status of the Redis server, and when the Redis server is able to process commands, a ready event will be emitted.
        enableReadyCheck: true,
        // By default, if there is no active connection to the Redis server, commands are added to a queue and are executed once the connection is "ready" (when enableReadyCheck is true, "ready" means the Redis server has loaded the database from disk, otherwise means the connection to the Redis server has been established). If this option is false, when execute the command when the connection isn't ready, an error will be returned.
        enableOfflineQueue: true,
        // The milliseconds before a timeout occurs during the initial connection to the Redis server.
        connectTimeout: 10000,
        // The milliseconds before socket.destroy() is called after socket.end() if the connection remains half-open during disconnection.
        disconnectTimeout: 2000,
        // The milliseconds before a timeout occurs when executing a single command. By default, there is no timeout and the client will wait indefinitely. The timeout is enforced only on the client side, not server side. The server may still complete the operation after a timeout error occurs on the client side.
        commandTimeout: undefined,
        // After reconnected, if the previous connection was in the subscriber mode, client will auto re-subscribe these channels.
        autoResubscribe: true,
        // If true, client will resend unfulfilled commands(e.g. block commands) in the previous connection when reconnected.
        autoResendUnfulfilledCommands: true,
        // By default, When a new Redis instance is created, it will connect to Redis server automatically. If you want to keep the instance disconnected until a command is called, you can pass the lazyConnect option to the constructor.
        lazyConnect: false,
        // TLS connection support. See https://github.com/luin/ioredis#tls-options
        tls: {},
        // The prefix to prepend to all keys in a command.
        keyPrefix: "",
        // See "Quick Start" section.
        retryStrategy: undefined,
        // See "Quick Start" section.
        maxRetriesPerRequest: undefined,
        // See "Quick Start" section.
        reconnectOnError: undefined,
        // Enable READONLY mode for the connection. Only available for cluster mode.
        readOnly: false,
        // Force numbers to be always returned as JavaScript strings. This option is necessary when dealing with big numbers (exceed the [-2^53, +2^53] range).
        stringNumbers: false,
        // When enabled, all commands issued during an event loop iteration are automatically wrapped in a pipeline and sent to the server at the same time. This can improve performance by 30-50%.
        enableAutoPipelining: false,
        // The list of commands which must not be automatically wrapped in pipelines.
        autoPipeliningIgnoredCommands: [],
        // Default script definition caching time.
        maxScriptsCachingTime: 60000
    }
  }
```


