const checks = require('../checks');

const factorQuadratic = require('./factorQuadratic');
const Factor = require('../factor/Factor');

const isolate = require('./isolate');
const print = require('../util/print');


// Given a mathjs expression node, steps through factoring the expression.
// Returns a list of details about each step.
function stepThrough(node, debug=false) {
  const steps = [];
  if (debug) {
    // eslint-disable-next-line
    console.log('\n\nFactoring: ' + print.ascii(node, false, true));
  }

  if (checks.hasUnsupportedNodes(node)) {
    return [];
  }

  let quadraticStep;
  if (checks.isQuadratic(node)) {
    quadraticStep = factorQuadratic(node);
    if (quadraticStep.hasChanged()) {
      steps.push(quadraticStep);
    }
  }
  /*
  let exhausted = false;
  while (!exhausted) {
    Factor.getFactorPaths(newNode).forEach(facPath => {
      // Isolate?
      isolate(node);
      // Difference of two squares?
      // Binomial expansion?
      // Take together as 2 + 2?
      // Take together as 3 + 1?
      // Take together as 3 + 2?
      // Take together as 3 + 3?
      // Take together as 2 + 2 + 2?
      // Add and subtract extra term?

    }
  });
  */
  return steps;
}

module.exports = stepThrough;
// module.exports = {
//   stepThrough: stepThrough,
//   isolate: isolate,
//   equalizeFacs: equalizeFacs
// };
