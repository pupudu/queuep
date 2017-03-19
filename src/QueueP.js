/**
 * Created by pubudud on 3/18/17.
 */

import Redis from 'redis';
import * as constants from './constants';

let redis = Redis.createClient();


/**
 *  Redis backed queue for congestion control with a trade-off for data loss
 */
export default class QueueP {

    /**
     * Constructor
     * @param {string} strategy - Redis or In-memory
     */
    constructor(strategy) {
        QueueP._strategy = strategy;
        QueueP._dataMap = {};
        QueueP._keyQueue = {};
        QueueP.dirtyCheckers = {};
    }

    /**
     * Initialize a queue for a given hSet
     *
     * @param {object} options - configurations for the queue
     * @param {!string} options.hSet - Key of the parent hset
     * @param {number} [options.interval = 1000] - Interval for executing the consumer function
     * @param {function} options.dirtyChecker - Function to evaluate whether overriding value is different from earlier
     * @param {function} options.consumer - Function which implements the consumer logic
     */
    static initQueue(options) {
        let {hSet, interval = constants.DEFAULT_INTERVAL, dirtyChecker, consumer} = options;

        QueueP.dirtyCheckers[hSet] = dirtyChecker;
        setInterval(function () {
            if (!QueueP._keyQueue[hSet]) {
                return;
            }
            let key = QueueP._keyQueue[hSet].shift();

            if (!hSet || !key) {
                return;
            }

            QueueP._getEntry(hSet, key, function (err, entry) {
                if (err) {
                    return;
                }
                if (entry && entry.isDirty) {
                    consumer(entry.data, function (err) {
                        if (err) {
                            return;
                        }
                        entry.isDirty = false;
                        QueueP._setEntry(hSet, key, entry, function () {
                            // Iteration success. Do nothing
                        });
                    });
                }
            });

        }, interval);
    }

    /**
     * Fetch the entry with the target data from the data map(Redis or In-memory)
     *
     * @param {string} hSet - Key of the parent set
     * @param {string} key - Key of the actual target data
     * @param {function} callback - callback
     * @returns {*} - call to callback
     * @private
     */
    static _getEntry(hSet, key, callback) {
        if (QueueP._strategy === "redis") {
            redis.hget(hSet, key, function (err, res) {
                if (err) {
                    return callback(err);
                }
                if (!res) {
                    return callback(null, {});
                }
                return callback(null, JSON.parse(res));
            });
        } else {
            if (!QueueP._dataMap[hSet]) {
                return callback(null, {});
            }
            return callback(null, QueueP._dataMap[hSet][key] || {});
        }
    }

    /**
     * Add an entry to the data-map
     *
     * @param {string} hSet - Key of the parent set
     * @param {string} key - key of the target data
     * @param {Object} entry - Object consisting of the target data and the isDirty attribute
     * @param {function} callback - callback
     * @returns {*} - call to callback
     * @private
     */
    static _setEntry(hSet, key, entry, callback) {
        if (QueueP._strategy === "redis") {
            redis.hset(hSet, key, JSON.stringify(entry), function (err, res) {
                return callback(err, res);
            });
        } else {
            if (!QueueP._dataMap[hSet]) {
                QueueP._dataMap[hSet] = {};
            }
            QueueP._dataMap[hSet][key] = entry;
            return callback(null);
        }
    }

    /**
     * Update/Insert an entry of/to the dataset and enqueue to be delayed processed if the entry is evaluated as dirty
     *
     * @param {string} hSet - Key of the parent dataset
     * @param {string} key - Key of the data to be queued
     * @param {Object|string|number} data - data to be enqueued for delayed processing
     * @param {function} callback - callback
     */
    static publish(hSet, key, data, callback) {
        QueueP._getEntry(hSet, key, function (err, entry) {
            if (err) {
                return callback(err);
            }
            if (!QueueP.dirtyCheckers[hSet]) {
                let err = new Error(`DirtyChecker not available for hSet: ${hSet}`);
                return callback(err);
            }
            let oldData = entry.data,
                isDirty = QueueP.dirtyCheckers[hSet](oldData, data);

            if (isDirty) {
                let entry = {
                    data: data,
                    isDirty: true
                };
                QueueP._setEntry(hSet, key, entry, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    QueueP._enqueue(hSet, key);
                    return callback(null);
                });
            }
        });
    }

    /**
     * Enqueue to pending operations, if not already pending
     *
     * @param {!string} hSet - Key of Parent set
     * @param {!string} key - Key of actual target data
     * @private
     */
    static _enqueue(hSet, key) {
        if (!QueueP._keyQueue[hSet]) {
            QueueP._keyQueue[hSet] = [];
        }
        if (QueueP._keyQueue[hSet].indexOf(key) === -1) {
            QueueP._keyQueue[hSet].push(key);
        }
    }
}
