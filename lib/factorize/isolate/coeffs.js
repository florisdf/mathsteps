const ChangeTypes = require('../../ChangeTypes');
const Factor = require('../../factor/Factor');
const Node = require('../../node');
const Polynom = require('../../polynom/Polynom');


// Factorize the coefficients of the terms in the node into primes
function splitCoeffsIntoPrimesStep(node) {
  return Polynom.iterateTermFacsWithStep(node, ChangeTypes.FACTOR_COEFFS_INTO_PRIMES,
    (termPath, facPath, oldNode, newNode, term, fac) => {
      const primes = Factor.splitNumberPrimes(fac);

      if (primes.length > 1) {
        return Node.Creator.operator('*', primes, false, true);
      }
    });
}

module.exports = splitCoeffsIntoPrimesStep;
