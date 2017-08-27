/**
 * Created by pubudud on 8/4/17.
 */

/* eslint-disable */

import qp, {makeObjectDirtyChecker, makeExpirationChecker} from './queuep';

/**
 * This module will be used for testing new changes of QueueP framework
 */
class Tester {

    constructor() {

        qp.init(null, console);

        this.instance = qp.initQueue("fake_1", {
            consumer: this.fakeConsumer,
            interval: 2000,
            dirtyChecker: makeExpirationChecker(10)
        });

        this.instance.on("error", console.info.bind(console, "*** Error: "));
        this.instance.on("duplicate", console.info.bind(console, "*** Duplicate: "));

        setInterval(() => {
            qp.getQueueInstance("fake_1").printStats("warn");
        }, 1000 * 5);
    }


    fakeConsumer(key, data) {

        let rand = parseInt(Math.random() * 10000);

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                return rand % 7 === 0 ? reject("**Seven is not so lucky today**") : resolve();
            }, rand);
        });
    }


    start() {
        setInterval(() => {

            let deviceId = `device-${parseInt(Math.random() * 10)}`,
                value = parseInt(Math.random() * 2);

            console.log("~~Publishing~~", deviceId, value);

            this.instance.publish(deviceId, {
                deviceId,
                value
            });
        }, 1000);
    }
}

let tester = new Tester();
tester.start();

setTimeout(() => {
    tester.instance.getStats();
}, 10000);