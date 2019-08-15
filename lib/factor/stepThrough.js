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
const Polynom = require('../polynom/Polynom');
const Term = require('../term/Term');

const _ = require('lodash');
const math = require('mathjs');


function iterateTermFacs(node, callback) {
  Term.getTermPaths(node).forEach(termPath => {
    const term = _.get(node, termPath);
    Factor.getFactorPaths(term)
      .map(facPath => facPath
        ? `${termPath}.${facPath}`
        : termPath)
      .forEach(facPath => {
        const fac = _.get(node, facPath);
        callback(termPath, facPath, term, fac);
      });
  });
}


function iterateTermFacsWithStep(node, changeType, callback) {
  const oldNode = node.cloneDeep();
  const newNode = oldNode.cloneDeep();
  let cgrpCount = 0;
  iterateTermFacs(newNode, (termPath, facPath, term, fac) => {
    const newFac = callback(termPath, facPath, oldNode, newNode, term, fac);

    if (newFac) {
      _.get(oldNode, facPath).changeGroup = ++cgrpCount;

      if (NodeType.isUnaryMinus(newFac)) {
        _.set(newNode, facPath, Node.Creator.parenthesis(newFac));
      }
      else {
        _.set(newNode, facPath, newFac);
      }
      _.get(newNode, facPath).changeGroup = cgrpCount;
    }
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
  const oldNode = node.cloneDeep();
  const newNode = node.cloneDeep();
  const termPaths = Term.getTermPaths(newNode);
  let cgrpCount = 0;
  let simplSubsteps = [];
  let facSubStepNode = Status.resetChangeGroups(oldNode.cloneDeep());
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
          const newFac = _.last(simplFacSteps).newNode.cloneDeep();
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
  return iterateTermFacsWithStep(node, ChangeTypes.FACTOR_COEFFS_INTO_PRIMES,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      const primes = Factor.splitNumberPrimes(fac);

      if (primes.length > 1) {
        return Node.Creator.operator('*', primes, false, true);
      }
    });
}

// Simplify the exponent
// e.g. x^(2 + 3) -> x^5
//      x^2^3 -> x^6
function simplifyExponents(node) {
  const firstNode = node.cloneDeep();

  let oldNode = firstNode.cloneDeep();
  const substeps = [];

  // First, collapse the exponents
  const collapseStep = iterateTermFacsWithStep(node, ChangeTypes.COLLAPSE_EXPONENTS,
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
  const simplifyStep = iterateTermFacsWithStep(oldNode, ChangeTypes.SIMPLIFY_EXPONENTS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      if (NodeType.isOperator(fac, '^')) {
        const expon = fac.args[1];
        let substeps = simplExpr(expon);
        if (substeps.length > 0) {
          substeps = Status.putStepsInNodePath(
            newNode.cloneDeep(),
            `${facPath}.args[1]`,
            substeps);
          simplifySubsteps = simplifySubsteps.concat(substeps);

          return _.get(_.last(simplifySubsteps).newNode, facPath).cloneDeep();
        }
      }
    }
  );

  if (simplifyStep.hasChanged()) {
    simplifyStep.substeps = simplifySubsteps;
    substeps.push(simplifyStep);
  }

  if (substeps.length > 0) {
    const lastNode = Status.resetChangeGroups(_.last(substeps).newNode.cloneDeep());
    const step = iterateTermFacsWithStep(firstNode, ChangeTypes.SIMPLIFY_EXPONENTS,
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
// e.g. x^(m + 1) -> x^m * x^1
function splitExponents(node) {
  return iterateTermFacsWithStep(node, ChangeTypes.SPLIT_EXPONENT_TERMS,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      if (!NodeType.isOperator(fac, '^')) {
        return;
      }

      let exp = fac.args[1];
      if (NodeType.isParenthesis(exp)) {
        exp = exp.content;
      }

      const expTerms = Term.getTerms(exp);

      if (expTerms.length > 1) {
        return Node.Creator.operator(
          '*',
          expTerms.map(exp => Node.Creator.operator('^', [fac.args[0], exp])),
          false, true);
      }
    });
}

function putEqualFacsOutsideParensStep(node) {
  const oldNode = _.cloneDeep(node);
  let newNode = _.cloneDeep(node);

  // Mark the equal factors
  const comFacPaths = Term.getCommonFactorPaths(oldNode);

  comFacPaths.forEach(term => {
    term.forEach(facPath => {
      _.get(oldNode, facPath).changeGroup = 1;
    });
  });

  // Isolate
  if (comFacPaths[0].length > 0) {
    const divisor = Node.Creator.operator('*',
      comFacPaths[0].map(facPath => _.get(newNode, facPath)),
      true, true);
    const quot = Polynom.naive_divide(node, divisor);
    newNode = Node.Creator.operator('*', [divisor,
      Node.Creator.parenthesis(quot)]);
    newNode.args[0].changeGroup = 1;

    return new Status(ChangeTypes.EQUAL_FACTORS_OUTSIDE_PARENS, oldNode, newNode);
  }
  else {
    return Status.noChange(node);
  }

}


function putExponFacsOutsideParensStep(node) {
  let oldNode = _.cloneDeep(node);
  let newNode = _.cloneDeep(node);
  const substeps = [];

  // Remove all exponents
  const tempNode = _.cloneDeep(newNode);
  iterateTermFacs(tempNode, (termPath, facPath, term, fac) => {
    if (NodeType.isOperator(fac, '^')) {
      _.set(tempNode, facPath, fac.args[0]);
    }
  });

  // Get equal factor paths in adjusted expression
  let addedExpOne = false;
  const facsWithExp = {};
  Term.getCommonFactorPaths(tempNode).forEach(term => {
    term.forEach(facPath => {
      // Use the path to obtain the original factor (with exponent)
      let fac = _.get(newNode, facPath);
      if (!NodeType.isOperator(fac, '^')) {
        fac = Node.Creator.operator('^', [fac, math.parse('1')]);
        _.set(newNode, facPath, fac);

        _.get(newNode, facPath).changeGroup = 1;
        _.get(oldNode, facPath).changeGroup = 1;
        addedExpOne = true;
      }

      if (NodeType.isOperator(fac, '^')) {
        let exp = fac.args[1];
        if (NodeType.isParenthesis(exp)) {
          exp = exp.content;
        }

        // Check if there is an integer in the factors of the exponent
        if (!Factor.getFactors(exp).some(expFac => NodeType.isConstant(expFac)
          && Number.isInteger(parseFloat(expFac.value)))) {
          // If not, multiply the exponent by 1

          fac.args[1] = Node.Creator.operator('*', [math.parse('1'), exp]);
          _.set(newNode, facPath, fac);

          _.get(newNode, facPath).changeGroup = 1;
          _.get(oldNode, facPath).changeGroup = 1;
          addedExpOne = true;
        }
      }

      // Push the facPath to a list of exponents with the same base
      const base = `${fac.args[0]}`;
      if (base in facsWithExp) {
        facsWithExp[base].push(facPath);
      }
      else {
        facsWithExp[base] = [facPath];
      }
    });
  });

  if (addedExpOne) {
    substeps.push(new Status(ChangeTypes.ADD_EXPONENT_OF_ONE,
      _.cloneDeep(oldNode), _.cloneDeep(newNode)));
    newNode = Status.resetChangeGroups(newNode);
    oldNode = newNode.cloneDeep();
  }

  // For each factor with a constant exponent, find the smallest exponent
  const minExpPerBase = {};
  _.forOwn(facsWithExp, (facPaths, base) => {
    const exps = facPaths.map(path => _.get(newNode, path).args[1]);

    if (exps.every(exp => NodeType.isConstant(exp)
      && Number.isInteger(parseFloat(exp.value))
      && parseInt(exp.value) > 0)) {
      // If all exponents are positive integer numbers,
      // find the smallest exponent
      minExpPerBase[base] = exps.reduce((acc, curVal) => acc < curVal ? acc : curVal);
    }
    else {
      const pseudoExpr =  Node.Creator.operator('+',
        exps.map(n => NodeType.isParenthesis(n) ? n.content : n),
        false, false);
      const comFacPaths = Term.getCommonFactorPaths(pseudoExpr);

      if (comFacPaths.length > 0 && comFacPaths[0].length > 0) {
        // The exponents have a common factor
        const comFacs = comFacPaths[0].map(p => _.get(pseudoExpr, p));

        // Store the common factor as a single expression
        const comFacsExpr = Node.Creator.operator('*', comFacs, false, true);

        // Remove the common factor from each exponent
        // and keep the first non-common factor
        const noComExps = exps.map(exp => {
          if (NodeType.isParenthesis(exp)) {
            exp = exp.content;
          }
          const noComs = Factor.getFactors(exp)
            .filter(fac => !_.includes(comFacs.map(f => `${f}`), `${fac}`));
          if (noComs.length > 0) {
            return Node.Creator.operator('*', noComs, false, true);
          }
          else {
            return math.parse('1');
          }
        });

        // Check if the non-common part are all positive integers
        if (noComExps.every(exp => NodeType.isConstant(exp)
          && Number.isInteger(parseFloat(exp.value))
          && parseInt(exp.value) > 0)) {
          // Find the smallest exponent and add the common part to it
          minExpPerBase[base] = Node.Creator.operator('*',
            [noComExps.reduce((acc, curVal) => acc < curVal ? acc : curVal),
              comFacsExpr]);
        }
      }
      // If the exponents don't fit in any of the above cases, ignore that base
    }
  });

  // Split the exponents of the factors with a larger exponent into the
  // smallest exponent + a rest-exponent
  let splitExpons = false;
  _.toPairs(facsWithExp).forEach(([base, facPaths], idx) => {
    const minExp = minExpPerBase[base];
    facPaths.forEach(facPath => {
      const fac = _.get(newNode, facPath);
      const exp = fac.args[1];
      if (exp !== minExp) {
        const newExp = math.simplify(Node.Creator.operator('-', [exp, minExp]));
        if (newExp.value === '0') {
          fac.args[1] = minExp, newExp;
        }
        else {
          fac.args[1] = Node.Creator.operator('+', [minExp, newExp]);
        }

        splitExpons = true;
      }
      _.get(newNode, facPath).changeGroup = idx + 1;
      _.get(oldNode, facPath).changeGroup = idx + 1;
    });
  });

  if (splitExpons) {
    substeps.push(new Status(ChangeTypes.SPLIT_INTEGER_EXPONENTS,
      _.cloneDeep(oldNode), _.cloneDeep(newNode)));
    oldNode = Status.resetChangeGroups(oldNode);
    newNode = Status.resetChangeGroups(newNode);
  }

  // Split the exponent terms
  const splitExponsStep = splitExponents(newNode);
  if (splitExponsStep.hasChanged()) {
    substeps.push(splitExponsStep);
    newNode = Status.resetChangeGroups(splitExponsStep.newNode.cloneDeep());
    oldNode = newNode.cloneDeep();
  }

  // Put the common factor outside the parentheses
  const eqFacsOutside = putEqualFacsOutsideParensStep(newNode);
  if (eqFacsOutside.hasChanged()) {
    substeps.push(eqFacsOutside);
    newNode = Status.resetChangeGroups(eqFacsOutside.newNode.cloneDeep());
    oldNode = newNode.cloneDeep();
  }

  // If there is an exponent "1" in the factor outside the parens, remove it
  let removedExponOne = false;
  Factor.getFactorPaths(newNode).forEach(facPath => {
    const fac = _.get(newNode, facPath);
    if (NodeType.isOperator(fac, '^')) {
      const expFacs = Factor.getFactors(fac.args[1]);
      const newExpFacs = expFacs.filter(expFac => expFac.value !== '1');
      if (newExpFacs.length < expFacs.length) {
        const newExp = Node.Creator.operator('*', newExpFacs, false, true);
        fac.args[1] = newExp;

        _.get(newNode, facPath).changeGroup = 1;
        _.get(oldNode, facPath).changeGroup = 1;
        removedExponOne = true;
      }
    }
  });
  if (removedExponOne) {
    substeps.push(new Status(ChangeTypes.REMOVE_EXPONENT_BY_ONE,
      _.cloneDeep(oldNode), _.cloneDeep(newNode)));
    oldNode = Status.resetChangeGroups(oldNode);
    newNode = Status.resetChangeGroups(newNode);
  }


  return new Status(ChangeTypes.EXPON_FACTORS_OUTSIDE_PARENS, oldNode, newNode, substeps);
}


// Returns the steps to isolate the common factors from a polynomial
function isolateComFacs(node) {
  const isolSubsteps = [];
  const oldNode = node.cloneDeep();
  let newNode = node.cloneDeep();

  const splitPrimes = splitCoeffsIntoPrimes(node);
  if (splitPrimes.hasChanged()) {
    isolSubsteps.push(splitPrimes);
    newNode = Status.resetChangeGroups(splitPrimes.newNode.cloneDeep());
  }

  const splitExpons = splitExponents(newNode);
  if (splitExpons.hasChanged()) {
    isolSubsteps.push(splitExpons);
    newNode = Status.resetChangeGroups(splitExpons.newNode.cloneDeep());
  }

  // Put the common factors outside the parentheses
  const eqFacsOutside = putEqualFacsOutsideParensStep(newNode);
  if (eqFacsOutside.hasChanged()) {
    isolSubsteps.push(eqFacsOutside);
    newNode = Status.resetChangeGroups(eqFacsOutside.newNode.cloneDeep());
  }

  // For common factors with different degrees, put the lowest degree outside
  // parens and subtract that degree from the remaining symbols
  const expFacsOutside = putExponFacsOutsideParensStep(newNode);
  if (expFacsOutside.hasChanged()) {
    isolSubsteps.push(expFacsOutside);
    newNode = Status.resetChangeGroups(expFacsOutside.newNode.cloneDeep());
  }

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
