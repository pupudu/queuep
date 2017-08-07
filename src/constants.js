/**
 * Created by pubudud on 3/19/17.
 */

export const DEFAULT_INTERVAL = 10;

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
export const getStatsString = (qId, {queueLength, interval, processedCount, failureCount}) =>
    `qId: ${qId}
    Remaining entry count in Queue: ${queueLength}
    Interval: ${interval}
    Processed Count: ${processedCount},
    Failure Count: ${failureCount}
    `;

export const CALLBACK_ARG_POSITION = 2; // Starting from 0

export const EVENTS = {
    ERROR: "error",
    EMPTY: "empty",
    FULL: "full",
    DUPLICATE: "duplicate",
    ENQUEUE: "enqueue",
    CONSUME: "consume"
};

export const SUPPORTED_EVENTS = [
    EVENTS.ERROR,
    EVENTS.EMPTY,
    EVENTS.FULL,
    EVENTS.DUPLICATE,
    EVENTS.ENQUEUE,
    EVENTS.CONSUME
];
