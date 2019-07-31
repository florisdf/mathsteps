const assert = require('assert');
const mathjs = require('mathjs');

const Util = require('../../lib/util/Util');

describe('appendToArrayInObject', function () {
  it('creates empty array', function () {
    const object = {};
    Util.appendToArrayInObject(object, 'key', 'value');
    assert.deepEqual(
      object,
      {'key': ['value']}
     );
  });
  it('appends to array if it exists', function () {
    const object = {'key': ['old_value']};
    Util.appendToArrayInObject(object, 'key', 'new_value');
    assert.deepEqual(
      object,
      {'key': ['old_value', 'new_value']}
     );
  });
});

function testHaveSameNodes(arr1, arr2, expectOut) {
  it('[' + arr1.join(', ') + '] and [' + arr2.join(', ') + ']'
    + ' -> ' + expectOut, function () {
      const arr1Nodes = arr1.map(n => mathjs.parse(n));
      const arr2Nodes = arr2.map(n => mathjs.parse(n));
      const out = Util.haveSameNodes(arr1, arr2);
      assert.equal(out, expectOut);
  });
}

describe('have same nodes', function() {
  const tests = [
    [ ['x'], ['x'], true ],
    [ ['x', 'y'], ['y', 'x'], true ],
    [ ['x', 'y'], ['x'], false ],
    [ ['x', 'y'], ['x', 'z'], false ],
    [ ['-2', 'x^2 - 3', '6 - y'], ['6 - y', '-2', 'x^2 - 3'], true ],
  ];
  tests.forEach(t => testHaveSameNodes(t[0], t[1], t[2]));
});
