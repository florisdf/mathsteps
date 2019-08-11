const ChangeTypes = require('../ChangeTypes');
const checks = require('../checks');
const Node = require('../node');
const NodeType = require('../node/Type');
const Status = require('../node/Status');

const factorQuadratic = require('./factorQuadratic');

const flattenOperands = require('../util/flattenOperands');
const print = require('../util/print');
const removeUnnecessaryParens = require('../util/removeUnnecessaryParens');
const simplExpr = require('../simplifyExpression/stepThrough');

const Expon = require('../expon/Expon');
const Factor = require('../factor/Factor');
const Polynom = require('../polynom/Polynom');
const Term = require('../term/Term');
const Util = require('../util/Util');

const _ = require('lodash');
const math = require('mathjs');


// Returns the steps to equalize the factors, i.e. when two factors are
// themselves polynomials and are opposite each other, this function negates
// the opposite factors such that they become equal to the other. This prepares
// the polynomial to have this factor isolated.
//
// e.g. '3 * (x - 1) + 2 * (1 - x)' becomes '3 * (x - 1) + 2 * (-1) * (x - 1)'
function equalizeFacs(node) {
  const opEqFacs = Polynom.opEqFacs(node);
  if (opEqFacs.length === 0) { return Status.noChange(node); }

  const steps = [];

  // Find opposite factors in terms
  let oldNode = _.cloneDeep(node);
  let newNode = _.cloneDeep(node);

  opEqFacs.forEach((opEqFac, idx) => {
    opEqFac.oppos.forEach(opFac => {
      _.get(newNode, opFac.path).changeGroup = idx + 1;
    });
    opEqFac.equal.forEach(eqFac => {
      _.get(newNode, eqFac.path).changeGroup = idx + 1;
    });
  });

  steps.push(new Status(ChangeTypes.FIND_OP_FACS, oldNode, newNode));

  // Put a minus outside the brackets of the opposite
  // factors, changing signs inside the brackets
  oldNode = _.cloneDeep(node);
  newNode = _.cloneDeep(node);

  opEqFacs.forEach((opEqFac, idx) => {
    opEqFac.oppos.forEach(opFac => {
      const path = opFac.path;
      _.get(oldNode, path).changeGroup = idx + 1;

      const negFac = Polynom.negate(_.get(newNode, path));
      const newFac = Node.Creator.parenthesis(Node.Creator.unaryMinus(negFac));
      _.set(newNode, path, newFac);
      _.get(newNode, path).changeGroup = idx + 1;
    });
  });

  steps.push(new Status(ChangeTypes.NEGATE_OP_FACS, oldNode, newNode));

  // Remove the brackets around the opposite factors,
  // merging all minuses into a single sign before the term
  oldNode = _.cloneDeep(newNode);
  newNode = _.cloneDeep(newNode);
  opEqFacs.forEach((opEqFac, idx) =>
    opEqFac.oppos.forEach(opFac => {
      // ChangeGroup will be the whole term
      _.get(newNode, opFac.termPath).changeGroup = idx + 1;

      // The opposite node has a unaryMinus inside parentheses in its top level
      // Remove this minus
      _.set(newNode, opFac.path, _.get(newNode, opFac.path).content.args[0]);

      // Now change the sign of the term
      // Go up the tree until we are at a node that is the second arg of a + or - operation
      let opPath = opFac.termPath;
      while (_.last(opPath.split('.')) !== 'args[1]'
             && opPath !== '') {
        opPath = Util.getParentPath(opPath);
      }

      let opNode;
      if (opPath === 'args[1]') {
        opPath = Util.getParentPath(opPath);
        opNode = (opPath !== '')
          ? _.get(newNode, opPath)
        // Else, the factor is in the 2nd arg of the top node
        // So the operation to negate is the top node
          : newNode;

        // Change the sign of that operation
        if (NodeType.isOperator(opNode, '+')) {
          if (opNode === newNode) {
            Util.modifyNode(newNode, Node.Creator.operator('-', opNode.args));
          }
          else {
            _.set(newNode, opPath, Node.Creator.operator('-', opNode.args));
          }
        }
        else if (NodeType.isOperator(opNode, '-')) {
          if (opNode === newNode) {
            Util.modifyNode(newNode, Node.Creator.operator('+', opNode.args));
          }
          else {
            _.set(newNode, opPath, Node.Creator.operator('+', opNode.args));
          }
        }
      }
      else {
        // opPath === ''
        // The factor is in the first arg of the top node
        // The factor term should be negated
        const term = _.get(newNode, opFac.termPath);
        if (NodeType.isUnaryMinus(term)) {
          _.set(newNode, opFac.termPath, term.args[0]);
        }
        else {
          _.set(newNode, opFac.termPath, Node.Creator.unaryMinus(term));
        }
      }
    })
  );
  steps.push(new Status(ChangeTypes.EQUALIZE_TERM_FACTORS, oldNode, newNode));


  oldNode = _.cloneDeep(newNode);
  Status.resetChangeGroups(oldNode);
  newNode = _.cloneDeep(oldNode);
  // Write all factors the same way
  opEqFacs.forEach((opEqFac, idx) => {
    const eqNode = opEqFac.equal[0].val;

    _.slice(opEqFac.equal, 1).forEach(eqFac => {
      if (eqNode.toString() !== eqFac.val.toString()) {
        _.get(oldNode, eqFac.path).changeGroup = idx + 1;

        _.set(newNode, eqFac.path, _.cloneDeep(eqNode));
        _.get(newNode, eqFac.path).changeGroup = idx + 1;
      }
    });

    opEqFac.oppos.forEach(opFac => {
      if (eqNode.toString() !== opFac.val.toString()) {
        _.get(oldNode, opFac.path).changeGroup = idx + 1;

        _.set(newNode, opFac.path, _.cloneDeep(eqNode));
        _.get(newNode, opFac.path).changeGroup = idx + 1;
      }
    });
  });
  if (oldNode.toString() !== newNode.toString()) {
    steps.push(new Status(ChangeTypes.EQUALIZE_TERM_FACTORS, oldNode, newNode));
  }

  // Compose the single step itself
  oldNode = _.cloneDeep(node);
  newNode = _.cloneDeep(Status.resetChangeGroups(_.last(steps).newNode));
  opEqFacs.forEach((opEqFac, idx) =>
    opEqFac.oppos.forEach(opFac => {
      _.get(newNode, opFac.termPath).changeGroup = idx + 1;
      _.get(oldNode, opFac.termPath).changeGroup = idx + 1;
    })
  );
  const step = new Status(ChangeTypes.EQUALIZE_TERM_FACTORS, oldNode, newNode, steps);
  return step;
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
  return [isolateComFacs(node)];
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
