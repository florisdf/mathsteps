// This module deals with getting constant factors, including prime factors
// and factor pairs of a number
const _ = require('lodash');
const math = require('mathjs');

const Node = require('../node');
const NodeCreator = require('../node/Creator');
const NodeType = require('../node/Type');

const Factor = {};

// Give a number Node, returns a list of the prime factors it is composed of.
// e.g. 12 becomes [2, 2, 3]
//      -12 becomes [-1, 2, 2, 3]
Factor.splitNumberPrimes = function(numberNode) {
  let factors = [];

  if (NodeType.isConstantOrConstantFraction(numberNode, true)) {
    if (NodeType.isUnaryMinus(numberNode)) {
      factors.push(NodeCreator.constant(-1));
      if (numberNode.args[0].value === '1') {
        // Don't push '1' if '-1' was the value of the number
        return factors;
      }
      numberNode = numberNode.args[0];
    }

    if (NodeType.isConstantFraction(numberNode)) {
      const numer = numberNode.args[0];
      const denom = numberNode.args[1];
      const numerFacs = Factor.splitNumberPrimes(numer);
      const denomFacs = Factor.splitNumberPrimes(denom);
      if (numerFacs.length === 1 && denomFacs.length === 1) {
        // No splitting happened, just return the original node
        return [numberNode];
      }

      return [...numerFacs.filter(f => f.value !== '1'),
        ...denomFacs.map(f => Node.Creator.operator('/', [math.parse('1'), f]))];
    }
  }
  else {
    // Node is not a number or a fraction
    return [numberNode];
  }

  const origNode = numberNode;
  numberNode = math.simplify(numberNode);
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
    // Push origNode for reference consistence
    factors.push(origNode);
  }
  // if we find a factor, make a recursive call on the quotient of the number and
  // our newly found prime factor in order to find more factors
  else {
    factors.push(NodeCreator.constant(candidate));
    const quot = NodeCreator.constant(numberNode/candidate);
    factors = factors.concat(Factor.splitNumberPrimes(quot));
  }

  return factors;
};

// Given an expression (symbolic or not), returns a list of the JSON paths of
// all factors by simply splitting the top-level multiplications.
// e.g. 12x^2 * y^3 becomes ['args[0].args[0]', 'args[0].args[1]', 'args[1]']
Factor.getFactorPaths = function(node) {
  const factors = [];

  if (NodeType.isOperator(node, '*')) {
    node.args.forEach((n, idx) =>
      factors.push(
        ...Factor.getFactorPaths(n)
          .map(path => {
            if (path) {
              return `args[${idx}].${path}`;
            }
            else {
              return `args[${idx}]`;
            }
          })
      )
    );
  }
  else {
    factors.push('');
  }
  return factors;
};

// Given an expression (symbolic or not), returns a list of all factors by
// simply splitting the top-level multiplications.
// e.g. 12x^2 * y^3 becomes [12, x^2, y^3]
//      -12x^2 * y^3 becomes [-12, x^2, y^3]
Factor.getFactors = function(node) {
  const factors = [];
  factors.push(...Factor.getFactorPaths(node).map(p => {
    if (!p) {
      return node;
    }
    else {
      return _.get(node, p);
    }
  }));

  return factors;
};

// Given an expression (symbolic or not), returns a list of factors by
// splitting the top-level positive integer exponents.
// e.g. x^3 becomes [x, x, x]
// NOTE e.g. 3x^3 is not split because there is no top-level exponent,
// (3x)^3, however will be split into [3x, 3x, 3x]
Factor.factorizePowers = function(node) {
  const factors = [];
  if (node.op === '^') {
    if (node.args[1].valueType !== 'number') {
      // Exponent is not a number, just push the whole node as a factor
      factors.push(node);
    }
    else {
      const exp = Number(node.args[1].value);
      if (Number.isInteger(exp) && exp > 0) {
        // Expand the positive integer exponent as a long series of factors
        const baseFac = node.args[0];
        for (let i=0; i < exp; i++) {
          factors.push(baseFac);
        }
      }
      else {
        // Exponent is a number, but not a positive integer
        // Therefore, we can't expand it. Push the whole node as a factor.
        factors.push(node);
      }
    }
  }
  else {
    // There is no exponent. Push the whole node as a factor.
    factors.push(node);
  }
  return factors;
};

// Given an expression (symbolic or not), returns a list of all factors in the
// top level of the expression, factorizing all numbers into primes and
// expanding exponents into factors where possible
// e.g. 12x^2 * y^3 becomes [2, 2, 3, x, x, y, y, y]
//      -12x^2 * y^3 becomes [-1, 2, 2, 3, x, x, y, y, y]
//      -3x becomes [-1, 3, x]
Factor.fullSplit = function(node) {
  if (node.op === '/') {
    const factors = [];
    if (node.args[0].value !== '1') {
      // Add the numerator as factors
      const numerFacs = Factor.fullSplit(node.args[0]);
      factors.push(...numerFacs);
    }
    if (node.args[1].value !== '1') {
      // Factor the denominator and add the inverse of each as a factor
      const denomFacs = Factor.fullSplit(node.args[1]);

      factors.push(...denomFacs.map(
        d => NodeCreator.operator('/',
          [NodeCreator.constant(1), d])));
    }
    return factors;
  }

  const multFacs = Factor.getFactors(node);

  const primeFacs = [];
  multFacs.forEach(fac =>
    primeFacs.push(...Factor.splitNumberPrimes(fac)));

  const powExpandFacs = [];
  primeFacs.forEach(fac =>
    powExpandFacs.push(...Factor.factorizePowers(fac)));

  return powExpandFacs;
};

// Given a number, will return all the factor pairs for that number as a list
// of 2-item lists
Factor.getFactorPairs = function(number){
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

module.exports = Factor;
