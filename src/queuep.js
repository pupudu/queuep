/**
 * Created by pubudud on 8/7/17.
 */

import {
    fakeLogger,
    dirtyCheckers
} from './constants';
import Queue from './queue';
import StateStore from './stateStore';
import QInterface from './qInterface';

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

        return this;
    }

    /**
     * Init QueueP with custom configs
     * @param {Object} [logger] - a logger instance
     * @param {StateStore} Store - Class reference of a QueueP Store
     */
    init(logger, Store) {
        this.logger = logger || this.logger;
        this.Store = Store || StateStore;
    }


    /**
     * Initialize a queue for a given qId
     *
     * @param {!string} qId - a unique Id to identify the initialized queue from anywhere
     * @param {number} [interval = 1000] - Interval for executing the consumer function
     * @param {function} [dirtyChecker] - Function to evaluate whether overriding value is different from earlier
     * @param {function} consumer - Function which implements the consumer logic
     * @param {Object} [store] - intermediate storage for the queue
     *
     * @returns {QInterface} - instance of QInterface to allow easy interaction with the initialized queue
     */
    initQueue(qId, {interval, dirtyChecker, consumer, store}) {

        // Create a queuep queue
        let queue = new Queue(this.logger);

        //
        let Store = this.Store;
        store = store || new Store(qId);

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
            let queue = this.getQueue(qId);

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
        let queue = this.getQueue(qId);

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
        let queue = this.getQueue(qId);

        if (!queue) return;

        queue.printStats(level);
    }

    /**
     * Add event listener to a target queue
     * @param {string} qId - queuep queue Id
     * @param {Array} args - any other arguments as applicable
     */
    on(qId, ...args) {
        let queue = this.getQueue(qId);

        if (!queue) return;

        queue.on(...args);
    }

    /**
     * Set the storage of a target queue (does not override the default/global Store constructor)
     * @param {string} qId - queuep queue Id
     * @param {Array} args - any other arguments as applicable
     */
    setStore(qId, ...args) {
        let queue = this.getQueue(qId);

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


export default new QueueP();
export const makeObjectDirtyChecker = dirtyCheckers.fieldBased;
