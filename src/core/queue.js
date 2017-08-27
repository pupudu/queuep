/**
 * Created by pubudud on 3/18/17.
 */

import {
    DEFAULT_INTERVAL,
    CALLBACK_ARG_POSITION,
    EVENTS,
    SUPPORTED_EVENTS
} from '../helpers/constants';
import {noop, getStatsString} from '../helpers/utils';
import * as dirtyCheckers from '../dirtyCheckers';


/**
 *  Redis backed queue for congestion control with a trade-off for data loss
 */
export default class Queue {

    /**
     * Constructor
     * @param {Object} logger <-
     */
    constructor(logger) {
        this.interval = DEFAULT_INTERVAL;
        this.stats = {
            processedCount: 0,
            failureCount: 0,
            interval: this.interval
        };
        this.keyQueue = [];
        this.eventHandlers = {
            [EVENTS.ERROR]: noop,
            [EVENTS.EMPTY]: noop,
            [EVENTS.FULL]: noop,
            [EVENTS.DUPLICATE]: noop,
            [EVENTS.ENQUEUE]: noop,
            [EVENTS.CONSUME]: noop
        };
        this.logger = logger;

        this.handleConsumptionFailure = this.handleConsumptionFailure.bind(this);
        this.handleConsumptionSuccess = this.handleConsumptionSuccess.bind(this);
    }

    /**
     * Initialize a queue w.r.t given qId
     *
     * @param {!string} qId - a unique Id to identify the initialized queue from anywhere
     * @param {number} [interval] - Interval for executing the consumer function
     * @param {Function} [dirtyChecker] - Function to evaluate whether overriding value is different from earlier
     * @param {Function} consumer - Function which implements the consumer logic
     * @param {Object} store - Intermediate storage strategy
     */
    init(qId, {interval, dirtyChecker, consumer, store}) {

        // Set Id for reference purposes
        this.qId = qId;

        // Decorate Stats Object
        this.stats.interval = interval || this.stats.interval;

        // Set Queue attributes
        this.dirtyChecker = dirtyChecker || dirtyCheckers.makeNaiveChecker();
        this.store = store;
        this.interval = interval || this.interval;
        this.consumer = consumer;
    }

    /**
     * Add event listener to the queue
     *
     * @param {string} event - event to subscribe to
     * @param {function} eventHandler - event handler
     */
    on(event, eventHandler) {
        if (SUPPORTED_EVENTS.some((supportedEvent) => supportedEvent === event)) {
            this.eventHandlers[event] = eventHandler;
        }
    }

    /**
     * Set the storage strategy of the queue
     * @param {Function} Store - Store definition which can be instantiated
     */
    setStore(Store) {
        this.store = new Store(this.qId);
    }

    /**
     * Start an interval based worker to execute the queue consumer as appropriate
     * @return {Object} <- Interval Id(as a reference to interact with the worker later)
     */
    startWorker() {
        this.worker = setInterval(() => {

            let key = this.keyQueue.shift();

            // Proceed only if there are pending items in the queue
            if (!key) {
                return;
            }

            this.store.getEntry(key)
                .then((entry) => {

                    // Redundant check, just to be safe
                    if (!entry || !entry.isDirty) {
                        this.eventHandlers[EVENTS.DUPLICATE](this.qId, key);
                        return;
                    }

                    if (this.consumer.length <= CALLBACK_ARG_POSITION) { // Promise handlers for signalling using promise approach
                        this.consumer(key, entry.data)
                            .then(() => this.handleConsumptionSuccess(key, entry))
                            .catch(this.handleConsumptionFailure);

                    } else { // length > CALLBACK_ARG_POSITION => Callback provided => Callback for signalling using callback approach
                        this.consumer(key, entry.data, (err) => {
                            if (err)
                                this.handleConsumptionFailure(err);

                            this.handleConsumptionSuccess(key, entry);
                        });
                    }
                })
                .catch(this.handleConsumptionFailure);

        }, this.interval);

        return this.worker;
    }

    /**
     * Notify listeners about the failure to successfully execute the assigned consumer function
     * @param {Object} err - error
     * @private
     */
    handleConsumptionFailure(err) {
        this.stats.failureCount++;
        this.eventHandlers[EVENTS.ERROR](err);
    }

    /**
     * Mark entry as not-dirty(to avoid further processing similar entries) and update stats
     * @param {string} key <-
     * @param {Object} entry <-
     * @private
     */
    handleConsumptionSuccess(key, entry) {

        // Mark entry in storage as done processing
        this.store.markEntryAsDone(key, entry)
            .then(() => {
                // Call event listener if given
                this.eventHandlers[EVENTS.CONSUME](this.qId, key);

                // Update stats
                this.stats.processedCount++;
            })
            .catch(this.eventHandlers[EVENTS.ERROR]);
    }

    /**
     * Enqueue to pending operations, if not already pending
     *
     * @param {!string} key - Key of actual target data
     * @private
     */
    enqueue(key) {
        this.eventHandlers[EVENTS.ENQUEUE](this.qId, key);
        if (this.keyQueue.indexOf(key) === -1) {
            this.keyQueue.push(key);
        }
    }


    /**
     * Publish an entry to the queue
     *
     * @param {string} key <-
     * @param {*} data <-
     * @return {Promise} - success message or error if failed
     */
    publish(key, data) {
        return new Promise((resolve, reject) => {
            this.store.getEntry(key)
                .then((entry) => {

                    let oldData = entry.data,
                        isDirty = this.dirtyChecker(oldData, data, {
                            time: entry.time,
                            skippedCount: entry.skippedCount,
                            isDirty: entry.isDirty
                        });

                    if (!isDirty) {
                        entry.skippedCount++;
                        this.eventHandlers[EVENTS.DUPLICATE](this.qId, key);
                        return resolve("Skipping duplicate");
                    }

                    // Set Entry and Enqueue if dirty
                    this.store
                        .setEntry(key, {
                            data: data,
                            isDirty: true,
                            time: new Date().getTime(),
                            skippedCount: 0
                        })
                        .then(() => {
                            this.enqueue(key);
                            return resolve("Enqueued for processing");
                        })
                        .catch(reject);
                })
                .catch(reject);
        });
    }

    /**
     * @return {Object} - stat object for this queue
     */
    getStats() {
        return {
            queueLength: this.keyQueue.length,
            interval: this.stats.interval,
            processedCount: this.stats.processedCount,
            failureCount: this.stats.failureCount
        };
    }

    /**
     * @param {String} [level] - override log level
     */
    printStats(level = "info") {
        this.logger[level](
            getStatsString(
                this.qId,
                this.getStats()
            )
        );
    }

}
