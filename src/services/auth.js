'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

function generateId() {
  return crypto.randomUUID();
}

function hashPassword(password) {
  const salt = bcrypt.genSaltSync(config.bcryptSaltRounds);
  return bcrypt.hashSync(password, salt);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

module.exports = {
  generateId,
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
};
