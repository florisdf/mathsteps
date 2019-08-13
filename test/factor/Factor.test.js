const _ = require('lodash');
const assert = require('assert');
const mathjs = require('mathjs');

const Factor = require('../../lib/factor/Factor');

const TestUtil = require('../TestUtil');


function testSplitNumberPrimes(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Factor.splitNumberPrimes(expression);

    assert.equal(out.every(o => typeof o === 'object'), true);
    assert.deepEqual(out.map(n => n.toString()), expectOut);
  });
}

describe('split number into primes', function() {
  const tests = [
    ['1', ['1']],
    ['-1', ['-1']],
    ['-2', ['-1', '2']],
    ['5', ['5']],
    ['12', ['2', '2', '3']],
    ['15', ['3', '5']],
    ['36', ['2', '2', '3', '3']],
    ['49', ['7', '7']],
    ['1260', ['2', '2', '3', '3', '5', '7']],
    ['13195', ['5', '7', '13', '29']],
    ['1234567891', ['1234567891']],
  ];
  tests.forEach(t => testSplitNumberPrimes(t[0], t[1]));
});


function testGetFactors(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Factor.getFactors(expression);
    assert.equal(out.every(o => typeof o === 'object'), true);
    assert.deepEqual(
      out.map(n => n.toString()),
      expectOut);
  });
}

describe('get factors', function() {
  const tests = [
    ['2x', ['2', 'x']],
    ['x^2', ['x ^ 2']],
    ['6x^2*7*y^3', ['6', 'x ^ 2', '7', 'y ^ 3']],
    ['(1/2)x^2', ['(1 / 2)', 'x ^ 2']],
    ['(x - 1)*(1 - x)', ['(x - 1)', '(1 - x)']],
    ['-b*(1 - x)', ['-b', '(1 - x)']],
  ];
  tests.forEach(t => testGetFactors(t[0], t[1]));
});


function testGetFactorPaths(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Factor.getFactorPaths(expression);
    assert.deepEqual(out, expectOut);
  });
}

describe('get factor paths', function() {
  const tests = [
    ['2x', ['args[0]', 'args[1]']],
    ['x^2', ['']],
    ['6x^2*7*y^3',
      ['args[0].args[0].args[0]', 'args[0].args[0].args[1]',
        'args[0].args[1]', 'args[1]']],
    ['(1/2)x^2', ['args[0]', 'args[1]']],
  ];
  tests.forEach(t => testGetFactorPaths(t[0], t[1]));
});


function testFullSplit(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Factor.fullSplit(expression);
    assert.equal(out.every(o => typeof o === 'object'), true);
    assert.deepEqual(
      out.map(n => n.toString()),
      expectOut);
  });
}

describe('get full factor split', function() {
  const tests = [
    ['x', ['x']],
    ['-x', ['-x']],
    ['-1 * x', ['-1', 'x']],
    ['-3x', ['-1', '3', 'x']],
    ['1/x', ['1 / x']],
    ['1/x^2', ['1 / x', '1 / x']],
    ['2x', ['2', 'x']],
    ['x^2', ['x', 'x']],
    ['6x^2*7*y^3', ['2', '3', 'x', 'x', '7', 'y', 'y', 'y']],
    ['(1/2)x^2', ['1 / 2', 'x', 'x']],
    ['(1/4)x^2', ['1 / 2', '1 / 2', 'x', 'x']],
    ['x^2/6', ['x', 'x', '1 / 2', '1 / 3']],
    ['1/(4)', ['1 / 2', '1 / 2']],
    ['6/(35x^2)', ['2', '3', '1 / 5', '1 / 7', '1 / x', '1 / x']],
    ['6/35/x^2', ['2', '3', '1 / 5', '1 / 7', '1 / x', '1 / x']],
    ['(x + 1)*5', ['x + 1', '5']],
    ['(x - 1)*(1 - x)', ['x - 1', '1 - x']],
    ['a*(x - 1)', ['a', 'x - 1']],
    ['-b*(1 - x)', ['-b', '1 - x']],
  ];
  tests.forEach(t => testFullSplit(t[0], t[1]));
});


function testFactorsRefConsistence(expr, exprPath, facsPath) {
  it(expr + ' factors ref consistence', function () {
    const exprNode = mathjs.parse(expr);
    const facs = Factor.getFactors(exprNode);
    assert.equal(_.get(exprNode, exprPath), _.get(facs, facsPath));
  });
}

describe('get factors ref consistence', function() {
  const tests = [
    ['1*2', 'args[0]', '[0]'],
    ['3x', 'args[1]', '[1]'],
    ['3x', 'args[0]', '[0]'],
  ];
  tests.forEach(t => testFactorsRefConsistence(t[0], t[1], t[2]));
});


function testFactorPairs(input, output) {
  TestUtil.testFunctionOutput(Factor.getFactorPairs, input, output);
}

describe('factor pairs', function() {
  const tests = [
    [1, [[-1, -1], [1, 1]]],
    [5, [[-1, -5], [1, 5]]],
    [12, [[-3, -4], [-2, -6], [-1, -12], [1, 12], [2, 6], [3, 4]]],
    [-12, [[-3, 4], [-2, 6], [-1, 12], [1, -12], [2, -6], [3, -4]]],
    [15, [[-3, -5], [-1, -15], [1, 15], [3, 5]]],
    [36, [[-6, -6], [-4, -9], [-3, -12], [-2, -18], [-1, -36], [1, 36], [2, 18], [3, 12], [4, 9], [6, 6,]]],
    [49, [[-7, -7], [-1, -49], [1, 49], [7, 7]]],
    [1260, [[-35, -36], [-30, -42], [-28, -45], [-21, -60], [-20, -63], [-18, -70], [-15, -84], [-14, -90], [-12, -105], [-10, -126], [-9, -140],  [-7, -180], [-6, -210], [-5, -252], [-4, -315],  [-3, -420], [-2, -630], [-1, -1260], [1, 1260], [2, 630], [3, 420], [4, 315], [5, 252], [6, 210], [7, 180], [9, 140], [10, 126], [12, 105], [14, 90], [15, 84], [18, 70], [20, 63], [21, 60], [28, 45], [30, 42], [35, 36]]],
    [13195, [[-91, -145], [-65, -203], [-35, -377], [-29, -455], [-13, -1015], [-7, -1885], [-5, -2639],  [-1, -13195], [1, 13195], [5, 2639], [7, 1885], [13, 1015], [29, 455], [35, 377], [65, 203], [91, 145]]],
    [1234567891, [[-1, -1234567891], [1, 1234567891]]]
  ];
  tests.forEach(t => testFactorPairs(t[0], t[1]));
});
