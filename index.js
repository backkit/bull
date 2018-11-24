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
      // redis prefix
      prefix: 'bull',
      /*
      // worker rate limit
      limiter: {
        // Max number of jobs processed
        max: 10000,
        // per duration in milliseconds
        duration: 10*60*1000,
        // When jobs get rate limited, they stay in the waiting queue and are not moved to the delayed queue
        bounceBack: false
      },
      */
      // redis connection
      redis: {
        host: _queueConfig.redis && _queueConfig.redis.host ? _queueConfig.redis.host : '127.0.0.1',
        port: _queueConfig.redis && _queueConfig.redis.port ? _queueConfig.redis.port : 6379,
        db: _queueConfig.redis && _queueConfig.redis.db ? _queueConfig.redis.db : 0,
        // password
        options: {
        },
        retry_strategy: function(options) {
          const {attempt, total_retry_time, error, times_connected} = options;
          console.log(`redis retry strategy: attempt #${attempt}, time spent to reconnect: ${total_retry_time}, connected ${times_connected} times, err ${error?error.message:''}`);
          return 5000;
        }
      },
      /*
      // advanced queue settings
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
      // default job options
      /*
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
    };
    return queueConfig;
  }

  /**
   * Returns configuration, with sane defaults for a given worker
   *
   * @param {String} name - queue name
   * @return {Object}
   */
  getWorkerConfig(name) {
    const beeConfig = this.config.get('bull');
    const _workerConfig = (beeConfig[name] || {}).worker || {};
    const workerConfig = {
      concurency: _workerConfig.concurency || 10
    };
    return workerConfig;
  }

  /**
   * Returns a bull queue by name
   *
   * @param {String} name
   * @return {Object}
   */
  getQueue(name) {
    const queueConfig = this.getQueueConfig(name);
    const queue = new bull(name, queueConfig);
    return queue;
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
      this.logger.info(`Queue ${name}, job #${jobId} waiting`);
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
    }, 5000);

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