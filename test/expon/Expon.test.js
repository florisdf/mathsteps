const assert = require('assert');
const mathjs = require('mathjs');

const Expon = require('../../lib/expon/Expon');

function testGetExponentPaths(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Expon.getExponentPaths(expression);
    assert.deepEqual(out, expectOut);
  });
}

describe('get exponent paths', function() {
  const tests = [
    ['x', ['']],
    ['x^2', ['args[1]']],
    ['x^2^m', ['args[1].args[0]', 'args[1].args[1]']],
    ['x^2^m^n', [
      'args[1].args[0]',
      'args[1].args[1].args[0]',
      'args[1].args[1].args[1]']],
    ['x^(2m)', ['args[1].content']],
    ['x^(m + 1)', ['args[1].content']],
    ['x^(2*(m + 1))', ['args[1].content']],
  ];
  tests.forEach(t => testGetExponentPaths(t[0], t[1]));
});

function testGetExponents(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Expon.getExponents(expression);
    assert.deepEqual(out.map(n => n.toString()), expectOut);
  });
}

describe('get exponents', function() {
  const tests = [
    ['x^2', ['2']],
    ['x^2^m', ['2', 'm']],
    ['x^(2m)', ['2 m']],
    ['x^(m + 1)', ['m + 1']],
    ['x^(2*(m + 1))', ['2 * (m + 1)']],
  ];
  tests.forEach(t => testGetExponents(t[0], t[1]));
});

function testCollapseExponents(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut, function () {
    const expression = mathjs.parse(exprString);
    const out = Expon.collapseExponents(expression);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('collapse exponents', function() {
  const tests = [
    ['x', 'x'],
    ['x^2', 'x ^ 2'],
    ['(x^2)^m', 'x ^ (2 * m)'],
    ['((x^2)^m)^n', 'x ^ (2 * m * n)'],
  ];
  tests.forEach(t => testCollapseExponents(t[0], t[1]));
});
