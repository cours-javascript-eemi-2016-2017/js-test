function makeCodeEvaluator(jailed, codeGradingOptions) {

  var COEF = codeGradingOptions.ptsPerExercise;

  function sum(a, b) {
    return a + b;
  }

  function runCodeInSandbox(code, callback) {
    var plugin = null;
    var timeout = null;
    function onDone(err, results){
      clearTimeout(timeout);
      timeout = null;
      callback(err, results);
      plugin.disconnect();
    }
    var timeoutMessage = 'TIMEOUT: infinite loop?'; // can be overrided by evaluation code
    var api = {
      _setTimeoutMessage: function(message){
        timeoutMessage = message;
      },
      _log: console.log.bind(console),
      // this function will be called with resulting arguments by sandboxed script, when done
      _send: function(){
        onDone(null, arguments);
      },
      _sendOnce: function(){
        timeout && onDone(null, arguments);
      },
    };
    plugin = new jailed.DynamicPlugin(code, api);
    plugin.whenFailed(onDone);
    //plugin.whenConnected(onDone);
    timeout = setTimeout(function(){ onDone(timeoutMessage); }, 2000);
  }

  // fixed version of variant3() => returns 0, 1 or 2, depending on the value of number
  function getVariantByStudentId (id, variants) {
    // modulo that also works for big integers
    var modulo = function(divident, divisor) {
        var partLength = 10;
        while (divident.length > partLength) {
            var part = divident.substring(0, partLength);
            divident = (part % divisor) +  divident.substring(partLength);          
        }
        return divident % divisor;
    };
    return modulo(id, variants.length);
  };

  function runTest(testCode, studentCode, callback) {
    if (!testCode) {
      console.log('// WARNING: NO CODE TESTER => skipping');
      callback(null, [ 0 ]);
    } else if (!studentCode) {
      console.log('// WARNING: NO STUDENT CODE => skipping');
      callback(null, [ 0 ]);
    } else {
      var code = testCode
        .replace(/_runStudentCode\(\)/g, [
          '// <STUDENT-CODE>',
          studentCode,
          '// </STUDENT-CODE>' ].join('\n'))
        .replace(/_runStudentCodeAgain\(\)/g, [
          '// <STUDENT-CODE>',
          studentCode.replace(/function ([^ \(]+)/g, '$1 = function'),
          '// </STUDENT-CODE>' ].join('\n'));
      //console.log(code);
      console.log([ '// STUDENT CODE:', studentCode ].join('\n\n'));
      runCodeInSandbox(code, function(err, res) {
        if (err) console.log('=> test runner err:', err);
        var scoreArray;
        if (res) {
          if (res[0]) {
            console.log('\n// -> STUDENT CODE ERROR:', res[0]);
          }
          var testResult = res[1];
          if (typeof testResult === 'object' && testResult.length >= 0) {
            scoreArray = testResult.map(function(a){ return a ? 1 : 0; });
          } else {
            scoreArray = [ testResult || 0 ];
          }
        }
        callback(null, scoreArray); // sum of array must be <= config.codeGrading.ptsPerExercise
      });
    }
  }

  // exported class

  // inspired by caolan's async.mapSeries
  function mapSeries(_arr, handler, callback) {
    var arr = _arr.slice(); // clone
    var results = [];
    function next() {
      if (!arr.length) {
        callback(null, results);
      } else {
        var item = arr.shift();
        handler(item, function(err, res) {
          // TODO: also handle errors
          results.push(res);
          next();
        });
      }
    }
    next();
  }

  function CodeEvaluator(tests) {
    this.tests = tests;
  }

  CodeEvaluator.mapSeries = mapSeries; // exported for convenience. (used client-side in suivi.js)

  CodeEvaluator.prototype.evaluateAnswers = function(answers, callback) {
    function runExEval(exEval, callback) {
      var variantNumber = getVariantByStudentId(answers._uid, exEval.variants);
      var evalTest = exEval.testVariants[variantNumber];
      console.log('\n------------- EXERCISE:', exEval.id, '(variant:', variantNumber + ') -------------\n');
      runTest(evalTest, answers[exEval.id], callback);
    }
    mapSeries(this.tests, runExEval, function done(err, res) {
      var ptsPerExercise = res.map(function(scoreArray){
        return scoreArray.reduce(sum) * COEF / scoreArray.length;
      });
      callback(null, {
        score: ptsPerExercise.reduce(sum),
        length: res.length * COEF
      });
    });
  };

  return CodeEvaluator;

};

try {
  exports.makeCodeEvaluator = makeCodeEvaluator
} catch(e) {}
