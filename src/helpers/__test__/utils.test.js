/**
 * Created by pubudud on 8/27/17.
 */

import {expect} from 'chai';
import {getStatsString, noop} from '../utils';

describe('Unit tests for helper util functions', function () {
    it('returns a stats string when arguments as required are provided', function () {
        let statString = getStatsString("myQ", {
            queueLength: 100,
            interval: 10,
            failureCount: 2,
            processedCount: 100
        });

        expect(statString).to.be.a("string");
        expect(statString).to.include("qId: myQ");
        expect(statString).to.include("Remaining entry count in Queue: 100");
        expect(statString).to.include("Interval: 10");
        expect(statString).to.include("Processed Count: 100");
        expect(statString).to.include("Failure Count: 2");
    });

    it('executes noop function without throwing exceptions', function (done) {
        noop();
        return done();
    });
});
