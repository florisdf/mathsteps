const ChangeTypes = require('../ChangeTypes');
const checks = require('../checks');
const Node = require('../node');
const NodeType = require('../node/Type');
const Status = require('../node/Status');

const equalizeFacs = require('./equalizeFactors');
const factorQuadratic = require('./factorQuadratic');

const flattenOperands = require('../util/flattenOperands');
const print = require('../util/print');
const removeUnnecessaryParens = require('../util/removeUnnecessaryParens');
const simplExpr = require('../simplifyExpression/stepThrough');

const Expon = require('../expon/Expon');
const Factor = require('../factor/Factor');
const Term = require('../term/Term');

const _ = require('lodash');
const math = require('mathjs');


function iterateTermFacs(node, changeType, callback) {
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(oldNode);
  let cgrpCount = 0;
  Term.getTermPaths(node).forEach(termPath => {
    const term = _.get(newNode, termPath);
    Factor.getFactorPaths(term)
      .map(facPath => facPath
        ? `${termPath}.${facPath}`
        : termPath)
      .forEach(facPath => {
        const fac = _.get(newNode, facPath);
        const newFac = callback(termPath, facPath, oldNode, newNode, term, fac);

        if (newFac) {
          _.get(oldNode, facPath).changeGroup = ++cgrpCount;
          _.set(newNode, facPath, Node.Creator.parenthesis(newFac));
          _.get(newNode, facPath).changeGroup = cgrpCount;
        }
      });
  });
  if (`${oldNode}` !== `${newNode}`) {
    return new Status(changeType, oldNode, newNode);
  }
  else {
    return Status.noChange(node);
  }
}


// Simplify the non-number factors
function simplifyFactors(node) {
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(node);
  const termPaths = Term.getTermPaths(newNode);
  let cgrpCount = 0;
  let simplSubsteps = [];
  let facSubStepNode = Status.resetChangeGroups(_.cloneDeep(oldNode));
  termPaths.forEach(termPath => {
    const term = _.get(node, termPath, node);
    Factor.getFactorPaths(term)
      .map(facPath => facPath
        ? `${termPath}.${facPath}`
        : termPath)
      .forEach(facPath => {
        const fac = _.get(newNode, facPath, newNode);

        let simplFacSteps = simplExpr(fac);
        if (simplFacSteps.length > 0) {
          const newFac = _.cloneDeep(_.last(simplFacSteps).newNode);
          if (NodeType.isConstant(newFac, true)) {
            return;
          }
          _.get(oldNode, facPath, oldNode).changeGroup = ++cgrpCount;

          _.set(newNode, facPath, newFac);
          _.get(newNode, facPath, newNode).changeGroup = cgrpCount;

          // Put factors back in expression
          simplFacSteps = Status.putStepsInNodePath(facSubStepNode, facPath, simplFacSteps);
          simplSubsteps = simplSubsteps.concat(simplFacSteps);
          facSubStepNode = Status.resetChangeGroups(_.last(simplFacSteps).newNode);
        }
      });
  });
  if (oldNode.toString() !== newNode.toString()) {
    return new Status(ChangeTypes.SIMPLIFY_FACTORS, oldNode, newNode, simplSubsteps);
  }
  else {
    return Status.noChange(node);
  }
}


// Factorize the coefficients of the terms in the node into primes
function splitCoeffsIntoPrimes(node) {
  return iterateTermFacs(node, ChangeTypes.FACTOR_COEFFS_INTO_PRIMES,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      const primes = Factor.splitNumberPrimes(fac);

      if (primes.length > 1) {
        return math.parse(primes.join('*'));
      }
    });
}

// Simplify the exponent
function simplifyExponents(node) {
  const firstNode = _.cloneDeep(node);

  let oldNode = _.cloneDeep(firstNode);
  const substeps = [];

  // First, collapse the exponents
  const collapseStep = iterateTermFacs(node, ChangeTypes.COLLAPSE_EXPONENTS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      const newFac = Expon.collapseExponents(fac);
      if (`${newFac}` !== `${fac}`) {
        return newFac;
      }
    });

  if (collapseStep.hasChanged()) {
    substeps.push(collapseStep);
    oldNode = Status.resetChangeGroups(collapseStep.newNode);
  }

  // Then, simplify the exponent
  let simplifySubsteps = [];
  const simplifyStep = iterateTermFacs(oldNode, ChangeTypes.SIMPLIFY_EXPONENTS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      if (NodeType.isOperator(fac, '^')) {
        const expon = fac.args[1];
        let substeps = simplExpr(expon);
        if (substeps.length > 0) {
          substeps = Status.putStepsInNodePath(
            _.cloneDeep(newNode),
            `${facPath}.args[1]`,
            substeps);
          simplifySubsteps = simplifySubsteps.concat(substeps);

          return _.cloneDeep(_.last(substeps).newNode);
        }
      }
    }
  );

  if (simplifyStep.hasChanged()) {
    simplifyStep.substeps = simplifySubsteps;
    substeps.push(simplifyStep);
  }

  if (substeps.length > 0) {
    const lastNode = Status.resetChangeGroups(_.cloneDeep(_.last(substeps).newNode));
    const step = iterateTermFacs(firstNode, ChangeTypes.SIMPLIFY_EXPONENTS,
      (termPath, facPath, oldNode, newNode, term, fac) => {
        const newFac = _.get(lastNode, facPath);
        if (`${fac}` !== `${newFac}`) {
          return newFac;
        }
      });
    step.substeps = substeps;
    return step;
  }
  else {
    return Status.noChange(node);
  }
}

// Split exponents into factors
function splitExponents(node) {
  return iterateTermFacs(node, ChangeTypes.FACTORIZE_EXPONENTS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      if (!NodeType.isOperator(fac, '^')) {
        return;
      }

      const exp = fac.args[1];
      const expTerms = Term.getTerms(exp);

      if (expTerms.length > 1) {
        return math.parse(expTerms.map(exp => `${fac.args[0]}^${exp}`).join('*'));
      }
    });
}


// Returns the steps to isolate the common factors from a polynomial
function isolateComFacs(node) {
  const isolSubsteps = [];
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(node);

  const splitPrimes = splitCoeffsIntoPrimes(node);
  if (splitPrimes.hasChanged()) {
    isolSubsteps.push(splitPrimes);
  }

  const simplifyExpons = simplifyExponents(node);
  if (simplifyExpons.hasChanged()) {
    isolSubsteps.push(simplifyExpons);
  }

  const splitExpons = splitExponents(node);
  if (splitExpons.hasChanged()) {
    isolSubsteps.push(splitExpons);
  }

  // Look for common parts
  // Put the common parts outside the brackets
  // Simplify the factors outside the brackets and the terms inside the brackets

  if (isolSubsteps.length === 0) {
    return Status.noChange(node);
  }
  else {
    return new Status(ChangeTypes.ISOLATE_COMMON_FACTOR, oldNode, newNode, isolSubsteps);
  }
}


// Given a mathjs expression node, takes the necessary steps to isolate the
// common factors in the expression
// Returns the steps taken
function isolate(node) {
  const steps = [];

  // Equalize the factors of the terms
  const facsEqStep = equalizeFacs(node);
  if (facsEqStep.hasChanged()) {
    steps.push(facsEqStep);
  }

  // Isolate the common factors
  const isolStep = isolateComFacs(node);
  if (isolStep.hasChanged()) {
    steps.push(isolStep);
  }
  return steps;
}

// Given a mathjs expression node, steps through factoring the expression.
// Returns a list of details about each step.
function stepThrough(node, debug=false) {
  // For each top level factor:
  // Common factor?
  // Difference of two squares?
  // Binomial expansion?
  // Take together as 2 + 2?
  // Take together as 3 + 1?
  // Take together as 3 + 2?
  // Take together as 3 + 3?
  // Take together as 2 + 2 + 2?
  // Add and subtract extra term?
  if (debug) {
    // eslint-disable-next-line
    console.log('\n\nFactoring: ' + print.ascii(node, false, true));
  }

  if (checks.hasUnsupportedNodes(node)) {
    return [];
  }

  let nodeStatus;
  const steps = [];

  node = flattenOperands(node);
  node = removeUnnecessaryParens(node, true);

  // Check the amount of terms
  const terms = Term.getTerms(node);
  if (terms.length === 1) {
    // There is only 1 term, so there is nothing to factorize
    return [];
  }

  // Isolate factor
  // isolateCommonFactor(node).forEach(s => steps.push(s));

  // If not, check if of (general) form a^2 + 2ab + b^2 or a^2 - b^2
  // Note that things like x^2 - 2x + 1 - a^2 should be recognised as (x - 1)^2 - a^2
  // Else if square, try with sum and product
  if (checks.isQuadratic(node)) {
    nodeStatus = factorQuadratic(node);
    if (nodeStatus.hasChanged()) {
      steps.push(nodeStatus);
    }
  }
  // Else if square, try with discriminant
  // Else, try to divide by x - a and factorize
  // Else, we can't factorize any further
  return steps;
}

module.exports = stepThrough;
// module.exports = {
//   stepThrough: stepThrough,
//   isolate: isolate,
//   equalizeFacs: equalizeFacs
// };
