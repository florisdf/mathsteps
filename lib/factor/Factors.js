// This module deals with getting constant factors, including prime factors
// and factor pairs of a number
const mathjs = require('mathjs');
const Symbols = require('../Symbols');
const NodeCreator = require('../node/Creator');

const Factors = {};

// Give a number Node, returns a list of the prime factors it is composed of.
// e.g. 12 becomes [2, 2, 3]
Factors.primeFactorize = function(numberNode) {
  let factors = [];
  const root = Math.sqrt(numberNode);
  let candidate = 2;
  if (numberNode % 2) {
    candidate = 3; // assign first odd
    while (numberNode % candidate && candidate <= root) {
      candidate = candidate + 2;
    }
  }

  // if no factor found then the numberNode is prime
  if (candidate > root) {
    factors.push(numberNode);
  }
  // if we find a factor, make a recursive call on the quotient of the number and
  // our newly found prime factor in order to find more factors
  else {
    factors.push(NodeCreator.constant(candidate));
    const quot = NodeCreator.constant(numberNode/candidate);
    factors = factors.concat(Factors.primeFactorize(quot));
  }

  return factors;
};

// Given an expression (symbolic or not), returns a list of all factors by
// simply splitting the top-level multiplications.
// e.g. 12x^2 * y^3 becomes [12, x^2, y^3]
Factors.splitMultcations = function(node) {
  let factors = [];
  if (node.op && node.fn === 'unaryMinus'
    && node.args.length === 1
    && node.args[0].valueType === 'number') {
    factors = [NodeCreator.constant(-1)];
    node = node.args[0];
  }

  if (node.op === '*') {
    node.args.forEach(n => factors.push(...Factors.splitMultcations(n)));
  } else {
    factors.push(node);
  }
  return factors;
}

// Given an expression (symbolic or not), returns a list of factors by
// splitting the top-level positive integer exponents.
// e.g. x^3 becomes [x, x, x]
// NOTE e.g. 3x^3 is not split because there is no top-level exponent,
// (3x)^3, however will be split into [3x, 3x, 3x]
Factors.factorizePowers = function(node) {
  let factors = [];
  if (node.op === '^') {
    if (node.args[1].valueType !== 'number') {
      // Exponent is not a number, just push the whole node as a factor
      factors.push(node);
    } else {
      const exp = Number(node.args[1].value);
      if (Number.isInteger(exp) && exp > 0) {
        // Expand the positive integer exponent as a long series of factors
        const baseFac = node.args[0];
        for (let i=0; i < exp; i++) {
          factors.push(baseFac);
        }
      } else {
        // Exponent is a number, but not a positive integer
        // Therefore, we can't expand it. Push the whole node as a factor.
        factors.push(node);
      }
    }
  } else {
    // There is no exponent. Push the whole node as a factor.
    factors.push(node);
  }
  return factors;
}

// Given an expression (symbolic or not), returns a list of all factors in the
// top level of the expression, factorizing all numbers into primes and
// expanding exponents into factors where possible
// e.g. 12x^2 * y^3 becomes [2, 2, 3, x, x, y, y, y]
Factors.getFactors = function(node){
  let factors = [];
  Factors.splitMultcations(node).forEach(fac =>
    {
      if (fac.valueType === 'number' && fac.value !== '-1') {
        factors.push(...Factors.primeFactorize(fac));
      } else if (fac.op === '^') {
        factors.push(
          ...Factors.factorizePowers(fac)
          .map(f => Factors.getFactors(f)));
      } else {
        factors.push(fac);
      }
    }
  );

  return factors;
};

// Given an expression (symbolic or not), factorizes the expression and returns
// a dictionary with the factor as key and the number of times it occured as
// value.
// e.g. 12x^2 * y^3 becomes {2: 2, 3: 1, x: 2, y: 3}
Factors.getFactorCounts = function(node) {
  let factors = Factors.getFactors(node);
  let keys = new Set(factors);

  let factorCounts = {};
  keys.forEach(k => factorCounts[k] = 0);
  factors.forEach(f => factorCounts[f] += 1);
  return factorCounts;
}

// Given a number, will return all the factor pairs for that number as a list
// of 2-item lists
Factors.getFactorPairs = function(number){
  const factors = [];

  const bound = Math.floor(Math.sqrt(Math.abs(number)));
  for (var divisor = -bound; divisor <= bound; divisor++) {
    if (divisor === 0) {
      continue;
    }
    if (number % divisor === 0) {
      const quotient = number / divisor;
      factors.push([divisor, quotient]);
    }
  }

  return factors;
};

module.exports = Factors;
