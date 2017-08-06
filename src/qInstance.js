/**
 * Created by pubudud on 8/4/17.
 */

import qp from './QueueP';

/**
 * Represents an instance of a queue initialized using the QueueP interface
 * This can be useful for interacting with a queue without explicitly providing the qId
 */
export default class QInstance {

    /**
     * @param {string} qId - Id of a Queue initialized with QueueP
     */
    constructor(qId) {
        this.qId = qId;
    }

    /**
     * @param {Array} args - arguments array
     * @return {Promise|undefined} <-
     */
    publish(...args) {
        return qp.publish(this.qId, ...args);
    }

    /**
     * @param {Array} args - arguments array
     * @return {Promise|undefined} <-
     */
    printStats(...args) {
        return qp.printStats(this.qId, ...args);
    }

    /**
     * @param {Array} args - arguments array
     * @return {Promise|undefined} <-
     */
    getStats(...args) {
        return qp.getStats(this.qId, ...args);
    }
}
