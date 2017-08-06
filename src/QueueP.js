/**
 * Created by pubudud on 7/23/17.
 */
/**
 * Created by pubudud on 3/18/17.
 */

import Redis from 'redis';
import {
    DEFAULT_INTERVAL,
    STRATEGIES,
    noop,
    fakeLogger as logger,
    dirtyCheckers,
    getStatsString,
    CALLBACK_ARG_POSITION
} from './constants';
import QInstance from './qInstance';

/**
 *  Redis backed queue for congestion control with a trade-off for data loss
 */
class QueueP {

    /**
     * Constructor
     */
    constructor() {
        this._dataMap = {};
        this._keyQueue = {};
        this.dirtyCheckers = {};
        this._strategy = STRATEGIES.STATE;
        this.logger = logger;
        this.stats = {};
    }

    /**
     * Initialize QueueP with a custom strategy rather than In-Memory-Application-State
     * @param {string} [strategy] - Redis or In-memory
     * @param {object} logger - an actual instance of some logger to override the noop logger
     * @param {function} [callback] - optional callback
     * @returns {Promise} <-
     */
    init(strategy, logger, callback) {
        return this._returnPromiseOrCallback(new Promise((resolve, reject) => {
            // Set Strategy
            if (strategy !== STRATEGIES.STATE || strategy !== STRATEGIES.REDIS) {
                let err = new Error(`Invalid Strategy: ${strategy}`);
                return reject(err);
            }
            this._strategy = strategy;
            if (this._strategy === STRATEGIES.REDIS) {
                this._redis = Redis.createClient();
            }

            // Set Logger
            this.logger = logger;

            return resolve();
        }), callback);
    }

    /**
     * Initialize a queue for a given qId
     *
     * @param {!string} qId - a unique Id to identify the initialized queue from anywhere
     * @param {number} [interval = 1000] - Interval for executing the consumer function
     * @param {function} [dirtyChecker] - Function to evaluate whether overriding value is different from earlier
     * @param {function} consumer - Function which implements the consumer logic
     *
     * @returns {object} - instance of QInstance to allow easy interaction with the initialized queue
     */
    initQueue(qId, {interval = DEFAULT_INTERVAL, dirtyChecker, consumer}) {

        // Make a naive dirty checker if a dirty checker is not specified
        if (!dirtyChecker) {
            dirtyChecker = dirtyCheckers.naive();
        }

        this.dirtyCheckers[qId] = dirtyChecker;
        this.stats[qId] = {
            interval,
            processedCount: 0,
            failureCount: 0
        };

        setInterval(() => {
            if (!this._keyQueue[qId]) {
                return;
            }
            let key = this._keyQueue[qId].shift();

            if (!qId || !key) {
                return;
            }

            this._getEntry(qId, key)
                .then((entry) => {
                    if (entry && entry.isDirty) {

                        if (consumer.length <= CALLBACK_ARG_POSITION) { // Promise handlers for signalling using promise approach
                            consumer(key, entry.data)
                                .then(this._markEntryAsDone.bind(this, qId, key, entry))
                                .catch(this._handleEntryConsumptionFailure.bind(this, qId));

                        } else { // length > CALLBACK_ARG_POSITION => Callback provided => Callback for signalling using callback approach
                            consumer(key, entry.data, (err) => {
                                if (err)
                                    return this._handleEntryConsumptionFailure(qId, err);

                                this._markEntryAsDone(qId, key, entry);
                            });
                        }
                    }
                })
                .catch((err) => {
                    this.logger.error(err);
                });

        }, interval);

        return new QInstance(qId);
    }

    /**
     * @param {string} qId - Id of an initialized Queue to create and return a reference
     * @return {QInstance} - Instance of a queue
     */
    getQueueInstance(qId) {
        if (!this._keyQueue[qId] || !this.stats[qId] || !this.dirtyCheckers[qId]) {
            throw new Error("Broken or incomplete Queue!");
        }
        return new QInstance(qId);
    }

    /**
     * Handle if an error occurred while running the consumer for a specific entry
     * Currently only a stat is collected. Can have a fallback mechanism or a retry strategy
     *
     * @param {string} qId <-
     * @param {object} err <-
     * @private
     */
    _handleEntryConsumptionFailure(qId, err) {
        noop(err);
        this.stats[qId].failureCount++;
    }

    /**
     * Mark an entry as done processing. i.e -> set as not dirty(already processed)
     * @param {string} qId <- parent set
     * @param {string} key <- key of the parent set (map structure)
     * @param {object} entry <-
     * @private
     */
    _markEntryAsDone(qId, key, entry) {
        entry.isDirty = false;

        this._setEntry(qId, key, entry)
            .then(noop) // Iteration success. Do nothing
            .catch((err) => {
                this.logger.error(err);
            });

        // Collect stat to print on demand
        this.stats[qId].processedCount++;
    }

    /**
     * Fetch the entry with the target data from the data map(Redis or In-memory)
     *
     * @param {string} qId - Key of the parent set
     * @param {string} key - Key of the actual target data
     * @private
     * @returns {Promise} <-
     */
    _getEntry(qId, key) {
        return new Promise((resolve, reject) => {
            if (this._strategy === STRATEGIES.REDIS) {
                this._redis.hget(qId, key, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!res) {
                        return resolve({});
                    }
                    return resolve(JSON.parse(res));
                });
            } else {
                if (!this._dataMap[qId]) {
                    return resolve({});
                }
                return resolve(this._dataMap[qId][key] || {});
            }
        });
    }

    /**
     * Add an entry to the data-map
     *
     * @param {string} qId - Key of the parent set
     * @param {string} key - key of the target data
     * @param {Object} entry - Object consisting of the target data and the isDirty attribute
     * @private
     * @returns {Promise} <-
     */
    _setEntry(qId, key, entry) {
        return new Promise((resolve, reject) => {
            if (this._strategy === STRATEGIES.REDIS) {

                this._redis.hset(qId, key, JSON.stringify(entry), (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(res);
                });

            } else {
                if (!this._dataMap[qId]) {
                    this._dataMap[qId] = {};
                }
                this._dataMap[qId][key] = entry;
                return resolve();
            }
        });
    }

    /**
     * Update/Insert an entry of/to the dataset and enqueue to be delayed processed if the entry is evaluated as dirty
     *
     * @param {string} qId - Id of the parent queue
     * @param {string} key - Key of the data to be queued
     * @param {Object|string|number} data - data to be enqueued for delayed processing
     * @param {function} [callback] - optional callback
     * @returns {Promise|undefined} <-
     */
    publish(qId, key, data, callback) {
        return this._returnPromiseOrCallback(new Promise((resolve, reject) => {
            if (!this.dirtyCheckers[qId]) {
                let err = new Error(`DirtyChecker unavailable/destroyed for qId: ${qId}`);

                return reject(err);
            }
            this._getEntry(qId, key)
                .then((entry) => {

                    let oldData = entry.data,
                        isDirty = this.dirtyCheckers[qId](oldData, data);

                    if (!isDirty) {
                        return resolve();
                    }

                    // Set Entry and Enqueue if dirty
                    this
                        ._setEntry(qId, key, {
                            data: data,
                            isDirty: true
                        })
                        .then(() => {
                            this._enqueue(qId, key);
                            return resolve();
                        })
                        .catch(reject);
                })
                .catch(reject);
        }), callback);
    }

    /**
     * Enqueue to pending operations, if not already pending
     *
     * @param {!string} qId - Key of Parent set
     * @param {!string} key - Key of actual target data
     * @private
     */
    _enqueue(qId, key) {
        if (!this._keyQueue[qId]) {
            this._keyQueue[qId] = [];
        }
        if (this._keyQueue[qId].indexOf(key) === -1) {
            this._keyQueue[qId].push(key);
        }
    }

    /**
     * @param {string} qId - target queue
     * @return {Object} - stat object
     * @param {function} [callback] - optional callback
     *
     * @return {Promise|undefined} <-
     */
    getStats(qId, callback) {
        return this._returnPromiseOrCallback(new Promise((resolve, reject)=> {
            if (!this._keyQueue[qId] || !this.stats[qId]) {
                return reject(new Error("Broken or incomplete Queue!"));
            }
            return resolve({
                queueLength: this._keyQueue[qId].length,
                interval: this.stats[qId].interval,
                totalProcessedCount: this.stats[qId].processedCount,
                failureCount: this.stats[qId].failureCount
            });
        }), callback);
    }

    /**
     * @param {string} qId - target queue
     * @param {Object} [logger] - override logger
     * @param {String} [level] - override log level
     */
    printStats(qId, logger, level = 'info') {
        if (!this._keyQueue[qId] || !this.stats[qId]) {
            (logger || this.logger).error("Broken or incomplete Queue!");
            return;
        }
        (logger || this.logger)[level](
            getStatsString(qId, this._keyQueue[qId] || [], this.stats[qId])
        );
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
}

export default new QueueP();

export const strategies = STRATEGIES;

export const makeObjectDirtyChecker = dirtyCheckers.fieldBased;
