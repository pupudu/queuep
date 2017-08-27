/**
 * Created by pubudud on 8/20/17.
 */

export const makeNaiveChecker = () => (prev, next) => JSON.stringify(prev) !== JSON.stringify(next);

export const makeFieldBasedChecker = (...fields) =>
    (prev = {}, next = {}) =>
        !fields.reduce(
            (isEqual, field) => isEqual && prev[field] === next[field]
            , true
        );

export const makeExpirationChecker = (start, end, unit) => {

    let threshold, unitVal;

    if (typeof start !== "number") {
        return new Error("Invalid arguments supplied to makeExpirationChecker Checker factory");
    }
    if (typeof end === "string") {
        unit = end;
        end = start;
    }
    threshold = start + parseFloat(Math.random() * ((end || start) - start));

    switch (unit) {
        case "seconds":
        case "s":
            unitVal = 1000; // eslint-disable-line
            break;
        case "minutes":
        case "m":
            unitVal = 60 * 1000; // eslint-disable-line
            break;
        case "hours":
        case "h":
            unitVal = 60 * 60 * 1000; // eslint-disable-line
            break;
        default:
            unitVal = 1000; // eslint-disable-line
            break;
    }

    return (prev, next, prevProps = {}) => {
        let updatedTime = prevProps.time || 0,
            currentTime = new Date().getTime();

        return currentTime - updatedTime >= threshold * unitVal;
    };
};

export const makeSkippedCountChecker = (start, end) =>
    (prev, next, prevProps) => prevProps.skippedCount >= start + parseFloat(Math.random() * ((end || start) - start));

export const combineStrict = (...checkers) =>
    (...args) =>
        checkers.reduce((isDirty, checker) =>
            isDirty && checker(...args),
            true
        );

export const combine = (...checkers) =>
    (...args) =>
        checkers.reduce((isDirty, checker) =>
            isDirty || checker(...args),
            false
        );
