/**
 * Created by pubudud on 8/4/17.
 */

import qp from '../queuep';

/**
 * Represents an instance of a queue initialized using the QueueP interface
 * This can be useful for interacting with a queue without explicitly providing the qId
 */
export default class QInterface {

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
     * @return {Promise|undefined} <-
     */
    getStats() {
        return qp.getStats(this.qId);
    }

    /**
     * Add event listener to a target queue
     * @param {Array} args - any other arguments as applicable
     */
    on(...args) {
        qp.on(this.qId, ...args);
    }

    /**
     * Set the storage of the queue
     * @param {Array} args - any other arguments as applicable
     */
    setStore(...args) {
        qp.setStore(this.qId, ...args);
    }
}
