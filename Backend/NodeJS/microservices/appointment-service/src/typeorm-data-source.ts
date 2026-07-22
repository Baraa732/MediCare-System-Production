import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'postgres-appointment',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'appointment_db',
  migrations: [__dirname + '/appointment/migrations/*.js', __dirname + '/appointment/migrations/*.ts'],
  migrationsTableName: 'appointment_migrations',
  migrationsTransactionMode: 'each',
});
