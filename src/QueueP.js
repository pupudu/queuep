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
        return this.returnPromiseOrCallback(new Promise((resolve, reject) => {
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
     * Initialize a queue for a given hSet
     *
     * @param {string} [hSet] - Key of the parent hset(deprecated)
     * @param {string} [id] - alias for hSet
     * @param {number} [interval = 1000] - Interval for executing the consumer function
     * @param {function} [dirtyChecker] - Function to evaluate whether overriding value is different from earlier
     * @param {function} consumer - Function which implements the consumer logic
     */
    initQueue({hSet, id, interval = DEFAULT_INTERVAL, dirtyChecker, consumer}) {

        // Assign hSet alias value back to hSet if specified
        if (id) {
            hSet = id;
        }

        // Make a naive dirty checker if a dirty checker is not specified
        if (!dirtyChecker) {
            dirtyChecker = dirtyCheckers.naive();
        }

        this.dirtyCheckers[hSet] = dirtyChecker;
        this.stats[hSet] = {
            interval,
            processedCount: 0,
            failureCount: 0
        };

        setInterval(() => {
            if (!this._keyQueue[hSet]) {
                return;
            }
            let key = this._keyQueue[hSet].shift();

            if (!hSet || !key) {
                return;
            }

            this._getEntry(hSet, key)
                .then((entry) => {
                    if (entry && entry.isDirty) {

                        if (consumer.length <= CALLBACK_ARG_POSITION) { // Promise handlers for signalling using promise approach
                            consumer(key, entry.data)
                                .then(this._markEntryAsDone.bind(this, hSet, key, entry))
                                .catch(this._handleEntryConsumptionFailure.bind(this, hSet));

                        } else { // length > CALLBACK_ARG_POSITION => Callback provided => Callback for signalling using callback approach
                            consumer(key, entry.data, (err) => {
                                if (err)
                                    return this._handleEntryConsumptionFailure(hSet, err);

                                this._markEntryAsDone(hSet, key, entry);
                            });
                        }
                    }
                })
                .catch((err) => {
                    this.logger.error(err);
                });

        }, interval);
    }

    /**
     * Handle if an error occurred while running the consumer for a specific entry
     * Currently only a stat is collected. Can have a fallback mechanism or a retry strategy
     *
     * @param {string} hSet <-
     * @param {object} err <-
     * @private
     */
    _handleEntryConsumptionFailure(hSet, err) {
        noop(err);
        this.stats[hSet].failureCount++;
    }

    /**
     * Mark an entry as done processing. i.e -> set as not dirty(already processed)
     * @param {string} hSet <- parent set
     * @param {string} key <- key of the parent set (map structure)
     * @param {object} entry <-
     * @private
     */
    _markEntryAsDone(hSet, key, entry) {
        entry.isDirty = false;

        this._setEntry(hSet, key, entry)
            .then(noop) // Iteration success. Do nothing
            .catch((err) => {
                this.logger.error(err);
            });

        // Collect stat to print on demand
        this.stats[hSet].processedCount++;
    }

    /**
     * Fetch the entry with the target data from the data map(Redis or In-memory)
     *
     * @param {string} hSet - Key of the parent set
     * @param {string} key - Key of the actual target data
     * @private
     * @returns {Promise} <-
     */
    _getEntry(hSet, key) {
        return new Promise((resolve, reject) => {
            if (this._strategy === STRATEGIES.REDIS) {
                this._redis.hget(hSet, key, (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!res) {
                        return resolve({});
                    }
                    return resolve(JSON.parse(res));
                });
            } else {
                if (!this._dataMap[hSet]) {
                    return resolve({});
                }
                return resolve(this._dataMap[hSet][key] || {});
            }
        });
    }

    /**
     * Add an entry to the data-map
     *
     * @param {string} hSet - Key of the parent set
     * @param {string} key - key of the target data
     * @param {Object} entry - Object consisting of the target data and the isDirty attribute
     * @private
     * @returns {Promise} <-
     */
    _setEntry(hSet, key, entry) {
        return new Promise((resolve, reject) => {
            if (this._strategy === STRATEGIES.REDIS) {

                this._redis.hset(hSet, key, JSON.stringify(entry), (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(res);
                });

            } else {
                if (!this._dataMap[hSet]) {
                    this._dataMap[hSet] = {};
                }
                this._dataMap[hSet][key] = entry;
                return resolve();
            }
        });
    }

    /**
     * Update/Insert an entry of/to the dataset and enqueue to be delayed processed if the entry is evaluated as dirty
     *
     * @param {string} hSet - Id of the parent queue
     * @param {string} key - Key of the data to be queued
     * @param {Object|string|number} data - data to be enqueued for delayed processing
     * @param {function} [callback] - optional callback
     * @returns {Promise|undefined} <-
     */
    publish(hSet, key, data, callback) {
        return this.returnPromiseOrCallback(new Promise((resolve, reject) => {
            if (!this.dirtyCheckers[hSet]) {
                let err = new Error(`DirtyChecker not available for hSet: ${hSet}`);

                return reject(err);
            }
            this._getEntry(hSet, key)
                .then((entry) => {

                    let oldData = entry.data,
                        isDirty = this.dirtyCheckers[hSet](oldData, data);

                    if (!isDirty) {
                        return resolve();
                    }

                    // Set Entry and Enqueue if dirty
                    this
                        ._setEntry(hSet, key, {
                            data: data,
                            isDirty: true
                        })
                        .then(() => {
                            this._enqueue(hSet, key);
                            return resolve();
                        })
                        .catch((err) => reject(err));
                })
                .catch((err) => reject(err));
        }), callback);
    }

    /**
     * Enqueue to pending operations, if not already pending
     *
     * @param {!string} hSet - Key of Parent set
     * @param {!string} key - Key of actual target data
     * @private
     */
    _enqueue(hSet, key) {
        if (!this._keyQueue[hSet]) {
            this._keyQueue[hSet] = [];
        }
        if (this._keyQueue[hSet].indexOf(key) === -1) {
            this._keyQueue[hSet].push(key);
        }
    }

    /**
     * @param {string} hSet - target hset
     * @return {Object} - stat object
     */
    getStats(hSet) {
        return {
            queueLength: this._keyQueue[hSet].length,
            interval: this.stats[hSet].interval,
            totalProcessedCount: this.stats[hSet].processedCount,
            failureCount: this.stats[hSet].failureCount
        };
    }

    /**
     * @param {string} hSet - target hset
     * @param {Object} [logger] - override logger
     * @param {String} [level] - override log level
     */
    printStats(hSet, logger, level = 'info') {
        (logger || this.logger)[level](
            getStatsString(hSet, this._keyQueue[hSet] || [], this.stats[hSet])
        );
    }

    /**
     * Call callback function if present or return a promise to be handled by the caller
     * @param {Promise} promise <-
     * @param {Function} [callback] <-
     * @return {Promise|undefined} <-
     */
    returnPromiseOrCallback(promise, callback) {
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
