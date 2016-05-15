var _ = require('lodash');
var async = require('async');
var jailed = require('jailed-node');

var TESTS = require('./CodeTests.js');

var VARIANTS = [
  {
    "fctName": "multiplication",
    "nb1": 3,
    "nb2": 4,
    "nb3": 100,
    "res1": 12,
    "res2": 16,
    "res3": 400
  },
  {
    "fctName": "multiplier",
    "nb1": 4,
    "nb2": 5,
    "nb3": 100,
    "res1": 16,
    "res2": 20,
    "res3": 400
  },
  {
    "fctName": "multi",
    "nb1": 5,
    "nb2": 6,
    "nb3": 100,
    "res1": 20,
    "res2": 24,
    "res3": 400
  }
];

function sum(a, b) {
  return a + b;
}

function runCodeAsync(code, api, callback) {
  var errors = [];
  var plugin = new jailed.DynamicPlugin(code, api);
  function onDone(err){
    if (err) errors.push(err);
    callback(errors);
    plugin.disconnect();
  }
  plugin.whenFailed(onDone);
  plugin.whenConnected(onDone);
}

var testHelpers = {

  sum: sum,

  testCode: function (code, callback) {
    var results = [];
    var api = {
      // this function will be called with resulting arguments by sandboxed script, when done
      _send: function(){
        results = arguments;
      }
    };
    code = [
      // test-specific instructions
      'var _result = [];',
      'var console = { log: function(){ _result.push(Array.prototype.join.call(arguments, " ")); } };',
      code,
      // every test should end with this, in order to compare to expected results
      'application.remote._send(_result);'
    ].join('\n');
    //console.log('FINAL CODE:', code);
    runCodeAsync(code, api, function(err) {
      callback(err, results[0] || []); // TODO: include all _send() arguments
    });
  },

  /*
  testCode("console.log('test', 666); alert('Hello from the plugin!');", function(err, res) {
    console.log('=> err:', err); // => [ 'ReferenceError: alert is not defined' ]
    console.log('=> res:', res); // => [ 'test 666' ]
  });
  */

  errorOr: function (err, res) {
    return (err && err.length) > 0 ? ('ERROR: ' + err[0]) : res;
  }
};

// fixed version of variant3() => returns 0, 1 or 2, depending on the value of number
function getVariantByStudentId (id) {
  // modulo that also works for big integers
  var modulo = function(divident, divisor) {
      var partLength = 10;
      while (divident.length > partLength) {
          var part = divident.substring(0, partLength);
          divident = (part % divisor) +  divident.substring(partLength);          
      }
      return divident % divisor;
  };
  return modulo(id, VARIANTS.length);
};

function CodeEvaluator() {
}

CodeEvaluator.prototype.evaluateAnswers = function(answers, callback) {

  var variantNumber = getVariantByStudentId(answers._uid);
  //console.log('\n===\nSTUDENT', answers.key, '(' + answers._uid + ' => ' + variantNumber + ') :\n---\n' + answers.code1 + '\n---');

  function runTest(testFct, callback) {
    testFct.call(testHelpers, answers.code1, VARIANTS[variantNumber], callback);
  }
  async.mapSeries(TESTS, runTest, function done(err, res) {
    var total = _.flatten(res).reduce(sum);
    //console.log('=> total STUDENT points:', res, '=', total);
    // csv export of marks:
    //console.log(JSON.stringify([ 'SCORE', answers.key, answers._uid, variantNumber, total ]).replace(/[\[\]]/g, ''));
    callback(null, {
      score: total,
      length: 6
    });
  });
};

module.exports = CodeEvaluator;
