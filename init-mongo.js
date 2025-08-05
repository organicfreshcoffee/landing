// MongoDB initialization script
db = db.getSiblingDB('landing');

// Create the users collection
db.createCollection('user_logins');

// Create the servers collection
db.createCollection('servers');

// Create an index on the userId field for better performance
db.user_logins.createIndex({ "userId": 1 });
db.user_logins.createIndex({ "loginTime": 1 });

// Create indexes for servers collection
db.servers.createIndex({ "server_name": 1 });
db.servers.createIndex({ "is_official": 1 });
db.servers.createIndex({ "is_third_party": 1 });

// Insert initial server data if it doesn't exist
if (db.servers.countDocuments({ server_name: "Flagship" }) === 0) {
  db.servers.insertOne({
    server_name: "Flagship",
    server_address: "server.organicfreshcoffee.com",
    is_official: true,
    is_third_party: false
  });
  print('Initial server data inserted');
}

print('Database initialized successfully');
