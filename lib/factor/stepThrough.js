const ChangeTypes = require('../ChangeTypes');
const checks = require('../checks');
const Node = require('../node');
const NodeType = require('../node/Type');
const Status = require('../node/Status');

const factorQuadratic = require('./factorQuadratic');

const flattenOperands = require('../util/flattenOperands');
const print = require('../util/print');
const removeUnnecessaryParens = require('../util/removeUnnecessaryParens');

const Polynom = require('../polynom/Polynom');
const Term = require('../term/Term');
const Util = require('../util/Util');

const _ = require('lodash');

function setChangeGroup(node, path, cgrp) {
  const parPath = Util.getParentPath(path);
  const parent = _.get(node, parPath);

  if (parent && NodeType.isParenthesis(parent)) {
    parent.changeGroup = cgrp;
  }
  else {
    node.changeGroup = cgrp;
  }
}

// Returns the steps to equalize the factors, i.e. when two factors are
// themselves polynomials and are opposite each other, this function negates
// the opposite factors such that they become equal to the other. This prepares
// the polynomial to have this factor isolated.
//
// e.g. '3 * (x - 1) + 2 * (1 - x)' becomes '3 * (x - 1) + 2 * (-1) * (x - 1)'
function equalizeFacs(node) {
  const steps = [];

  const opEqFacs = Polynom.opEqFacs(node);
  if (opEqFacs.length === 0) { return []; }

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
  oldNode = _.cloneDeep(oldNode);
  newNode = _.cloneDeep(oldNode);

  opEqFacs.forEach((opEqFac, idx) => {
    opEqFac.oppos.forEach(opFac => {
      const path = opFac.path;
      setChangeGroup(oldNode, path, idx + 1);

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
  opEqFacs.forEach(opEqFac =>
    opEqFac.oppos.forEach(opFac => {
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
      
      const opNode;
      if (opPath !== '') {
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
  clearChangeGroups(oldNode);
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
  newNode = _.cloneDeep(clearChangeGroups(_.last(steps).newNode));
  opEqFacs.forEach((opEqFac, idx) =>
    opEqFac.oppos.forEach(opFac => {
      _.get(newNode, opFac.termPath).changeGroup = idx + 1;
      _.get(oldNode, opFac.termPath).changeGroup = idx + 1;
    })
  );
  const step = new Status(ChangeTypes.EQUALIZE_TERM_FACTORS, oldNode, newNode, steps);
  return step;
}


// Returns the steps to isolate the common factors from a polynomial
function isolateComFacs(node) {
  const substeps = [];

  // First, simplify all FACTORS
  const oldNode = _.cloneDeep(node);
  const newNode = _.cloneDeep(node);
  const terms = Term.getTerms(newNode);
  // TODO way to use JSON paths as well here?
  terms.forEach(term => {
    Factor.getFactors(term).forEach(fac => {
      const newFac = simplify(fac);
      if (fac.toString() !== newFac.toString()) {
        Util.modifyNode(fac, newFac);
      }
    });
  });
  if (oldNode.toString() !== newNode.toString()) {
    substeps.push(new Status(ChangeTypes.ISOLATE_COMMON_FACTOR, oldNode, newNode));
  }

  // Factorize the coefficients into primes and expand symbols with exponents
  // Look for common parts
  // Put the common parts outside the brackets
  // Simplify the factors outside the brackets and the terms inside the brackets
  const terms = Term.getTerms(node);
  const comFacs = Term.getCommonFactors(terms);
  return Status.noChange(node);
}


// Given a mathjs expression node, takes the necessary steps to isolate the
// common factors in the expression
// Returns the steps taken
function isolate(node) {
  const steps = [];

  // Equalize the factors of the terms
  const facsEqSteps = equalizeFacs(node);
  if (facsEqSteps.length > 0) {
    steps.push(new Status(ChangeTypes.EQUALIZE_TERM_FACTORS,
      node,
      _.last(facsEqSteps).newNode,
      facsEqSteps));
    node = _.last(facsEqSteps).newNode;
  }

  // Isolate the common factors
  let isolSteps = isolateComFacs(node);
  if (isolSteps.length > 0) {
    steps.push(new Status(ChangeTypes.ISOLATE_COMMON_FACTOR,
                          oldNode=node,
                          newNode=_.last(isolSteps).newNode,
                          substeps=isolSteps));
  }
  return steps;
}

// Given a mathjs expression node, steps through factoring the expression.
// Returns a list of details about each step.
function stepThrough(node, debug=false) {
  return equalizeFacs(node);
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
