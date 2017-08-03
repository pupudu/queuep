# QueueP
Pronounced: "queue-pea"

QueueP is a framework designed for congestion control in NodeJs applications. It is more often useful for scenarios where redundant requests should be ignored (more details later). However, QueueP can be used in any other case where performance is affected by a heavy load of data.

This does not mean that data or data consistency is sacrificed. However QueueP tries to keep the application alive and process data as much as possible, and just ignore the overflow, in critical situations. In simple words, QueueP will tolerate inconsistency and data loss in cases where the application would have crashed/stopped-responding if QueueP was not present.

### Installation
To install the stable version:

    npm install --save queuep
tl;dr: QueueP is in ES5 syntax meaning that you can directly use it in your project.

The current queuep implementation is transpiled to ES5 syntax before publishing to npm. (That means you can use queuep directly in with ES5 or ES2015+). However, this might change in future to be in ES2015+ syntax by default. This is required to gain more support from popular IDEs. If you are not already using ES2015 or later, we suggest you to try that. Newer versions of Javascript are really awesome!

### Basic Usage
Let's assume that 5000 devices are sending data to an endpoint about their online status.

First, initialize a queue(can have multiple queues) with the minimal required configurations. Constructor of a module is a good place to keep the initQueue code.

    import qp from 'queuep';

    qp.initQueue({
        id: "app_online_status",
        consumer: updateOnlineStatus
    });

Then you can publish data to the queue.

    qp.publish("app_online_status", deviceId, {
        onlineStatus: onlineStatus,
        deviceId: deviceId
    });
initQueue and publish method calls can be in the same module or in different modules. I personally prefer to keep the initQueue and publish methods in the same module. But that is completely up to you to decide.

* Note 1: The argument **id** is used to identify the queue. An application can have any number of queuep queues.

* Note 2: The argument **consumer** should be a function reference which should be either;

A function which accepts two arguments. First argument will give the data published from the publish method. The second argument is an error-first callback that should be called to signal QueueP that the consume task has finished.
See example:

    let updateOnlineStatus = (data, callback) {

        let {deviceId, onlineStatus} = data;

        deviceDao.updateOnlineStatus(deviceId, onlineStatus, function (err) {
            if (err) {
                return callback(err)
            }
            return callback();
        });
    }
A function which accepts a single argument and returns a promise. First argument is as same as above. The promise can be resolved or rejected to signal QueueP that the consume task has finished.
See example:

    let updateOnlineStatus = (data) {

        let {deviceId, onlineStatus} = data;

        return new Promise((resolve, reject) => {
            deviceDao.updateOnlineStatus(deviceId, onlineStatus)
                .then(resolve)
                .catch(reject);
        });
    }

### Background
I wrote queuep to fix an issue in a project I was working on. I believe, summarizing that story will give you a sound understanding about what exactly queuep does. So here it goes,

There is an API endpoint in the application to which thousands of devices send periodic data. The data is about the online status of an application running on each device. So we were interested only in the transitions. However, the online status was being updated in a database without caring about the value. For example, If a device sends 1000 requests saying the online status is true, we do 1000 mysql operations to override the same value. And at some point in time, the database could not process any more queries and both the database and the NodeJs API stopped responding to further requests.

So I wrote a middleware which would stay somewhere between the API endpoint and the data access layer, preventing redundant mysql operations. Although the primary requirement was to prevent redundant operations, it gave few other benefits as well. Thus I was motivated to implement the module as a lightweight and easily pluggable library. Listed below are some of the said benefits in brief.

##### Normalize Traffic Spikes

Due to the way queuep works internally, sudden spikes of data traffic will be normalized. That is, the load will be distributed along the time axis and hence CPU usage of the server will be optimized with no extra effort.

<Diagram coming soon>

##### Bounded Resource Utilization

When the load received is too damn high, and ignoring duplicates and distributing along the time axis also cannot help, queuep will sacrifice unprocessed old data to keep the application alive. (For example, if the (n+1)th request received before processing the (n)th request, the (n+1)th data will replace the (n)th data).

##### No Starvation

The internal algorithm used in QueueP takes measures to avoid starvation without compromising performance. Algorithm is based on the FIFO principle.

#### Backed by redis
QueueP supports(optional) redis as the intermediate storage for published data. This ensures that queued data is preserved even if the NodeJs application was restarted. 

QueueP v0.0.7 has the redis strategy built in. However, redis strategy will be taken out and will be implemented as a plugin. This will make the core library even lighter while opening the opportunity to use other methods of intermediate storage such as rabbitMq or nats. 

### License
MIT
