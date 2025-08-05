// MongoDB migration script - compatible with init-mongo.js style
db = db.getSiblingDB('landing');

// Create collections
db.createCollection('user_logins');
db.createCollection('servers');

// Create indexes
db.user_logins.createIndex({ "userId": 1 });
db.user_logins.createIndex({ "loginTime": 1 });

db.servers.createIndex({ "server_name": 1 }, { unique: true });
db.servers.createIndex({ "is_official": 1 });
db.servers.createIndex({ "is_third_party": 1 });

// Insert initial server data if it doesn't exist
if (db.servers.countDocuments({ server_name: "Flagship" }) === 0) {
  db.servers.insertOne({
    server_name: "Flagship",
    server_address: "server.organicfreshcoffee.com",
    is_official: true,
    is_third_party: false,
    created_at: new Date(),
    updated_at: new Date()
  });
  print('Initial server data inserted');
}

print('Database migration completed successfully!');
