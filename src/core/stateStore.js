/**
 * Created by pubudud on 8/6/17.
 */

/**
 * Storage strategy for QueueP using application state as the medium
 */
export default class StateStore {

    /**
     * Constructor
     * @param {string} [qId] - Optional Id for cross references
     */
    constructor(qId) {
        this.dataMap = {};
        this.qId = qId; // For references only
    }

    /**
     * Fetch the entry with the target data from the data map(Redis or In-memory)
     *
     * @param {string} key - Key of the actual target data
     * @returns {Promise} <-
     */
    getEntry(key) {
        return new Promise((resolve) => resolve(this.dataMap[key] || {}));
    }

    /**
     * Add an entry to the data-map
     *
     * @param {string} key - key of the target data
     * @param {Object} entry - Object consisting of the target data and the isDirty attribute
     * @returns {Promise} <-
     */
    setEntry(key, entry) {
        return new Promise((resolve) => {
            this.dataMap[key] = entry;
            return resolve();
        });
    }

    /**
     * Set the isDirty of target entry to false to avoid adding similar items to the queuep queue
     * @param {string} key <-
     * @param {Object} entry <-
     * @return {Promise} - success or failure
     */
    markEntryAsDone(key, entry) {
        return new Promise((resolve, reject) => {
            entry.isDirty = false;

            this.setEntry(key, entry)
                .then(resolve)
                .catch(reject); // Logically impossible state.
        });
    }
}
