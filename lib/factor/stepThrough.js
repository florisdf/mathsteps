const checks = require('../checks');
const Node = require('../node');
const Status = require('../node/Status');
const ChangeTypes = require('../ChangeTypes');

const factorQuadratic = require('./factorQuadratic');

const flattenOperands = require('../util/flattenOperands');
const print = require('../util/print');
const removeUnnecessaryParens = require('../util/removeUnnecessaryParens');
const Negative = require('../Negative');

const Factors = require('../factor/Factors');
const Terms = require('../term/Terms');
const math = require('mathjs');

function getCombinations(array, size) {

    function p(t, i) {
        if (t.length === size) {
            result.push(t);
            return;
        }
        if (i + 1 > array.length) {
            return;
        }
        p(t.concat(array[i]), i + 1);
        p(t, i + 1);
    }

    var result = [];
    p([], 0);
    return result;
}

// Given a mathjs expression node, takes the step of isolating the common
// factor in the expression
// Returns the steps taken
function isolateCommonFactor(node) {
  const steps = [];

  const originalExpressionStr = print.ascii(node);

  // Find GCD of the terms
  const terms = Terms.getTerms(node);
  let comFacs = Factors.getCommonFactors(terms);

  if (comFacs.length == 0) {
    // No common factors
    // Check if any of the factors are each other's inverse
  }
  const gcd = Factors.gcd(terms);

  // Write each factor as <GCD> * <quotient>
  let quots = [];
  try {
    quots = terms.map(term => Factors.divide(term, gcd));
  } catch(e) {
    return steps;
  }
  let newNode = math.parse(quots.map(q => `( ${gcd.toString()} ) * ( ${q.toString()} )`).join(' + '));
  newNode = removeUnnecessaryParens(newNode);
  let step = new Status(ChangeTypes.FIND_GCD, node, newNode);
  steps.push(step);

  // Isolate the factor
  let oldNode = newNode.cloneDeep();
  newNode = Factors.isolate(node, gcd);
  step = new Status(ChangeTypes.ISOLATE_COMMON_FACTOR, oldNode, newNode);
  steps.push(step);
  return steps;
}

// Given a mathjs expression node, steps through factoring the expression.
// Returns a list of details about each step.
function stepThrough(node, debug=false) {
  if (debug) {
    // eslint-disable-next-line
    console.log('\n\nFactoring: ' + print.ascii(node, false, true));
  }

  if (checks.hasUnsupportedNodes(node)) {
    return [];
  }

  let nodeStatus;
  const steps = [];

  // Check the amount of terms
  const terms = Terms.getTerms(node);
  if (terms.length === 1) {
    // There is only 1 term, so there is nothing to factorize
    return [];
  }

  // Isolate factor
  isolateCommonFactor(node).forEach(s => steps.push(s));

  // If not, check if of form a^2 + 2ab + b^2 of a^2 - b^2
  // Else if square, try with sum and product
  // Else if square, try with discriminant
  // Else, try to divide by x - a and factorize
  // Else, we can't factorize any further

  return steps;
}

module.exports = stepThrough;
