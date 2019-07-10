// This module deals with getting constant factors, including prime factors
// and factor pairs of a number
const mathjs = require('mathjs');

const ConstantFactors = {};

// Given a number, will return all the prime factors of that number as a list
// sorted from smallest to largest
ConstantFactors.getPrimeFactors = function(node){
  let factors = [];
  if (node.op && node.fn === 'unaryMinus'
      && node.args.length === 1
      && node.args[0].valueType === 'number') {
    factors = [mathjs.parse(-1)];
    node = mathjs.parse(node.args[0].toString());
  }

  // Remove all symbols

  const root = Math.sqrt(node);
  let candidate = 2;
  if (node % 2) {
    candidate = 3; // assign first odd
    while (node % candidate && candidate <= root) {
      candidate = candidate + 2;
    }
  }

  // if no factor found then the node is prime
  if (candidate > root) {
    factors.push(node);
  }
  // if we find a factor, make a recursive call on the quotient of the number and
  // our newly found prime factor in order to find more factors
  else {
    factors.push(mathjs.parse(candidate));
    const quot = mathjs.parse(node/candidate);
    factors = factors.concat(ConstantFactors.getPrimeFactors(quot));
  }

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
