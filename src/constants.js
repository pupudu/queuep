/**
 * Created by pubudud on 3/19/17.
 */

export const DEFAULT_INTERVAL = 1000;

export const STRATEGIES = {
    REDIS: "redis",
    STATE: "app-state"
};

export const noop = () => {
    // This function does nothing
};

export const fakeLogger = (function fakeLogger() {
    return {
        info: noop,
        debug: noop,
        error: noop,
        warn: noop
    };
})();

export const dirtyCheckers = {
    naive: () => (prev, next) => JSON.stringify(prev) !== JSON.stringify(next),

    fieldBased: (...fields) =>
        (prev = {}, next = {}) =>
            !fields.reduce(
                (isEqual, field) => isEqual && prev[field] === next[field]
                , true
            )
};

// binding the QueueP scope to `this` should be done for this method to work properly
export const getStatsString = (hSet, keyQueue, stats) =>
    `hSet: ${hSet}
    Remaining entry count in Queue: ${keyQueue.length}
    Interval: ${stats.interval}
    Processed Count: ${stats.processedCount},
    Failure Count: ${stats.failureCount}
    `;

export const CALLBACK_ARG_POSITION = 2; // Starting from 0
