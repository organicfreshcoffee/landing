// MongoDB initialization script
db = db.getSiblingDB('landing');

// Create the users collection
db.createCollection('user_logins');

// Create an index on the userId field for better performance
db.user_logins.createIndex({ "userId": 1 });
db.user_logins.createIndex({ "loginTime": 1 });

print('Database initialized successfully');
