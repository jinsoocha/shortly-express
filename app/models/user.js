var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var utility = require('../../lib/utility');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      model.set('password', utility.hashing(model.get('password') + model.get('salt')));
    });
  }
});

module.exports = User;