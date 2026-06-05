const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'données');
if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

function getUser(userId) {
  const file = path.join(DB_PATH, `${userId}.json`);
  if (!fs.existsSync(file)) {
    const defaultData = {
      userId,
      cash: 500,
      bank: 0,
      inventory: [],
      vehicle: [],
      appartement: [],
      history: []
    };
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(file));
}

function saveUser(userId, data) {
  const file = path.join(DB_PATH, `${userId}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getItems() {
  const file = path.join(DB_PATH, 'items.json');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([], null, 2));
    return [];
  }
  return JSON.parse(fs.readFileSync(file));
}

function saveItems(items) {
  const file = path.join(DB_PATH, 'items.json');
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
}

function getConfig() {
  const file = path.join(DB_PATH, 'config.json');
  if (!fs.existsSync(file)) {
    const defaultConfig = { modRole: null, adminRole: null };
    fs.writeFileSync(file, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
  return JSON.parse(fs.readFileSync(file));
}

function saveConfig(config) {
  const file = path.join(DB_PATH, 'config.json');
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
}

function addHistory(userId, action, amount) {
  const user = getUser(userId);
  const entry = {
    action,
    amount,
    date: new Date().toLocaleString('fr-FR')
  };
  user.history.unshift(entry);
  if (user.history.length > 10) user.history = user.history.slice(0, 10);
  saveUser(userId, user);
}

module.exports = { getUser, saveUser, getItems, saveItems, getConfig, saveConfig, addHistory };
