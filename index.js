const bull = require('bull');

class BullService {

  /**
   * @param {String} appdir
   * @param {WinstonService} logger
   * @param {ConfigService} config
   */
  constructor({appdir, logger, config}) {
    this.appdir = appdir;
    this.logger = logger;
    this.config = config;
    this.queueProcessors = {};
  }

  /**
   * Child services should use this method to set processor function for a queue
   *
   * @param {String} queueName
   * @param {AsyncFunction} processorFn
   */
  worker(queueName, processorFn) {
    this.queueProcessors[queueName] = processorFn;
    return this;
  }

  /**
   * Returns configuration, with sane defaults for a given queue
   *
   * @param {String} name
   * @return {Object}
   */
  getQueueConfig(name) {
    const bullConfig = this.config.get('bull');
    const _queueConfig = (bullConfig[name] || {}).queue || {};
    const queueConfig = {
      options: {}
    };
    _queueConfig.options = _queueConfig.options || {};
    _queueConfig.redis = _queueConfig.redis || {};

    /*
      Redis prefix
      queue.options.prefix

      ===
    */
    if (_queueConfig.options.prefix) {
      // redis prefix
      queueConfig.options.prefix = _queueConfig.options.prefix;
    } else {
      queueConfig.options.prefix = 'bull';
    }

    /*
      Worker rate limit
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
    */
    if (_queueConfig.options.limiter) {
      queueConfig.options.limiter = _queueConfig.options.limiter;
    }

    
    /*
      Redis connection
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

      !!! In case you use a connection string, you have to set queue.options.redis.tls = {} to avoid ECONNRESET
      !!! https://github.com/OptimalBits/bull/issues/1464#issuecomment-532700395
      !!! https://github.com/redis/ioredis/blob/f68290e/lib/redis/RedisOptions.ts#L184
    */
    if (_queueConfig.redis) {
      // redis connection string url OR socket file (ex: /tmp/redis.sock)
      if (typeof(_queueConfig.redis) === 'string') {
        queueConfig.redis = _queueConfig.redis;
      }
      // fallback to host|port|db|password format for compatibility reasons
      else if (typeof(_queueConfig.redis) === 'object') {
        queueConfig.redis = {redis: _queueConfig.redis};
        // ensre there is at least host/port
        queueConfig.redis.redis.host = queueConfig.redis.redis.host || '127.0.0.1';
        queueConfig.redis.redis.port = queueConfig.redis.redis.port || 6379;
      }
      // simple port format (see ioredis)
      else if (typeof(_queueConfig.redis) === 'number' && Number.isInteger(_queueConfig.redis)) {
        queueConfig.redis.redis.host = '127.0.0.1';
        queueConfig.redis.redis.port = ~~(_queueConfig.redis);
        queueConfig.redis.redis.db = 0;
      }
      else {
        throw Error(`@backkit/bull: Bad queueConfig.redis config`);
      }
    } else {
      throw Error(`@backkit/bull: Missing queueConfig.redis config`);
    }

    /*
    // @todo https://github.com/redis/ioredis/blob/f68290e/lib/redis/RedisOptions.ts#L195C3-L195C16
    queueConfig.redis.retryStrategy = function(options) {
      const {attempt, total_retry_time, error, times_connected} = options;
      console.log(`redis retry strategy: attempt #${attempt}, time spent to reconnect: ${total_retry_time}, connected ${times_connected} times, err ${error?error.message:''}`);
      return 5000;
    };
    */

    /*
      Advanced queue settings
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
    */
    if (_queueConfig.options.settings && typeof(_queueConfig.options.settings) === 'object') {
      queueConfig.options.settings = _queueConfig.options.settings;
    }


    /*
      Metrics options
      queue.options.metrics

      metrics: {
        maxDataPoints?: number; //  Max number of data points to collect, granularity is fixed at one minute.
      }

     */
    if (_queueConfig.options.metrics && typeof(_queueConfig.options.metrics) === 'object') {
      queueConfig.options.metrics = _queueConfig.options.metrics;
    }


    /*
      Redis options  !!!!!!  Do not confuse it with the redis connection string/object located at queue.redis !!!!!!!!
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

     */
    if (_queueConfig.options.redis && typeof(_queueConfig.options.redis) === 'object') {
      queueConfig.options.redis = _queueConfig.options.redis;
    }



    /*
      Default job options
      queue.options.defaultJobOptions

      ===

      defaultJobOptions: {
        // Optional priority value. ranges from 1 (highest priority) to MAX_INT  (lowest priority). Note that
        // using priorities has a slight impact on performance, so do not use it if not required.
        priority: 1,

        // An amount of miliseconds to wait until this job can be processed. Note that for accurate delays, both
        // server and clients should have their clocks synchronized. [optional].
        delay: number;

        // The total number of attempts to try the job until it completes.
        attempts: 3,

        // Repeat job according to a cron specification.
        repeat: {
          // Cron string
          cron?: string;
          // Timezone
          tz?: string,
          // Start date when the repeat job should start repeating (only with cron).
          startDate?: Date | string | number;
          // End date when the repeat job should stop repeating.
          endDate?: Date | string | number;
          // Number of times the job should repeat at max.
          limit?: number;
          // Repeat every millis (cron setting cannot be used together with this setting.)
          every?: number;
          // The start value for the repeat iteration count.
          count?: number,
        },

        // Backoff setting for automatic retries if the job fails
        backoff: {
          // Backoff type, which can be either `fixed` or `exponential`. A custom backoff strategy can also be specified in `backoffStrategies` on the queue settings.
          type: 'fixed',
          // Backoff delay, in milliseconds.
          delay: 5000
        },

        // if true, adds the job to the right of the queue instead of the left (default false)
        lifo: false,

        // The number of milliseconds after which the job should be fail with a timeout error [optional]
        timeout: 3600000,

        // If true, removes the job when it successfully
        // completes. Default behavior is to keep the job in the completed set.
        removeOnComplete: false,

        // If true, removes the job when it fails after all attempts.
        // Default behavior is to keep the job in the failed set.
        removeOnFail: false,

        // Limits the amount of stack trace lines that will be recorded in the stacktrace.
        stackTraceLimit: 1000
      }
    */
    if (_queueConfig.options.defaultJobOptions && typeof(_queueConfig.options.defaultJobOptions) === 'object') {
      queueConfig.options.defaultJobOptions = _queueConfig.options.defaultJobOptions;
    }

    return queueConfig;
  }

  /**
   * Returns configuration, with sane defaults for a given worker
   *
   * @param {String} name - queue name
   * @return {Object}
   */
  getWorkerConfig(name) {
    const bullConfig = this.config.get('bull');
    const _workerConfig = (bullConfig[name] || {}).worker || {};
    const workerConfig = {
      concurency: _workerConfig.concurency || 10
    };
    return workerConfig;
  }

  /**
   * Returns a bull queue by name
   *
   * @see fix for "error: read ECONNRESET" when using connection string "rediss://..."
   *      https://github.com/OptimalBits/bull/issues/1464#issuecomment-532700395
   *      we have to set options, 3rd bull queue argument: {redis: tls: {}}
   * 
   * @see https://github.com/OptimalBits/bull/blob/develop/REFERENCE.md#queue
   * @see https://github.com/OptimalBits/bull/blob/develop/lib/queue.js
   * 
   * @param {String} name
   * @return {Object}
   */
  getQueue(name) {
    const queueConfig = this.getQueueConfig(name);
    return new bull(name, queueConfig.redis, queueConfig.options);
  }

  /**
   * Starts a queue processor by name
   */
  runWorker(name) {
    this.logger.info(`Starting queue ${name}...`);
    const queueConfig = this.getQueueConfig(name);
    const workerConfig = this.getWorkerConfig(name);
    const queue = this.getQueue(name);

    queue
    // queue events
    .on('error', (error) => {
      this.logger.error(`Queue ${name} error: ${error?error.message:''}`);
    })

    .on('paused', () => {
      this.logger.info(`Queue ${name} paused`);
    })

    .on('resumed', () => {
      this.logger.info(`Queue ${name} resumed`);
    })

    .on('cleaned', (jobs, type) => {
      this.logger.info(`Queue ${name} cleaned old jobs: ${jobs}`);
    })

    .on('drained', () => {
      this.logger.info(`Queue ${name} drained`);
    })

    // job events
    .on('waiting', (jobId) => {
      //this.logger.info(`Queue ${name}, job #${jobId} waiting`);
    })

    .on('active', (job, jobPromise) => {
      this.logger.info(`Queue ${name}, job #${job.id} active`);
    })

    .on('stalled', (job) => {
      this.logger.info(`Queue ${name}, job #${job.id} stalled`);
    })

    .on('progress', (job, progress) => {
      this.logger.info(`Queue ${name}, job #${job.id} progress ${progress}`);
    })

    .on('completed', (job, result) => {
      this.logger.info(`Queue ${name}, job #${job.id} successfully completed`, {result});
    })

    .on('failed', (job, err) => {
      this.logger.info(`Queue ${name}, job #${job.id} failed`);
    })

    .on('removed', (job) => {
      this.logger.info(`Queue ${name}, job #${job.id} removed`);
    });

    setInterval(() => {
      queue
      .getJobCounts()
      .then((counts) => {
        this.logger.info(`Queue ${name} waiting: ${counts.waiting}, active: ${counts.active}, completed: ${counts.completed}, failed: ${counts.failed}, delayed: ${counts.delayed}`);
      })
      .catch(err => {
        this.logger.info(`Queue ${name}, healthcheck failed`);
      })
    }, 30*1000);

    queue.process(workerConfig.concurency, this.queueProcessors[name]);
    return this;
  }
  
  /**
   * Start all queue workers
   */
  run() {
    for (let name in this.queueProcessors) {
      this.runWorker(`${name}`);
    }
  }

  /**
   * Register all queue processors
   *
   * @return {String}
   */
  register() {
    return `${this.appdir}/res/bull/*.js`;
  }
}

module.exports = BullService;