const Factors = require('../../lib/factor/Factors');
const mathjs = require('mathjs');
const assert = require('assert');

const TestUtil = require('../TestUtil');

function testFactors(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut.join(', '), function () {
    const expression = mathjs.parse(exprString);
    const out = Factors.getFactors(expression);
    assert.equal(out.every(o => typeof o === 'object'), true);
    assert.deepEqual(
      out.map(n => n.toString()),
      expectOut);
  });
}

describe('get factors', function() {
  const tests = [
    ['1', ['1']],
    ['-1', ['-1', '1']],
    ['-2', ['-1', '2']],
    ['5', ['5']],
    ['12', ['2', '2', '3']],
    ['15', ['3', '5']],
    ['36', ['2', '2', '3', '3']],
    ['49', ['7', '7']],
    ['1260', ['2', '2', '3', '3', '5', '7']],
    ['13195', ['5', '7', '13', '29']],
    ['1234567891', ['1234567891']],

    ['x', ['x']],
    ['-x', ['-1', 'x']],
    ['-3x', ['-1', '3', 'x']],
    ['1/x', ['1 / x']],
    ['1/x^2', ['1 / x', '1 / x']],
    ['2x', ['2', 'x']],
    ['x^2', ['x', 'x']],
    ['6x^2*7*y^3', ['2', '3', 'x', 'x', '7', 'y', 'y', 'y']],
    ['(1/2)x^2', ['1 / 2', 'x', 'x']],
    ['x^2/6', ['x', 'x', '1 / 2', '1 / 3']],
    ['1/(4)', ['1 / 2', '1 / 2']],
    ['6/(35x^2)', ['2', '3', '1 / 5', '1 / 7', '1 / x', '1 / x']],
    ['(x + 1)*5', ['x + 1', '5']],
  ];
  tests.forEach(t => testFactors(t[0], t[1]));
});

function testFactorCounts(exprString, expectOut) {
  it(exprString + ' -> ' + expectOut, function () {
    const expression = mathjs.parse(exprString);
    const out = Factors.getFactorCounts(expression);

    let outStr = {};
    Object.keys(out).forEach(function (key) {
      outStr[key.toString()] = out[key];
    });
    assert.deepEqual(outStr, expectOut);
  });
}

describe('factor counts', function() {
  const tests = [
    ['x', {'x': 1}],
    ['12x', {'2': 2, '3': 1, 'x': 1}],
    ['12x^2', {'2': 2, '3': 1, 'x': 2}],
    ['12x^2 * y^3', {'2': 2, '3': 1, 'x': 2, 'y': 3}],
    ['12x^2 * 3y^3', {'2': 2, '3': 2, 'x': 2, 'y': 3}],
    ['(x + 1)*(1 + x)', {'x + 1': 2}],
    ['(x + 1)*(3 + x - 2)', {'x + 1': 2}],
    ['(x^2 + 1 - x)*(-x + 1 + x^2)', {'x ^ 2 - x + 1': 2}],
  ];
  tests.forEach(t => testFactorCounts(t[0], t[1]));
});

function testCommonFactors(terms, expectOut) {
  it(terms.join(', ') + ' -> ' + expectOut.join(', '), function () {
    const nodeTerms = terms.map(t => mathjs.parse(t));
    const out = Factors.getCommonFactors(nodeTerms);
    assert.deepEqual(out.map(n => n.toString()), expectOut);
  });
}

describe('common factors', function() {
  const tests = [
    [['4', '2'], ['2']],
    [['-4', '-2'], ['2', '-1']],
    [['12', '4'], ['2', '2']],
    [['12x^3', '4x^2'], ['2', '2', 'x', 'x']],
    [['6x * y^2', '9y * x^2'], ['3', 'x', 'y']],
    [['2x * 9y^2', '7x^2'], ['x']],
    [['x', 'y'], []],
    [['y^2/15', 'y/5'], ['y', '1 / 5']],
    [['(x + 1)*5', '15*(1 + x)'], ['5', 'x + 1']],
  ];
  tests.forEach(t => testCommonFactors(t[0], t[1]));
});

function testGcd(terms, expectOut) {
  it(terms.join(', ') + ' -> ' + expectOut, function () {
    const nodeTerms = terms.map(t => mathjs.parse(t));
    const out = Factors.gcd(nodeTerms);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('gcd', function() {
  const tests = [
    [['4', '2'], '2'],
    [['-4', '-2'], '-2'],
    [['12', '4'], '4'],
    [['12x^3', '4x^2'], '4 * x ^ 2'],
    [['6x * y^2', '9y * x^2'], '3 * x * y'],
    [['2x * 9y^2', '7x^2'], 'x'],
    [['x', 'y'], '1'],
    [['y^2/15', 'y/5'], 'y / 5'],
    [['(x + 1)*5', '15*(1 + x)'], '5 * (x + 1)'],
  ];
  tests.forEach(t => testGcd(t[0], t[1]));
});

function testFactorPairs(input, output) {
  TestUtil.testFunctionOutput(Factors.getFactorPairs, input, output);
}

function testDivide(term, divisor, expectOut) {
  it(`${term} by ${divisor}` + ' -> ' + expectOut, function () {
    const inTerm = mathjs.parse(term);
    const inDivisor = mathjs.parse(divisor);
    const out = Factors.divide(inTerm, inDivisor);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('divide factor', function() {
  const tests = [
    ['6', '3', '2'],
    ['x^2', 'x', 'x'],
    ['x^2 + x', 'x', 'x + 1'],
    ['x^2 - x', 'x', 'x - 1'],
    ['(x + 1) * x', 'x + 1', 'x'],
    ['(x + 1) * x + 3* (x + 1)', 'x + 1', 'x + 3'],
    ['3y^3 - 6y^2', '3y^2', 'y - 2'],
  ];
  tests.forEach(t => testDivide(t[0], t[1], t[2]));
});

function testIsolate(node, factor, expectOut) {
  it(`${factor} from ${node}` + ' -> ' + expectOut, function () {
    const inNode = mathjs.parse(node);
    const inFactor = mathjs.parse(factor);
    const out = Factors.isolate(inNode, inFactor);
    assert.deepEqual(out.toString(), expectOut);
  });
}

describe('isolate factor', function() {
  const tests = [
    ['x^2 + x', 'x', 'x * (x + 1)'],
    ['2 * (x + 1) - 3x * (1 + x)', 'x + 1', '(x + 1) * (2 - 3 * x)'],
    ['3y^3 - 6y^2', '3y^2', '3 * y ^ 2 * (y - 2)'],
    ['3x^2 * y^3 - 6y^2 * x', '3y^2 * x', '3 * y ^ 2 * x * (x * y - 2)'],
  ];
  tests.forEach(t => testIsolate(t[0], t[1], t[2]));
});

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
