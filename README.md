# <a href='http://queuep.netlify.com/'><img src='http://i.imgur.com/24TwZl4.png' height='100'></a>

[![Build Status](https://travis-ci.org/pupudu/queuep.svg?branch=master)](https://travis-ci.org/pupudu/queuep) 
[![Code Climate](https://codeclimate.com/github/pupudu/queuep/badges/gpa.svg)](https://codeclimate.com/github/pupudu/queuep)
[![Coverage Status](https://coveralls.io/repos/github/pupudu/queuep/badge.svg?branch=master)](https://coveralls.io/github/pupudu/queuep?branch=master)

Pronounced: "queue-pea" https://pupudu.gitbooks.io/queuep https://pupudu.gitbooks.io/queuep

An API which will be consumed by multiple clients will eventually reach a point when the resources
of the hosting server is insufficient to handle the incoming load. 

**QueueP to the Rescue !!**

QueueP can be used in any context where performance is affected by a heavy load of data.
 
## Demo
A live demo of how QueueP works can be found at https://queuep-fruit-salad.stackblitz.io

The source code of the demo can be found at https://stackblitz.com/edit/queuep-fruit-salad

Feel free to edit the demo code in realtime and fork it on Stack Blitz.
 
## Table of Contents

- [Why QueueP](#why-queuep)
- [Basic Usage](#basic-usage)
- [Installation](#installation)
- [Documentation](#documentation)
- [Background](#background)
- [License](#license) 
 
### Why QueueP?
None of the similar queue libraries have a concept of avoiding duplicate requests. 
QueueP filters out redundant requests and allows to process useful data.
 
QueueP internally uses concepts such as memoization, throttling and producer-consumer pattern 
to provide a premium user experience.
 
QueueP allows you to customize the memoization logic (deciding whether or not to process a data chunk) via the 
dirty checkers. While you can write the dirty checkers all by yourself, QueueP provides several
dirty checker templates which can be quite handy to use. 
 
### Basic Usage
Let's assume that multiple devices are sending data about their online status.

First, let's create a queue with the minimal required configurations. 

```js
import qp from 'queuep';

qp.initQueue("app_online_status", {
    consumer: function(key, data, done) {
        // Logic to process the online status data goes here
        
        // key - to identify the device corresponding to the online status data
        // data - online status of the corresponding device
        // done - an error-first callback to signal the queue, that the operation has been completed
    }
});
```

Then we can publish data to the queue.

```js
qp.publish("app_online_status", deviceId, onlineStatus);
```

#### Notes about initQueue
* 1: The first argument is used to identify the queue. An application can have any number of queuep queues.

* 2: The second argument is an options object. 
**consumer** is the only compulsory attribute & should be a function which accepts 3 arguments. 

First two arguments will give the **key** and the **data** published from the publish method. 
The optional 3rd argument is an **error-first** callback that should be used to signal the queue that the consume task 
has finished.

```js
function consumer(key, data, done) {

    let onlineStatus = data,
        deviceId = key;

    myDbModule.updateOnlineStatus(deviceId, onlineStatus, function (err) {
        if (err) {
            return done(err)
        }
        return done();
    });
}
```
    
If the 3rd argument is not provided, then the function should return a promise to signal that the operation has finished.
If the actual code which processes the online status returns a promise, then you can return the function call directly. 

```js
function consumer(key, data) {
    return myDbModule.updateOnlineStatus(key, data); // calling updateOnlineStatus should return a promise 
    // key: deviceId, data: onlineStatus
}
```

### Installation
To install the stable version:

    npm install --save queuep

### Documentation
We have started writing a gitbook to give the users a thorough understanding about the framework. 
The book is still not complete, but do visit  https://pupudu.gitbooks.io/queuep/content/ or http://queuep.netlify.com/  and have a look
to see where it is heading. We promise to finish it soon. 

### Background
I wrote queuep to fix an issue in a project I was working on. 
The story in brief and the fundamental advantages of using QueueP can be found at 
https://pupudu.gitbooks.io/queuep/content/background.html

### License
MIT
