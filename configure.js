const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const yaml = require('js-yaml');
const beautifyjs = require('js-beautify').js;

const skipPrompt = process.env.NO_INTERACTIVE || process.env.NO_PROMPT ? true : false;
const skipAutoconf = process.env.NO_AUTOCONF ? true : false;

const generate = (serviceName, moduleName, config) => {
  const serviceDir = `${__dirname}/../../services`;
  const servicePath = `${__dirname}/../../services/${serviceName}.js`;
  const configDir = `${__dirname}/../../config`;
  const configPath = `${__dirname}/../../config/${serviceName}.yml`;
  const resourceBaseDir = `${__dirname}/../../res`;
  const resourceDir = `${__dirname}/../../res/${serviceName}`;

  console.log("");
  console.log(`${serviceName} service config:`);
  console.log(JSON.stringify(config, null, '  '));
  console.log("");

  // save service config
  console.log(`writing config: ${configPath}`);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, {recursive: true});
  }
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, yaml.safeDump(config, {skipInvalid: true}));
  }

  // enable service
  console.log(`creating service alias: ${servicePath}`);
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, {recursive: true});
  }
  if (!fs.existsSync(servicePath)) {
    fs.writeFileSync(servicePath, `module.exports = require('${moduleName}')`);
  }
  
  // ensure resource dir exist
  console.log(`creating resources folder: ${resourceDir}`);
  if (!fs.existsSync(resourceBaseDir)) {
    fs.mkdirSync(resourceBaseDir, {recursive: true});
  }
  if (!fs.existsSync(resourceDir)) {
    fs.mkdirSync(resourceDir, {recursive: true});
    for (let queueName in config) {
      fs.writeFileSync(`${resourceDir}/${queueName}.js`,
        beautifyjs(`
        module.exports = ({bull}) => bull.worker('${queueName}', (job) => {
          return Promise.resolve(true);
        });`,
        { indent_size: 2 }));
    }
  }
};

if (!skipAutoconf) {
  const packageJson = require('./package.json');
  const serviceName = 'bull';
  const moduleName = packageJson.name;
  const defaultConf = {
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
  };

  if (!skipPrompt) {
    const questions = [
      {
        type: 'input',
        name: 'default_queue_name',
        message: "default queue name",
        default: 'default',
        validate: function(value) {
          return true;
        }
      },
      {
        type: 'input',
        name: 'default_queue_redis_host',
        message: "redis host for default queue",
        default: defaultConf.default.queue.redis.host,
        validate: function(value) {
          return true;
        }
      },
      {
        type: 'input',
        name: 'default_queue_redis_port',
        message: "redis port for default queue",
        default: defaultConf.default.queue.redis.port,
        validate: function(value) {
          return ~~(value) > 0;
        }
      },
      {
        type: 'input',
        name: 'default_queue_redis_db',
        message: "redis database id for default queue",
        default: defaultConf.default.queue.redis.db,
        validate: function(value) {
          return ~~(value) >= 0;
        }
      },
      {
        type: 'input',
        name: 'default_worker_concurency',
        message: "concurency for default worker",
        default: defaultConf.default.worker.concurency,
        validate: function(value) {
          return ~~(value) > 0;
        }
      }
    ];

    inquirer.prompt(questions).then(conf => {
      generate(serviceName, moduleName, {
        [conf.default_queue_name]: {
          queue: {
            redis: {
              host: conf.default_queue_redis_host,
              port: conf.default_queue_redis_port,
              db: conf.default_queue_redis_db
            }
          },
          worker: {
            concurency: conf.default_worker_concurency
          }
        }
      });
    });  
  } else {
    generate(serviceName, moduleName, defaultConf);
  }
}