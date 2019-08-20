const ChangeTypes = require('../../ChangeTypes');
const Status = require('../../node/Status');

const expon = require('./expon');
const putEqualFacsOutsideParensStep = require('./equalFacs');
const splitCoeffsIntoPrimes = require('./coeffs');

const equalizeFacs = require('./equalizeFactors');

/* Given a mathjs expression node, takes the necessary steps to isolate the
 common factors in the expression
 Returns the steps taken */
function isolate(node) {
  const oldNode = node.cloneDeep();
  let newNode = node.cloneDeep();
  const steps = [];

  // Equalize the factors of the terms
  const facsEqStep = equalizeFacs(node);
  if (facsEqStep.hasChanged()) {
    steps.push(facsEqStep);
    newNode = Status.resetChangeGroups(facsEqStep.newNode.cloneDeep());
  }

  const splitPrimes = splitCoeffsIntoPrimes(node);
  if (splitPrimes.hasChanged()) {
    steps.push(splitPrimes);
    newNode = Status.resetChangeGroups(splitPrimes.newNode.cloneDeep());
  }

  const splitExpons = expon.splitExponents(newNode);
  if (splitExpons.hasChanged()) {
    steps.push(splitExpons);
    newNode = Status.resetChangeGroups(splitExpons.newNode.cloneDeep());
  }

  // Put the common factors outside the parentheses
  const eqFacsOutside = putEqualFacsOutsideParensStep(newNode);
  if (eqFacsOutside.hasChanged()) {
    steps.push(eqFacsOutside);
    newNode = Status.resetChangeGroups(eqFacsOutside.newNode.cloneDeep());
  }

  // For common factors with different degrees, put the lowest degree outside
  // parens and subtract that degree from the remaining symbols
  const expFacsOutside = expon.putExponFacsOutsideParensStep(newNode);
  if (expFacsOutside.hasChanged()) {
    steps.push(expFacsOutside);
    newNode = Status.resetChangeGroups(expFacsOutside.newNode.cloneDeep());
  }

  if (steps.length === 0) {
    return Status.noChange(node);
  }
  else {
    return new Status(ChangeTypes.ISOLATE_COMMON_FACTOR, oldNode, newNode, steps);
  }
}

module.exports = isolate;
