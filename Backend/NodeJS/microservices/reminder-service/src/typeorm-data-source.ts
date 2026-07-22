import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'postgres-reminder',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'reminder_db',
  migrations: [__dirname + '/reminder/migrations/*.js', __dirname + '/reminder/migrations/*.ts'],
  migrationsTableName: 'reminder_migrations',
  migrationsTransactionMode: 'each',
});
