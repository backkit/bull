const path = require('path');
const autoconf = require("@backkit/autoconf");
const beautifyjs = require('js-beautify').js;

autoconf('bull')
.generator(self => {
  let arr = [
    {
      putFileOnce: self.serviceConfigMainYML,
      contentYml: self.config
    },
    {
      putFileOnce: self.serviceCodeMainJS,
      content: `module.exports = require('${self.npmModuleName}')`
    }
  ];
  for (let queueName in self.config) {
    arr.push({
      putFileOnce: `${self.serviceResourceDir}${path.sep}${queueName}.js`,
      content: beautifyjs(`
        module.exports = ({bull}) => bull.worker('${queueName}', (job) => {
          return Promise.resolve(true);
        });`,
        { indent_size: 2 })
    });
  }
  return arr;
})
.default(self => ({
  default: {
    queue: {
      redis: {
        host: "127.0.0.1",
        port: 6379,
        db: 0
      }
    },
    worker: {
      concurency: 100
    }
  }
}))
.prompt(self => ([
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_name',
    message: "default queue name",
    default: 'default',
    validate: function(value) {
      return true;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_redis_host',
    message: "redis host for default queue",
    default: self.defaultConfig.default.queue.redis.host,
    validate: function(value) {
      return true;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_redis_port',
    message: "redis port for default queue",
    default: self.defaultConfig.default.queue.redis.port,
    validate: function(value) {
      return ~~(value) > 0;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_queue_redis_db',
    message: "redis database id for default queue",
    default: self.defaultConfig.default.queue.redis.db,
    validate: function(value) {
      return ~~(value) >= 0;
    }
  },
  {
    if: {
      fileNotFound: self.serviceConfigMainYML
    },
    type: 'input',
    name: 'default_worker_concurency',
    message: "concurency for default worker",
    default: self.defaultConfig.default.worker.concurency,
    validate: function(value) {
      return ~~(value) > 0;
    }
  }
]))
.answersToConfig((self, answers) => {
  if (answers.default_queue_name) {
    return {
      [answers.default_queue_name]: {
        queue: {
          redis: {
            host: answers.default_queue_redis_host,
            port: ~~(answers.default_queue_redis_port),
            db: ~~(answers.default_queue_redis_db)
          }
        },
        worker: {
          concurency: ~~(answers.default_worker_concurency)
        }
      }
    };
  } else {
    return {};
  }
})
.run()

