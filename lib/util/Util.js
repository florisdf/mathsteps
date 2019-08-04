/*
  Various utility functions used in the math stepper
 */
const Util = {};

// Adds `value` to a list in `dict`, creating a new list if the key isn't in
// the dictionary yet. Returns the updated dictionary.
Util.appendToArrayInObject = function(dict, key, value) {
  if (dict[key]) {
    dict[key].push(value);
  }
  else {
    dict[key] = [value];
  }
  return dict;
};

// Returns whether two lists contain the same nodes in the same amounts,
// irrespective of their order.
// e.g. [x, y, -2x] and [-2x, x, y] returns true
//      [x, x, y] and [x, y] returns false
Util.haveSameNodes = function(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }

  const arr1Str = arr1.map(n => n.toString());
  const arr2Str = arr2.map(n => n.toString());
  arr1Str.forEach(n1 => {
    let idx = arr2Str.indexOf(n1);
    if (idx > -1) {
      arr2Str.splice(idx, 1);
    }
  });

  return arr2Str.length === 0;
}

// Puts the new node in the reference of the old node
Util.modifyNode = function (node, newNode) {
  Object.keys(node).forEach(function(key) {
    delete node[key];
  });

  Object.keys(newNode).forEach(function(key) {
    node[key] = newNode[key];
  });
}

module.exports = Util;
