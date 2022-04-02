# BackKit Bull

Backkit service for [bull](https://github.com/OptimalBits/bull), redis based job queue


# install

```
npm install --save @backkit/bull
```

# configuration example

/config/bull.yml

```yml
test:
  queue:
    redis:
      host: 127.0.0.1
      port: 6379
      db: 0
  worker:
    concurency: 100

```

# worker example

/res/bull/test.js

```node
module.exports = ({bull}) => bull.worker('test', (job) => {
  return Promise.resolve(true);
});

```

# job producer example

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

# run example

run all registered bull job queues

```bash
ENTRYPOINT=bull node index.js
```

run job producer example

```bash
ENTRYPOINT=bullJobProducer node index.js
```
