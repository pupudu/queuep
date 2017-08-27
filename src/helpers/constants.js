/**
 * Created by pubudud on 3/19/17.
 */

export const DEFAULT_INTERVAL = 10;

export const STRATEGIES = {
    REDIS: "redis",
    STATE: "app-state"
};

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
