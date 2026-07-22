import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'postgres-auth',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'auth_db',
  migrations: [__dirname + '/auth/migrations/*.js', __dirname + '/auth/migrations/*.ts'],
  migrationsTableName: 'auth_migrations',
  migrationsTransactionMode: 'each',
});
