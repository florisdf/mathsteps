// This module deals with getting constant factors, including prime factors
// and factor pairs of a number
const mathjs = require('mathjs');
const Symbols = require('../Symbols');
const NodeCreator = require('../node/Creator');

const ConstantFactors = {};

function splitFactors(node) {
  let factors = [];
  if (node.op === '*') {
    node.args.forEach(n => factors.push(...splitFactors(n)));
  } else if (node.op === '^') {
    if (node.args[1].valueType !== 'number') {
      // Exponent is not a number, just push the whole node as a factor
      factors.push(node);
    } else {
      const exp = Number(node.args[1].value);
      if (Number.isInteger(exp) && exp > 0) {
        // Expand the positive integer exponent as a long series of factors
        const baseFacs = splitFactors(node.args[0]);
        for (let i=0; i < exp; i++) {
          factors.push(...baseFacs);
        }
      } else {
        // Exponent is a number, but not a positive integer
        // Therefore, we can't expand it. Push the whole node as a factor.
        factors.push(node);
      }
    }
  } else {
    factors.push(node);
  }
  return factors;
}

function splitPrimes(numberNode) {
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
    factors = factors.concat(ConstantFactors.getPrimeFactors(quot));
  }

  return factors;
}

// Given a number, will return all the prime factors of that number as a list
// sorted from smallest to largest
ConstantFactors.getPrimeFactors = function(node){
  let factors = [];
  if (node.op && node.fn === 'unaryMinus'
      && node.args.length === 1
      && node.args[0].valueType === 'number') {
    factors = [NodeCreator.constant(-1)];
    node = node.args[0];
  }

  splitFactors(node).forEach(fac =>
    {
      if (fac.valueType === 'number') {
        factors.push(...splitPrimes(fac));
      } else {
        factors.push(fac);
      }
    }
  );

  return factors;
};

// Given a number, will return all the factor pairs for that number as a list
// of 2-item lists
ConstantFactors.getFactorPairs = function(number){
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

module.exports = ConstantFactors;
