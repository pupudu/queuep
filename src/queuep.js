/**
 * Created by pubudud on 8/7/17.
 */

import {fakeLogger} from './helpers/utils';
import * as dirtyCheckers from './dirtyCheckers';
import Queue from './core/queue';
import StateStore from './core/stateStore';
import QInterface from './core/qInterface';

/**
 * High Performance Congestion Control Map-Queue hybrid for NodeJs applications
 */
class QueueP {

    /**
     * Constructor
     * @returns {QueueP} - QueueP instance
     */
    constructor() {
        this.queueMap = {};
        this.logger = fakeLogger;
        this.Store = StateStore;

        return this;
    }

    /**
     * Init QueueP with custom configs
     * @param {StateStore} Store - Class reference of a QueueP Store
     * @param {Object} [logger] - a logger instance
     */
    init(Store, logger) {
        this.logger = logger || this.logger;
        this.Store = Store || this.Store;
    }


    /**
     * Initialize a queue for a given qId
     *
     * @param {!string} qId - a unique Id to identify the initialized queue from anywhere
     * @param {number} [interval = 1000] - Interval for executing the consumer function
     * @param {function} [dirtyChecker] - Function to evaluate whether overriding value is different from earlier
     * @param {function} consumer - Function which implements the consumer logic
     * @param {Function} [storeClass] - intermediate storage for the queue
     *
     * @returns {QInterface} - instance of QInterface to allow easy interaction with the initialized queue
     */
    initQueue(qId, {interval, dirtyChecker, consumer, storeClass}) {

        // Create a queuep queue
        const queue = new Queue(this.logger);

        // Create store instance
        const Store = storeClass || this.Store,
            store = new Store(qId);

        // Initialize queue with base configurations and save reference
        queue.init(qId, {interval, dirtyChecker, consumer, store});
        this.queueMap[qId] = queue;

        // Start queue worker which will run the consumer as appropriate
        queue.startWorker();

        // Return a new instance of QInterface for easy interaction with the queue
        return new QInterface(qId);
    }

    /**
     * @param {string} qId - id of an actual queue instance in QueueMap
     * @return {Queue} - Actual instance of a Queue
     */
    getQueue(qId) {
        return this.queueMap[qId];
    }

    /**
     * @param {string} qId - Id of an initialized Queue to create and return a reference
     * @return {QInterface} - Instance of a queue
     */
    getQueueInstance(qId) {
        if (!this.getQueue(qId)) {
            throw new Error("QueueP queue with given qId does not exist");
        }
        return new QInterface(qId);
    }

    /**
     * Promise interface for getQueueInstance method
     * @param {string} qId <-
     * @return {Promise} - resolves to an instance of a queue
     */
    getQueueInstanceAsync(qId) {
        try {
            return Promise.resolve(this.getQueueInstance(qId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Call callback function if present or return a promise to be handled by the caller
     * @param {Promise} promise <-
     * @param {Function} [callback] <-
     * @return {Promise|undefined} <-
     * @private
     */
    _returnPromiseOrCallback(promise, callback) {
        if (callback) {
            promise
                .then((result) => callback(null, result))
                .catch((err) => callback(err));
        }
        return promise;
    }

    /**
     * Publish an entry to the queue
     *
     * @param {string} qId <-
     * @param {string} key <-
     * @param {*} data <-
     * @param {function} [callback] <-
     * @return {Promise|undefined} - success message or error if failed
     */
    publish(qId, key, data, callback) {
        return this._returnPromiseOrCallback(new Promise((resolve, reject) => {
            const queue = this.getQueue(qId);

            if (!queue) {
                return reject(new Error("QP Queue With given qId does not exist! Have you initialized the queue?"));
            }

            return queue.publish(key, data)
                .then(resolve)
                .catch(reject);
        }), callback);
    }

    /**
     * @param {string} qId - target queue
     * @return {Object} - stat object
     */
    getStats(qId) {
        const queue = this.getQueue(qId);

        if (!queue) {
            return {};
        }
        return queue.getStats();
    }

    /**
     * @param {string} qId - target queue
     * @param {String} [level] - override log level
     */
    printStats(qId, level = "info") {
        const queue = this.getQueue(qId);

        if (!queue) return;

        queue.printStats(level);
    }


    /**
     * Get the latest entry of corresponding to the given key of the target queue
     * @param {string} qId - queue Id
     * @param {string} key - key of the target entry
     * @returns {*} entry object with a data attribute
     */
    getEntry(qId, key) {
        const queue = this.getQueue(qId);

        if (!queue) return Promise.reject(
            new Error("QP Queue With given qId does not exist! Have you initialized the queue?")
        );

        return queue.getEntry(key);
    }

    /**
     * Add event listener to a target queue
     * @param {string} qId - queuep queue Id
     * @param {Array} args - any other arguments as applicable
     */
    on(qId, ...args) {
        const queue = this.getQueue(qId);

        if (!queue) return;

        queue.on(...args);
    }

    /**
     * Set the storage of a target queue (does not override the default/global Store constructor)
     * @param {string} qId - queuep queue Id
     * @param {Array} args - any other arguments as applicable
     */
    setStore(qId, ...args) {
        const queue = this.getQueue(qId);

        if (!queue) return;

        queue.setStore(...args);
    }

    /**
     * Set and override the default/global Store constructor of QueueP. All new Queues will use this storage medium
     * unless specified otherwise explicitly
     *
     * @param {Object} Store - A function which implements the required methods to be a qp Store
     */
    useStore(Store) {
        this.Store = Store;
    }
}

/**
 * @module QueueP
 */
export default new QueueP();

// Dirty Checker templates
export const makeObjectDirtyChecker = dirtyCheckers.makeFieldBasedChecker;
export const makeExpirationChecker = dirtyCheckers.makeExpirationChecker;
export const makeNaiveChecker = dirtyCheckers.makeNaiveChecker;
export const makeSkippedCountChecker = dirtyCheckers.makeSkippedCountChecker;
export const combine = dirtyCheckers.combine;
export const combineStrict = dirtyCheckers.combineStrict;
