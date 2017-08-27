/**
 * Created by pubudud on 8/27/17.
 */

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

// binding the QueueP scope to `this` should be done for this method to work properly
export const getStatsString = (qId, {queueLength, interval, processedCount, failureCount}) =>
    `qId: ${qId}
    Remaining entry count in Queue: ${queueLength}
    Interval: ${interval}
    Processed Count: ${processedCount},
    Failure Count: ${failureCount}
    `;
