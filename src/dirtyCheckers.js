/**
 * Created by pubudud on 8/20/17.
 */

/**
 * Return the milliseconds given the time in second(s), minute(m), hour(h) encoded format
 * @param {string} unit - unit which represents hours minutes or seconds
 * @returns {number} - milliseconds
 */
function getMillis(unit) {
    switch (unit) {
        case "seconds":
        case "s":
            return 1000; // eslint-disable-line no-magic-numbers, :- 1 second
        case "minutes":
        case "m":
            return 60 * 1000; // eslint-disable-line no-magic-numbers, :- 1 minute
        case "hours":
        case "h":
            return 60 * 60 * 1000; // eslint-disable-line no-magic-numbers, :- 1 hour
        default:
            return 1000; // eslint-disable-line no-magic-numbers, :- 1 second
    }
}

export const makeNaiveChecker = () => (prev, next) => JSON.stringify(prev) !== JSON.stringify(next);

export const makeFieldBasedChecker = (...fields) =>
    (prev = {}, next = {}) =>
        !fields.reduce(
            (isEqual, field) => isEqual && prev[field] === next[field]
            , true
        );

export const makeExpirationChecker = (start, end, unit) => {

    if (typeof start !== "number")
        return new Error("Invalid arguments supplied to makeExpirationChecker Checker factory");

    if (typeof end === "string") {
        unit = end;
        end = start;
    }
    const threshold = start + parseFloat(Math.random() * ((end || start) - start));

    return (prev, next, prevProps = {}) => {
        const updatedTime = prevProps.time || 0,
            currentTime = new Date().getTime();
        return currentTime - updatedTime >= threshold * getMillis(unit);
    };
};

export const makeSkippedCountChecker = (start, end) =>
    (prev, next, prevProps) => prevProps.skippedCount >= start + parseFloat(Math.random() * ((end || start) - start));

export const combineStrict = (...checkers) => (...args) =>
    checkers.reduce((isDirty, checker) => isDirty && checker(...args),
        true
    );

export const combine = (...checkers) => (...args) =>
    checkers.reduce(
        (isDirty, checker) => isDirty || checker(...args),
        false
    );
