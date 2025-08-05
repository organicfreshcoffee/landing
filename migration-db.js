const { MongoClient } = require('mongodb');

// Configuration
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017';
const DB_NAME = process.env.DB_NAME || 'landing';

class DatabaseMigration {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      console.log('Connecting to MongoDB...');
      this.client = new MongoClient(MONGO_URL);
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      console.log(`Connected to database: ${DB_NAME}`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    }
  }

  async createCollections() {
    console.log('Creating collections...');
    
    // Collections to create
    const collections = ['user_logins', 'servers'];
    
    const existingCollections = await this.db.listCollections().toArray();
    const existingNames = existingCollections.map(col => col.name);
    
    for (const collectionName of collections) {
      if (!existingNames.includes(collectionName)) {
        await this.db.createCollection(collectionName);
        console.log(`✅ Created collection: ${collectionName}`);
      } else {
        console.log(`⏭️  Collection already exists: ${collectionName}`);
      }
    }
  }

  async createIndexes() {
    console.log('Creating indexes...');
    
    // User logins indexes
    try {
      await this.db.collection('user_logins').createIndex({ "userId": 1 });
      console.log('✅ Created index on user_logins.userId');
    } catch (error) {
      console.log('⏭️  Index already exists: user_logins.userId');
    }

    try {
      await this.db.collection('user_logins').createIndex({ "loginTime": 1 });
      console.log('✅ Created index on user_logins.loginTime');
    } catch (error) {
      console.log('⏭️  Index already exists: user_logins.loginTime');
    }

    // Servers indexes
    try {
      await this.db.collection('servers').createIndex({ "server_name": 1 }, { unique: true });
      console.log('✅ Created unique index on servers.server_name');
    } catch (error) {
      console.log('⏭️  Index already exists: servers.server_name');
    }

    try {
      await this.db.collection('servers').createIndex({ "is_official": 1 });
      console.log('✅ Created index on servers.is_official');
    } catch (error) {
      console.log('⏭️  Index already exists: servers.is_official');
    }

    try {
      await this.db.collection('servers').createIndex({ "is_third_party": 1 });
      console.log('✅ Created index on servers.is_third_party');
    } catch (error) {
      console.log('⏭️  Index already exists: servers.is_third_party');
    }
  }

  async seedInitialData() {
    console.log('Seeding initial data...');
    
    // Insert initial server data if it doesn't exist
    const existingFlagshipServer = await this.db.collection('servers')
      .findOne({ server_name: "Flagship" });
    
    if (!existingFlagshipServer) {
      await this.db.collection('servers').insertOne({
        server_name: "Flagship",
        server_address: "server.organicfreshcoffee.com",
        is_official: true,
        is_third_party: false,
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('✅ Inserted initial Flagship server data');
    } else {
      console.log('⏭️  Flagship server data already exists');
    }

    // Add more seed data as needed
    const serverCount = await this.db.collection('servers').countDocuments();
    console.log(`Total servers in database: ${serverCount}`);
  }

  async runMigrations() {
    console.log('Running database migrations...');
    
    // Migration 1: Add timestamps to existing servers
    await this.addTimestampsToServers();
    
    // Migration 2: Ensure all servers have required fields
    await this.normalizeServerDocuments();
    
    console.log('✅ All migrations completed');
  }

  async addTimestampsToServers() {
    console.log('Migration: Adding timestamps to servers...');
    
    const serversWithoutTimestamps = await this.db.collection('servers')
      .find({
        $or: [
          { created_at: { $exists: false } },
          { updated_at: { $exists: false } }
        ]
      }).toArray();

    if (serversWithoutTimestamps.length > 0) {
      const now = new Date();
      await this.db.collection('servers').updateMany(
        {
          $or: [
            { created_at: { $exists: false } },
            { updated_at: { $exists: false } }
          ]
        },
        {
          $set: {
            created_at: now,
            updated_at: now
          }
        }
      );
      console.log(`✅ Added timestamps to ${serversWithoutTimestamps.length} servers`);
    } else {
      console.log('⏭️  All servers already have timestamps');
    }
  }

  async normalizeServerDocuments() {
    console.log('Migration: Normalizing server documents...');
    
    // Ensure all servers have boolean flags
    await this.db.collection('servers').updateMany(
      { is_official: { $exists: false } },
      { $set: { is_official: false } }
    );

    await this.db.collection('servers').updateMany(
      { is_third_party: { $exists: false } },
      { $set: { is_third_party: true } }
    );

    console.log('✅ Normalized server documents');
  }

  async validateDatabase() {
    console.log('Validating database state...');
    
    // Check collections exist
    const collections = await this.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const requiredCollections = ['user_logins', 'servers'];
    const missingCollections = requiredCollections.filter(name => !collectionNames.includes(name));
    
    if (missingCollections.length > 0) {
      throw new Error(`Missing collections: ${missingCollections.join(', ')}`);
    }

    // Check indexes exist
    const userLoginsIndexes = await this.db.collection('user_logins').listIndexes().toArray();
    const serversIndexes = await this.db.collection('servers').listIndexes().toArray();
    
    console.log(`✅ user_logins collection has ${userLoginsIndexes.length} indexes`);
    console.log(`✅ servers collection has ${serversIndexes.length} indexes`);

    // Check data integrity
    const serverCount = await this.db.collection('servers').countDocuments();
    const loginCount = await this.db.collection('user_logins').countDocuments();
    
    console.log(`✅ Database contains ${serverCount} servers and ${loginCount} user logins`);
    console.log('✅ Database validation completed successfully');
  }

  async run() {
    try {
      await this.connect();
      await this.createCollections();
      await this.createIndexes();
      await this.seedInitialData();
      await this.runMigrations();
      await this.validateDatabase();
      
      console.log('🎉 Database migration completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new DatabaseMigration();
  migration.run();
}

module.exports = DatabaseMigration;
